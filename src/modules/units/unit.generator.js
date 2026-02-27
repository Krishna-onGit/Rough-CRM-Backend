import { calculateUnitCost } from '../../shared/costSheet.js';

// Unit configurations assigned by position on floor
// Position 1 = typically corner unit = 2BHK or 3BHK
// This is the default config map — overridable per project
const POSITION_CONFIG_MAP = {
    1: 'BHK_2',
    2: 'BHK_3',
    3: 'BHK_2',
    4: 'BHK_3',
    5: 'BHK_4',
    6: 'BHK_2',
    7: 'BHK_3',
    8: 'BHK_2',
};

// Default facing assignment by position
const POSITION_FACING_MAP = {
    1: 'NE',
    2: 'N',
    3: 'NW',
    4: 'E',
    5: 'W',
    6: 'SE',
    7: 'S',
    8: 'SW',
};

// Default area by config (in sqft x 100 for BigInt storage)
const CONFIG_AREA_MAP = {
    BHK_1: { carpet: 45000n, builtUp: 55000n, superBuiltUp: 65000n },
    BHK_2: { carpet: 65000n, builtUp: 80000n, superBuiltUp: 95000n },
    BHK_3: { carpet: 90000n, builtUp: 110000n, superBuiltUp: 130000n },
    BHK_4: { carpet: 120000n, builtUp: 145000n, superBuiltUp: 170000n },
    Penthouse: { carpet: 180000n, builtUp: 220000n, superBuiltUp: 260000n },
};

/**
 * generateUnitNumber — creates the display unit number.
 * Format: {TowerName}-{Floor}{UnitPosition padded to 2 digits}
 * Example: Tower A, Floor 12, Position 3 → "A-1203"
 *
 * @param {string} towerName - e.g. "Tower A" or "Wing 1"
 * @param {number} floor
 * @param {number} position - unit position on floor (1-based)
 * @returns {string} unit number
 */
const generateUnitNumber = (towerName, floor, position) => {
    // Extract short prefix from tower name
    // "Tower A" → "A", "Wing 1" → "W1", "Block B" → "B"
    const parts = towerName.trim().split(/\s+/);
    let prefix = '';
    if (parts.length >= 2) {
        prefix = parts[parts.length - 1].toUpperCase();
    } else {
        prefix = towerName.substring(0, 2).toUpperCase();
    }

    const floorStr = String(floor);
    const posStr = String(position).padStart(2, '0');
    return `${prefix}-${floorStr}${posStr}`;
};

/**
 * generateUnitCode — creates a unique sortable code.
 * Format: {TowerPrefix}-F{floor padded}-U{position padded}
 * Example: "A-F12-U03"
 */
const generateUnitCode = (towerName, floor, position) => {
    const parts = towerName.trim().split(/\s+/);
    let prefix = parts.length >= 2
        ? parts[parts.length - 1].toUpperCase()
        : towerName.substring(0, 2).toUpperCase();

    const floorStr = String(floor).padStart(2, '0');
    const posStr = String(position).padStart(2, '0');
    return `${prefix}-F${floorStr}-U${posStr}`;
};

/**
 * generateUnitsForTower — the main export.
 * Generates all unit records for a tower ready for
 * prisma.unit.createMany().
 *
 * @param {Object} params
 * @param {string} params.organizationId
 * @param {string} params.projectId
 * @param {string} params.towerId
 * @param {string} params.towerName
 * @param {number} params.floors
 * @param {number} params.unitsPerFloor
 * @param {BigInt} params.baseRate - in paise per sqft
 * @param {Object} params.projectSettings
 * @param {string} params.createdBy
 *
 * @returns {Array} Array of unit objects for createMany
 */
export const generateUnitsForTower = ({
    organizationId,
    projectId,
    towerId,
    towerName,
    floors,
    unitsPerFloor,
    baseRate,
    projectSettings = {},
    createdBy,
}) => {
    const units = [];
    const rate = BigInt(baseRate);

    for (let floor = 1; floor <= floors; floor++) {
        for (let position = 1; position <= unitsPerFloor; position++) {
            // Assign config based on position (cycling if more than 8 units/floor)
            const configKey = POSITION_CONFIG_MAP[position] ||
                POSITION_CONFIG_MAP[((position - 1) % 8) + 1];

            // Top floor gets Penthouse config
            const config = floor === floors && position <= 2
                ? 'Penthouse'
                : configKey;

            const facing = POSITION_FACING_MAP[position] ||
                POSITION_FACING_MAP[((position - 1) % 8) + 1];

            // Get area defaults for this config
            const areas = CONFIG_AREA_MAP[config] || CONFIG_AREA_MAP.BHK_2;

            // Calculate full cost sheet
            const costSheet = calculateUnitCost({
                superBuiltUpArea: areas.superBuiltUp,
                baseRate: rate,
                floor,
                facing,
                viewType: null,
                parking: 'Covered',
                projectSettings,
                amenityCharge: 0n,
            });

            const unitNumber = generateUnitNumber(towerName, floor, position);
            const unitCode = generateUnitCode(towerName, floor, position);

            units.push({
                organizationId,
                projectId,
                towerId,
                unitNumber,
                unitCode,
                floor,
                config,
                facing,
                parking: 'Covered',
                carpetArea: areas.carpet,
                builtUpArea: areas.builtUp,
                superBuiltUpArea: areas.superBuiltUp,
                baseRate: rate,
                basePrice: costSheet.basePrice,
                floorRise: costSheet.floorRise,
                plc: costSheet.plc,
                amenityCharge: costSheet.amenityCharge,
                agreementValue: costSheet.agreementValue,
                gstAmount: costSheet.gstAmount,
                stampDuty: costSheet.stampDuty,
                registration: costSheet.registration,
                totalPrice: costSheet.totalPrice,
                status: 'available',
                isActive: true,
                createdBy: createdBy || null,
                updatedBy: createdBy || null,
            });
        }
    }

    return units;
};
