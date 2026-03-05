import { logger } from '../../config/logger.js';

/**
 * onUnitCancelled — Full cancellation cascade.
 * Runs inside the caller's Prisma transaction (tx).
 *
 * Steps:
 * 1. Booking → cancelled
 * 2. Unit → available (all FK fields nulled)
 * 3. Cleared payments → refund_pending
 * 4. Pending/overdue demand letters → cancelled
 * 5. Payment schedule items → cancelled
 * 6. Commission records → cancelled
 * 7. Agent pendingCommission running total decremented
 * 8. Possession record → cancelled
 *
 * Notifications are queued into notificationsToDispatch array.
 * The caller dispatches AFTER the transaction commits.
 *
 * @param {Object} payload
 * @param {string} payload.bookingId
 * @param {string} payload.unitId
 * @param {string} payload.organizationId
 * @param {string} payload.customerId
 * @param {Object} tx — Prisma transaction client
 * @param {Array}  notificationsToDispatch — caller-owned array
 */
export const onUnitCancelled = async (
    payload,
    tx,
    notificationsToDispatch = []
) => {
    const { bookingId, unitId, organizationId, customerId } = payload;

    const results = {};

    // ── Step 1: Booking → cancelled ──────────────────────────────────────────
    await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'cancelled' },
    });

    // ── Step 2: Unit → available (clear all FK fields) ───────────────────────
    await tx.unit.update({
        where: { id: unitId },
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

    // ── Step 3: Cleared payments → refund_pending ────────────────────────────
    // Only cleared payments become refund_pending.
    // bounced/under_process payments are left as-is.
    const paymentResult = await tx.payment.updateMany({
        where: {
            bookingId,
            organizationId,
            status: 'cleared',
        },
        data: { status: 'refund_pending' },
    });
    results.paymentsMarkedRefund = paymentResult.count;

    // ── Step 4: Demand letters → cancelled ───────────────────────────────────
    const demandResult = await tx.demandLetter.updateMany({
        where: {
            bookingId,
            organizationId,
            status: { in: ['pending', 'partially_paid', 'overdue'] },
        },
        data: { status: 'cancelled' },
    });
    results.demandLettersCancelled = demandResult.count;

    // ── Step 5: Payment schedule → cancelled ─────────────────────────────────
    const scheduleResult = await tx.paymentSchedule.updateMany({
        where: {
            bookingId,
            organizationId,
            status: { in: ['upcoming', 'due', 'overdue'] },
        },
        data: { status: 'cancelled' },
    });
    results.schedulesCancelled = scheduleResult.count;

    // ── Step 6 + 7: Commissions → cancelled + agent totals ───────────────────
    const commissions = await tx.commission.findMany({
        where: { bookingId, organizationId },
        select: {
            id: true,
            agentId: true,
            pendingAmount: true,
            status: true,
        },
    });

    let commissionsCancelled = 0;
    for (const comm of commissions) {
        if (comm.status === 'cancelled') continue;

        await tx.commission.update({
            where: { id: comm.id },
            data: { status: 'cancelled', pendingAmount: 0n },
        });
        commissionsCancelled++;

        // Decrement agent running total only for unpaid pending amount
        if (comm.agentId && comm.pendingAmount > 0n) {
            await tx.agent.update({
                where: { id: comm.agentId },
                data: {
                    pendingCommission: { decrement: comm.pendingAmount },
                },
            });
        }
    }
    results.commissionsCancelled = commissionsCancelled;

    // ── Step 8: Possession record → leave as-is ──────────────────────────────
    // PossessionStatus enum has no 'cancelled' value.
    // Possession records are retained (status stays 'pending') so that
    // post-cancellation reporting can still reference them.
    // Orphaned possession records are harmless and can be cleaned up manually.

    logger.info('[Cascade] onUnitCancelled complete', {
        bookingId,
        paymentsMarkedRefund: results.paymentsMarkedRefund,
        demandLettersCancelled: results.demandLettersCancelled,
        schedulesCancelled: results.schedulesCancelled,
        commissionsCancelled: results.commissionsCancelled,
    });

    // ── Queue notification (dispatched by caller AFTER tx commits) ────────────
    notificationsToDispatch.push({
        type: 'BOOKING_CANCELLED',
        payload: {
            organizationId,
            bookingId,
            customerId,
            priority: 'high',
        },
    });

    return results;
};
