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
    let cached = null;
    try { cached = await redis.get(cacheKey); } catch (_) { /* Redis unavailable */ }
    if (cached) return { success: true, data: cached, cached: true };

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

    await redis.setex(cacheKey, CACHE_TTL, data).catch(() => {});
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
        by: ['config', 'status'],
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
                config: c.config,
                status: c.status,
                count: c._count.id,
            })),
        },
    };
};

// ── Leaderboard ───────────────────────────────────────────────────────────────

export const getLeaderboard = async (organizationId, query = {}) => {
    const cacheKey = `analytics:leaderboard:${organizationId}`;
    let cached = null;
    try { cached = await redis.get(cacheKey); } catch (_) { /* Redis unavailable */ }
    if (cached) return { success: true, data: cached, cached: true };

    const period = query.period || 'mtd';
    const now = new Date();

    let dateFilter;
    if (period === 'mtd') {
        dateFilter = { gte: new Date(now.getFullYear(), now.getMonth(), 1), lte: now };
    } else if (period === 'ytd') {
        dateFilter = { gte: new Date(now.getFullYear(), 0, 1), lte: now };
    }
    // period === 'all' → dateFilter stays undefined

    const salesPersons = await prisma.salesPerson.findMany({
        where: { organizationId, isActive: true },
        select: {
            id: true,
            spCode: true,
            fullName: true,
            mobile: true,
            team: true,
            designation: true,
            monthlyTarget: true,
        },
    });

    const leaderboard = await Promise.all(
        salesPersons.map(async (sp) => {
            const bWhere = {
                organizationId,
                salesPersonId: sp.id,
                status: { notIn: ['cancelled', 'pending_discount_approval'] },
                ...(dateFilter ? { bookingDate: dateFilter } : {}),
            };

            const [unitsSold, revenue, totalLeads, wonLeads, activeBlocks] =
                await Promise.all([
                    prisma.booking.count({ where: bWhere }),
                    prisma.booking.aggregate({
                        where: bWhere,
                        _sum: { finalValue: true },
                    }),
                    prisma.lead.count({
                        where: { organizationId, assignedTo: sp.id, isActive: true },
                    }),
                    prisma.lead.count({
                        where: {
                            organizationId,
                            assignedTo: sp.id,
                            status: 'won',
                            isActive: true,
                        },
                    }),
                    prisma.unit.count({
                        where: { organizationId, blockedBy: sp.id, status: 'blocked' },
                    }),
                ]);

            const revenueRupees = paiseToRupees(revenue._sum.finalValue || 0n);
            const conversionPercent =
                totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;
            const revenueInLakhs = revenueRupees / 100000;
            const score = Math.round(
                unitsSold * 40 + revenueInLakhs * 0.3 + conversionPercent * 30
            );
            const mtdAchievementPct =
                sp.monthlyTarget && sp.monthlyTarget > 0n
                    ? Math.round(
                          (revenueRupees / paiseToRupees(sp.monthlyTarget)) * 100
                      )
                    : 0;

            return {
                id: sp.id,
                spCode: sp.spCode,
                fullName: sp.fullName,
                team: sp.team,
                designation: sp.designation,
                unitsSold,
                revenue: revenueRupees,
                conversionPercent,
                score,
                activeBlocks,
                monthlyTarget: paiseToRupees(sp.monthlyTarget || 0n),
                mtdAchievementPct,
            };
        })
    );

    leaderboard.sort((a, b) => b.score - a.score);
    const ranked = leaderboard.map((entry, i) => ({ rank: i + 1, ...entry }));

    const data = { period, generatedAt: now.toISOString(), leaderboard: ranked };
    await redis.setex(cacheKey, CACHE_TTL, data).catch(() => {});
    return { success: true, data, cached: false };
};

// ── Channel Analytics ─────────────────────────────────────────────────────────

const SOURCE_LABELS = {
    walk_in: 'Direct Sales',
    referral: 'Referral',
    website: 'Digital / Online',
    whatsapp: 'WhatsApp / Social',
};

