import { logger } from '../../config/logger.js';

/**
 * onTransferInitiated — Full ownership migration cascade.
 * Moves ALL records from old customer to new customer.
 * Runs inside the caller's Prisma transaction (tx).
 *
 * Records migrated (10 total):
 * 1.  Booking
 * 2.  Unit
 * 3.  PossessionRecord
 * 4.  Payment (all)
 * 5.  DemandLetter (all)
 * 6.  LoanRecord (all)          ← uses tx.loanRecord NOT tx.loan
 * 7.  PaymentSchedule (all)
 * 8.  Commission (all)
 * 9.  CommunicationLog (all)
 * 10. CustomerDocument (all)
 *
 * NOTE: Complaints and SnagItems are intentionally NOT transferred.
 * Open complaints belong to the originating customer relationship.
 * New owner should open new complaints post-transfer if needed.
 *
 * @param {Object} payload
 * @param {string} payload.transferId
 * @param {string} payload.bookingId
 * @param {string} payload.unitId
 * @param {string} payload.organizationId
 * @param {string} payload.fromCustomerId
 * @param {string} payload.toCustomerId
 * @param {Object} tx
 * @param {Array}  notificationsToDispatch
 */
export const onTransferInitiated = async (
    payload,
    tx,
    notificationsToDispatch = []
) => {
    const {
        bookingId,
        unitId,
        organizationId,
        fromCustomerId,
        toCustomerId,
        transferId,
    } = payload;

    const results = {};

    // ── 1: Booking → new customer ─────────────────────────────────────────────
    await tx.booking.update({
        where: { id: bookingId },
        data: { customerId: toCustomerId },
    });

    // ── 2: Unit → new customer ────────────────────────────────────────────────
    await tx.unit.update({
        where: { id: unitId },
        data: { customerId: toCustomerId },
    });

    // ── 3: PossessionRecord → new customer ───────────────────────────────────
    const possResult = await tx.possessionRecord.updateMany({
        where: { bookingId, organizationId },
        data: { customerId: toCustomerId },
    });
    results.possessionRecords = possResult.count;

    // ── 4: Payments → new customer ────────────────────────────────────────────
    const payResult = await tx.payment.updateMany({
        where: { bookingId, organizationId },
        data: { customerId: toCustomerId },
    });
    results.paymentsMigrated = payResult.count;

    // ── 5: Demand letters → new customer ─────────────────────────────────────
    const dlResult = await tx.demandLetter.updateMany({
        where: { bookingId, organizationId },
        data: { customerId: toCustomerId },
    });
    results.demandLettersMigrated = dlResult.count;

    // ── 6: Loan records → new customer ───────────────────────────────────────
    // CRITICAL: model is loanRecord (not loan)
    const loanResult = await tx.loanRecord.updateMany({
        where: { bookingId, organizationId },
        data: { customerId: toCustomerId },
    });
    results.loansMigrated = loanResult.count;

    // ── 7: Payment schedule — no customerId field, stays linked via bookingId ─
    results.schedulesMigrated = 0;

    // ── 8: Commissions — no customerId field, stays linked via bookingId/agentId
    results.commissionsMigrated = 0;

    // ── 9: Communication logs → new customer ─────────────────────────────────
    const commLogResult = await tx.communicationLog.updateMany({
        where: { customerId: fromCustomerId, organizationId },
        data: { customerId: toCustomerId },
    });
    results.communicationLogsMigrated = commLogResult.count;

    // ── 10: Documents → new customer ─────────────────────────────────────────
    const docResult = await tx.customerDocument.updateMany({
        where: { customerId: fromCustomerId, bookingId, organizationId },
        data: { customerId: toCustomerId },
    });
    results.documentsMigrated = docResult.count;

    logger.info('[Cascade] onTransferInitiated complete', {
        transferId,
        bookingId,
        fromCustomerId,
        toCustomerId,
        ...results,
    });

    // ── Queue notification (dispatched by caller AFTER tx commits) ────────────
    notificationsToDispatch.push({
        type: 'TRANSFER_COMPLETED',
        payload: {
            organizationId,
            bookingId,
            fromCustomerId,
            toCustomerId,
            transferId,
        },
    });

    return results;
};
