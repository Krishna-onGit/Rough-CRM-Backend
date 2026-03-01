import prisma from '../../config/database.js';
import { redis, CacheKeys } from '../../config/redis.js';
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
import { paiseToRupees, rupeesToPaise } from '../../shared/costSheet.js';
import {
    calculateRefund,
    formatRefundForDisplay,
} from '../../shared/refund.js';

// ── List Cancellations ────────────────────────────────────────────────────────

export const listCancellations = async (
    organizationId,
    query = {}
) => {
    const { skip, take, page, pageSize } = parsePagination(query);

    const where = cleanObject({
        organizationId,
        refundStatus: buildEnumFilter(query.refundStatus),
        cancellationDate: buildDateRangeFilter(query.from, query.to),
    });

    const [cancellations, total] = await Promise.all([
        prisma.cancellationRecord.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                cancelCode: true,
                bookingId: true,
                unitId: true,
                customerId: true,
                cancellationDate: true,
                reason: true,
                totalReceived: true,
                forfeiturePct: true,
                forfeitureAmt: true,
                netRefund: true,
                refundStatus: true,
                refundDate: true,
                createdAt: true,
            },
        }),
        prisma.cancellationRecord.count({ where }),
    ]);

    const formatted = cancellations.map((c) => ({
        ...c,
        forfeiturePct: Number(c.forfeiturePct),
        totalReceived: paiseToRupees(c.totalReceived),
        forfeitureAmt: paiseToRupees(c.forfeitureAmt),
        netRefund: paiseToRupees(c.netRefund),
    }));

    return buildPaginatedResponse(formatted, total, page, pageSize);
};

// ── Get Cancellation Preview ──────────────────────────────────────────────────
// Shows what the refund will look like BEFORE confirming.
// Use this before initiateCancellation to show customer the breakdown.

export const getCancellationPreview = async (
    organizationId,
    bookingId
) => {
    const booking = await prisma.booking.findFirst({
        where: {
            id: bookingId,
            organizationId,
            status: { notIn: ['cancelled'] },
        },
    });
    if (!booking) throw new NotFoundError('Booking');

    // Sum all cleared payments for this booking
    const payments = await prisma.payment.findMany({
        where: {
            bookingId,
            organizationId,
            status: 'cleared',
        },
        select: { amount: true },
    });

    const totalReceived = payments.reduce(
        (sum, p) => sum + p.amount,
        0n
    );

    // Get agent commission if exists
    const commission = await prisma.commission.findFirst({
        where: { bookingId, organizationId },
        select: { grossCommission: true },
    });

    const refund = calculateRefund({
        totalReceived,
        bookingStatus: booking.status,
        grossCommission: commission?.grossCommission || 0n,
    });

    return buildSingleResponse({
        bookingId,
        bookingCode: booking.bookingCode,
        bookingStatus: booking.status,
        refundBreakdown: formatRefundForDisplay(refund),
    });
};

// ── Initiate Cancellation ─────────────────────────────────────────────────────

export const initiateCancellation = async (
    organizationId,
    userId,
    body
) => {
    const { bookingId, reason, requestedBy } = body;

    // Verify booking exists and is cancellable
    const booking = await prisma.booking.findFirst({
        where: { id: bookingId, organizationId },
    });
    if (!booking) throw new NotFoundError('Booking');

    if (booking.status === 'cancelled') {
        throw new ConflictError('This booking is already cancelled.');
    }

    if (booking.status === 'possession_handed') {
        throw new BusinessRuleError(
            'Cannot cancel a booking after possession has been handed over.'
        );
    }

    // Check no pending cancellation exists
    const existingCancellation = await prisma.cancellationRecord.findFirst({
        where: {
            bookingId,
            organizationId,
            refundStatus: { notIn: ['processed', 'paid'] },
        },
    });
    if (existingCancellation) {
        throw new ConflictError(
            `A cancellation request already exists for this booking ` +
            `(${existingCancellation.cancelCode}).`
        );
    }

    // Sum all cleared payments
    const payments = await prisma.payment.findMany({
        where: { bookingId, organizationId, status: 'cleared' },
        select: { amount: true },
    });

    const totalReceived = payments.reduce(
        (sum, p) => sum + p.amount,
        0n
    );

    // Get commission for brokerage recovery calc
    const commission = await prisma.commission.findFirst({
        where: { bookingId, organizationId },
        select: { grossCommission: true },
    });

    // Calculate refund with default rules
    const refund = calculateRefund({
        totalReceived,
        bookingStatus: booking.status,
        grossCommission: commission?.grossCommission || 0n,
    });

    // Generate cancel code
    const count = await prisma.cancellationRecord.count({
        where: { organizationId },
    });
    const cancelCode = `CAN-${String(count + 1).padStart(4, '0')}`;

    // Create cancellation record + create approval request atomically
    const result = await prisma.$transaction(async (tx) => {
        const cancellation = await tx.cancellationRecord.create({
            data: {
                organizationId,
                bookingId,
                unitId: booking.unitId,
                customerId: booking.customerId,
                cancelCode,
                cancellationDate: new Date(),
                reason,
                requestedBy: requestedBy || userId,
                totalReceived,
                forfeiturePct: refund.forfeiturePct,
                forfeitureAmt: refund.forfeitureAmt,
                gstDeduction: refund.gstDeduction,
                tdsDeduction: refund.tdsDeduction,
                brokerageRecovery: refund.brokerageRecovery,
                adminFee: refund.adminFee,
                netRefund: refund.netRefund,
                refundStatus: 'pending',
            },
        });

        // Auto-create approval request for cancellation
        const approval = await tx.approvalRequest.create({
            data: {
                organizationId,
                requestType: 'cancellation',
                entityType: 'cancellation_record',
                entityId: cancellation.id,
                requestedBy: requestedBy || userId,
                requestData: {
                    cancelCode,
                    bookingCode: booking.bookingCode,
                    netRefund: refund.netRefund.toString(),
                    totalReceived: totalReceived.toString(),
                },
                justification: reason,
                status: 'pending',
            },
        });

        return { cancellation, approvalId: approval.id };
    });

    return buildActionResponse(
        {
            id: result.cancellation.id,
            cancelCode: result.cancellation.cancelCode,
            refundBreakdown: formatRefundForDisplay(refund),
            approvalId: result.approvalId,
            status: 'pending_approval',
        },
        `Cancellation ${cancelCode} initiated. Pending approval.`
    );
};

