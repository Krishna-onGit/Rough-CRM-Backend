import prisma from '../../config/database.js';
import {
    NotFoundError,
    ConflictError,
    BusinessRuleError,
} from '../../shared/errors.js';
import {
    parsePagination,
    buildPaginatedResponse,
    buildSingleResponse,
    buildActionResponse,
} from '../../shared/pagination.js';
import {
    buildSearchFilter,
    buildEnumFilter,
    buildBooleanFilter,
    cleanObject,
} from '../../shared/filters.js';
import { paiseToRupees, rupeesToPaise } from '../../shared/costSheet.js';

// ── List Sales Persons ────────────────────────────────────────────────────────

export const listSalesPersons = async (
    organizationId,
    query = {}
) => {
    const { skip, take, page, pageSize } = parsePagination(query);

    const where = cleanObject({
        organizationId,
        team: query.team || undefined,
        designation: buildEnumFilter(query.designation),
        isActive: buildBooleanFilter(query.isActive) ?? true,
    });

    const searchFilter = buildSearchFilter(query.search, [
        'fullName',
        'mobile',
        'spCode',
    ]);
    if (searchFilter) where.OR = searchFilter;

    const [salesPersons, total] = await Promise.all([
        prisma.salesPerson.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                spCode: true,
                fullName: true,
                mobile: true,
                email: true,
                team: true,
                designation: true,
                reportingTo: true,
                monthlyTarget: true,
                isActive: true,
                createdAt: true,
            },
        }),
        prisma.salesPerson.count({ where }),
    ]);

    const formatted = salesPersons.map((sp) => ({
        ...sp,
        monthlyTarget: paiseToRupees(sp.monthlyTarget),
    }));

    return buildPaginatedResponse(formatted, total, page, pageSize);
};

// ── Get Single Sales Person ───────────────────────────────────────────────────

export const getSalesPerson = async (
    organizationId,
    salesPersonId
) => {
    const salesPerson = await prisma.salesPerson.findFirst({
        where: { id: salesPersonId, organizationId },
    });
    if (!salesPerson) throw new NotFoundError('Sales person');

    // Get performance stats
    const [
        totalBookings,
        activeBlocks,
        monthlyBookings,
    ] = await Promise.all([
        // Total bookings by this SP
        prisma.booking.count({
            where: { salesPersonId, organizationId },
        }),

        // Currently blocked units by this SP
        prisma.unit.count({
            where: {
                organizationId,
                blockedBy: salesPersonId,
                status: 'blocked',
            },
        }),

        // Bookings this calendar month
        prisma.booking.count({
            where: {
                salesPersonId,
                organizationId,
                bookingDate: {
                    gte: new Date(
                        new Date().getFullYear(),
                        new Date().getMonth(),
                        1
                    ),
                },
            },
        }),
    ]);

    // Total revenue from bookings
    const bookingRevenue = await prisma.booking.aggregate({
        where: {
            salesPersonId,
            organizationId,
            status: { notIn: ['cancelled'] },
        },
        _sum: { finalValue: true },
    });

    const totalRevenue = bookingRevenue._sum.finalValue || 0n;
    const monthlyTarget = salesPerson.monthlyTarget || 0n;
    const achievementPct =
        monthlyTarget > 0n
            ? Math.round(
                (Number(totalRevenue) / Number(monthlyTarget)) * 100
            )
            : 0;

    return buildSingleResponse({
        ...salesPerson,
        monthlyTarget: paiseToRupees(salesPerson.monthlyTarget),
        performance: {
            totalBookings,
            activeBlocks,
            monthlyBookings,
            totalRevenue: paiseToRupees(totalRevenue),
            achievementPct,
        },
    });
};

// ── Create Sales Person ───────────────────────────────────────────────────────

export const createSalesPerson = async (
    organizationId,
    userId,
    body
) => {
    const { mobile, monthlyTarget, ...rest } = body;

    // Auto-generate SP code
    const spCount = await prisma.salesPerson.count({ where: { organizationId } });
    const spCode = `SP-${String(spCount + 1).padStart(3, '0')}`;

    // Check mobile uniqueness
    const existingMobile = await prisma.salesPerson.findFirst({
        where: { organizationId, mobile },
    });
    if (existingMobile) {
        throw new ConflictError(
            `A sales person with mobile ${mobile} already exists ` +
            `(${existingMobile.spCode}).`
        );
    }

    // Verify reportingTo exists if provided
    if (rest.reportingTo) {
        const manager = await prisma.salesPerson.findFirst({
            where: { id: rest.reportingTo, organizationId },
        });
        if (!manager) throw new NotFoundError('Reporting manager');
    }

    const salesPerson = await prisma.salesPerson.create({
        data: {
            ...rest,
            organizationId,
            spCode,
            mobile,
            monthlyTarget: rupeesToPaise(monthlyTarget || 0),
            isActive: true,
        },
    });

    return buildActionResponse(
        {
            id: salesPerson.id,
            spCode: salesPerson.spCode,
            fullName: salesPerson.fullName,
            designation: salesPerson.designation,
        },
        `Sales person ${spCode} created successfully.`
    );
};

