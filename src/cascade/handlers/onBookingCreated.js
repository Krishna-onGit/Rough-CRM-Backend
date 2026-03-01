// ── onBookingCreated Cascade Handler ─────────────────────────────────────────
//
// Triggered when a booking is created. Automatically creates:
//   1. Payment Schedule (CLP milestones)
//   2. First Demand Letter (On Booking milestone)
//   3. Commission Record (if agent is attached)
//   4. Possession Record (pre-created in pending state)
//
// All operations run inside the caller's transaction — atomic.

/**
 * @param {Object} payload
 * @param {string} payload.bookingId
 * @param {string} payload.organizationId
 * @param {string} payload.unitId
 * @param {string} payload.customerId
 * @param {string} payload.projectId
 * @param {string} payload.agentId - nullable
 * @param {BigInt} payload.finalValue - booking final value in paise
 * @param {BigInt} payload.tokenAmount - token collected in paise
 * @param {string} payload.agentCommissionPct - agent commission %
 * @param {Object} tx - Prisma transaction client
 */
export const onBookingCreated = async (payload, tx) => {
    const {
        bookingId,
        organizationId,
        unitId,
        customerId,
        projectId,
        agentId,
        finalValue,
        tokenAmount,
        agentCommissionPct,
        bookingCode,
    } = payload;

    const results = {};

    // ── 1. Create Payment Schedule (CLP Milestones) ───────────────────────────
    // Standard CLP schedule for Indian residential real estate
    const clpMilestones = [
        { order: 1, name: 'On Booking', percentage: 10 },
        { order: 2, name: 'On Allotment', percentage: 10 },
        { order: 3, name: 'On Excavation', percentage: 10 },
        { order: 4, name: 'On Plinth', percentage: 10 },
        { order: 5, name: 'On 1st Slab', percentage: 10 },
        { order: 6, name: 'On 2nd Slab', percentage: 10 },
        { order: 7, name: 'On 3rd Slab', percentage: 10 },
        { order: 8, name: 'On Top Slab', percentage: 10 },
        { order: 9, name: 'On Brickwork', percentage: 10 },
        { order: 10, name: 'On Possession', percentage: 10 },
    ];

    const scheduleData = clpMilestones.map((milestone) => ({
        organizationId,
        bookingId,
        unitId,
        milestoneOrder: milestone.order,
        milestoneName: milestone.name,
        percentage: milestone.percentage,
        amount: (finalValue * BigInt(milestone.percentage)) / 100n,
        status: milestone.order === 1 ? 'due' : 'upcoming',
    }));

    await tx.paymentSchedule.createMany({ data: scheduleData });

    results.paymentScheduleCount = scheduleData.length;

    // ── 2. Create First Demand Letter (On Booking) ────────────────────────────
    const onBookingAmount = (finalValue * 10n) / 100n;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7); // due in 7 days

    const letterCode = `DL-${bookingCode}-01`;

    const demandLetter = await tx.demandLetter.create({
        data: {
            organizationId,
            bookingId,
            customerId,
            unitId,
            letterCode,
            milestoneName: 'On Booking',
            milestonePct: 10,
            demandAmount: onBookingAmount,
            dueDate,
            status: 'pending',
            paidAmount: tokenAmount || 0n,
            remaining: onBookingAmount - (tokenAmount || 0n),
        },
    });

    results.demandLetterId = demandLetter.id;

    // ── 3. Create Commission Record (if agent attached) ───────────────────────
    if (agentId && agentCommissionPct) {
        const commissionPct = Number(agentCommissionPct);
        const grossCommission =
            (finalValue * BigInt(Math.round(commissionPct * 100))) / 10000n;
        const gstAmount = (grossCommission * 18n) / 100n;
        const tdsAmount = (grossCommission * 5n) / 100n;
        const netPayable = grossCommission - gstAmount - tdsAmount;

        const commission = await tx.commission.create({
            data: {
                organizationId,
                bookingId,
                agentId,
                unitId,
                agreementValue: finalValue,
                commissionPct,
                grossCommission,
                gstAmount,
                tdsAmount,
                netPayable,
                status: 'pending',
                paidAmount: 0n,
                pendingAmount: netPayable,
                milestones: [],
            },
        });

        results.commissionId = commission.id;
    }

    // ── 4. Create Possession Record (pre-created in pending state) ────────────
    const possession = await tx.possessionRecord.create({
        data: {
            organizationId,
            unitId,
            bookingId,
            customerId,
            status: 'pending',
            checklist: {
                possession_letter: false,
                keys_handed: false,
                meter_readings: false,
                welcome_kit: false,
                noc_obtained: false,
            },
        },
    });

    results.possessionId = possession.id;

    console.log(
        `[Cascade] onBookingCreated complete for booking ${bookingCode}:`,
        `${results.paymentScheduleCount} schedule items,`,
        `demand letter ${letterCode},`,
        agentId ? `commission ${results.commissionId},` : 'no agent commission,',
        `possession record ${results.possessionId}`
    );

    return results;
};
