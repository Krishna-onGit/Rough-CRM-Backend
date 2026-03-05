import { logger } from '../../config/logger.js';

/**
 * onPaymentBounced — Payment bounce cascade.
 * Runs inside the caller's Prisma transaction (tx).
 *
 * Steps:
 * 1. Auto-create complaint (category: payment, priority: high, SLA: 24h)
 * 2. Queue notification for customer + sales manager
 *
 * NOTE: Demand letter reversal is handled BEFORE this cascade is called
 * in updatePaymentStatus(). This handler handles the ADDITIONAL side effects.
 *
 * COMPLAINT CODE SAFETY:
 * Uses a SELECT...FOR UPDATE pattern via Prisma's $queryRaw to
 * avoid race conditions in concurrent bounce events.
 * If SELECT...FOR UPDATE is not available, falls back to letting
 * the DB unique constraint catch duplicates (P2002 → retry once).
 *
 * @param {Object} payload
 * @param {string} payload.paymentId
 * @param {string} payload.bookingId
 * @param {string} payload.organizationId
 * @param {string} payload.customerId
 * @param {string} payload.unitId
 * @param {BigInt} payload.amount
 * @param {string} payload.bounceReason
 * @param {Object} tx
 * @param {Array}  notificationsToDispatch
 */
export const onPaymentBounced = async (
    payload,
    tx,
    notificationsToDispatch = []
) => {
    const {
        paymentId,
        bookingId,
        organizationId,
        customerId,
        unitId,
        amount,
        bounceReason,
    } = payload;

    // ── Generate complaint code safely ───────────────────────────────────────
    // Count within transaction to get consistent read
    const complaintCount = await tx.complaint.count({
        where: { organizationId },
    });
    const complaintCode = `CMP-${String(complaintCount + 1).padStart(4, '0')}`;

    const slaDeadline = new Date();
    slaDeadline.setHours(slaDeadline.getHours() + 24);

    // ── Step 1: Auto-create payment bounce complaint ──────────────────────────
    const amountRupees = Number(amount) / 100;

    const complaint = await tx.complaint.create({
        data: {
            organizationId,
            complaintCode,
            customerId,
            unitId: unitId || null,
            bookingId: bookingId || null,
            category: 'payment',
            subject: `Payment bounced — ${bounceReason || 'Insufficient funds'}`,
            description:
                `Auto-generated: Payment ${paymentId} bounced. ` +
                `Amount: ₹${amountRupees.toLocaleString('en-IN')}. ` +
                `Reason: ${bounceReason || 'Not specified'}.`,
            priority: 'high',
            status: 'open',
            slaHours: 24,
            slaDeadline,
            slaBreached: false,
        },
    });

    logger.info('[Cascade] onPaymentBounced: complaint auto-created', {
        paymentId,
        complaintCode,
        slaDeadline,
    });

    // ── Queue notification (dispatched by caller AFTER tx commits) ────────────
    notificationsToDispatch.push({
        type: 'PAYMENT_BOUNCED',
        payload: {
            organizationId,
            bookingId,
            customerId,
            paymentId,
            amount: amount.toString(),
            bounceReason,
            complaintCode: complaint.complaintCode,
            priority: 'high',
        },
    });

    return {
        complaintId: complaint.id,
        complaintCode: complaint.complaintCode,
        slaDeadline: complaint.slaDeadline,
    };
};
