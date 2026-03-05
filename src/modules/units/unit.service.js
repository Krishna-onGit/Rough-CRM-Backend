import prisma from '../../config/database.js';
import { redis, CacheKeys, CacheTTL } from '../../config/redis.js';
import { logger } from '../../config/logger.js';
import {
    NotFoundError,
    BusinessRuleError,
    ConflictError,
} from '../../shared/errors.js';
import {
    parsePagination,
    buildPaginatedResponse,
    buildSingleResponse,
} from '../../shared/pagination.js';
import {
    buildSearchFilter,
    buildEnumFilter,
    cleanObject,
} from '../../shared/filters.js';
import {
    calculateUnitCost,
    formatCostSheetForDisplay,
    paiseToRupees,
} from '../../shared/costSheet.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const BLOCK_EXPIRY_HOURS = 48;

/**
 * getSpBlockCount — fetches active block count for a SP.
 * Primary source: Redis INCR counter.
 * Fallback (Redis unavailable): DB count query.
 *
 * @param {string} organizationId
 * @param {string} salesPersonId
 * @returns {number}
 */
const getSpBlockCount = async (organizationId, salesPersonId) => {
    const redisKey = `sp:blocks:${organizationId}:${salesPersonId}`;

    try {
        const cached = await redis.get(redisKey);
        if (cached !== null) return parseInt(cached, 10);
    } catch {
        // Redis unavailable — fall through to DB
        logger.warn('[BlockLimit] Redis unavailable, falling back to DB count', {
            salesPersonId,
        });
    }

    // DB fallback: count active blocks
    return prisma.unit.count({
        where: {
            organizationId,
            blockedBy: salesPersonId,
            status: 'blocked',
        },
    });
};

/**
 * incrementSpBlockCounter — atomically increments Redis counter.
 * Sets TTL of 48 hours on first increment.
 * Safe to call even if Redis is temporarily unavailable.
 */
const incrementSpBlockCounter = async (
    organizationId,
    salesPersonId
) => {
    const redisKey = `sp:blocks:${organizationId}:${salesPersonId}`;
    try {
        await redis.incr(redisKey);
        // Set TTL only if not already set (first block for this SP)
        const ttl = await redis.ttl(redisKey);
        if (ttl === -1) {
            await redis.expire(redisKey, BLOCK_EXPIRY_HOURS * 60 * 60); // 48h
        }
    } catch {
        logger.warn('[BlockLimit] Redis counter increment failed', {
            salesPersonId,
        });
        // Non-fatal — DB is source of truth, Redis is optimization
    }
};

/**
 * decrementSpBlockCounter — decrements Redis counter on release.
 * Called when a block is released or converted to booking.
 */
export const decrementSpBlockCounter = async (
    organizationId,
    salesPersonId
) => {
    if (!salesPersonId) return;
    const redisKey = `sp:blocks:${organizationId}:${salesPersonId}`;
    try {
        const current = await redis.get(redisKey);
        if (current !== null && parseInt(current, 10) > 0) {
            await redis.decr(redisKey);
        }
    } catch {
        logger.warn('[BlockLimit] Redis counter decrement failed', {
            salesPersonId,
        });
    }
};

const formatUnit = (unit) => ({
    ...unit,
    baseRate: paiseToRupees(unit.baseRate),
    basePrice: paiseToRupees(unit.basePrice),
    floorRise: paiseToRupees(unit.floorRise),
    plc: paiseToRupees(unit.plc),
    amenityCharge: paiseToRupees(unit.amenityCharge),
    agreementValue: paiseToRupees(unit.agreementValue),
    gstAmount: paiseToRupees(unit.gstAmount),
    stampDuty: paiseToRupees(unit.stampDuty),
    registration: paiseToRupees(unit.registration),
    totalPrice: paiseToRupees(unit.totalPrice),
    carpetArea: Number(unit.carpetArea) / 100,
    builtUpArea: Number(unit.builtUpArea) / 100,
    superBuiltUpArea: Number(unit.superBuiltUpArea) / 100,
});

// ── List Units ───────────────────────────────────────────────────────────────

