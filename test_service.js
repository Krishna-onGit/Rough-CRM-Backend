import { createProject } from './src/modules/projects/project.service.js';

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
            }
        };

        const result = await createProject(
            "dummy_org_id",
            "dummy_user_id",
            body
        );
        console.log("Success");
    } catch (e) {
        console.error("FAILED", e.message);
    } finally {
        process.exit(0);
    }
}

test();
