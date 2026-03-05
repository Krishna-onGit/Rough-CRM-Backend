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
import { processCancellation } from '../postSales/cancellation.service.js';
import { processTransfer } from '../postSales/transfer.service.js';
import { dispatchNotification } from '../../jobs/notificationDispatch.js';
import { logger } from '../../config/logger.js';

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

/**
 * executeApprovedAction — dispatches to the correct processor
 * based on the approval requestType.
 *
 * RUNS INSIDE the caller's $transaction (tx).
 * This ensures approval status + cascade are atomic.
 *
 * @param {Object} approval     — the approval record
 * @param {string} organizationId
 * @param {string} userId       — the reviewer
 * @param {Object} tx           — Prisma transaction client
 * @param {Array}  notifications — caller-owned notification array
 */
const executeApprovedAction = async (
    approval,
    organizationId,
    userId,
    tx,
    notifications
) => {
    switch (approval.requestType) {

        case 'cancellation': {
            // entityId on a cancellation approval = cancellationId
            // processCancellation is called with the tx so it runs
            // inside our transaction, not a new one.
            await processCancellation(
                organizationId,
                approval.entityId,
                userId,
                {
                    approvedBy: userId,
                    remarks: approval.reviewRemarks,
                },
                tx,          // ← pass transaction client
                notifications
            );
            break;
        }

        case 'transfer': {
            await processTransfer(
                organizationId,
                approval.entityId,
                userId,
                {
                    approvedBy: userId,
                    remarks: approval.reviewRemarks,
                },
                tx,
                notifications
            );
            break;
        }

        case 'discount': {
            // Discount approval only records the approval.
            // The booking discount was already applied at booking time
            // in a pending_discount_approval state.
            // Mark booking discount as approved here if that pattern
            // is implemented. Otherwise log and continue.
            logger.info('[Approval] Discount approved', {
                approvalId: approval.id,
                entityId: approval.entityId,
            });
            break;
        }

        default: {
            // refund, possession, other — no auto-execution
            // these are informational approvals only
            logger.info('[Approval] No auto-execution for type', {
                requestType: approval.requestType,
                approvalId: approval.id,
            });
        }
    }
};

export const reviewApproval = async (
    organizationId,
    approvalId,
    userId,
    body
) => {
    const { status, reviewRemarks } = body;

    // ── Fetch approval ────────────────────────────────────────────────────────
    const approval = await prisma.approvalRequest.findFirst({
        where: { id: approvalId, organizationId },
    });
    if (!approval) throw new NotFoundError('Approval request');

    // ── Validations ───────────────────────────────────────────────────────────
    if (approval.status !== 'pending') {
        throw new BusinessRuleError(
            `Only pending approvals can be reviewed. ` +
            `Current status: "${approval.status}".`
        );
    }

    if (approval.requestedBy === userId) {
        throw new BusinessRuleError(
            'You cannot review your own approval request.'
        );
    }

    // ── Single atomic transaction: update approval + execute cascade ──────────
    // If the cascade fails, the approval status also rolls back.
    // This prevents the stuck state where approval = 'approved'
    // but the underlying action never completed.
    const notifications = [];

    await prisma.$transaction(async (tx) => {

        // 1. Update approval status inside the transaction
        await tx.approvalRequest.update({
            where: { id: approvalId },
            data: {
                status,
                reviewedBy: userId,
                reviewedAt: new Date(),
                reviewRemarks: reviewRemarks || null,
            },
        });

        // 2. Execute the downstream action inside the SAME transaction
        if (status === 'approved') {
            await executeApprovedAction(
                approval,
                organizationId,
                userId,
                tx,
                notifications
            );
        }

    }, { timeout: 30000 });

    // 3. Dispatch notifications AFTER transaction commits
    for (const n of notifications) {
        await dispatchNotification(n.type, n.payload).catch((err) => {
            logger.error('[Approval] Post-review notification failed', {
                type: n.type,
                err: err.message,
            });
        });
    }

    return buildActionResponse(
        { approvalId, status, requestType: approval.requestType },
        `Approval request has been ${status}.`
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
