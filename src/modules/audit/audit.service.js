import prisma from '../../config/database.js';
import {
    parsePagination,
    buildPaginatedResponse,
} from '../../shared/pagination.js';
import {
    buildSearchFilter,
    buildEnumFilter,
    buildDateRangeFilter,
    cleanObject,
} from '../../shared/filters.js';

// ── List Audit Logs ───────────────────────────────────────────────────────────

export const listAuditLogs = async (
    organizationId,
    query = {}
) => {
    const { skip, take, page, pageSize } = parsePagination(query);

    const where = cleanObject({
        organizationId,
        userId: query.userId || undefined,
        entityType: query.entityType || undefined,
        entityId: query.entityId || undefined,
        action: query.action || undefined,
        createdAt: buildDateRangeFilter(query.from, query.to),
    });

    const searchFilter = buildSearchFilter(query.search, [
        'action',
        'entityType',
    ]);
    if (searchFilter) where.OR = searchFilter;

    const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                userId: true,
                action: true,
                entityType: true,
                entityId: true,
                metadata: true,
                ipAddress: true,
                userAgent: true,
                createdAt: true,
            },
        }),
        prisma.auditLog.count({ where }),
    ]);

    return buildPaginatedResponse(logs, total, page, pageSize);
};

// ── Get Entity Audit Trail ────────────────────────────────────────────────────
// Returns full history for a specific entity (e.g. all changes to a booking)

export const getEntityAuditTrail = async (
    organizationId,
    entityType,
    entityId
) => {
    const logs = await prisma.auditLog.findMany({
        where: { organizationId, entityType, entityId },
        orderBy: { createdAt: 'asc' },
        select: {
            id: true,
            userId: true,
            action: true,
            metadata: true,
            ipAddress: true,
            createdAt: true,
        },
    });

    return {
        success: true,
        data: {
            entityType,
            entityId,
            totalEvents: logs.length,
            trail: logs,
        },
    };
};

// ── Get User Activity ─────────────────────────────────────────────────────────

export const getUserActivity = async (
    organizationId,
    userId,
    query = {}
) => {
    const { skip, take, page, pageSize } = parsePagination(query);

    const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
            where: { organizationId, userId },
            skip,
            take,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                action: true,
                entityType: true,
                entityId: true,
                ipAddress: true,
                createdAt: true,
            },
        }),
        prisma.auditLog.count({ where: { organizationId, userId } }),
    ]);

    return buildPaginatedResponse(logs, total, page, pageSize);
};
