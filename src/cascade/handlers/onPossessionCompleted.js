import { logger } from '../../config/logger.js';

/**
 * onPossessionCompleted — Possession completion cascade.
 * Runs inside the caller's Prisma transaction (tx).
 *
 * IMPORTANT: This handler OWNS the booking and unit status updates.
 * completePossession() in possession.service.js must have its inline
 * booking/unit updates REMOVED when this handler is wired in.
 *
 * Steps:
 * 1. Booking → possession_handed
 * 2. Unit → possession_handed
 * 3. Commissions (pending/approved) → sale_completed
 *
 * @param {Object} payload
 * @param {string} payload.possessionId
 * @param {string} payload.bookingId
 * @param {string} payload.unitId
 * @param {string} payload.organizationId
 * @param {string} payload.customerId
 * @param {Object} tx
 * @param {Array}  notificationsToDispatch
 */
export const onPossessionCompleted = async (
    payload,
    tx,
    notificationsToDispatch = []
) => {
    const {
        possessionId,
        bookingId,
        unitId,
        organizationId,
        customerId,
    } = payload;

    // ── Step 1: Booking → possession_handed ──────────────────────────────────
    await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'possession_handed' },
    });

    // ── Step 2: Unit → possession_handed ─────────────────────────────────────
    await tx.unit.update({
        where: { id: unitId },
        data: { status: 'possession_handed' },
    });

    // ── Step 3: Commissions → sale_completed ─────────────────────────────────
    // This is the critical step that was missing.
    // Commissions only become eligible for payout AFTER possession.
    const commResult = await tx.commission.updateMany({
        where: {
            bookingId,
            organizationId,
            status: { in: ['pending', 'approved'] },
        },
        data: { status: 'sale_completed' },
    });

    logger.info('[Cascade] onPossessionCompleted complete', {
        possessionId,
        bookingId,
        commissionsUpdated: commResult.count,
    });

    // ── Queue notification (dispatched by caller AFTER tx commits) ────────────
    notificationsToDispatch.push({
        type: 'POSSESSION_COMPLETED',
        payload: {
            organizationId,
            bookingId,
            customerId,
            unitId,
            priority: 'high',
        },
    });

    return { commissionsUpdated: commResult.count };
};
