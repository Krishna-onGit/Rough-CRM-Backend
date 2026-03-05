import prisma from '../../config/database.js';
import { redis, CacheKeys } from '../../config/redis.js';
import {
    NotFoundError,
    BusinessRuleError,
} from '../../shared/errors.js';
import { logger } from '../../config/logger.js';
import { triggerCascade } from '../../cascade/cascadeEngine.js';
import { CascadeEvents } from '../../cascade/types.js';
import { dispatchNotification } from '../../jobs/notificationDispatch.js';
import {
    parsePagination,
    buildPaginatedResponse,
    buildSingleResponse,
    buildActionResponse,
} from '../../shared/pagination.js';
import {
    buildEnumFilter,
    buildDateRangeFilter,
    cleanObject,
} from '../../shared/filters.js';
import { paiseToRupees, rupeesToPaise } from '../../shared/costSheet.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * generateReceiptNumber — sequential receipt per org.
 * Format: RCPT-0001, RCPT-0002
 */
const generateReceiptNumber = async (organizationId) => {
    const count = await prisma.payment.count({
        where: { organizationId },
    });
    return `RCPT-${String(count + 1).padStart(4, '0')}`;
};

// ── List Payments ─────────────────────────────────────────────────────────────

export const listPayments = async (organizationId, query = {}) => {
    const { skip, take, page, pageSize } = parsePagination(query);

    const where = cleanObject({
        organizationId,
        bookingId: query.bookingId || undefined,
        customerId: query.customerId || undefined,
        unitId: query.unitId || undefined,
        status: buildEnumFilter(query.status),
        paymentMode: buildEnumFilter(query.paymentMode),
        paymentDate: buildDateRangeFilter(query.from, query.to),
    });

    const [payments, total] = await Promise.all([
        prisma.payment.findMany({
            where,
            skip,
            take,
            orderBy: { paymentDate: 'desc' },
            select: {
                id: true,
                receiptNumber: true,
                bookingId: true,
                customerId: true,
                unitId: true,
                amount: true,
                paymentMode: true,
                transactionRef: true,
                paymentDate: true,
                status: true,
                bounceReason: true,
                remarks: true,
                createdAt: true,
            },
        }),
        prisma.payment.count({ where }),
    ]);

    const formatted = payments.map((p) => ({
        ...p,
        amount: paiseToRupees(p.amount),
    }));

    return buildPaginatedResponse(formatted, total, page, pageSize);
};

// ── Record Payment ────────────────────────────────────────────────────────────

export const recordPayment = async (
    organizationId,
    userId,
    body
) => {
    const {
        bookingId,
        customerId,
        unitId,
        demandLetterId,
        amount,
        paymentMode,
        transactionRef,
        paymentDate,
        remarks,
    } = body;

    // Verify booking exists and is active
    const booking = await prisma.booking.findFirst({
        where: {
            id: bookingId,
            organizationId,
            status: { notIn: ['cancelled'] },
        },
    });
    if (!booking) throw new NotFoundError('Booking');

    // Verify unit matches booking
    if (booking.unitId !== unitId) {
        throw new BusinessRuleError(
            'Unit ID does not match the booking.'
        );
    }

    // Verify customer matches booking
    if (booking.customerId !== customerId) {
        throw new BusinessRuleError(
            'Customer ID does not match the booking.'
        );
    }

    const amountPaise = rupeesToPaise(amount);
    const receiptNumber = await generateReceiptNumber(organizationId);

    // ── Auto-clear instant payment modes ─────────────────────────
    // Digital transfers settle immediately — no manual clearing needed.
    // Cheque and demand_draft require bank clearing (manual).
    const INSTANT_PAYMENT_MODES = ['upi', 'neft', 'rtgs', 'imps'];

    const initialStatus = INSTANT_PAYMENT_MODES.includes(
        body.paymentMode?.toLowerCase()
    )
        ? 'cleared'
        : 'under_process';

    // Create payment record safely handling idempotency checks
    let payment;

    try {
        payment = await prisma.payment.create({
            data: {
                organizationId,
                bookingId,
                customerId,
                unitId,
                demandLetterId: demandLetterId || null,
                receiptNumber,
                amount: amountPaise,
                paymentMode,
                transactionRef: transactionRef || null,
                paymentDate: new Date(paymentDate),
                status: initialStatus,
                remarks: remarks || null,
                recordedBy: userId,
                idempotencyKey: body.idempotencyKey || null,
            },
        });
    } catch (err) {
        // P2002 on idempotency_key = duplicate submission, return existing
        if (
            err.code === 'P2002' &&
            err.meta?.target &&
            err.meta.target.some((f) => f.includes('idempotency_key'))
        ) {
            const existing = await prisma.payment.findUnique({
                where: { idempotencyKey: body.idempotencyKey },
            });

            if (existing) {
                return buildActionResponse(
                    {
                        id: existing.id,
                        receiptNumber: existing.receiptNumber,
                        amount: paiseToRupees(existing.amount),
                        status: existing.status,
                        isDuplicate: true,
                    },
                    `Payment already recorded (idempotent retry). ` +
                    `Receipt: ${existing.receiptNumber}.`
                );
            }
        }
        // Re-throw any other error
        throw err;
    }

    // If linked to demand letter — update paid amount
    if (demandLetterId) {
        const demandLetter = await prisma.demandLetter.findFirst({
            where: { id: demandLetterId, organizationId },
        });

        if (demandLetter) {
            const newPaidAmount = demandLetter.paidAmount + amountPaise;
            const newRemaining = demandLetter.demandAmount - newPaidAmount;

            await prisma.demandLetter.update({
                where: { id: demandLetterId },
                data: {
                    paidAmount: newPaidAmount,
                    remaining: newRemaining > 0n ? newRemaining : 0n,
                    status: newRemaining <= 0n
                        ? 'paid'
                        : 'partially_paid',
                },
            });
        }
    }

    await redis.del(
        `analytics:dashboard:${organizationId}`
    ).catch((err) => {
        logger.warn('[Analytics] Cache invalidation failed', {
            err: err.message,
        });
    });

    return buildActionResponse(
        {
            id: payment.id,
            receiptNumber: payment.receiptNumber,
            amount: paiseToRupees(payment.amount),
            paymentMode: payment.paymentMode,
            paymentDate: payment.paymentDate,
            status: payment.status,
        },
        `Payment ${receiptNumber} recorded successfully.`
    );
};

