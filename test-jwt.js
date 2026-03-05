const fetch = require('node-fetch'); // we'll use raw http if fetch not auto

async function testRenew() {
    const url = 'http://localhost:3000/v1/auth/login';
    const loginRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'admin@example.com', // Need to make sure what is seeded or use proper login... wait, let me just check server boot first.
            password: '...',
            organizationSlug: '...'
        })
    });
}