export const getChannelAnalytics = async (organizationId, query = {}) => {
    const cacheKey = `analytics:channels:${organizationId}`;
    let cached = null;
    try { cached = await redis.get(cacheKey); } catch (_) { /* Redis unavailable */ }
    if (cached) return { success: true, data: cached, cached: true };

    const now = new Date();
    const startDate = query.from
        ? new Date(query.from)
        : new Date(now.getFullYear(), 0, 1);
    const endDate = query.to ? new Date(query.to) : now;

    const bookingDateFilter = { gte: startDate, lte: endDate };
    const leadDateFilter = { gte: startDate, lte: endDate };

    // Leads grouped by source + won leads by source + site visits + bookings
    const [leadGroups, wonLeadGroups, siteVisitRecords, bookings] =
        await Promise.all([
            prisma.lead.groupBy({
                by: ['source'],
                where: { organizationId, isActive: true, createdAt: leadDateFilter },
                _count: { id: true },
            }),
            prisma.lead.groupBy({
                by: ['source'],
                where: {
                    organizationId,
                    status: 'won',
                    isActive: true,
                    createdAt: leadDateFilter,
                },
                _count: { id: true },
            }),
            prisma.siteVisit.findMany({
                where: { organizationId, visitDate: bookingDateFilter },
                select: { leadId: true, lead: { select: { source: true } } },
            }),
            prisma.booking.findMany({
                where: {
                    organizationId,
                    status: { notIn: ['cancelled'] },
                    bookingDate: bookingDateFilter,
                },
                select: {
                    id: true,
                    finalValue: true,
                    agentId: true,
                    sourceLeadId: true,
                },
            }),
        ]);

    // Build lookup maps
    const leadCountBySource = Object.fromEntries(
        leadGroups.map((g) => [g.source, g._count.id])
    );
    const wonLeadCountBySource = Object.fromEntries(
        wonLeadGroups.map((g) => [g.source, g._count.id])
    );
    const visitCountBySource = {};
    siteVisitRecords.forEach((v) => {
        const src = v.lead?.source;
        if (src) visitCountBySource[src] = (visitCountBySource[src] || 0) + 1;
    });

    // Fetch lead sources for bookings via sourceLeadId
    const sourceLeadIds = bookings.map((b) => b.sourceLeadId).filter(Boolean);
    const sourceLeads = sourceLeadIds.length
        ? await prisma.lead.findMany({
              where: { id: { in: sourceLeadIds } },
              select: { id: true, source: true },
          })
        : [];
    const leadSourceMap = Object.fromEntries(
        sourceLeads.map((l) => [l.id, l.source])
    );

    // Build per-source channels
    const channels = ['walk_in', 'referral', 'website', 'whatsapp'].map(
        (source) => {
            const channelBookings = bookings.filter(
                (b) => leadSourceMap[b.sourceLeadId] === source
            );
            const leadsGenerated = leadCountBySource[source] || 0;
            const bookingCount = channelBookings.length;
            const revenue = paiseToRupees(
                channelBookings.reduce((s, b) => s + b.finalValue, 0n)
            );
            const wonLeads = wonLeadCountBySource[source] || 0;
            const conversionRate =
                leadsGenerated > 0
                    ? parseFloat(
                          ((bookingCount / leadsGenerated) * 100).toFixed(1)
                      )
                    : 0;

            return {
                channel: SOURCE_LABELS[source],
                source,
                leadsGenerated,
                siteVisits: visitCountBySource[source] || 0,
                bookings: bookingCount,
                revenue,
                wonLeads,
                conversionRate,
            };
        }
    );

    // Synthetic "Channel Partner" channel
    const cpBookings = bookings.filter((b) => b.agentId != null);
    channels.push({
        channel: 'Channel Partner',
        source: 'agent',
        leadsGenerated: null,
        siteVisits: null,
        bookings: cpBookings.length,
        revenue: paiseToRupees(cpBookings.reduce((s, b) => s + b.finalValue, 0n)),
        wonLeads: cpBookings.length,
        conversionRate: null,
    });

    // Totals (excluding CP channel)
    const sourceChannels = channels.slice(0, 4);
    const totalLeads = sourceChannels.reduce(
        (s, c) => s + (c.leadsGenerated || 0), 0
    );
    const totalWon = sourceChannels.reduce((s, c) => s + c.wonLeads, 0);
    const totalRevenue = paiseToRupees(
        bookings.reduce((s, b) => s + b.finalValue, 0n)
    );
    const avgConversionRate =
        totalLeads > 0
            ? parseFloat(((totalWon / totalLeads) * 100).toFixed(1))
            : 0;

    const data = {
        period: { from: startDate.toISOString(), to: endDate.toISOString() },
        totals: {
            totalLeads,
            totalBookings: bookings.length,
            totalRevenue,
            avgConversionRate,
        },
        channels,
    };

    await redis.setex(cacheKey, CACHE_TTL, data).catch(() => {});
    return { success: true, data, cached: false };
};