// ── Update Payment Status ─────────────────────────────────────────────────────

export const updatePaymentStatus = async (
    organizationId,
    paymentId,
    userId,
    body
) => {
    const notifications = [];

    const result = await prisma.$transaction(async (tx) => {

        // Fetch payment inside transaction
        const payment = await tx.payment.findFirst({
            where: { id: paymentId, organizationId },
        });
        if (!payment) throw new NotFoundError('Payment');

        if (payment.status === 'cleared') {
            throw new BusinessRuleError(
                'Payment is already cleared and cannot be updated.'
            );
        }

        // Update payment status
        const updated = await tx.payment.update({
            where: { id: paymentId },
            data: {
                status: body.status,
                bounceReason: body.status === 'bounced' ? body.bounceReason : null,
                bounceDate: body.bounceDate ? new Date(body.bounceDate) : null,
            },
        });

        // If bouncing — reverse demand letter amount
        if (body.status === 'bounced' && payment.demandLetterId) {
            await tx.demandLetter.update({
                where: { id: payment.demandLetterId },
                data: {
                    paidAmount: { decrement: payment.amount },
                    remaining: { increment: payment.amount },
                    status: 'pending',
                },
            });
        }

        // If clearing — mark payment schedule milestone as paid (assuming payment has scheduleId if applicable, though typically demand letters handle schedules, but mimicking user code)
        if (body.status === 'cleared' && payment.scheduleId) {
            await tx.paymentSchedule.update({
                where: { id: payment.scheduleId },
                data: { status: 'paid' },
            });
        }

        // Also handling demand letter marking for schedule as in original code
        if (body.status === 'cleared' && payment.demandLetterId) {
            await tx.paymentSchedule.updateMany({
                where: {
                    linkedDemandId: payment.demandLetterId,
                    status: { in: ['due', 'upcoming'] },
                },
                data: { status: 'paid' },
            });
        }

        // Bounce cascade — auto-create complaint
        if (body.status === 'bounced') {
            await triggerCascade(
                CascadeEvents.PAYMENT_BOUNCED,
                {
                    paymentId,
                    bookingId: payment.bookingId,
                    organizationId,
                    customerId: payment.customerId,
                    unitId: payment.unitId,
                    amount: payment.amount,
                    bounceReason: body.bounceReason || null,
                },
                tx,
                notifications
            );
        }

        return updated;

    }, { timeout: 15000 });

    // Dispatch notifications AFTER transaction commits
    for (const n of notifications) {
        await dispatchNotification(n.type, n.payload).catch((err) => {
            logger.error('[Payment] Notification dispatch failed', {
                type: n.type,
                err: err.message,
            });
        });
    }

    return buildActionResponse(
        { id: result.id, status: result.status },
        `Payment status updated to "${body.status}".`
    );
};

// ── Get Payment Summary for Booking ──────────────────────────────────────────

export const getBookingPaymentSummary = async (
    organizationId,
    bookingId
) => {
    const booking = await prisma.booking.findFirst({
        where: { id: bookingId, organizationId },
    });
    if (!booking) throw new NotFoundError('Booking');

    const payments = await prisma.payment.findMany({
        where: {
            bookingId,
            organizationId,
            status: { in: ['cleared', 'under_process'] },
        },
    });

    const totalCollected = payments.reduce(
        (sum, p) => sum + p.amount,
        0n
    );

    const clearedAmount = payments
        .filter((p) => p.status === 'cleared')
        .reduce((sum, p) => sum + p.amount, 0n);

    const pendingAmount = booking.finalValue - clearedAmount;

    return buildSingleResponse({
        bookingId,
        bookingCode: booking.bookingCode,
        finalValue: paiseToRupees(booking.finalValue),
        totalCollected: paiseToRupees(totalCollected),
        clearedAmount: paiseToRupees(clearedAmount),
        pendingAmount: paiseToRupees(pendingAmount > 0n ? pendingAmount : 0n),
        paymentCount: payments.length,
        collectionPct: booking.finalValue > 0n
            ? Math.round(
                (Number(clearedAmount) / Number(booking.finalValue)) * 100
            )
            : 0,
    });
};
