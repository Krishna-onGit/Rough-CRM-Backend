import prisma from '../../config/database.js';
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

// ── List Demand Letters ───────────────────────────────────────────────────────

export const listDemandLetters = async (
    organizationId,
    query = {}
) => {
    const { skip, take, page, pageSize } = parsePagination(query);

    const where = cleanObject({
        organizationId,
        bookingId: query.bookingId || undefined,
        customerId: query.customerId || undefined,
        status: buildEnumFilter(query.status),
        dueDate: buildDateRangeFilter(query.from, query.to),
    });

    const [letters, total] = await Promise.all([
        prisma.demandLetter.findMany({
            where,
            skip,
            take,
            orderBy: { dueDate: 'asc' },
            select: {
                id: true,
                letterCode: true,
                bookingId: true,
                customerId: true,
                unitId: true,
                milestoneName: true,
                milestonePct: true,
                demandAmount: true,
                paidAmount: true,
                remaining: true,
                dueDate: true,
                status: true,
                reminderCount: true,
                lastReminder: true,
                createdAt: true,
            },
        }),
        prisma.demandLetter.count({ where }),
    ]);

    const formatted = letters.map((l) => ({
        ...l,
        milestonePct: Number(l.milestonePct),
        demandAmount: paiseToRupees(l.demandAmount),
        paidAmount: paiseToRupees(l.paidAmount),
        remaining: paiseToRupees(l.remaining),
    }));

    return buildPaginatedResponse(formatted, total, page, pageSize);
};

// ── Get Single Demand Letter ──────────────────────────────────────────────────

export const getDemandLetter = async (
    organizationId,
    letterId
) => {
    const letter = await prisma.demandLetter.findFirst({
        where: { id: letterId, organizationId },
        include: {
            paymentSchedules: {
                select: {
                    id: true,
                    milestoneOrder: true,
                    milestoneName: true,
                    percentage: true,
                    amount: true,
                    status: true,
                    dueDate: true,
                },
            },
        },
    });
    if (!letter) throw new NotFoundError('Demand letter');

    return buildSingleResponse({
        ...letter,
        milestonePct: Number(letter.milestonePct),
        demandAmount: paiseToRupees(letter.demandAmount),
        paidAmount: paiseToRupees(letter.paidAmount),
        remaining: paiseToRupees(letter.remaining),
        paymentSchedules: letter.paymentSchedules.map((s) => ({
            ...s,
            percentage: Number(s.percentage),
            amount: paiseToRupees(s.amount),
        })),
    });
};

// ── Create Demand Letter ──────────────────────────────────────────────────────

export const createDemandLetter = async (
    organizationId,
    userId,
    body
) => {
    const {
        bookingId,
        customerId,
        unitId,
        milestoneName,
        milestonePct,
        demandAmount,
        dueDate,
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

    // Generate letter code
    const count = await prisma.demandLetter.count({
        where: { bookingId },
    });
    const letterCode = `DL-${booking.bookingCode}-${String(count + 1).padStart(2, '0')}`;

    const demandAmountPaise = rupeesToPaise(demandAmount);

    const letter = await prisma.demandLetter.create({
        data: {
            organizationId,
            bookingId,
            customerId,
            unitId,
            letterCode,
            milestoneName,
            milestonePct,
            demandAmount: demandAmountPaise,
            dueDate: new Date(dueDate),
            status: 'pending',
            paidAmount: 0n,
            remaining: demandAmountPaise,
        },
    });

    return buildActionResponse(
        {
            id: letter.id,
            letterCode: letter.letterCode,
            milestoneName: letter.milestoneName,
            demandAmount: paiseToRupees(letter.demandAmount),
            dueDate: letter.dueDate,
            status: letter.status,
        },
        `Demand letter ${letterCode} created successfully.`
    );
};

// ── Send Reminder ─────────────────────────────────────────────────────────────

export const sendReminder = async (
    organizationId,
    letterId,
    userId,
    body
) => {
    const letter = await prisma.demandLetter.findFirst({
        where: { id: letterId, organizationId },
    });
    if (!letter) throw new NotFoundError('Demand letter');

    if (letter.status === 'paid') {
        throw new BusinessRuleError(
            'Cannot send reminder for a fully paid demand letter.'
        );
    }

    // Throttle reminders — max 1 per 24 hours
    if (letter.lastReminder) {
        const hoursSinceLast =
            (Date.now() - new Date(letter.lastReminder).getTime()) /
            (1000 * 60 * 60);

        if (hoursSinceLast < 24) {
            throw new BusinessRuleError(
                `A reminder was already sent ${Math.floor(hoursSinceLast)} ` +
                `hour(s) ago. Please wait 24 hours between reminders.`
            );
        }
    }

    const updated = await prisma.demandLetter.update({
        where: { id: letterId },
        data: {
            reminderCount: letter.reminderCount + 1,
            lastReminder: new Date(),
        },
    });

    // TODO Phase 8: dispatch actual notification
    // await dispatchNotification('DEMAND_REMINDER', {
    //   letterId, customerId: letter.customerId, priority: 'high'
    // });

    return buildActionResponse(
        {
            id: updated.id,
            letterCode: updated.letterCode,
            reminderCount: updated.reminderCount,
            lastReminder: updated.lastReminder,
        },
        `Reminder #${updated.reminderCount} sent for ${updated.letterCode}.`
    );
};
