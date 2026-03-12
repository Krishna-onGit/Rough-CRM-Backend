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
import { buildEnumFilter, buildDateRangeFilter, cleanObject } from '../../shared/filters.js';
import { paiseToRupees, rupeesToPaise } from '../../shared/costSheet.js';
import { triggerCascade } from '../../cascade/cascadeEngine.js';
import { CascadeEvents } from '../../cascade/types.js';
import { decrementSpBlockCounter } from '../units/unit.service.js';
import { logger } from '../../config/logger.js';
import { dispatchNotification } from '../../jobs/notificationDispatch.js';

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

    // 1. Verify customer exists + KYC (checked first so KYC error takes priority)
    const customer = await prisma.customer.findFirst({
        where: { id: customerId, organizationId, isActive: true },
    });
    if (!customer) throw new NotFoundError('Customer');

    // ── KYC completeness check ────────────────────────────────────────────────
    // Spec BKG-001: These fields are mandatory for a booking.
    // A customer can be created with minimal data during lead capture,
    // but must be complete before real money changes hands.
    // panHash is used instead of panNumber (panNumber is now ciphertext).

    const REQUIRED_KYC_FIELDS = [
        'fullName',
        'dateOfBirth',
        'mobilePrimary',
        'email',
        'currentAddress',
    ];

    // PAN is checked via panHash (panNumber column holds ciphertext)
    const missingFields = REQUIRED_KYC_FIELDS.filter(
        (field) => !customer[field]
    );

    const missingPan = !customer.panHash;

    if (missingFields.length > 0 || missingPan) {
        const allMissing = [
            ...missingFields,
            ...(missingPan ? ['panNumber'] : []),
        ];

        throw new BusinessRuleError(
            `Customer KYC is incomplete. Cannot proceed with booking. ` +
            `Missing required fields: ${allMissing.join(', ')}. ` +
            `Update the customer record (PATCH /v1/customers/:id) ` +
            `before creating a booking.`
        );
    }

    // 2. Verify unit exists and is in correct state
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

    // ── Discount approval gate ────────────────────────────────────────────────
    // Discounts up to 1% of agreement value: auto-approved, proceed normally.
    // Discounts above 1%: booking created as 'pending_discount_approval',
    // approval request auto-created, unit stays 'blocked'.

    const DISCOUNT_AUTO_APPROVE_PCT = 1;
    let bookingStatus = 'booked';
    let requiresDiscountApproval = false;

    if (discountPaise > 0n) {
        const discountPct =
            (Number(discountPaise) / Number(agreementValue)) * 100;

        if (discountPct > DISCOUNT_AUTO_APPROVE_PCT) {
            bookingStatus = 'pending_discount_approval';
            requiresDiscountApproval = true;

            logger.info('[Booking] Discount >1% — requires approval', {
                discountPct: discountPct.toFixed(2),
                organizationId,
                unitId: unitId,
            });
        }
    }

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
                status: bookingStatus,
                bookingDate: new Date(),
                remarks: remarks || null,
                createdBy: userId,
            },
        });

        if (requiresDiscountApproval) {
            const approvalCount = await tx.approvalRequest.count({
                where: { organizationId },
            });
            const approvalCode = `APR-${String(approvalCount + 1).padStart(4, '0')}`;

            await tx.approvalRequest.create({
                data: {
                    organizationId,
                    approvalCode,
                    requestType: 'discount',
                    entityType: 'booking',
                    entityId: booking.id,
                    requestedBy: userId,
                    status: 'pending',
                    justification:
                        `Discount of ${((Number(discountPaise) / Number(agreementValue)) * 100).toFixed(2)}% ` +
                        `requested on booking ${booking.bookingCode}. ` +
                        `Amount: ₹${Number(discountPaise) / 100}. ` +
                        `Requires director approval (exceeds 1% auto-approve threshold).`,
                    requestData: {
                        discountPaise: discountPaise.toString(),
                        agreementValuePaise: agreementValue.toString(),
                        discountPct: (
                            (Number(discountPaise) / Number(agreementValue)) * 100
                        ).toFixed(2),
                        bookingCode: booking.bookingCode,
                        unitId: unitId,
                    },
                },
            });
        }

        // 2. Update unit status to booked + attach sale info
        if (bookingStatus === 'booked') {
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
                    discountAmount: discountPaise > 0n ? discountPaise : null,
                    updatedBy: userId,
                },
            });
        } else {
            // Unit stays blocked — just link the bookingId for reference
            await tx.unit.update({
                where: { id: unitId },
                data: { bookingId: booking.id },
            });
        }

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
    // Decrement SP block counter since unit transitioned to Booked
    if (unit.blockedBy) {
        await decrementSpBlockCounter(organizationId, unit.blockedBy);
    }

    // Invalidate analytics dashboard cache on new booking
    await redis.del(
        `analytics:dashboard:${organizationId}`
    ).catch((err) => {
        logger.warn('[Analytics] Cache invalidation failed', {
            err: err.message,
        });
    });

    // Invalidate caches
    await redis.del(CacheKeys.unitStatus(unitId)).catch(() => {});
    await redis.del(CacheKeys.projectStats(unit.projectId)).catch(() => {});

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

