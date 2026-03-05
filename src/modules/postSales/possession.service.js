import prisma from '../../config/database.js';
import { redis, CacheKeys } from '../../config/redis.js';
import {
    NotFoundError,
    BusinessRuleError,
} from '../../shared/errors.js';
import { logger } from '../../config/logger.js';
import { triggerCascade } from '../../cascade/cascadeEngine.js';
import { CascadeEvents } from '../../cascade/types.js';
import { dispatchNotification } from '../../jobs/notificationDispatch.js';
import {
    parsePagination,
    buildPaginatedResponse,
    buildSingleResponse,
    buildActionResponse,
} from '../../shared/pagination.js';
import {
    buildEnumFilter,
    cleanObject,
} from '../../shared/filters.js';

// ── List Possessions ──────────────────────────────────────────────────────────

export const listPossessions = async (
    organizationId,
    query = {}
) => {
    const { skip, take, page, pageSize } = parsePagination(query);

    const where = cleanObject({
        organizationId,
        status: buildEnumFilter(query.status),
        unitId: query.unitId || undefined,
        bookingId: query.bookingId || undefined,
        customerId: query.customerId || undefined,
    });

    const [possessions, total] = await Promise.all([
        prisma.possessionRecord.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                unitId: true,
                bookingId: true,
                customerId: true,
                possessionDate: true,
                status: true,
                checklist: true,
                handoverBy: true,
                remarks: true,
                createdAt: true,
                _count: {
                    select: { snagItems: true },
                },
            },
        }),
        prisma.possessionRecord.count({ where }),
    ]);

    return buildPaginatedResponse(possessions, total, page, pageSize);
};

// ── Get Single Possession ─────────────────────────────────────────────────────

export const getPossession = async (
    organizationId,
    possessionId
) => {
    const possession = await prisma.possessionRecord.findFirst({
        where: { id: possessionId, organizationId },
        include: {
            snagItems: {
                orderBy: [
                    { priority: 'asc' },
                    { reportedDate: 'desc' },
                ],
                select: {
                    id: true,
                    description: true,
                    category: true,
                    priority: true,
                    status: true,
                    reportedDate: true,
                    resolvedDate: true,
                    resolvedBy: true,
                    remarks: true,
                },
            },
        },
    });

    if (!possession) throw new NotFoundError('Possession record');

    // Build checklist completion summary
    const checklist = possession.checklist || {};
    const checklistItems = Object.entries(checklist);
    const completedItems = checklistItems.filter(
        ([, v]) => v === true
    ).length;
    const checklistPct =
        checklistItems.length > 0
            ? Math.round((completedItems / checklistItems.length) * 100)
            : 0;

    // Snag summary
    const snagSummary = {
        total: possession.snagItems.length,
        open: possession.snagItems.filter(
            (s) => s.status === 'open'
        ).length,
        in_progress: possession.snagItems.filter(
            (s) => s.status === 'in_progress'
        ).length,
        resolved: possession.snagItems.filter(
            (s) => s.status === 'resolved'
        ).length,
    };

    return buildSingleResponse({
        ...possession,
        checklistSummary: {
            completed: completedItems,
            total: checklistItems.length,
            percentage: checklistPct,
        },
        snagSummary,
    });
};

// ── Update Possession ─────────────────────────────────────────────────────────

export const updatePossession = async (
    organizationId,
    possessionId,
    userId,
    body
) => {
    const possession = await prisma.possessionRecord.findFirst({
        where: { id: possessionId, organizationId },
    });
    if (!possession) throw new NotFoundError('Possession record');

    if (possession.status === 'completed') {
        throw new BusinessRuleError(
            'Cannot update a completed possession record.'
        );
    }

    const updateData = { ...body };

    if (body.possessionDate) {
        updateData.possessionDate = new Date(body.possessionDate);
    }

    // Merge checklist — preserve existing items
    if (body.checklist) {
        updateData.checklist = {
            ...(possession.checklist || {}),
            ...body.checklist,
        };
    }

    const updated = await prisma.possessionRecord.update({
        where: { id: possessionId },
        data: updateData,
    });

    return buildActionResponse(
        {
            id: updated.id,
            status: updated.status,
            checklist: updated.checklist,
            possessionDate: updated.possessionDate,
        },
        'Possession record updated successfully.'
    );
};

// ── Complete Possession ───────────────────────────────────────────────────────

