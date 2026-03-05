import fs from 'fs';

const url = 'http://localhost:5000/v1';

async function run() {
    const loginRes = await fetch(url + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            organizationSlug: 'skyline-dev',
            email: 'rajesh@skyline-dev.com',
            password: 'SecurePass@123'
        })
    });
    const loginData = await loginRes.json();
    const token = loginData?.data?.tokens?.accessToken || loginData?.data?.accessToken || loginData?.data?.token;

    if (!token) {
        console.error('Failed to login:', loginData);
        return;
    }

    console.log('\n--- 500 ERROR CATCH TEST ---');
    const res1 = await fetch(url + '/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
            "projectCode": "SKY-001",
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
        })
    });
    const data1 = await res1.json();
    console.log('Status:', res1.status);
    console.log(JSON.stringify(data1, null, 2));
}

run();
