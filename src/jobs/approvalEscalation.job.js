import { Queue, Worker } from 'bullmq';
import { bullMQConnection } from '../config/redis.js';
import prisma from '../config/database.js';
import { dispatchNotification } from './notificationDispatch.js';
import { logger } from '../config/logger.js';

const QUEUE_NAME = 'approval-escalation';
const JOB_NAME = 'escalate-stale-approvals';
const INTERVAL_MS = 30 * 60 * 1000;       // 30 minutes
const ESCALATION_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48 hours

// ── Queue ─────────────────────────────────────────────────────────────────────
export const approvalEscalationQueue = new Queue(QUEUE_NAME, {
    connection: bullMQConnection,
    defaultJobOptions: {
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 50 },
    },
});

// ── Register repeatable job on startup ────────────────────────────────────────
await approvalEscalationQueue.add(
    JOB_NAME,
    {},
    { repeat: { every: INTERVAL_MS } }
);

logger.info(
    `[ApprovalEscalationJob] Scheduled every ${INTERVAL_MS / 60000} minutes`
);

// ── Worker ────────────────────────────────────────────────────────────────────
export const approvalEscalationWorker = new Worker(
    QUEUE_NAME,
    async () => {
        try {
            const now = new Date();
            const threshold = new Date(now.getTime() - ESCALATION_THRESHOLD_MS);

            // Find approvals pending > 48 hours and not yet escalated
            // Check if escalatedAt field exists — if ApprovalRequest
            // model has escalatedAt, use it. Otherwise use a fallback.
            const staleApprovals = await prisma.approvalRequest.findMany({
                where: {
                    status: 'pending',
                    createdAt: { lt: threshold },
                    escalatedAt: null,  // not yet escalated
                },
                select: {
                    id: true,
                    approvalCode: true,
                    organizationId: true,
                    requestType: true,
                    requestedBy: true,
                    createdAt: true,
                    entityType: true,
                    entityId: true,
                },
            });

            if (staleApprovals.length === 0) {
                logger.info('[ApprovalEscalationJob] No stale approvals found');
                return;
            }

            logger.info(
                `[ApprovalEscalationJob] Escalating ${staleApprovals.length} approval(s)`
            );

            // Mark as escalated + notify per approval
            for (const approval of staleApprovals) {
                // Mark escalated
                await prisma.approvalRequest.update({
                    where: { id: approval.id },
                    data: { escalatedAt: now },
                });

                // Dispatch escalation notification
                await dispatchNotification('APPROVAL_ESCALATED', {
                    organizationId: approval.organizationId,
                    approvalId: approval.id,
                    approvalCode: approval.approvalCode,
                    requestType: approval.requestType,
                    requestedBy: approval.requestedBy,
                    hoursElapsed: Math.floor(
                        (now - new Date(approval.createdAt)) / (1000 * 60 * 60)
                    ),
                    entityType: approval.entityType,
                    entityId: approval.entityId,
                }).catch((err) => {
                    logger.error(
                        '[ApprovalEscalationJob] Notification dispatch failed',
                        { approvalCode: approval.approvalCode, err: err.message }
                    );
                });
            }

        } catch (err) {
            logger.error('[ApprovalEscalationJob] Job execution failed', {
                err: err.message,
                stack: err.stack,
            });
        }
    },
    { connection: bullMQConnection }
);

approvalEscalationWorker.on('failed', (job, err) => {
    logger.error(`[ApprovalEscalationJob] Worker job failed`, {
        jobId: job?.id,
        err: err.message,
    });
});

approvalEscalationWorker.on('completed', (job) => {
    logger.info(`[ApprovalEscalationJob] Run completed`, { jobId: job.id });
});
