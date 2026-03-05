import prisma from './src/config/database.js';
import { redis } from './src/config/redis.js';
import { blockUnit, releaseUnit, getUnit, listUnits } from './src/modules/units/unit.service.js';

async function runTests() {
    const org = await prisma.organization.findFirst();
    if (!org) {
        console.log('No org found');
        return;
    }
    const orgId = org.id;

    const spName = 'Test SP ' + Date.now();
    console.log('Creating Sales Person...');
    const sp = await prisma.salesPerson.create({
        data: { organizationId: orgId, name: spName, email: Date.now() + '@mail.com', mobile: '9999999999' }
    });

    const units = await prisma.unit.findMany({ where: { organizationId: orgId, status: 'available' }, take: 4 });
    if (units.length < 4) {
        console.log('Not enough units to test');
        return;
    }

    // TEST 1 & TEST 2 - Block limits and Redis
    console.log('\n--- TEST 1 Phase ---');
    await blockUnit(orgId, units[0].id, 'admin1', { salesPersonId: sp.id });
    let count = await redis.get(`sp:blocks:${orgId}:${sp.id}`);
    console.log('Blocked 1. Redis count = ' + count);

    await blockUnit(orgId, units[1].id, 'admin1', { salesPersonId: sp.id });
    count = await redis.get(`sp:blocks:${orgId}:${sp.id}`);
    console.log('Blocked 2. Redis count = ' + count);

    await blockUnit(orgId, units[2].id, 'admin1', { salesPersonId: sp.id });
    count = await redis.get(`sp:blocks:${orgId}:${sp.id}`);
    console.log('Blocked 3. Redis count = ' + count);

    try {
        console.log('Attempting Block 4...');
        await blockUnit(orgId, units[3].id, 'admin1', { salesPersonId: sp.id });
        console.log('ERROR: 4th block succeeded!');
    } catch (e) {
        console.log('4th block rejected with: ' + e.message);
    }

    console.log('\n--- Release Phase ---');
    await releaseUnit(orgId, units[0].id, 'admin1');
    count = await redis.get(`sp:blocks:${orgId}:${sp.id}`);
    console.log('Released 1. Redis count = ' + count);

    await blockUnit(orgId, units[3].id, 'admin1', { salesPersonId: sp.id });
    count = await redis.get(`sp:blocks:${orgId}:${sp.id}`);
    console.log('Blocked 4 successfully. Redis count = ' + count);

    // TEST 3 - Lazy expiry
    console.log('\n--- TEST 3 Phase ---');
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    await prisma.unit.update({
        where: { id: units[1].id },
        data: { blockExpiresAt: pastDate }
    });

    console.log('Manually expired unit 2 in DB. Fetching with getUnit...');
    const u = await getUnit(orgId, units[1].id);
    console.log('Unit status returned from getUnit (should be available): ' + u.data.status);

    const dbUnit = await prisma.unit.findUnique({ where: { id: units[1].id } });
    console.log('Unit status in DB (should be available): ' + dbUnit.status);

    // List passing test
    await prisma.unit.update({
        where: { id: units[2].id },
        data: { blockExpiresAt: pastDate }
    });
    console.log('Manually expired unit 3 in DB. Fetching with listUnits...');
    const pag = await listUnits(orgId, {});
    const lu = pag.data.items.find(x => x.id === units[2].id);
    console.log('Unit 3 status in listUnits result (should be available): ' + lu.status);

    // finish
    process.exit();
}
runTests().catch(console.error);
