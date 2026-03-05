import { PrismaClient } from '@prisma/client';
import { triggerCascade } from './src/cascade/cascadeEngine.js';
import { CascadeEvents } from './src/cascade/types.js';

const prisma = new PrismaClient();

async function runTest1() {
    console.log('\n--- TEST 1: Unit Cancelled ---');
    // just dry run cascade function if records don't exist
    // actually wait I should try to make mock data or just invoke cascade over empty db to ensure no crashes
    const tx = prisma;
    const notifications = [];
    try {
        await triggerCascade(CascadeEvents.UNIT_CANCELLED, {
            bookingId: "b-01", unitId: "u-01", organizationId: "o-01", customerId: "c-01"
        }, tx, notifications);
        console.log("TEST 1 cascade triggered successfully.");
        console.log("Notifications queued: ", notifications);
    } catch (e) {
        console.error("TEST 1 error:", e);
    }
}

async function runTest2() {
    console.log('\n--- TEST 2: Payment Bounced ---');
    const tx = prisma;
    const notifications = [];
    try {
        const res = await triggerCascade(CascadeEvents.PAYMENT_BOUNCED, {
            paymentId: "p-01", bookingId: "b-01", organizationId: "o-01", customerId: "c-01", unitId: "u-01", amount: 100000n, bounceReason: "NSF"
        }, tx, notifications);
        console.log("TEST 2 cascade triggered successfully.");
        console.log("Complaint Auto-Created: " + res.complaintCode);
        console.log("Notifications queued: ", notifications);
    } catch (e) {
        console.error("TEST 2 error:", e);
    }
}

async function main() {
    await runTest1();
    await runTest2();
}

main().finally(() => prisma.$disconnect());
