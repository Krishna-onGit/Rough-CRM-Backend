/**
 * calculateRefund — computes cancellation refund breakdown.
 *
 * Forfeiture rules (configurable per org settings):
 * - Before agreement: 2% forfeiture
 * - After agreement, before registration: 5% forfeiture  
 * - After registration: 10% forfeiture
 *
 * @param {Object} params
 * @param {BigInt} params.totalReceived - Total payments collected in paise
 * @param {string} params.bookingStatus - Current booking status
 * @param {BigInt} params.grossCommission - Agent commission paid in paise
 * @param {Object} params.orgSettings - Organization cancellation settings
 * @returns {Object} Full refund breakdown in paise
 */
export const calculateRefund = ({
    totalReceived,
    bookingStatus,
    grossCommission = 0n,
    orgSettings = {},
}) => {
    const received = BigInt(totalReceived);
    const commission = BigInt(grossCommission);

    // ── Forfeiture % based on booking lifecycle stage ───────────────────────
    let forfeiturePct;

    const cancellationRules = orgSettings.cancellationRules || {};

    if (bookingStatus === 'booked' || bookingStatus === 'token_received') {
        // Before agreement — lowest forfeiture
        forfeiturePct = cancellationRules.beforeAgreement ?? 2;
    } else if (bookingStatus === 'agreement_done') {
        // After agreement, before registration
        forfeiturePct = cancellationRules.afterAgreement ?? 5;
    } else if (bookingStatus === 'registered') {
        // After registration — highest forfeiture
        forfeiturePct = cancellationRules.afterRegistration ?? 10;
    } else {
        forfeiturePct = cancellationRules.default ?? 2;
    }

    const forfeiturePctBig = BigInt(Math.round(forfeiturePct * 100));

    // ── Forfeiture Amount ─────────────────────────────────────────────────────
    const forfeitureAmt = (received * forfeiturePctBig) / 10000n;

    // ── GST Deduction on Forfeiture ──────────────────────────────────────────
    // 18% GST applicable on forfeiture amount
    const gstDeduction = (forfeitureAmt * 18n) / 100n;

    // ── TDS Deduction ────────────────────────────────────────────────────────
    // 1% TDS on total received (per Indian income tax rules)
    const tdsDeduction = (received * 1n) / 100n;

    // ── Brokerage Recovery ───────────────────────────────────────────────────
    // Recover paid commission from refund if cancellation after booking
    const brokerageRecovery = commission > 0n
        ? (commission * 50n) / 100n  // 50% recovery
        : 0n;

    // ── Admin Fee ────────────────────────────────────────────────────────────
    // Fixed admin processing fee (default ₹5,000 = 500000 paise)
    const adminFee = BigInt(
        (cancellationRules.adminFee ?? 5000) * 100
    );

    // ── Net Refund ───────────────────────────────────────────────────────────
    const totalDeductions = forfeitureAmt + gstDeduction +
        tdsDeduction + brokerageRecovery + adminFee;

    // Net refund cannot be negative
    const netRefund = received > totalDeductions
        ? received - totalDeductions
        : 0n;

    return {
        totalReceived: received,
        forfeiturePct,
        forfeitureAmt,
        gstDeduction,
        tdsDeduction,
        brokerageRecovery,
        adminFee,
        netRefund,
    };
};

/**
 * formatRefundForDisplay — converts paise to rupees for API response.
 */
export const formatRefundForDisplay = (refund) => {
    const toRupees = (paise) => Number(paise) / 100;
    return {
        totalReceived: toRupees(refund.totalReceived),
        forfeiturePct: refund.forfeiturePct,
        forfeitureAmt: toRupees(refund.forfeitureAmt),
        gstDeduction: toRupees(refund.gstDeduction),
        tdsDeduction: toRupees(refund.tdsDeduction),
        brokerageRecovery: toRupees(refund.brokerageRecovery),
        adminFee: toRupees(refund.adminFee),
        netRefund: toRupees(refund.netRefund),
        currency: 'INR',
    };
};
