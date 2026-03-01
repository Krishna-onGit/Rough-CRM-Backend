import prisma from '../../config/database.js';
import { redis, CacheKeys } from '../../config/redis.js';
import {
    NotFoundError,
    BusinessRuleError,
    ConflictError,
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
import { triggerCascade } from '../../cascade/cascadeEngine.js';
import { CascadeEvents } from '../../cascade/types.js';

// ── List Bookings ─────────────────────────────────────────────────────────────

export const listBookings = async (organizationId, query = {}) => {
    const { skip, take, page, pageSize } = parsePagination(query);

    const where = cleanObject({
        organizationId,
        status: buildEnumFilter(query.status),
        projectId: query.projectId || undefined,
        customerId: query.customerId || undefined,
        salesPersonId: query.salesPersonId || undefined,
        agentId: query.agentId || undefined,
        bookingDate: buildDateRangeFilter(query.from, query.to),
    });

    const [bookings, total] = await Promise.all([
        prisma.booking.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                bookingCode: true,
                unitId: true,
                projectId: true,
                customerId: true,
                salesPersonId: true,
                agentId: true,
                agreementValue: true,
                finalValue: true,
                discountAmount: true,
                tokenAmount: true,
                paymentMode: true,
                status: true,
                bookingDate: true,
                createdAt: true,
            },
        }),
        prisma.booking.count({ where }),
    ]);

    const formatted = bookings.map((b) => ({
        ...b,
        agreementValue: paiseToRupees(b.agreementValue),
        finalValue: paiseToRupees(b.finalValue),
        discountAmount: paiseToRupees(b.discountAmount),
        tokenAmount: paiseToRupees(b.tokenAmount),
    }));

    return buildPaginatedResponse(formatted, total, page, pageSize);
};

// ── Get Single Booking ────────────────────────────────────────────────────────

export const getBooking = async (organizationId, bookingId) => {
    const booking = await prisma.booking.findFirst({
        where: { id: bookingId, organizationId },
        include: {
            payments: {
                orderBy: { paymentDate: 'desc' },
                select: {
                    id: true,
                    receiptNumber: true,
                    amount: true,
                    paymentMode: true,
                    paymentDate: true,
                    status: true,
                },
            },
            commissions: {
                select: {
                    id: true,
                    agentId: true,
                    grossCommission: true,
                    netPayable: true,
                    status: true,
                },
            },
            demandLetters: {
                orderBy: { createdAt: 'asc' },
                select: {
                    id: true,
                    letterCode: true,
                    milestoneName: true,
                    demandAmount: true,
                    paidAmount: true,
                    remaining: true,
                    dueDate: true,
                    status: true,
                },
            },
            paymentSchedules: {
                orderBy: { milestoneOrder: 'asc' },
            },
        },
    });

    if (!booking) throw new NotFoundError('Booking');

    return buildSingleResponse({
        ...booking,
        agreementValue: paiseToRupees(booking.agreementValue),
        finalValue: paiseToRupees(booking.finalValue),
        discountAmount: paiseToRupees(booking.discountAmount),
        tokenAmount: paiseToRupees(booking.tokenAmount),
        payments: booking.payments.map((p) => ({
            ...p,
            amount: paiseToRupees(p.amount),
        })),
        commissions: booking.commissions.map((c) => ({
            ...c,
            grossCommission: paiseToRupees(c.grossCommission),
            netPayable: paiseToRupees(c.netPayable),
        })),
        demandLetters: booking.demandLetters.map((d) => ({
            ...d,
            demandAmount: paiseToRupees(d.demandAmount),
            paidAmount: paiseToRupees(d.paidAmount),
            remaining: paiseToRupees(d.remaining),
        })),
        paymentSchedules: booking.paymentSchedules.map((s) => ({
            ...s,
            amount: paiseToRupees(s.amount),
            percentage: Number(s.percentage),
        })),
    });
};

// ── Create Booking (Full Cascade) ─────────────────────────────────────────────

