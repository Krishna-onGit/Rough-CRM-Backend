import prisma from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { paiseToRupees } from '../../shared/costSheet.js';
import { buildDateRangeFilter, cleanObject } from
    '../../shared/filters.js';

const CACHE_TTL = 300; // 5 minutes for analytics

// ── Executive Dashboard ───────────────────────────────────────────────────────
// Top-level KPIs for the organization dashboard.

export const getExecutiveDashboard = async (
    organizationId,
    query = {}
) => {
    const cacheKey = `analytics:dashboard:${organizationId}`;
    const cached = await redis.get(cacheKey);
    if (cached) return { success: true, data: JSON.parse(cached), cached: true };

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // ── Inventory KPIs ───────────────────────────────────────────────────────
    const inventoryStats = await prisma.unit.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: { status: true },
    });

    const inventory = {
        total: 0,
        available: 0,
        blocked: 0,
        booked: 0,
        registered: 0,
        possession_handed: 0,
    };

    inventoryStats.forEach((s) => {
        inventory.total += s._count.status;
        if (inventory[s.status] !== undefined) {
            inventory[s.status] = s._count.status;
        }
    });

    inventory.soldPct =
        inventory.total > 0
            ? Math.round(
                ((inventory.booked + inventory.registered +
                    inventory.possession_handed) /
                    inventory.total) *
                100
            )
            : 0;

    // ── Booking KPIs ─────────────────────────────────────────────────────────
    const [
        totalBookings,
        monthlyBookings,
        cancelledBookings,
    ] = await Promise.all([
        prisma.booking.count({
            where: {
                organizationId,
                status: { notIn: ['cancelled'] },
            },
        }),
        prisma.booking.count({
            where: {
                organizationId,
                bookingDate: { gte: startOfMonth },
                status: { notIn: ['cancelled'] },
            },
        }),
        prisma.booking.count({
            where: { organizationId, status: 'cancelled' },
        }),
    ]);

    // ── Revenue KPIs ─────────────────────────────────────────────────────────
    const [totalRevenue, monthlyRevenue, collectedRevenue] =
        await Promise.all([
            prisma.booking.aggregate({
                where: {
                    organizationId,
                    status: { notIn: ['cancelled'] },
                },
                _sum: { finalValue: true },
            }),
            prisma.booking.aggregate({
                where: {
                    organizationId,
                    bookingDate: { gte: startOfMonth },
                    status: { notIn: ['cancelled'] },
                },
                _sum: { finalValue: true },
            }),
            prisma.payment.aggregate({
                where: {
                    organizationId,
                    status: 'cleared',
                },
                _sum: { amount: true },
            }),
        ]);

    // ── Lead KPIs ────────────────────────────────────────────────────────────
    const leadStats = await prisma.lead.groupBy({
        by: ['status'],
        where: { organizationId, isActive: true },
        _count: { status: true },
    });

    const leads = {
        total: 0, new: 0, contacted: 0,
        site_visit_done: 0, won: 0, lost: 0
    };
    leadStats.forEach((l) => {
        leads.total += l._count.status;
        if (leads[l.status] !== undefined) {
            leads[l.status] = l._count.status;
        }
    });

    leads.conversionRate =
        leads.total > 0
            ? Math.round((leads.won / leads.total) * 100)
            : 0;

    // ── Complaint KPIs ───────────────────────────────────────────────────────
    const [openComplaints, slaBreached] = await Promise.all([
        prisma.complaint.count({
            where: {
                organizationId,
                status: { in: ['open', 'in_progress', 'escalated'] },
            },
        }),
        prisma.complaint.count({
            where: {
                organizationId, slaBreached: true,
                status: { notIn: ['resolved', 'closed'] }
            },
        }),
    ]);

    const data = {
        generatedAt: now.toISOString(),
        inventory,
        bookings: {
            total: totalBookings,
            thisMonth: monthlyBookings,
            cancelled: cancelledBookings,
        },
        revenue: {
            totalBookingValue: paiseToRupees(
                totalRevenue._sum.finalValue || 0n
            ),
            monthlyBookingValue: paiseToRupees(
                monthlyRevenue._sum.finalValue || 0n
            ),
            totalCollected: paiseToRupees(
                collectedRevenue._sum.amount || 0n
            ),
        },
        leads,
        complaints: { open: openComplaints, slaBreached },
    };

    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(data));
    return { success: true, data, cached: false };
};

// ── Sales Performance Analytics ───────────────────────────────────────────────