export const listUnits = async (organizationId, query = {}) => {
    const { skip, take, page, pageSize } = parsePagination(query);

    const where = cleanObject({
        organizationId,
        projectId: query.projectId || undefined,
        towerId: query.towerId || undefined,
        status: buildEnumFilter(query.status),
        config: buildEnumFilter(query.config),
        floor: query.floor ? parseInt(query.floor) : undefined,
    });

    const searchFilter = buildSearchFilter(
        query.search,
        ['unitNumber', 'unitCode']
    );
    if (searchFilter) where.OR = searchFilter;

    const [units, total] = await Promise.all([
        prisma.unit.findMany({
            where,
            skip,
            take,
            orderBy: [{ floor: 'asc' }, { unitNumber: 'asc' }],
            select: {
                id: true,
                unitNumber: true,
                unitCode: true,
                floor: true,
                config: true,
                facing: true,
                status: true,
                totalPrice: true,
                agreementValue: true,
                superBuiltUpArea: true,
                parking: true,
                projectId: true,
                towerId: true,
                blockExpiresAt: true,
            },
        }),
        prisma.unit.count({ where }),
    ]);

    const formatted = units.map((u) => ({
        ...u,
        totalPrice: paiseToRupees(u.totalPrice),
        agreementValue: paiseToRupees(u.agreementValue),
        superBuiltUpArea: Number(u.superBuiltUpArea) / 100,
    }));

    // ── Lazy expiry pass on listed units ─────────────────────────────────────
    const now = new Date();
    const expiredUnitIds = formatted
        .filter(
            (u) =>
                u.status === 'blocked' &&
                u.blockExpiresAt &&
                new Date(u.blockExpiresAt) < now
        )
        .map((u) => u.id);

    if (expiredUnitIds.length > 0) {
        logger.info('[LazyExpiry] Releasing expired blocks in list', {
            count: expiredUnitIds.length,
        });

        // Fire-and-forget bulk release — do not block the response
        prisma.unit
            .updateMany({
                where: { id: { in: expiredUnitIds }, organizationId },
                data: {
                    status: 'available',
                    blockedBy: null,
                    blockedAt: null,
                    blockExpiresAt: null,
                    blockAgentId: null,
                },
            })
            .catch((err) =>
                logger.error('[LazyExpiry] Bulk release failed', {
                    err: err.message,
                })
            );

        // Update in-memory result so caller sees correct status now
        expiredUnitIds.forEach((id) => {
            const index = formatted.findIndex((u) => u.id === id);
            if (index !== -1) {
                formatted[index].status = 'available';
                formatted[index].blockedBy = null;
            }
        });
    }

    return buildPaginatedResponse(formatted, total, page, pageSize);
};

// ── Get Single Unit with Full Cost Sheet ─────────────────────────────────────

export const getUnit = async (organizationId, unitId) => {
    let unit = await prisma.unit.findFirst({
        where: { id: unitId, organizationId },
        include: {
            project: { select: { name: true, projectCode: true, settings: true } },
            tower: { select: { name: true } },
        },
    });
    if (!unit) throw new NotFoundError('Unit');

    // ── Lazy expiry: release expired blocks inline ────────────────────────────
    // Fallback for when Redis/BullMQ job is unavailable.
    // If a unit is blocked but its expiry has passed, release it
    // before returning so callers never see stale 'blocked' status.
    if (
        unit &&
        unit.status === 'blocked' &&
        unit.blockExpiresAt &&
        new Date() > new Date(unit.blockExpiresAt)
    ) {
        logger.info('[LazyExpiry] Releasing expired block inline', {
            unitId: unit.id,
            blockedBy: unit.blockedBy,
            blockExpiresAt: unit.blockExpiresAt,
        });

        // Decrement counter for the SP whose block expired
        await decrementSpBlockCounter(organizationId, unit.blockedBy);

        unit = await prisma.unit.update({
            where: { id: unit.id },
            data: {
                status: 'available',
                blockedBy: null,
                blockedAt: null,
                blockExpiresAt: null,
                blockAgentId: null,
            },
            include: {
                project: { select: { name: true, projectCode: true, settings: true } },
                tower: { select: { name: true } },
            },
        });
    }

    // Recalculate cost sheet for display
    const costSheet = calculateUnitCost({
        superBuiltUpArea: unit.superBuiltUpArea,
        baseRate: unit.baseRate,
        floor: unit.floor,
        facing: unit.facing,
        viewType: unit.viewType,
        parking: unit.parking,
        projectSettings: unit.project.settings || {},
        amenityCharge: unit.amenityCharge,
    });

    return buildSingleResponse({
        ...formatUnit(unit),
        costSheet: formatCostSheetForDisplay(costSheet),
    });
};

// ── Block Unit ───────────────────────────────────────────────────────────────