export const createBooking = async (organizationId, userId, body) => {
    const {
        unitId,
        customerId,
        salesPersonId,
        agentId,
        tokenAmount,
        discountAmount,
        paymentMode,
        remarks,
    } = body;

    // ── Pre-flight validation ────────────────────────────────────────────────

    // 1. Verify unit exists and is in correct state
    const unit = await prisma.unit.findFirst({
        where: { id: unitId, organizationId },
        include: {
            project: { select: { settings: true } },
        },
    });
    if (!unit) throw new NotFoundError('Unit');

    if (!['blocked', 'token_received'].includes(unit.status)) {
        throw new BusinessRuleError(
            `Booking can only be created for units in "blocked" or ` +
            `"token_received" status. Current status: "${unit.status}".`
        );
    }

    // 2. Verify customer exists
    const customer = await prisma.customer.findFirst({
        where: { id: customerId, organizationId, isActive: true },
    });
    if (!customer) throw new NotFoundError('Customer');

    // 3. Verify sales person exists
    const salesPerson = await prisma.salesPerson.findFirst({
        where: { id: salesPersonId, organizationId, isActive: true },
    });
    if (!salesPerson) throw new NotFoundError('Sales person');

    // 4. Verify agent if provided
    let agent = null;
    if (agentId) {
        agent = await prisma.agent.findFirst({
            where: { id: agentId, organizationId, isActive: true },
        });
        if (!agent) throw new NotFoundError('Agent');
    }

    // 5. Check no active booking exists for this unit
    const existingBooking = await prisma.booking.findFirst({
        where: {
            unitId,
            organizationId,
            status: { notIn: ['cancelled'] },
        },
    });
    if (existingBooking) {
        throw new ConflictError(
            'An active booking already exists for this unit.'
        );
    }

    // ── Pricing Calculations ─────────────────────────────────────────────────
    const agreementValue = unit.agreementValue;
    const discountPaise = rupeesToPaise(discountAmount || 0);
    const tokenPaise = rupeesToPaise(tokenAmount || 0);
    const finalValue = agreementValue - discountPaise;

    if (finalValue <= 0n) {
        throw new BusinessRuleError('Discount cannot exceed agreement value.');
    }

    // ── Generate Booking Code ────────────────────────────────────────────────
    const bookingCount = await prisma.booking.count({ where: { organizationId } });
    const bookingCode = `BKG-${String(bookingCount + 1).padStart(4, '0')}`;

    // ── Atomic Transaction: Create Booking + Trigger Cascade ─────────────────
    const result = await prisma.$transaction(async (tx) => {
        // 1. Create the booking record
        const booking = await tx.booking.create({
            data: {
                organizationId,
                bookingCode,
                unitId,
                projectId: unit.projectId,
                customerId,
                salesPersonId,
                agentId: agentId || null,
                agreementValue,
                finalValue,
                discountAmount: discountPaise,
                tokenAmount: tokenPaise,
                paymentMode,
                status: 'booked',
                bookingDate: new Date(),
                remarks: remarks || null,
                createdBy: userId,
            },
        });

        // 2. Update unit status to booked + attach sale info
        await tx.unit.update({
            where: { id: unitId },
            data: {
                status: 'booked',
                customerId,
                salesPersonId,
                agentId: agentId || null,
                bookingId: booking.id,
                saleDate: new Date(),
                finalSaleValue: finalValue,
                discountAmount: discountPaise,
                updatedBy: userId,
            },
        });

        // 3. Update customer's last booking reference (if lead exists, mark won)
        await tx.customer.update({
            where: { id: customerId },
            data: { updatedAt: new Date() },
        });

        // 4. Fire cascade — creates payment schedule,
        //    demand letter, commission, possession record
        const cascadeResults = await triggerCascade(
            CascadeEvents.BOOKING_CREATED,
            {
                bookingId: booking.id,
                bookingCode: booking.bookingCode,
                organizationId,
                unitId,
                customerId,
                projectId: unit.projectId,
                agentId: agentId || null,
                finalValue,
                tokenAmount: tokenPaise,
                agentCommissionPct: agent?.commissionPct || null,
            },
            tx
        );

        return { booking, cascadeResults };
    });

    // ── Post-transaction side effects ────────────────────────────────────────
    // Invalidate caches
    await redis.del(CacheKeys.unitStatus(unitId));
    await redis.del(CacheKeys.projectStats(unit.projectId));

    return buildActionResponse(
        {
            booking: {
                id: result.booking.id,
                bookingCode: result.booking.bookingCode,
                status: result.booking.status,
                agreementValue: paiseToRupees(agreementValue),
                finalValue: paiseToRupees(finalValue),
                discountAmount: paiseToRupees(discountPaise),
                tokenAmount: paiseToRupees(tokenPaise),
                bookingDate: result.booking.bookingDate,
            },
            cascadeResults: result.cascadeResults,
        },
        `Booking ${bookingCode} created successfully. ` +
        `${result.cascadeResults.paymentScheduleCount} payment milestones, ` +
        `1 demand letter, and possession record auto-created.`
    );
};
