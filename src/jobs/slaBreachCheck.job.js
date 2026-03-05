import { Queue, Worker } from 'bullmq';
import { bullMQConnection } from '../config/redis.js';
import prisma from '../config/database.js';
import { dispatchNotification } from './notificationDispatch.js';
import { logger } from '../config/logger.js';

const QUEUE_NAME = 'sla-breach-check';
const JOB_NAME = 'check-sla-breaches';
const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// ── Queue ────────────────────────────────────────────────────────────────────
export const slaBreachQueue = new Queue(QUEUE_NAME, {
    connection: bullMQConnection,
    defaultJobOptions: {
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 50 },
    },
});

// ── Register repeatable job on startup ───────────────────────────────────────
await slaBreachQueue.add(
    JOB_NAME,
    {},
    { repeat: { every: INTERVAL_MS } }
);

logger.info(`[SLABreachJob] Scheduled every ${INTERVAL_MS / 60000} minutes`);

// ── Worker ───────────────────────────────────────────────────────────────────
export const slaBreachWorker = new Worker(
    QUEUE_NAME,
    async () => {
        try {
            const now = new Date();

            // Step 1: Mark all breached complaints in one query
            const breachResult = await prisma.complaint.updateMany({
                where: {
                    status: { notIn: ['resolved', 'closed'] },
                    slaDeadline: { lt: now },
                    slaBreached: false,
                },
                data: { slaBreached: true },
            });

            if (breachResult.count === 0) {
                logger.info('[SLABreachJob] No new SLA breaches found');
                return;
            }

            logger.info(
                `[SLABreachJob] Marked ${breachResult.count} complaint(s) as SLA breached`
            );

            // Step 2: Fetch breached complaints for notifications
            const breachedComplaints = await prisma.complaint.findMany({
                where: {
                    status: { notIn: ['resolved', 'closed'] },
                    slaDeadline: { lt: now },
                    slaBreached: true,
                    // Only notify for complaints breached in last 31 minutes
                    // to avoid re-notifying on every job run
                    updatedAt: {
                        gte: new Date(now.getTime() - INTERVAL_MS - 60000),
                    },
                },
                select: {
                    id: true,
                    complaintCode: true,
                    organizationId: true,
                    customerId: true,
                    category: true,
                    priority: true,
                    slaDeadline: true,
                },
            });

            // Step 3: Dispatch per-complaint notifications
            for (const complaint of breachedComplaints) {
                await dispatchNotification('SLA_BREACHED', {
                    organizationId: complaint.organizationId,
                    complaintId: complaint.id,
                    complaintCode: complaint.complaintCode,
                    customerId: complaint.customerId,
                    category: complaint.category,
                    priority: complaint.priority,
                    slaDeadline: complaint.slaDeadline,
                }).catch((err) => {
                    logger.error('[SLABreachJob] Notification dispatch failed', {
                        complaintCode: complaint.complaintCode,
                        err: err.message,
                    });
                });
            }

        } catch (err) {
            // Never crash the worker — log and continue
            logger.error('[SLABreachJob] Job execution failed', {
                err: err.message,
                stack: err.stack,
            });
        }
    },
    { connection: bullMQConnection }
);

slaBreachWorker.on('failed', (job, err) => {
    logger.error(`[SLABreachJob] Worker job failed`, {
        jobId: job?.id,
        err: err.message,
    });
});

slaBreachWorker.on('completed', (job) => {
    logger.info(`[SLABreachJob] Run completed`, { jobId: job.id });
});