export const getSalesAnalytics = async (
    organizationId,
    query = {}
) => {
    const { from, to } = query;
    const startDate = from ? new Date(from) : new Date(
        new Date().getFullYear(), new Date().getMonth(), 1
    );
    const endDate = to ? new Date(to) : new Date();

    const bookingWhere = {
        organizationId,
        bookingDate: { gte: startDate, lte: endDate },
        status: { notIn: ['cancelled'] },
    };

    // Bookings by project
    const byProject = await prisma.booking.groupBy({
        by: ['projectId'],
        where: bookingWhere,
        _count: { id: true },
        _sum: { finalValue: true },
    });

    // Get project names
    const projectIds = byProject.map((b) => b.projectId);
    const projects = await prisma.project.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, name: true, projectCode: true },
    });
    const projectMap = Object.fromEntries(
        projects.map((p) => [p.id, p])
    );

    // Monthly booking trend (last 6 months)
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
        const monthStart = new Date(
            new Date().getFullYear(),
            new Date().getMonth() - i,
            1
        );
        const monthEnd = new Date(
            new Date().getFullYear(),
            new Date().getMonth() - i + 1,
            0
        );

        const [count, revenue] = await Promise.all([
            prisma.booking.count({
                where: {
                    organizationId,
                    bookingDate: { gte: monthStart, lte: monthEnd },
                    status: { notIn: ['cancelled'] },
                },
            }),
            prisma.booking.aggregate({
                where: {
                    organizationId,
                    bookingDate: { gte: monthStart, lte: monthEnd },
                    status: { notIn: ['cancelled'] },
                },
                _sum: { finalValue: true },
            }),
        ]);

        monthlyTrend.push({
            month: monthStart.toLocaleString('en-IN', {
                month: 'short', year: 'numeric',
            }),
            bookings: count,
            revenue: paiseToRupees(revenue._sum.finalValue || 0n),
        });
    }

    // Config-wise sales
    const byConfig = await prisma.unit.groupBy({
        by: ['unitConfig', 'status'],
        where: {
            organizationId,
            status: { in: ['booked', 'registered', 'possession_handed'] },
        },
        _count: { id: true },
    });

    return {
        success: true,
        data: {
            period: {
                from: startDate.toISOString(),
                to: endDate.toISOString(),
            },
            byProject: byProject.map((b) => ({
                projectId: b.projectId,
                projectName: projectMap[b.projectId]?.name || 'Unknown',
                projectCode: projectMap[b.projectId]?.projectCode,
                bookings: b._count.id,
                revenue: paiseToRupees(b._sum.finalValue || 0n),
            })),
            monthlyTrend,
            byConfig: byConfig.map((c) => ({
                config: c.unitConfig,
                status: c.status,
                count: c._count.id,
            })),
        },
    };
};

// ── Collection Analytics ──────────────────────────────────────────────────────

export const getCollectionAnalytics = async (
    organizationId,
    query = {}
) => {
    const { from, to } = query;
    const startDate = from
        ? new Date(from)
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = to ? new Date(to) : new Date();

    // Payments by mode
    const byMode = await prisma.payment.groupBy({
        by: ['paymentMode', 'status'],
        where: {
            organizationId,
            paymentDate: { gte: startDate, lte: endDate },
        },
        _count: { id: true },
        _sum: { amount: true },
    });

    // Overdue demand letters
    const overdue = await prisma.demandLetter.findMany({
        where: {
            organizationId,
            status: 'overdue',
        },
        select: {
            id: true,
            letterCode: true,
            demandAmount: true,
            remaining: true,
            dueDate: true,
        },
    });

    const totalOverdue = overdue.reduce(
        (sum, d) => sum + d.remaining,
        0n
    );

    // Total collected this period
    const collected = await prisma.payment.aggregate({
        where: {
            organizationId,
            status: 'cleared',
            paymentDate: { gte: startDate, lte: endDate },
        },
        _sum: { amount: true },
    });

    return {
        success: true,
        data: {
            period: { from: startDate, to: endDate },
            totalCollected: paiseToRupees(
                collected._sum.amount || 0n
            ),
            byMode: byMode.map((m) => ({
                mode: m.paymentMode,
                status: m.status,
                count: m._count.id,
                amount: paiseToRupees(m._sum.amount || 0n),
            })),
            overdue: {
                count: overdue.length,
                totalAmount: paiseToRupees(totalOverdue),
                letters: overdue.map((d) => ({
                    ...d,
                    demandAmount: paiseToRupees(d.demandAmount),
                    remaining: paiseToRupees(d.remaining),
                })),
            },
        },
    };
};
