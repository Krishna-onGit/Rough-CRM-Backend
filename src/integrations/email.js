import sgMail from '@sendgrid/mail';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

// Initialize SendGrid
if (env.SENDGRID_API_KEY) {
    sgMail.setApiKey(env.SENDGRID_API_KEY);
}

const FROM = {
    email: env.SENDGRID_FROM_EMAIL || 'noreply@leadflow.ai',
    name: env.SENDGRID_FROM_NAME || 'LeadFlow AI',
};

/**
 * sendEmail — sends a transactional email via SendGrid.
 *
 * @param {Object} options
 * @param {string} options.to          — recipient email
 * @param {string} options.subject     — email subject
 * @param {string} options.text        — plain text body
 * @param {string} [options.html]      — HTML body (optional)
 * @returns {Promise<boolean>}
 */
export const sendEmail = async ({ to, subject, text, html }) => {
    if (!env.SENDGRID_API_KEY) {
        logger.warn('[Email] SENDGRID_API_KEY not configured', {
            to, subject,
        });
        return false;
    }

    if (!to || !subject || !text) {
        logger.warn('[Email] Missing required fields', {
            to, subject,
        });
        return false;
    }

    try {
        await sgMail.send({
            to,
            from: FROM,
            subject,
            text,
            html: html || text,
        });

        logger.info('[Email] Sent successfully', { to, subject });
        return true;

    } catch (err) {
        logger.error('[Email] Send failed', {
            to,
            subject,
            statusCode: err.code,
            message: err.message,
        });
        throw err; // Re-throw so BullMQ retry mechanism triggers
    }
};
