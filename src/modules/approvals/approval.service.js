import prisma from '../../config/database.js';
import {
    NotFoundError,
    BusinessRuleError,
    ConflictError,
} from '../../shared/errors.js';
import {
    parsePagination,
    buildPaginatedResponse,
    buildSingleResponse,
    buildActionResponse,
} from '../../shared/pagination.js';
import {
    buildEnumFilter,
    buildDateRangeFilter,
    cleanObject,
} from '../../shared/filters.js';

// ── List Approvals ────────────────────────────────────────────────────────────

export const listApprovals = async (
    organizationId,
    query = {},
    user = {}
) => {
    const { skip, take, page, pageSize } = parsePagination(query);

    const where = cleanObject({
        organizationId,
        status: buildEnumFilter(query.status),
        requestType: buildEnumFilter(query.requestType),
        entityType: query.entityType || undefined,
        createdAt: buildDateRangeFilter(query.from, query.to),
    });

    // Non-admin users only see their own requests
    if (
        user.role !== 'admin' &&
        user.role !== 'finance' &&
        user.role !== 'operations'
    ) {
        where.requestedBy = user.userId;
    }

    const [approvals, total] = await Promise.all([
        prisma.approvalRequest.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                requestType: true,
                entityType: true,
                entityId: true,
                requestedBy: true,
                status: true,
                justification: true,
                requestData: true,
                reviewedBy: true,
                reviewedAt: true,
                reviewRemarks: true,
                createdAt: true,
                updatedAt: true,
            },
        }),
        prisma.approvalRequest.count({ where }),
    ]);

    return buildPaginatedResponse(approvals, total, page, pageSize);
};

// ── Get Single Approval ───────────────────────────────────────────────────────

export const getApproval = async (
    organizationId,
    approvalId
) => {
    const approval = await prisma.approvalRequest.findFirst({
        where: { id: approvalId, organizationId },
    });
    if (!approval) throw new NotFoundError('Approval request');

    // Calculate time pending
    const hoursPending = Math.round(
        (Date.now() - new Date(approval.createdAt).getTime()) /
        (1000 * 60 * 60)
    );

    return buildSingleResponse({
        ...approval,
        hoursPending:
            approval.status === 'pending' ? hoursPending : null,
    });
};

// ── Create Approval Request ───────────────────────────────────────────────────

export const createApproval = async (
    organizationId,
    userId,
    body
) => {
    const {
        requestType,
        entityType,
        entityId,
        justification,
        requestData,
    } = body;

    // Check no pending approval exists for same entity
    const existing = await prisma.approvalRequest.findFirst({
        where: {
            organizationId,
            entityId,
            status: 'pending',
        },
    });
    if (existing) {
        throw new ConflictError(
            `A pending approval request already exists for this ` +
            `entity (${existing.id}).`
        );
    }

    // Generate approval code
    const count = await prisma.approvalRequest.count({
        where: { organizationId },
    });
    const approvalCode = `APR-${String(count + 1).padStart(4, '0')}`;

    const approval = await prisma.approvalRequest.create({
        data: {
            organizationId,
            requestType,
            entityType,
            entityId,
            requestedBy: userId,
            justification,
            requestData: requestData || {},
            status: 'pending',
        },
    });

    return buildActionResponse(
        {
            id: approval.id,
            requestType: approval.requestType,
            entityType: approval.entityType,
            entityId: approval.entityId,
            status: approval.status,
        },
        `Approval request created successfully. ` +
        `Pending review by authorized approver.`
    );
};

// ── Review Approval ───────────────────────────────────────────────────────────

export const reviewApproval = async (
    organizationId,
    approvalId,
    userId,
    body
) => {
    const approval = await prisma.approvalRequest.findFirst({
        where: { id: approvalId, organizationId },
    });
    if (!approval) throw new NotFoundError('Approval request');

    // Cannot review own request
    if (approval.requestedBy === userId) {
        throw new BusinessRuleError(
            'You cannot approve or reject your own request.'
        );
    }

    if (approval.status !== 'pending') {
        throw new BusinessRuleError(
            `This approval request is already "${approval.status}".`
        );
    }

    const { status, reviewRemarks } = body;

    const updated = await prisma.approvalRequest.update({
        where: { id: approvalId },
        data: {
            status,
            reviewedBy: userId,
            reviewedAt: new Date(),
            reviewRemarks,
        },
    });

    return buildActionResponse(
        {
            id: updated.id,
            requestType: updated.requestType,
            entityType: updated.entityType,
            entityId: updated.entityId,
            previousStatus: 'pending',
            newStatus: updated.status,
            reviewedBy: updated.reviewedBy,
            reviewedAt: updated.reviewedAt,
        },
        `Approval request ${status}. ` +
        `Entity: ${updated.entityType} (${updated.entityId}).`
    );
};

// ── Get Pending Approvals Count ───────────────────────────────────────────────
// Used for dashboard badge counts

export const getPendingCount = async (organizationId) => {
    const byType = await prisma.approvalRequest.groupBy({
        by: ['requestType'],
        where: { organizationId, status: 'pending' },
        _count: { id: true },
    });

    const total = byType.reduce(
        (sum, t) => sum + t._count.id,
        0
    );

    return {
        success: true,
        data: {
            total,
            byType: Object.fromEntries(
                byType.map((t) => [t.requestType, t._count.id])
            ),
        },
    };
};
