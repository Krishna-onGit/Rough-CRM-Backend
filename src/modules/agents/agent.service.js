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
    buildBooleanFilter,
    cleanObject,
} from '../../shared/filters.js';
import {
    paiseToRupees,
    rupeesToPaise,
} from '../../shared/costSheet.js';

// ── List Agents ───────────────────────────────────────────────────────────────

export const listAgents = async (
    organizationId,
    query = {}
) => {
    const { skip, take, page, pageSize } = parsePagination(query);

    const where = cleanObject({
        organizationId,
        isActive: buildBooleanFilter(query.isActive) ?? true,
    });

    const searchFilter = buildSearchFilter(query.search, [
        'contactPerson',
        'firmName',
        'agentCode',
        'mobile',
    ]);
    if (searchFilter) where.OR = searchFilter;

    const [agents, total] = await Promise.all([
        prisma.agent.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
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
                isActive: true,
                createdAt: true,
            },
        }),
        prisma.agent.count({ where }),
    ]);

    const formatted = agents.map((a) => ({
        ...a,
        commissionPct: Number(a.commissionPct),
        rating: Number(a.rating),
        totalCommission: paiseToRupees(a.totalCommission),
        pendingCommission: paiseToRupees(a.pendingCommission),
    }));

    return buildPaginatedResponse(formatted, total, page, pageSize);
};

// ── Get Single Agent ──────────────────────────────────────────────────────────

