

const url = 'http://localhost:5000/v1';

async function run() {
    const loginRes = await fetch(url + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            organizationSlug: 'moonlight-realty',
            email: 'rajesh@moonlight.com',
            password: 'Admin1234'
        })
    });

    const loginData = await loginRes.json();
    // Using the actual response structure from the login
    let token = loginData?.data?.tokens?.accessToken || loginData?.data?.accessToken;

    // Let's create an org and user if not exists
    if (!token) {
        const regRes = await fetch(url + '/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orgName: "Tester Org",
                orgSlug: "test-org",
                fullName: "Testing",
                email: "test@test.com",
                password: "Admin1234"
            })
        });
        const regData = await regRes.json();
        token = regData?.data?.tokens?.accessToken;
    }

    console.log('\n--- CATCH TEST ---');
    const res1 = await fetch(url + '/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
            "projectCode": "TEST-001",
            "name": "Test Project",
            "city": "Mumbai",
            "projectType": "residential"
        })
    });
    const data1 = await res1.json();
    console.log('Status HTTP:', res1.status);
    console.log('Response body:', JSON.stringify(data1, null, 2));

}
run().catch(console.error);