// ── Agent Analytics (helpers) ─────────────────────────────────────────────────

const computeAgentTier = (unitsSold, rating) => {
    if (unitsSold === 0) return 'New';
    if (unitsSold >= 20 && rating >= 4.5) return 'Platinum';
    if (unitsSold >= 10 && rating >= 4.0) return 'Gold';
    if (unitsSold >= 5 && rating >= 3.5) return 'Silver';
    return 'Bronze';
};

const computeAgentMetrics = async (organizationId, agentId) => {
    const [agentBookingRecords, unitsSold, revenue, grossCommission, paidCommission] =
        await Promise.all([
            prisma.booking.findMany({
                where: { organizationId, agentId },
                select: { id: true },
            }),
            prisma.booking.count({
                where: {
                    organizationId,
                    agentId,
                    status: { notIn: ['cancelled', 'pending_discount_approval'] },
                },
            }),
            prisma.booking.aggregate({
                where: {
                    organizationId,
                    agentId,
                    status: { notIn: ['cancelled'] },
                },
                _sum: { finalValue: true },
            }),
            prisma.commission.aggregate({
                where: { organizationId, agentId },
                _sum: { grossCommission: true },
            }),
            prisma.commission.aggregate({
                where: { organizationId, agentId, status: 'paid' },
                _sum: { netPayable: true },
            }),
        ]);

    const agentBookingIds = agentBookingRecords.map((b) => b.id);

    const activeLeads = agentBookingIds.length
        ? await prisma.lead.count({
              where: {
                  organizationId,
                  isActive: true,
                  status: { notIn: ['won', 'lost', 'junk'] },
                  convertedBookingId: { in: agentBookingIds },
              },
          })
        : 0;

    return {
        agentBookingIds,
        unitsSold,
        revenue: paiseToRupees(revenue._sum.finalValue || 0n),
        grossCommission: paiseToRupees(grossCommission._sum.grossCommission || 0n),
        paidCommission: paiseToRupees(paidCommission._sum.netPayable || 0n),
        activeLeads,
    };
};

// ── Agent Analytics (list) ────────────────────────────────────────────────────

export const getAgentAnalytics = async (organizationId, _query = {}) => {
    const cacheKey = `analytics:agents:${organizationId}`;
    let cached = null;
    try { cached = await redis.get(cacheKey); } catch (_) { /* Redis unavailable */ }
    if (cached) return { success: true, data: cached, cached: true };

    const agents = await prisma.agent.findMany({
        where: { organizationId, isActive: true },
        select: {
            id: true,
            agentCode: true,
            firmName: true,
            contactPerson: true,
            mobile: true,
            email: true,
            reraNumber: true,
            commissionPct: true,
            rating: true,
            totalCommission: true,
            pendingCommission: true,
        },
    });

    const agentResults = await Promise.all(
        agents.map(async (agent) => {
            const metrics = await computeAgentMetrics(organizationId, agent.id);
            const rating = Number(agent.rating || 0);
            const tier = computeAgentTier(metrics.unitsSold, rating);

            return {
                id: agent.id,
                agentCode: agent.agentCode,
                firmName: agent.firmName,
                contactPerson: agent.contactPerson,
                mobile: agent.mobile,
                email: agent.email,
                reraNumber: agent.reraNumber,
                commissionPct: agent.commissionPct?.toString() || '0',
                rating: agent.rating?.toString() || '0',
                tier,
                unitsSold: metrics.unitsSold,
                revenue: metrics.revenue,
                grossCommission: metrics.grossCommission,
                paidCommission: metrics.paidCommission,
                pendingCommission: paiseToRupees(agent.pendingCommission || 0n),
                activeLeads: metrics.activeLeads,
            };
        })
    );

    // Sort by revenue descending
    agentResults.sort((a, b) => b.revenue - a.revenue);

    // Build tier summary
    const TIERS = ['Platinum', 'Gold', 'Silver', 'Bronze', 'New'];
    const tierSummary = Object.fromEntries(
        TIERS.map((t) => {
            const group = agentResults.filter((a) => a.tier === t);
            return [
                t,
                {
                    count: group.length,
                    totalRevenue: group.reduce((s, a) => s + a.revenue, 0),
                },
            ];
        })
    );

    const data = { agents: agentResults, tierSummary };
    await redis.setex(cacheKey, CACHE_TTL, data).catch(() => {});
    return { success: true, data, cached: false };
};

