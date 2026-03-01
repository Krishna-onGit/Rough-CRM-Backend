import { Queue, Worker, QueueEvents } from 'bullmq';
import { bullMQConnection } from '../config/redis.js';
import prisma from '../config/database.js';
import { isDev } from '../config/env.js';

const QUEUE_NAME = 'block-expiry';

// ── Queue (used to add jobs) ─────────────────────────────────────────────────
export const blockExpiryQueue = new Queue(QUEUE_NAME, {
    connection: bullMQConnection,
    defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 200,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
    },
});

// ── Worker (processes jobs) ──────────────────────────────────────────────────
export const blockExpiryWorker = new Worker(
    QUEUE_NAME,
    async (job) => {
        if (isDev) {
            console.log(`[BlockExpiry] Running job: ${job.id}`);
        }

        const now = new Date();

        // Find all expired blocked units
        const expiredUnits = await prisma.unit.findMany({
            where: {
                status: 'blocked',
                blockExpiresAt: { lte: now },
            },
            select: {
                id: true,
                unitNumber: true,
                organizationId: true,
                blockedBy: true,
                blockExpiresAt: true,
            },
        });

        if (expiredUnits.length === 0) {
            return { released: 0, message: 'No expired blocks found.' };
        }

        // Release all expired units in one batch update
        const unitIds = expiredUnits.map((u) => u.id);

        await prisma.unit.updateMany({
            where: { id: { in: unitIds } },
            data: {
                status: 'available',
                blockedBy: null,
                blockedAt: null,
                blockExpiresAt: null,
                blockAgentId: null,
            },
        });

        if (isDev) {
            console.log(
                `[BlockExpiry] Released ${expiredUnits.length} expired blocks:`,
                expiredUnits.map((u) => u.unitNumber)
            );
        }

        return {
            released: expiredUnits.length,
            unitIds,
            message: `Released ${expiredUnits.length} expired block(s).`,
        };
    },
    { connection: bullMQConnection }
);

// ── Schedule recurring job (every 15 minutes) ────────────────────────────────
export const scheduleBlockExpiryJob = async () => {
    // Remove any existing repeatable job first (prevent duplicates on restart)
    const repeatableJobs = await blockExpiryQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
        await blockExpiryQueue.removeRepeatableByKey(job.key);
    }

    // Add new repeatable job
    await blockExpiryQueue.add(
        'check-expired-blocks',
        {},
        {
            repeat: { every: 15 * 60 * 1000 }, // every 15 minutes
            jobId: 'block-expiry-cron',
        }
    );

    if (isDev) {
        console.log('[BlockExpiry] Cron job scheduled: every 15 minutes');
    }
};

// ── Worker event logging ─────────────────────────────────────────────────────
blockExpiryWorker.on('completed', (job, result) => {
    if (isDev && result.released > 0) {
        console.log(`[BlockExpiry] Job ${job.id} completed:`, result.message);
    }
});

blockExpiryWorker.on('failed', (job, err) => {
    console.error(`[BlockExpiry] Job ${job?.id} failed:`, err.message);
});