export const blockUnit = async (organizationId, unitId, userId, body) => {
    const unit = await prisma.unit.findFirst({
        where: { id: unitId, organizationId },
    });
    if (!unit) throw new NotFoundError('Unit');

    // Validate state machine transition
    if (unit.status !== 'available') {
        throw new BusinessRuleError(
            `Unit cannot be blocked. Current status: "${unit.status}". ` +
            `Only "available" units can be blocked.`
        );
    }

    // Verify sales person exists
    const salesPerson = await prisma.salesPerson.findFirst({
        where: { id: body.salesPersonId, organizationId, isActive: true },
    });
    if (!salesPerson) throw new NotFoundError('Sales person');

    // ── 3-block limit enforcement ─────────────────────────────────────────────
    const MAX_ACTIVE_BLOCKS = 3;

    const currentBlockCount = await getSpBlockCount(
        organizationId,
        body.salesPersonId
    );

    if (currentBlockCount >= MAX_ACTIVE_BLOCKS) {
        throw new BusinessRuleError(
            `Sales person has reached the maximum of ${MAX_ACTIVE_BLOCKS} ` +
            `active blocks. Release or convert an existing block to a ` +
            `booking before blocking another unit.`
        );
    }

    const blockedAt = new Date();
    const blockExpiresAt = new Date(
        blockedAt.getTime() + BLOCK_EXPIRY_HOURS * 60 * 60 * 1000
    );

    const updated = await prisma.unit.update({
        where: { id: unitId },
        data: {
            status: 'blocked',
            blockedBy: body.salesPersonId,
            blockedAt,
            blockExpiresAt,
            blockAgentId: body.agentId || null,
            updatedBy: userId,
        },
    });

    // Increment Redis counter after successful DB write
    await incrementSpBlockCounter(organizationId, body.salesPersonId);

    // Invalidate unit status cache (non-fatal)
    await redis.del(CacheKeys.unitStatus(unitId)).catch(() => {});

    return buildSingleResponse({
        id: updated.id,
        unitNumber: updated.unitNumber,
        status: updated.status,
        blockedAt: updated.blockedAt,
        blockExpiresAt: updated.blockExpiresAt,
        blockedBy: updated.blockedBy,
        message: `Unit blocked for ${BLOCK_EXPIRY_HOURS} hours. ` +
            `Expires at ${blockExpiresAt.toISOString()}.`,
    });
};

// ── Release Unit ─────────────────────────────────────────────────────────────

export const releaseUnit = async (organizationId, unitId, userId) => {
    const unit = await prisma.unit.findFirst({
        where: { id: unitId, organizationId },
    });
    if (!unit) throw new NotFoundError('Unit');

    if (unit.status !== 'blocked') {
        throw new BusinessRuleError(
            `Unit cannot be released. Current status: "${unit.status}". ` +
            `Only "blocked" units can be released.`
        );
    }

    const updated = await prisma.unit.update({
        where: { id: unitId },
        data: {
            status: 'available',
            blockedBy: null,
            blockedAt: null,
            blockExpiresAt: null,
            blockAgentId: null,
            updatedBy: userId,
        },
    });

    await redis.del(CacheKeys.unitStatus(unitId)).catch(() => {});

    return buildSingleResponse({
        id: updated.id,
        unitNumber: updated.unitNumber,
        status: updated.status,
        message: 'Unit released and available for booking.',
    });
};

// ── Record Token ─────────────────────────────────────────────────────────────

export const recordToken = async (organizationId, unitId, userId, body) => {
    const unit = await prisma.unit.findFirst({
        where: { id: unitId, organizationId },
    });
    if (!unit) throw new NotFoundError('Unit');

    if (unit.status !== 'blocked') {
        throw new BusinessRuleError(
            `Token can only be collected on a "blocked" unit. ` +
            `Current status: "${unit.status}".`
        );
    }

    const updated = await prisma.unit.update({
        where: { id: unitId },
        data: {
            status: 'token_received',
            updatedBy: userId,
        },
    });

    await redis.del(CacheKeys.unitStatus(unitId)).catch(() => {});

    return buildSingleResponse({
        id: updated.id,
        unitNumber: updated.unitNumber,
        status: updated.status,
        message: 'Token recorded. Unit status updated to token_received.',
    });
};

// ── Get Cost Sheet ────────────────────────────────────────────────────────────

export const getCostSheet = async (organizationId, unitId) => {
    const unit = await prisma.unit.findFirst({
        where: { id: unitId, organizationId },
        include: {
            project: {
                select: { name: true, projectCode: true, settings: true },
            },
            tower: { select: { name: true } },
        },
    });
    if (!unit) throw new NotFoundError('Unit');

    const costSheet = calculateUnitCost({
        superBuiltUpArea: unit.superBuiltUpArea,
        baseRate: unit.baseRate,
        floor: unit.floor,
        facing: unit.facing,
        viewType: unit.viewType,
        parking: unit.parking,
        projectSettings: unit.project.settings || {},
        amenityCharge: unit.amenityCharge,
    });

    return buildSingleResponse({
        unit: {
            id: unit.id,
            unitNumber: unit.unitNumber,
            unitCode: unit.unitCode,
            floor: unit.floor,
            config: unit.config,
            facing: unit.facing,
            superBuiltUpArea: Number(unit.superBuiltUpArea) / 100,
            status: unit.status,
            project: unit.project.name,
            tower: unit.tower.name,
        },
        costSheet: formatCostSheetForDisplay(costSheet),
    });
};
