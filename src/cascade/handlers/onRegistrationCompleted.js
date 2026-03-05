import { logger } from '../../config/logger.js';

/**
 * onRegistrationCompleted — Registration event cascade.
 * Runs inside the caller's Prisma transaction (tx).
 *
 * Steps:
 * 1. Booking → registered
 * 2. Unit → registered
 * 3. Commissions (pending/approved) → sale_completed
 *
 * Note: If possession already completed first, commissions
 * will already be 'sale_completed'. The updateMany with
 * status filter handles this correctly (0 records updated,
 * no error).
 *
 * @param {Object} payload
 * @param {string} payload.bookingId
 * @param {string} payload.unitId
 * @param {string} payload.organizationId
 * @param {string} payload.customerId
 * @param {Object} tx
 * @param {Array}  notificationsToDispatch
 */
export const onRegistrationCompleted = async (
    payload,
    tx,
    notificationsToDispatch = []
) => {
    const { bookingId, unitId, organizationId, customerId } = payload;

    // ── Step 1: Booking → registered ─────────────────────────────────────────
    await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'registered' },
    });

    // ── Step 2: Unit → registered ─────────────────────────────────────────────
    await tx.unit.update({
        where: { id: unitId },
        data: { status: 'registered' },
    });

    // ── Step 3: Commissions → sale_completed ─────────────────────────────────
    // Enables agent payout eligibility.
    // If possession already set this, updateMany finds 0 records — safe.
    const commResult = await tx.commission.updateMany({
        where: {
            bookingId,
            organizationId,
            status: { in: ['pending', 'approved'] },
        },
        data: { status: 'sale_completed' },
    });

    logger.info('[Cascade] onRegistrationCompleted complete', {
        bookingId,
        commissionsUpdated: commResult.count,
    });

    notificationsToDispatch.push({
        type: 'REGISTRATION_COMPLETED',
        payload: {
            organizationId,
            bookingId,
            customerId,
            unitId,
        },
    });

    return { commissionsUpdated: commResult.count };
};
