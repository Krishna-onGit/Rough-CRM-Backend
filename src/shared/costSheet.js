/**
 * calculateUnitCost — computes the full price breakdown for a unit.
 *
 * @param {Object} params
 * @param {BigInt} params.superBuiltUpArea - Area in sqft x 100
 * @param {BigInt} params.baseRate - Rate per sqft in paise
 * @param {number} params.floor - Floor number (for floor rise)
 * @param {string} params.facing - Unit facing (for PLC)
 * @param {string} params.viewType - View type (for PLC)
 * @param {string} params.parking - Parking type (for amenity)
 * @param {Object} params.projectSettings - Project JSONB settings
 * @param {BigInt} params.amenityCharge - Fixed amenity charge in paise
 *
 * @returns {Object} Complete cost breakdown — all values in paise
 */
export const calculateUnitCost = ({
    superBuiltUpArea,
    baseRate,
    floor,
    facing,
    viewType,
    parking,
    projectSettings = {},
    amenityCharge = 0n,
}) => {
    // Convert to BigInt safely
    const area = BigInt(superBuiltUpArea);
    const rate = BigInt(baseRate);
    const amenity = BigInt(amenityCharge);

    // ── Base Price ────────────────────────────────────────────────────────────
    // area is sqft x 100, rate is per sqft in paise
    // so (area x rate) / 100 = price in paise
    const basePrice = (area * rate) / 100n;

    // ── Floor Rise ────────────────────────────────────────────────────────────
    // projectSettings.floorRise: { startFloor: 5, risePerFloor: 5000 (paise/sqft) }
    let floorRise = 0n;
    if (projectSettings.floorRise && floor > projectSettings.floorRise.startFloor) {
        const floorsAboveBase = BigInt(floor - projectSettings.floorRise.startFloor);
        const risePerFloor = BigInt(projectSettings.floorRise.risePerFloor || 0);
        floorRise = (area * risePerFloor * floorsAboveBase) / 100n;
    }

    // ── PLC (Preferential Location Charge) ───────────────────────────────────
    // projectSettings.plc: { Sea: 50000, Garden: 30000, Pool: 40000, NE: 20000 }
    let plc = 0n;
    if (projectSettings.plc) {
        const plcSettings = projectSettings.plc;

        // View type PLC
        if (viewType && plcSettings[viewType]) {
            plc += (area * BigInt(plcSettings[viewType])) / 100n;
        }

        // Facing PLC
        if (facing && plcSettings[facing]) {
            plc += (area * BigInt(plcSettings[facing])) / 100n;
        }
    }

    // ── Agreement Value (before taxes) ───────────────────────────────────────
    const agreementValue = basePrice + floorRise + plc + amenity;

    // ── GST ──────────────────────────────────────────────────────────────────
    // 5% GST on agreement value (Indian residential property rate)
    const gstAmount = (agreementValue * 5n) / 100n;

    // ── Stamp Duty ────────────────────────────────────────────────────────────
    // 6% stamp duty on agreement value (Maharashtra rate — configurable)
    const stampDutyRate = BigInt(projectSettings.stampDutyRate || 6);
    const stampDuty = (agreementValue * stampDutyRate) / 100n;

    // ── Registration ──────────────────────────────────────────────────────────
    // 1% registration fee on agreement value (capped at ₹30,000 = 3000000 paise)
    const registrationFee = (agreementValue * 1n) / 100n;
    const registration = registrationFee > 3000000n ? 3000000n : registrationFee;

    // ── Total Price ───────────────────────────────────────────────────────────
    const totalPrice = agreementValue + gstAmount + stampDuty + registration;

    return {
        basePrice,
        floorRise,
        plc,
        amenityCharge: amenity,
        agreementValue,
        gstAmount,
        stampDuty,
        registration,
        totalPrice,
    };
};

/**
 * formatCostSheetForDisplay — converts paise values to rupees
 * for API responses. Always use this before sending to client.
 *
 * @param {Object} costSheet - Output from calculateUnitCost
 * @returns {Object} Same structure with values in rupees (numbers)
 */
export const formatCostSheetForDisplay = (costSheet) => {
    const toRupees = (paise) => Number(paise) / 100;

    return {
        basePrice: toRupees(costSheet.basePrice),
        floorRise: toRupees(costSheet.floorRise),
        plc: toRupees(costSheet.plc),
        amenityCharge: toRupees(costSheet.amenityCharge),
        agreementValue: toRupees(costSheet.agreementValue),
        gstAmount: toRupees(costSheet.gstAmount),
        stampDuty: toRupees(costSheet.stampDuty),
        registration: toRupees(costSheet.registration),
        totalPrice: toRupees(costSheet.totalPrice),
        currency: 'INR',
    };
};

/**
 * paiseToRupees — simple converter for single values.
 */
export const paiseToRupees = (paise) => Number(BigInt(paise)) / 100;

/**
 * rupeesToPaise — simple converter for incoming API values.
 */
export const rupeesToPaise = (rupees) => BigInt(Math.round(Number(rupees) * 100));
