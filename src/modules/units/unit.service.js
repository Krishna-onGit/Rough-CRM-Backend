import prisma from '../../config/database.js';
import { redis, CacheKeys, CacheTTL } from '../../config/redis.js';
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

    return buildPaginatedResponse(formatted, total, page, pageSize);
};

// ── Get Single Unit with Full Cost Sheet ─────────────────────────────────────

export const getUnit = async (organizationId, unitId) => {
    const unit = await prisma.unit.findFirst({
        where: { id: unitId, organizationId },
        include: {
            project: { select: { name: true, projectCode: true, settings: true } },
            tower: { select: { name: true } },
        },
    });
    if (!unit) throw new NotFoundError('Unit');

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

    // Invalidate unit status cache
    await redis.del(CacheKeys.unitStatus(unitId));

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

    await redis.del(CacheKeys.unitStatus(unitId));

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

    await redis.del(CacheKeys.unitStatus(unitId));

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
