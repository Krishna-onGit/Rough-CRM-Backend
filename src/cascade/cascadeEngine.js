// ── Cascade Engine ───────────────────────────────────────────────────────────
// Central event dispatcher. Routes cascade events to their handlers.
// All handlers receive the Prisma transaction context so everything
// stays atomic — all or nothing.

import { onBookingCreated } from './handlers/onBookingCreated.js';
import { CascadeEvents } from './types.js';

/**
 * triggerCascade — dispatches a cascade event to its handler.
 * Must be called INSIDE a prisma.$transaction block.
 *
 * @param {string} event - CascadeEvents constant
 * @param {Object} payload - Event data
 * @param {Object} tx - Prisma transaction client
 */
export const triggerCascade = async (event, payload, tx) => {
    switch (event) {
        case CascadeEvents.BOOKING_CREATED:
            return await onBookingCreated(payload, tx);

        case CascadeEvents.UNIT_CANCELLED:
            // Handler implemented in Phase 7
            console.log('[Cascade] UNIT_CANCELLED queued:', payload.bookingId);
            return;

        case CascadeEvents.PAYMENT_BOUNCED:
            // Handler implemented in Phase 7
            console.log('[Cascade] PAYMENT_BOUNCED queued:', payload.paymentId);
            return;

        case CascadeEvents.TRANSFER_INITIATED:
            // Handler implemented in Phase 7
            console.log('[Cascade] TRANSFER_INITIATED queued:', payload.transferId);
            return;

        case CascadeEvents.POSSESSION_COMPLETED:
            // Handler implemented in Phase 7
            console.log('[Cascade] POSSESSION_COMPLETED queued:', payload.possessionId);
            return;

        default:
            console.warn(`[Cascade] Unknown event: ${event}`);
    }
};