// ── Agent Analytics (detail) ──────────────────────────────────────────────────

export const getAgentDetail = async (organizationId, agentId, _query = {}) => {
    const cacheKey = `analytics:agent:${organizationId}:${agentId}`;
    let cached = null;
    try { cached = await redis.get(cacheKey); } catch (_) { /* Redis unavailable */ }
    if (cached) return { success: true, data: cached, cached: true };

    const agent = await prisma.agent.findFirst({
        where: { id: agentId, organizationId },
        select: {
            id: true,
            agentCode: true,
            firmName: true,
            contactPerson: true,
            mobile: true,
            email: true,
            reraNumber: true,
            commissionPct: true,
            rating: true,
            totalCommission: true,
            pendingCommission: true,
        },
    });
    if (!agent) {
        const { NotFoundError } = await import('../../shared/errors.js');
        throw new NotFoundError('Agent');
    }

    const metrics = await computeAgentMetrics(organizationId, agentId);
    const rating = Number(agent.rating || 0);
    const tier = computeAgentTier(metrics.unitsSold, rating);

    // Monthly trend — last 6 months
    const now = new Date();
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

        const [count, rev] = await Promise.all([
            prisma.booking.count({
                where: {
                    organizationId,
                    agentId,
                    bookingDate: { gte: monthStart, lte: monthEnd },
                    status: { notIn: ['cancelled'] },
                },
            }),
            prisma.booking.aggregate({
                where: {
                    organizationId,
                    agentId,
                    bookingDate: { gte: monthStart, lte: monthEnd },
                    status: { notIn: ['cancelled'] },
                },
                _sum: { finalValue: true },
            }),
        ]);

        monthlyTrend.push({
            month: monthStart.toLocaleString('en-IN', {
                month: 'short',
                year: 'numeric',
            }),
            units: count,
            revenue: paiseToRupees(rev._sum.finalValue || 0n),
        });
    }

    // Project contributions
    const byProject = await prisma.booking.groupBy({
        by: ['projectId'],
        where: {
            organizationId,
            agentId,
            status: { notIn: ['cancelled'] },
        },
        _count: { id: true },
        _sum: { finalValue: true },
    });

    const projectIds = byProject.map((b) => b.projectId);
    const projectRecords = projectIds.length
        ? await prisma.project.findMany({
              where: { id: { in: projectIds } },
              select: { id: true, name: true },
          })
        : [];
    const projectMap = Object.fromEntries(projectRecords.map((p) => [p.id, p.name]));

    const projectContributions = byProject.map((b) => ({
        projectId: b.projectId,
        projectName: projectMap[b.projectId] || 'Unknown',
        units: b._count.id,
        revenue: paiseToRupees(b._sum.finalValue || 0n),
    }));

    // Average days to close
    let avgDaysToClose = null;
    if (metrics.agentBookingIds.length > 0) {
        const [convertedLeads, agentBookings] = await Promise.all([
            prisma.lead.findMany({
                where: {
                    organizationId,
                    convertedBookingId: { in: metrics.agentBookingIds },
                    isActive: true,
                },
                select: { createdAt: true, convertedBookingId: true },
            }),
            prisma.booking.findMany({
                where: { organizationId, agentId, id: { in: metrics.agentBookingIds } },
                select: { id: true, bookingDate: true },
            }),
        ]);

        const bookingDateMap = Object.fromEntries(
            agentBookings.map((b) => [b.id, b.bookingDate])
        );
        const diffs = convertedLeads
            .map((l) => {
                const bd = bookingDateMap[l.convertedBookingId];
                if (!bd) return null;
                return (bd - l.createdAt) / (1000 * 60 * 60 * 24);
            })
            .filter(Boolean);

        if (diffs.length > 0) {
            avgDaysToClose = Math.round(
                diffs.reduce((a, b) => a + b, 0) / diffs.length
            );
        }
    }

    const data = {
        id: agent.id,
        agentCode: agent.agentCode,
        firmName: agent.firmName,
        contactPerson: agent.contactPerson,
        mobile: agent.mobile,
        email: agent.email,
        reraNumber: agent.reraNumber,
        commissionPct: agent.commissionPct?.toString() || '0',
        rating: agent.rating?.toString() || '0',
        tier,
        unitsSold: metrics.unitsSold,
        revenue: metrics.revenue,
        grossCommission: metrics.grossCommission,
        paidCommission: metrics.paidCommission,
        pendingCommission: paiseToRupees(agent.pendingCommission || 0n),
        activeLeads: metrics.activeLeads,
        monthlyTrend,
        projectContributions,
        avgDaysToClose,
    };

    await redis.setex(cacheKey, CACHE_TTL, data).catch(() => {});
    return { success: true, data, cached: false };
};