// ── Execute Agreement ─────────────────────────────────────────────────────────

export const executeAgreement = async (bookingId, data, actor) => {
    const { organizationId, userId } = actor;

    if (!data.agreementDate) {
        const err = new BusinessRuleError('agreementDate is required.');
        err.code = 'VALIDATION_ERROR';
        err.statusCode = 400;
        throw err;
    }

    const agreementDate = new Date(data.agreementDate);
    if (isNaN(agreementDate.getTime())) {
        const err = new BusinessRuleError('agreementDate must be a valid ISO datetime.');
        err.code = 'VALIDATION_ERROR';
        err.statusCode = 400;
        throw err;
    }

    const booking = await prisma.booking.findFirst({
        where: { id: bookingId, organizationId },
    });
    if (!booking) throw new NotFoundError('Booking');

    const ALLOWED_STATUSES = ['booked', 'pending_discount_approval'];
    if (!ALLOWED_STATUSES.includes(booking.status)) {
        const err = new ConflictError(
            `Booking must be in "booked" status to execute agreement. ` +
            `Current status: "${booking.status}".`
        );
        err.code = 'BOOKING_NOT_ACTIVE';
        throw err;
    }

    const [updatedBooking, updatedUnit] = await prisma.$transaction([
        prisma.booking.update({
            where: { id: bookingId },
            data: { status: 'agreement_done', agreementDate },
        }),
        prisma.unit.update({
            where: { id: booking.unitId },
            data: { status: 'agreement_done' },
        }),
        prisma.auditLog.create({
            data: {
                organizationId,
                actorId: userId,
                action: 'status_change',
                entityType: 'booking',
                entityId: bookingId,
                entityCode: booking.bookingCode,
                metadata: {
                    from: booking.status,
                    to: 'agreement_done',
                    agreementDate: agreementDate.toISOString(),
                },
            },
        }),
    ]);

    return {
        success: true,
        message: `Agreement executed for booking ${booking.bookingCode}.`,
        data: {
            bookingId: updatedBooking.id,
            bookingCode: updatedBooking.bookingCode,
            status: updatedBooking.status,
            agreementDate: updatedBooking.agreementDate,
            unitStatus: updatedUnit.status,
        },
    };
};

export const registerBooking = async (
    organizationId,
    bookingId,
    userId,
    body
) => {
    // ── Fetch booking ─────────────────────────────────────────────────────────
    const booking = await prisma.booking.findFirst({
        where: { id: bookingId, organizationId },
    });
    if (!booking) throw new NotFoundError('Booking');

    // ── Validation ────────────────────────────────────────────────────────────
    const REGISTERABLE_STATUSES = ['booked', 'possession_handed'];
    if (!REGISTERABLE_STATUSES.includes(booking.status)) {
        throw new BusinessRuleError(
            `Only active bookings can be registered. ` +
            `Current status: "${booking.status}".`
        );
    }

    if (!body.registrationDate) {
        throw new BusinessRuleError('Registration date is required.');
    }

    if (!body.registrationNumber) {
        throw new BusinessRuleError('Registration number is required.');
    }

    // ── Atomic transaction ────────────────────────────────────────────────────
    const notifications = [];

    await prisma.$transaction(async (tx) => {

        // Store registration details on booking
        await tx.booking.update({
            where: { id: bookingId },
            data: {
                registrationDate: new Date(body.registrationDate),
                registrationNumber: body.registrationNumber,
                registrationRemarks: body.remarks || null,
                registeredBy: userId,
            },
        });

        // Fire registration cascade
        await triggerCascade(
            CascadeEvents.REGISTRATION_COMPLETED,
            {
                bookingId,
                unitId: booking.unitId,
                organizationId,
                customerId: booking.customerId,
            },
            tx,
            notifications
        );

    }, { timeout: 15000 });

    // Dispatch notifications after commit
    for (const n of notifications) {
        await dispatchNotification(n.type, n.payload).catch((err) => {
            logger.error('[Registration] Notification dispatch failed', {
                type: n.type, err: err.message,
            });
        });
    }

    return buildActionResponse(
        {
            bookingId,
            status: 'registered',
            registrationNumber: body.registrationNumber,
            registrationDate: body.registrationDate,
        },
        'Booking registered successfully. Commission status updated.'
    );
};