export const getAgent = async (organizationId, agentId) => {
    const agent = await prisma.agent.findFirst({
        where: { id: agentId, organizationId },
    });
    if (!agent) throw new NotFoundError('Agent');

    // Get all commissions for this agent
    const commissions = await prisma.commission.findMany({
        where: { agentId, organizationId },
        select: {
            id: true,
            bookingId: true,
            agreementValue: true,
            grossCommission: true,
            gstAmount: true,
            tdsAmount: true,
            netPayable: true,
            paidAmount: true,
            pendingAmount: true,
            status: true,
            createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
    });

    // Commission summary
    const totalGross = commissions.reduce(
        (sum, c) => sum + c.grossCommission,
        0n
    );
    const totalPaid = commissions.reduce(
        (sum, c) => sum + c.paidAmount,
        0n
    );
    const totalPending = commissions.reduce(
        (sum, c) => sum + c.pendingAmount,
        0n
    );

    return buildSingleResponse({
        ...agent,
        commissionPct: Number(agent.commissionPct),
        rating: Number(agent.rating),
        totalCommission: paiseToRupees(agent.totalCommission),
        pendingCommission: paiseToRupees(agent.pendingCommission),
        commissions: commissions.map((c) => ({
            ...c,
            agreementValue: paiseToRupees(c.agreementValue),
            grossCommission: paiseToRupees(c.grossCommission),
            gstAmount: paiseToRupees(c.gstAmount),
            tdsAmount: paiseToRupees(c.tdsAmount),
            netPayable: paiseToRupees(c.netPayable),
            paidAmount: paiseToRupees(c.paidAmount),
            pendingAmount: paiseToRupees(c.pendingAmount),
        })),
        commissionSummary: {
            totalGross: paiseToRupees(totalGross),
            totalPaid: paiseToRupees(totalPaid),
            totalPending: paiseToRupees(totalPending),
            totalBookings: commissions.length,
        },
    });
};

// ── Create Agent ──────────────────────────────────────────────────────────────

export const createAgent = async (
    organizationId,
    userId,
    body
) => {
    const { reraNumber, mobile, ...rest } = body;

    // Auto-generate agent code
    const agentCount = await prisma.agent.count({ where: { organizationId } });
    const agentCode = `AG-${String(agentCount + 1).padStart(3, '0')}`;

    // Check RERA uniqueness if provided
    if (reraNumber) {
        const existingRera = await prisma.agent.findFirst({
            where: { organizationId, reraNumber },
        });
        if (existingRera) {
            throw new ConflictError(
                `An agent with RERA number "${reraNumber}" already exists ` +
                `(${existingRera.agentCode}).`
            );
        }
    }

    // Check mobile uniqueness
    const existingMobile = await prisma.agent.findFirst({
        where: { organizationId, mobile },
    });
    if (existingMobile) {
        throw new ConflictError(
            `An agent with mobile ${mobile} already exists ` +
            `(${existingMobile.agentCode}).`
        );
    }

    const agent = await prisma.agent.create({
        data: {
            ...rest,
            organizationId,
            agentCode,
            reraNumber,
            mobile,
            commissionPct: rest.commissionPct || 2,
            rating: 0,
            totalCommission: 0n,
            pendingCommission: 0n,
            isActive: true,
        },
    });

    return buildActionResponse(
        {
            id: agent.id,
            agentCode: agent.agentCode,
            contactPerson: agent.contactPerson,
            reraNumber: agent.reraNumber,
            commissionPct: Number(agent.commissionPct),
        },
        `Agent ${agentCode} created successfully.`
    );
};

// ── Update Agent ──────────────────────────────────────────────────────────────

export const updateAgent = async (
    organizationId,
    agentId,
    userId,
    body
) => {
    const agent = await prisma.agent.findFirst({
        where: { id: agentId, organizationId },
    });
    if (!agent) throw new NotFoundError('Agent');

    // Cannot deactivate agent with pending commissions
    if (body.isActive === false) {
        const pendingCommissions = await prisma.commission.count({
            where: {
                agentId,
                organizationId,
                status: {
                    in: ['pending', 'approved', 'partially_paid'],
                },
            },
        });
        if (pendingCommissions > 0) {
            throw new BusinessRuleError(
                `Cannot deactivate agent with ${pendingCommissions} ` +
                `pending commission(s). Settle commissions first.`
            );
        }
    }

    const updated = await prisma.agent.update({
        where: { id: agentId },
        data: body,
    });

    return buildActionResponse(
        {
            id: updated.id,
            agentCode: updated.agentCode,
            isActive: updated.isActive,
        },
        'Agent updated successfully.'
    );
};

// ── Record Commission Payment ─────────────────────────────────────────────────

export const recordCommissionPayment = async (
    organizationId,
    agentId,
    userId,
    body
) => {
    const agent = await prisma.agent.findFirst({
        where: { id: agentId, organizationId },
    });
    if (!agent) throw new NotFoundError('Agent');

    const { commissionId, amountPaid, paymentMode, remarks } = body;

    // Verify commission belongs to this agent
    const commission = await prisma.commission.findFirst({
        where: { id: commissionId, agentId, organizationId },
    });
    if (!commission) throw new NotFoundError('Commission');

    const PAYOUT_ELIGIBLE_STATUSES = ['sale_completed'];

    if (!PAYOUT_ELIGIBLE_STATUSES.includes(commission.status)) {
        throw new BusinessRuleError(
            `Commission payout is not yet eligible. ` +
            `Current status: "${commission.status}". ` +
            `Payout is only allowed after possession handover sets the ` +
            `commission to "sale_completed". ` +
            `Complete possession for this booking first.`
        );
    }

    if (commission.status === 'cancelled') {
        throw new BusinessRuleError(
            'Cannot record payment for a cancelled commission.'
        );
    }

    const amountPaise = rupeesToPaise(amountPaid);

    // Validate amount does not exceed pending
    if (amountPaise > commission.pendingAmount) {
        throw new BusinessRuleError(
            `Payment amount (₹${amountPaid}) exceeds pending ` +
            `commission amount ` +
            `(₹${paiseToRupees(commission.pendingAmount)}).`
        );
    }

    const newPaidAmount = commission.paidAmount + amountPaise;
    const newPendingAmount = commission.pendingAmount - amountPaise;
    const isFullyPaid = newPendingAmount === 0n;

    // Update commission record
    await prisma.$transaction(async (tx) => {
        // 1. Update commission
        await tx.commission.update({
            where: { id: commissionId },
            data: {
                paidAmount: newPaidAmount,
                pendingAmount: newPendingAmount,
                status: isFullyPaid ? 'paid' : 'partially_paid',
            },
        });

        // 2. Update agent running totals
        await tx.agent.update({
            where: { id: agentId },
            data: {
                totalCommission: {
                    increment: amountPaise,
                },
                pendingCommission: {
                    decrement: amountPaise,
                },
            },
        });
    });

    return buildActionResponse(
        {
            commissionId,
            amountPaid: paiseToRupees(amountPaise),
            newPaidAmount: paiseToRupees(newPaidAmount),
            newPendingAmount: paiseToRupees(newPendingAmount),
            commissionStatus: isFullyPaid ? 'paid' : 'partially_paid',
        },
        `Commission payment of ₹${amountPaid.toLocaleString(
            'en-IN'
        )} recorded. ` +
        `${isFullyPaid
            ? 'Commission fully settled.'
            : `₹${paiseToRupees(
                newPendingAmount
            ).toLocaleString('en-IN')} remaining.`
        }`
    );
};

// ── Rate Agent ────────────────────────────────────────────────────────────────

export const rateAgent = async (
    organizationId,
    agentId,
    userId,
    rating
) => {
    const agent = await prisma.agent.findFirst({
        where: { id: agentId, organizationId },
    });
    if (!agent) throw new NotFoundError('Agent');

    if (rating < 0 || rating > 5) {
        throw new BusinessRuleError(
            'Rating must be between 0 and 5.'
        );
    }

    const updated = await prisma.agent.update({
        where: { id: agentId },
        data: { rating },
    });

    return buildActionResponse(
        {
            id: updated.id,
            agentCode: updated.agentCode,
            rating: Number(updated.rating),
        },
        `Agent rated ${rating}/5 successfully.`
    );
};
