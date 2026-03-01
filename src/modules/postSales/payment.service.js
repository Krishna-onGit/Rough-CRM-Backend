import prisma from '../../config/database.js';
import { redis, CacheKeys } from '../../config/redis.js';
import {
    NotFoundError,
    BusinessRuleError,
} from '../../shared/errors.js';
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

    // Create payment record
    const payment = await prisma.payment.create({
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
            status: 'under_process',
            remarks: remarks || null,
            recordedBy: userId,
        },
    });

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
    const payment = await prisma.payment.findFirst({
        where: { id: paymentId, organizationId },
    });
    if (!payment) throw new NotFoundError('Payment');

    // Cannot update already cleared or refunded payments
    if (['cleared', 'refunded'].includes(payment.status)) {
        throw new BusinessRuleError(
            `Payment with status "${payment.status}" cannot be modified.`
        );
    }

    // Bounce requires reason
    if (body.status === 'bounced' && !body.bounceReason) {
        throw new BusinessRuleError(
            'A bounce reason is required when marking a payment as bounced.'
        );
    }

    const updateData = { ...body };
    if (body.bounceDate) {
        updateData.bounceDate = new Date(body.bounceDate);
    }

    // If payment cleared and linked to demand letter
    // ensure demand letter paid amount is already updated
    if (
        body.status === 'cleared' &&
        payment.demandLetterId
    ) {
        // Update linked payment schedule to paid
        await prisma.paymentSchedule.updateMany({
            where: {
                linkedDemandId: payment.demandLetterId,
                status: { in: ['due', 'upcoming'] },
            },
            data: { status: 'paid' },
        });
    }

    // If payment bounced and linked to demand letter
    // reverse the paid amount update
    if (body.status === 'bounced' && payment.demandLetterId) {
        const demandLetter = await prisma.demandLetter.findFirst({
            where: { id: payment.demandLetterId, organizationId },
        });

        if (demandLetter) {
            const reversedPaid = demandLetter.paidAmount - payment.amount;
            const newPaid = reversedPaid > 0n ? reversedPaid : 0n;
            const newRemaining = demandLetter.demandAmount - newPaid;

            await prisma.demandLetter.update({
                where: { id: payment.demandLetterId },
                data: {
                    paidAmount: newPaid,
                    remaining: newRemaining,
                    status: newPaid === 0n
                        ? 'pending'
                        : 'partially_paid',
                },
            });
        }
    }

    const updated = await prisma.payment.update({
        where: { id: paymentId },
        data: updateData,
    });

    return buildActionResponse(
        {
            id: updated.id,
            receiptNumber: updated.receiptNumber,
            previousStatus: payment.status,
            newStatus: updated.status,
            bounceReason: updated.bounceReason,
        },
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