// ── Update Sales Person ───────────────────────────────────────────────────────

export const updateSalesPerson = async (
    organizationId,
    salesPersonId,
    userId,
    body
) => {
    const salesPerson = await prisma.salesPerson.findFirst({
        where: { id: salesPersonId, organizationId },
    });
    if (!salesPerson) throw new NotFoundError('Sales person');

    const updateData = { ...body };

    if (body.monthlyTarget !== undefined) {
        updateData.monthlyTarget = rupeesToPaise(body.monthlyTarget);
    }

    // Cannot deactivate SP with active blocks
    if (body.isActive === false) {
        const activeBlocks = await prisma.unit.count({
            where: {
                organizationId,
                blockedBy: salesPersonId,
                status: 'blocked',
            },
        });
        if (activeBlocks > 0) {
            throw new BusinessRuleError(
                `Cannot deactivate sales person with ${activeBlocks} ` +
                `active unit block(s). Release blocks first.`
            );
        }
    }

    const updated = await prisma.salesPerson.update({
        where: { id: salesPersonId },
        data: updateData,
    });

    return buildActionResponse(
        {
            id: updated.id,
            spCode: updated.spCode,
            isActive: updated.isActive,
        },
        'Sales person updated successfully.'
    );
};

// ── Get Team Performance ──────────────────────────────────────────────────────

export const getTeamPerformance = async (
    organizationId,
    query = {}
) => {
    const { team } = query;

    const where = cleanObject({
        organizationId,
        team: team || undefined,
        isActive: true,
    });

    const salesPersons = await prisma.salesPerson.findMany({
        where,
        select: {
            id: true,
            spCode: true,
            fullName: true,
            team: true,
            designation: true,
            monthlyTarget: true,
        },
    });

    // Get booking counts and revenue for each SP
    const performance = await Promise.all(
        salesPersons.map(async (sp) => {
            const startOfMonth = new Date(
                new Date().getFullYear(),
                new Date().getMonth(),
                1
            );

            const [monthlyBookings, revenue] = await Promise.all([
                prisma.booking.count({
                    where: {
                        salesPersonId: sp.id,
                        organizationId,
                        bookingDate: { gte: startOfMonth },
                        status: { notIn: ['cancelled'] },
                    },
                }),
                prisma.booking.aggregate({
                    where: {
                        salesPersonId: sp.id,
                        organizationId,
                        bookingDate: { gte: startOfMonth },
                        status: { notIn: ['cancelled'] },
                    },
                    _sum: { finalValue: true },
                }),
            ]);

            const monthlyRevenue =
                revenue._sum.finalValue || 0n;
            const target = sp.monthlyTarget || 0n;
            const achievementPct =
                target > 0n
                    ? Math.round(
                        (Number(monthlyRevenue) / Number(target)) * 100
                    )
                    : 0;

            return {
                id: sp.id,
                spCode: sp.spCode,
                fullName: sp.fullName,
                team: sp.team,
                designation: sp.designation,
                monthlyTarget: paiseToRupees(target),
                monthlyRevenue: paiseToRupees(monthlyRevenue),
                monthlyBookings,
                achievementPct,
            };
        })
    );

    // Sort by achievement descending
    performance.sort(
        (a, b) => b.achievementPct - a.achievementPct
    );

    return {
        success: true,
        data: {
            team: team || 'all',
            month: new Date().toLocaleString('en-IN', {
                month: 'long',
                year: 'numeric',
            }),
            salesPersons: performance,
            summary: {
                totalSalesPersons: performance.length,
                totalRevenue: performance.reduce(
                    (sum, sp) => sum + sp.monthlyRevenue,
                    0
                ),
                totalBookings: performance.reduce(
                    (sum, sp) => sum + sp.monthlyBookings,
                    0
                ),
                avgAchievement:
                    performance.length > 0
                        ? Math.round(
                            performance.reduce(
                                (sum, sp) => sum + sp.achievementPct,
                                0
                            ) / performance.length
                        )
                        : 0,
            },
        },
    };
};
