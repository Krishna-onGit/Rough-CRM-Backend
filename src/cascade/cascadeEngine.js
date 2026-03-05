import { onBookingCreated } from './handlers/onBookingCreated.js';
import { onUnitCancelled } from './handlers/onUnitCancelled.js';
import { onPaymentBounced } from './handlers/onPaymentBounced.js';
import { onTransferInitiated } from './handlers/onTransferInitiated.js';
import { onPossessionCompleted } from './handlers/onPossessionCompleted.js';
import { onRegistrationCompleted } from './handlers/onRegistrationCompleted.js';
import { CascadeEvents } from './types.js';
import { logger } from '../config/logger.js';

/**
 * triggerCascade — Central cascade dispatcher.
 *
 * DESIGN CONTRACT:
 * - All handlers run inside the caller's transaction (tx).
 * - Notifications are collected in notificationsToDispatch array.
 * - The caller dispatches notifications AFTER the transaction commits.
 * - Handlers never dispatch notifications directly.
 *
 * @param {string} event    — CascadeEvents constant
 * @param {Object} payload  — event-specific data
 * @param {Object} tx       — Prisma transaction client from caller
 * @param {Array}  notificationsToDispatch — caller-owned array
 */
export const triggerCascade = async (
    event,
    payload,
    tx,
    notificationsToDispatch = []
) => {
    logger.info(`[Cascade] Triggering: ${event}`, {
        bookingId: payload.bookingId,
        unitId: payload.unitId,
    });

    switch (event) {
        case CascadeEvents.BOOKING_CREATED:
            return await onBookingCreated(payload, tx);

        case CascadeEvents.UNIT_CANCELLED:
            return await onUnitCancelled(
                payload, tx, notificationsToDispatch
            );

        case CascadeEvents.PAYMENT_BOUNCED:
            return await onPaymentBounced(
                payload, tx, notificationsToDispatch
            );

        case CascadeEvents.TRANSFER_INITIATED:
            return await onTransferInitiated(
                payload, tx, notificationsToDispatch
            );

        case CascadeEvents.POSSESSION_COMPLETED:
            return await onPossessionCompleted(
                payload, tx, notificationsToDispatch
            );

        case CascadeEvents.REGISTRATION_COMPLETED:
            return await onRegistrationCompleted(
                payload, tx, notificationsToDispatch
            );

        default:
            logger.warn(`[Cascade] Unknown event: ${event}`, { payload });
            return null;
    }
};
