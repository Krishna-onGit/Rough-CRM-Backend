import { createProject } from './src/modules/projects/project.service.js';

BigInt.prototype.toJSON = function () {
    const int = Number.parseInt(this.toString());
    return Number.isSafeInteger(int) ? int : this.toString();
};

async function test() {
    try {
        const body = {
            "projectCode": "SKY-" + Math.floor(Math.random() * 10000),
            "name": "Skyline Heights",
            "city": "Pune",
            "location": "Hinjewadi Phase 3",
            "projectType": "Residential",
            "baseRate": 7500,
            "reraNumber": "RERA-MH-2024-001",
            "settings": {
                "floorRise": { "startFloor": 5, "risePerFloor": 50 },
                "plc": {}
            },
            "towers": [
                {
                    "name": "Tower A",
                    "floors": 15,
                    "unitsPerFloor": 4
                }
            ]
        };

        const result = await createProject(
            "dummy_org_id",
            "dummy_user_id",
            body
        );
        const jsonString = JSON.stringify(result);
        console.log("Success Stringify!");
    } catch (e) {
        console.error("Stringify failed:", e.message);
    } finally {
        process.exit(0);
    }
}

test();
