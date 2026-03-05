import { Worker } from 'bullmq';
import { bullMQConnection } from '../config/redis.js';
import { logger } from '../config/logger.js';
import { sendEmail } from '../integrations/email.js';
import { sendSMS } from '../integrations/sms.js';

const interpolate = (template, payload) => {
    if (!template) return '';
    return template.replace(/\{(\w+)\}/g, (match, key) => {
        return payload[key] !== undefined ? payload[key] : match;
    });
};

const NOTIFICATION_TEMPLATES = {
    BOOKING_CONFIRMED: {
        email: {
            subject: 'Booking Confirmed — {bookingCode}',
            body:
                'Dear {customerName},\n\n' +
                'Your booking {bookingCode} has been confirmed.\n' +
                'Unit: {unitNumber}\n' +
                'Agreement Value: ₹{agreementValue}\n\n' +
                'Thank you for choosing us.\n\nLeadFlow AI',
        },
        sms:
            'Booking confirmed: {bookingCode}. ' +
            'Unit {unitNumber}. Value: Rs.{agreementValue}. ' +
            'LeadFlow AI',
    },
    PAYMENT_RECEIVED: {
        email: {
            subject: 'Payment Received — ₹{amount}',
            body:
                'Dear {customerName},\n\n' +
                'Payment of ₹{amount} received.\n' +
                'Receipt: {receiptNumber}\n' +
                'Booking: {bookingCode}\n\nLeadFlow AI',
        },
        sms:
            'Payment of Rs.{amount} received. ' +
            'Receipt: {receiptNumber}. LeadFlow AI',
    },
    PAYMENT_BOUNCED: {
        email: {
            subject: 'Payment Bounced — Action Required',
            body:
                'Dear {customerName},\n\n' +
                'Your payment of ₹{amount} has bounced.\n' +
                'Reason: {bounceReason}\n' +
                'Complaint Ref: {complaintCode}\n' +
                'Please contact our office immediately.\n\nLeadFlow AI',
        },
        sms:
            'ALERT: Payment Rs.{amount} bounced. ' +
            'Ref: {complaintCode}. Call us immediately. LeadFlow AI',
    },
    BOOKING_CANCELLED: {
        email: {
            subject: 'Booking Cancelled',
            body:
                'Dear {customerName},\n\n' +
                'Your booking has been cancelled.\n' +
                'Refund will be processed within 30 working days.\n\n' +
                'LeadFlow AI',
        },
        sms:
            'Your booking has been cancelled. ' +
            'Refund processing in 30 days. LeadFlow AI',
    },
    TRANSFER_COMPLETED: {
        email: {
            subject: 'Ownership Transfer Completed',
            body:
                'Dear {customerName},\n\n' +
                'The ownership transfer has been completed.\n' +
                'Booking: {bookingCode}\n\nLeadFlow AI',
        },
        sms: null,  // email only
    },
    POSSESSION_COMPLETED: {
        email: {
            subject: 'Congratulations! Possession Handed Over',
            body:
                'Dear {customerName},\n\n' +
                'Possession of your unit has been handed over.\n' +
                'We wish you a wonderful new beginning!\n\nLeadFlow AI',
        },
        sms:
            'Congratulations! Possession of your unit is complete. ' +
            'LeadFlow AI',
    },
    REGISTRATION_COMPLETED: {
        email: {
            subject: 'Sale Registered Successfully',
            body:
                'Dear {customerName},\n\n' +
                'Your sale deed has been registered.\n' +
                'Registration No: {registrationNumber}\n\nLeadFlow AI',
        },
        sms: null,
    },
    SLA_BREACHED: {
        email: {
            subject: '⚠️ SLA Breach — {complaintCode}',
            body:
                'Operations Team,\n\n' +
                'Complaint {complaintCode} has breached its SLA.\n' +
                'Category: {category}\n' +
                'Priority: {priority}\n' +
                'SLA Deadline: {slaDeadline}\n\n' +
                'Immediate action required.\n\nLeadFlow AI',
        },
        sms: null,
    },
    APPROVAL_ESCALATED: {
        email: {
            subject: '⏰ Approval Pending {hoursElapsed}h — {approvalCode}',
            body:
                'Admin Team,\n\n' +
                'Approval request {approvalCode} has been pending ' +
                'for {hoursElapsed} hours.\n' +
                'Type: {requestType}\n' +
                'Please review immediately.\n\nLeadFlow AI',
        },
        sms: null,
    },
    APPROVAL_PENDING: {
        email: {
            subject: 'Approval Required — {requestType}',
            body:
                'Dear Approver,\n\n' +
                'A new approval request requires your review.\n' +
                'Type: {requestType}\n' +
                'Code: {approvalCode}\n\n' +
                'Please log in to review.\n\nLeadFlow AI',
        },
        sms: null,
    },
};

export const notificationWorker = new Worker(
    'notifications',
    async (job) => {
        const { name: type, data: payload } = job;

        const template = NOTIFICATION_TEMPLATES[type];
        if (!template) {
            logger.warn('[Notification] Unknown type — skipping', {
                type,
            });
            return { sent: false, reason: 'unknown_type' };
        }

        const results = {};

        // ── Email ─────────────────────────────────────────────────────
        if (template.email && payload.customerEmail) {
            const subject = interpolate(
                template.email.subject, payload
            );
            const text = interpolate(template.email.body, payload);

            results.email = await sendEmail({
                to: payload.customerEmail,
                subject,
                text,
            });
        }

        // ── SMS ───────────────────────────────────────────────────────
        if (template.sms && payload.customerMobile) {
            // Ensure mobile has country code
            const mobile = payload.customerMobile.startsWith('91')
                ? payload.customerMobile
                : `91${payload.customerMobile}`;

            const message = interpolate(template.sms, payload);

            results.sms = await sendSMS({ to: mobile, message });
        }

        logger.info('[Notification] Processed', { type, results });
        return results;
    },
    { connection: bullMQConnection }
);

notificationWorker.on('failed', (job, err) => {
    logger.error('[NotificationWorker] Job failed', {
        jobId: job?.id,
        jobName: job?.name,
        errorMessage: err.message,
    });
});
