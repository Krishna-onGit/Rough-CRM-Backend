import axios from 'axios';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const MSG91_BASE_URL = 'https://api.msg91.com/api/v5/flow/';

/**
 * sendSMS — sends a transactional SMS via MSG91.
 * MSG91 is the standard Indian SMS provider.
 *
 * In development (isDev): logs the SMS instead of sending.
 * In production: sends via MSG91 API.
 *
 * @param {Object} options
 * @param {string} options.to      — mobile number with country
 *                                   code e.g. '919876543210'
 * @param {string} options.message — SMS text (max 160 chars)
 * @returns {Promise<boolean>}
 */
export const sendSMS = async ({ to, message }) => {
    if (!to || !message) {
        logger.warn('[SMS] Missing required fields', { to });
        return false;
    }

    // In development, log instead of sending
    if (process.env.NODE_ENV === 'development') {
        logger.info('[SMS] DEV MODE — not sending', {
            to,
            message: message.slice(0, 50) + '...',
        });
        return true;
    }

    if (!env.MSG91_AUTH_KEY) {
        logger.warn('[SMS] MSG91_AUTH_KEY not configured', { to });
        return false;
    }

    try {
        const response = await axios.post(
            'https://api.msg91.com/api/sendhttp.php',
            null,
            {
                params: {
                    authkey: env.MSG91_AUTH_KEY,
                    mobiles: to,
                    message,
                    sender: env.MSG91_SENDER_ID || 'LEADFW',
                    route: env.MSG91_ROUTE || '4',
                    country: '91',
                },
                timeout: 10000, // 10 second timeout
            }
        );

        logger.info('[SMS] Sent successfully', {
            to,
            response: response.data,
        });
        return true;

    } catch (err) {
        logger.error('[SMS] Send failed', {
            to,
            message: err.message,
        });
        throw err; // Re-throw so BullMQ retry triggers
    }
};