// ── Process Cancellation (after approval) ────────────────────────────────────

export const processCancellation = async (
    organizationId,
    cancellationId,
    userId,
    body
) => {
    const cancellation = await prisma.cancellationRecord.findFirst({
        where: { id: cancellationId, organizationId },
        include: {
            booking: true,
        },
    });
    if (!cancellation) throw new NotFoundError('Cancellation record');

    if (cancellation.refundStatus !== 'pending') {
        throw new BusinessRuleError(
            `Cancellation is already in "${cancellation.refundStatus}" status.`
        );
    }

    const {
        forfeiturePct,
        adminFee,
        brokerageRecovery,
        approvedBy,
        remarks,
    } = body;

    // Recalculate with approved forfeiture
    const forfeiturePctBig = BigInt(Math.round(forfeiturePct * 100));
    const forfeitureAmt =
        (cancellation.totalReceived * forfeiturePctBig) / 10000n;
    const gstDeduction = (forfeitureAmt * 18n) / 100n;
    const tdsDeduction = (cancellation.totalReceived * 1n) / 100n;
    const adminFeePaise = rupeesToPaise(adminFee);
    const brokerageRecoveryPaise = rupeesToPaise(brokerageRecovery);

    const totalDeductions =
        forfeitureAmt +
        gstDeduction +
        tdsDeduction +
        brokerageRecoveryPaise +
        adminFeePaise;

    const netRefund =
        cancellation.totalReceived > totalDeductions
            ? cancellation.totalReceived - totalDeductions
            : 0n;

    // Execute cancellation atomically
    await prisma.$transaction(async (tx) => {
        // 1. Update cancellation record
        await tx.cancellationRecord.update({
            where: { id: cancellationId },
            data: {
                forfeiturePct,
                forfeitureAmt,
                gstDeduction,
                tdsDeduction,
                brokerageRecovery: brokerageRecoveryPaise,
                adminFee: adminFeePaise,
                netRefund,
                refundStatus: 'approved',
                approvedBy,
            },
        });

        // 2. Update booking status to cancelled
        await tx.booking.update({
            where: { id: cancellation.bookingId },
            data: { status: 'cancelled' },
        });

        // 3. Release unit back to available
        await tx.unit.update({
            where: { id: cancellation.unitId },
            data: {
                status: 'available',
                customerId: null,
                salesPersonId: null,
                agentId: null,
                bookingId: null,
                saleDate: null,
                finalSaleValue: null,
                discountAmount: null,
                discountApprovedBy: null,
                blockedBy: null,
                blockedAt: null,
                blockExpiresAt: null,
                blockAgentId: null,
            },
        });

        // 4. Update commission to cancelled
        await tx.commission.updateMany({
            where: {
                bookingId: cancellation.bookingId,
                organizationId,
            },
            data: { status: 'cancelled' },
        });

        // 5. Update approval request to approved
        await tx.approvalRequest.updateMany({
            where: {
                entityId: cancellationId,
                organizationId,
                status: 'pending',
            },
            data: {
                status: 'approved',
                reviewedBy: approvedBy,
                reviewedAt: new Date(),
                reviewRemarks: remarks || null,
            },
        });
    });

    // Invalidate caches
    await redis.del(CacheKeys.unitStatus(cancellation.unitId));
    await redis.del(
        CacheKeys.projectStats(cancellation.booking.projectId)
    );

    return buildActionResponse(
        {
            cancelCode: cancellation.cancelCode,
            netRefund: paiseToRupees(netRefund),
            refundStatus: 'approved',
            unitReleased: true,
            bookingStatus: 'cancelled',
        },
        `Cancellation processed. Unit released back to inventory. ` +
        `Net refund: ₹${paiseToRupees(netRefund).toLocaleString('en-IN')}.`
    );
};
