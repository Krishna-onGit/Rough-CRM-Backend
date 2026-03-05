import { Queue, Worker } from 'bullmq';
import { bullMQConnection } from '../config/redis.js';
import prisma from '../config/database.js';
import { isDev } from '../config/env.js';

const QUEUE_NAME = 'demand-overdue';

export const demandOverdueQueue = new Queue(QUEUE_NAME, {
    connection: bullMQConnection,
    defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 100,
        attempts: 3,
        backoff: { type: 'exponential', delay: 10000 },
    },
});

export const demandOverdueWorker = new Worker(
    QUEUE_NAME,
    async (job) => {
        if (isDev) {
            console.log(`[DemandOverdue] Running job: ${job.id}`);
        }

        const now = new Date();

        // Find demand letters that are past due and not yet marked overdue
        const overdueLetters = await prisma.demandLetter.findMany({
            where: {
                status: { in: ['pending', 'partially_paid'] },
                dueDate: { lte: now },
            },
            select: {
                id: true,
                letterCode: true,
                organizationId: true,
                demandAmount: true,
                paidAmount: true,
            },
        });

        if (overdueLetters.length === 0) {
            return { marked: 0, message: 'No overdue demand letters found.' };
        }

        const letterIds = overdueLetters.map((l) => l.id);

        await prisma.demandLetter.updateMany({
            where: { id: { in: letterIds } },
            data: { status: 'overdue' },
        });

        // Also mark associated payment schedule items as overdue
        await prisma.paymentSchedule.updateMany({
            where: {
                linkedDemandId: { in: letterIds },
                status: { in: ['upcoming', 'due'] },
            },
            data: { status: 'overdue' },
        });

        if (isDev) {
            console.log(
                `[DemandOverdue] Marked ${overdueLetters.length} demand letters as overdue`
            );
        }

        return {
            marked: overdueLetters.length,
            message: `Marked ${overdueLetters.length} demand letter(s) as overdue.`,
        };
    },
    { connection: bullMQConnection }
);

// ── Schedule daily at 1:00 AM ────────────────────────────────────────────────
const repeatableJobs = await demandOverdueQueue.getRepeatableJobs();
for (const job of repeatableJobs) {
    if (job.name === 'check-overdue-demands') {
        await demandOverdueQueue.removeRepeatableByKey(job.key);
    }
}

await demandOverdueQueue.add(
    'check-overdue-demands',
    {},
    {
        repeat: { every: 60 * 60 * 1000 }, // every 1 hour
        jobId: 'demand-overdue-cron',
    }
);

demandOverdueWorker.on('completed', (job, result) => {
    if (isDev && result.marked > 0) {
        console.log(`[DemandOverdue] Job ${job.id} completed:`, result.message);
    }
});

demandOverdueWorker.on('failed', (job, err) => {
    console.error(`[DemandOverdue] Job ${job?.id} failed:`, err.message);
});