// ── Heatmap Data ──────────────────────────────────────────────────────────────

const SOLD_STATUSES = new Set([
    'booked',
    'agreement_done',
    'registered',
    'possession_handed',
]);

export const getHeatmapData = async (organizationId, query = {}) => {
    const { projectId } = query;
    const cacheKey = `analytics:heatmap:${organizationId}:${projectId || 'all'}`;
    let cached = null;
    try { cached = await redis.get(cacheKey); } catch (_) { /* Redis unavailable */ }
    if (cached) return { success: true, data: cached, cached: true };

    const projectWhere = { organizationId, isActive: true };
    if (projectId) projectWhere.id = projectId;

    const projects = await prisma.project.findMany({
        where: projectWhere,
        select: {
            id: true,
            name: true,
            projectCode: true,
            towers: {
                where: { isActive: true },
                select: {
                    id: true,
                    name: true,
                    floors: true,
                    unitsPerFloor: true,
                    totalUnits: true,
                },
            },
        },
        ...(projectId ? {} : { take: 8, orderBy: { createdAt: 'desc' } }),
    });

    const result = await Promise.all(
        projects.map(async (project) => {
            const unitGroups = await prisma.unit.groupBy({
                by: ['towerId', 'floor', 'status'],
                where: { organizationId, projectId: project.id },
                _count: { id: true },
            });

            // Build unitMap: { "towerId:floor": { status: count } }
            const unitMap = {};
            unitGroups.forEach((u) => {
                const key = `${u.towerId}:${u.floor}`;
                if (!unitMap[key]) unitMap[key] = {};
                unitMap[key][u.status] = u._count.id;
            });

            const towers = project.towers.map((tower) => {
                const floors = [];
                for (let f = tower.floors; f >= 1; f--) {
                    const counts = unitMap[`${tower.id}:${f}`] || {};
                    const available = counts['available'] || 0;
                    const blocked = counts['blocked'] || 0;
                    const token_received = counts['token_received'] || 0;
                    const cancelled = counts['cancelled'] || 0;
                    const booked = Object.entries(counts)
                        .filter(([s]) => SOLD_STATUSES.has(s))
                        .reduce((s, [, c]) => s + c, 0);
                    const total =
                        available + blocked + token_received + cancelled + booked;

                    floors.push({
                        floor: f,
                        available,
                        blocked,
                        token_received,
                        booked,
                        cancelled,
                        total,
                        occupiedPct:
                            total > 0 ? Math.round((booked / total) * 100) : 0,
                    });
                }

                return {
                    towerId: tower.id,
                    towerName: tower.name,
                    totalUnits: tower.totalUnits,
                    floors,
                };
            });

            return {
                projectId: project.id,
                projectName: project.name,
                projectCode: project.projectCode,
                towers,
            };
        })
    );

    const data = { projects: result };
    await redis.setex(cacheKey, CACHE_TTL, data).catch(() => {});
    return { success: true, data, cached: false };
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
