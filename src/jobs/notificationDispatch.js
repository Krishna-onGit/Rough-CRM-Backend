import { Queue } from 'bullmq';
import { bullMQConnection } from '../config/redis.js';

export const notificationQueue = new Queue('notifications', {
    connection: bullMQConnection,
    defaultJobOptions: {
        removeOnComplete: 200,
        removeOnFail: 500,
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
    },
});

/**
 * dispatchNotification — adds a notification job to the queue.
 * Worker will be implemented in Phase 8.
 *
 * @param {string} type - Notification type
 * @param {Object} payload - Notification data
 */
export const dispatchNotification = async (type, payload) => {
    await notificationQueue.add(type, payload, {
        priority: payload.priority === 'high' ? 1 : 10,
    });
};