export const completePossession = async (
    organizationId,
    possessionId,
    userId,
    body
) => {
    const possession = await prisma.possessionRecord.findFirst({
        where: { id: possessionId, organizationId },
        include: {
            snagItems: {
                where: {
                    status: { in: ['open', 'in_progress'] },
                },
                select: { id: true },
            },
        },
    });
    if (!possession) throw new NotFoundError('Possession record');

    if (possession.status === 'completed') {
        throw new BusinessRuleError(
            'Possession is already marked as completed.'
        );
    }

    // Warn if open snags exist — but do NOT block completion
    // Operations team can override
    const openSnagCount = possession.snagItems.length;

    const { possessionDate, handoverBy, remarks } = body;

    // Log incomplete checklist items as a warning (non-blocking)
    const checklist = possession.checklist || {};
    const incompleteItems = Object.entries(checklist)
        .filter(([, v]) => v !== true)
        .map(([k]) => k);

    if (incompleteItems.length > 0) {
        logger.warn('[Possession] Completing with incomplete checklist items', {
            possessionId,
            incompleteItems,
        });
    }

    const notifications = [];

    // Execute completion atomically
    await prisma.$transaction(async (tx) => {
        // Update possession record itself
        await tx.possessionRecord.update({
            where: { id: possessionId },
            data: {
                status: 'completed',
                possessionDate: body.possessionDate
                    ? new Date(body.possessionDate)
                    : new Date(),
                handoverBy: body.handoverBy || userId,
                remarks: body.remarks || null,
            },
        });

        // Fire possession cascade:
        // - Booking → possession_handed
        // - Unit → possession_handed
        // - Commissions → sale_completed  (the critical missing step)
        await triggerCascade(
            CascadeEvents.POSSESSION_COMPLETED,
            {
                possessionId,
                bookingId: possession.bookingId,
                unitId: possession.unitId,
                organizationId,
                customerId: possession.customerId,
            },
            tx,
            notifications
        );

    }, { timeout: 15000 });

    // Dispatch notifications AFTER transaction commits
    for (const n of notifications) {
        await dispatchNotification(n.type, n.payload).catch((err) => {
            logger.error('[Possession] Notification dispatch failed', {
                type: n.type,
                err: err.message,
            });
        });
    }

    // Invalidate caches
    await redis.del(CacheKeys.unitStatus(possession.unitId)).catch(() => {});

    return buildActionResponse(
        {
            possessionId,
            status: 'completed',
            possessionDate: new Date(possessionDate),
            bookingStatusUpdated: 'possession_handed',
            unitStatusUpdated: 'possession_handed',
            openSnagWarning:
                openSnagCount > 0
                    ? `${openSnagCount} unresolved snag(s) remain.`
                    : null,
        },
        `Possession completed successfully. ` +
        `Unit and booking updated to possession_handed.`
    );
};

// ── Create Snag Item ──────────────────────────────────────────────────────────

export const createSnag = async (
    organizationId,
    userId,
    body
) => {
    const {
        possessionId,
        unitId,
        description,
        category,
        priority,
        reportedDate,
    } = body;

    // Verify possession record exists
    const possession = await prisma.possessionRecord.findFirst({
        where: { id: possessionId, organizationId },
    });
    if (!possession) throw new NotFoundError('Possession record');

    // Cannot add snags to completed possession
    if (possession.status === 'completed') {
        throw new BusinessRuleError(
            'Cannot add snag items to a completed possession record.'
        );
    }

    // Verify unit matches possession
    if (possession.unitId !== unitId) {
        throw new BusinessRuleError(
            'Unit ID does not match the possession record.'
        );
    }

    const snag = await prisma.snagItem.create({
        data: {
            organizationId,
            possessionId,
            unitId,
            description,
            category: category || 'civil',
            priority: priority || 'medium',
            status: 'open',
            reportedDate: new Date(reportedDate),
        },
    });

    return buildActionResponse(
        {
            id: snag.id,
            description: snag.description,
            category: snag.category,
            priority: snag.priority,
            status: snag.status,
            reportedDate: snag.reportedDate,
        },
        'Snag item reported successfully.'
    );
};

// ── Update Snag Item ──────────────────────────────────────────────────────────

export const updateSnag = async (
    organizationId,
    snagId,
    userId,
    body
) => {
    const snag = await prisma.snagItem.findFirst({
        where: { id: snagId, organizationId },
    });
    if (!snag) throw new NotFoundError('Snag item');

    if (snag.status === 'resolved' && body.status !== 'open') {
        throw new BusinessRuleError(
            'A resolved snag can only be re-opened. ' +
            'Contact your supervisor to re-open.'
        );
    }

    // Require resolvedBy when marking resolved
    if (body.status === 'resolved' && !body.resolvedBy) {
        throw new BusinessRuleError(
            'resolvedBy is required when marking a snag as resolved.'
        );
    }

    const updateData = { ...body };

    if (body.resolvedDate) {
        updateData.resolvedDate = new Date(body.resolvedDate);
    }

    // Auto-set resolvedDate if resolving without date
    if (body.status === 'resolved' && !body.resolvedDate) {
        updateData.resolvedDate = new Date();
    }

    const updated = await prisma.snagItem.update({
        where: { id: snagId },
        data: updateData,
    });

    return buildActionResponse(
        {
            id: updated.id,
            description: updated.description,
            status: updated.status,
            resolvedDate: updated.resolvedDate,
            resolvedBy: updated.resolvedBy,
        },
        `Snag item updated to "${updated.status}".`
    );
};

// ── List Snags for Possession ─────────────────────────────────────────────────

export const listSnags = async (
    organizationId,
    possessionId,
    query = {}
) => {
    const { skip, take, page, pageSize } = parsePagination(query);

    // Verify possession exists
    const possession = await prisma.possessionRecord.findFirst({
        where: { id: possessionId, organizationId },
    });
    if (!possession) throw new NotFoundError('Possession record');

    const where = cleanObject({
        possessionId,
        organizationId,
        status: buildEnumFilter(query.status),
        category: buildEnumFilter(query.category),
        priority: buildEnumFilter(query.priority),
    });

    const [snags, total] = await Promise.all([
        prisma.snagItem.findMany({
            where,
            skip,
            take,
            orderBy: [
                { priority: 'asc' },
                { reportedDate: 'desc' },
            ],
        }),
        prisma.snagItem.count({ where }),
    ]);

    return buildPaginatedResponse(snags, total, page, pageSize);
};
