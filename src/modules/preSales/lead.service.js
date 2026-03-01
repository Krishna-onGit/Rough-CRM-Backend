import prisma from '../../config/database.js';
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
    buildSearchFilter,
    buildEnumFilter,
    buildDateRangeFilter,
    cleanObject,
} from '../../shared/filters.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * generateLeadCode — creates sequential lead code per org.
 * Format: LEAD-0001, LEAD-0002, etc.
 */
const generateLeadCode = async (organizationId) => {
    const count = await prisma.lead.count({ where: { organizationId } });
    return `LEAD-${String(count + 1).padStart(4, '0')}`;
};

/**
 * Valid status transitions — enforces the lead pipeline flow.
 * A lead can only move forward (or to junk/lost from any stage).
 */
const VALID_TRANSITIONS = {
    new: [
        'contacted', 'site_visit_scheduled', 'interested',
        'lost', 'junk',
    ],
    contacted: [
        'site_visit_scheduled', 'interested',
        'negotiation', 'lost', 'junk',
    ],
    site_visit_scheduled: [
        'site_visit_done', 'contacted',
        'interested', 'lost', 'junk',
    ],
    site_visit_done: [
        'interested', 'negotiation',
        'lost', 'junk',
    ],
    interested: ['negotiation', 'won', 'lost', 'junk'],
    negotiation: ['won', 'lost', 'junk'],
    won: [],       // terminal — no further transitions
    lost: ['new'], // can be revived
    junk: ['new'], // can be revived
};

// ── List Leads ────────────────────────────────────────────────────────────────

export const listLeads = async (organizationId, query = {}, user = {}) => {
    const { skip, take, page, pageSize } = parsePagination(query);

    const where = cleanObject({
        organizationId,
        status: buildEnumFilter(query.status),
        source: buildEnumFilter(query.source),
        assignedTo: query.assignedTo || undefined,
        interestedProject: query.projectId || undefined,
        isActive: true,
        createdAt: buildDateRangeFilter(query.from, query.to),
    });

    // Sales executives can only see their own leads
    if (user.role === 'sales_executive') {
        where.assignedTo = user.userId;
    }

    // Search across name, mobile, email
    const searchFilter = buildSearchFilter(
        query.search,
        ['fullName', 'mobile', 'email']
    );
    if (searchFilter) where.OR = searchFilter;

    const [leads, total] = await Promise.all([
        prisma.lead.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                leadCode: true,
                fullName: true,
                mobile: true,
                email: true,
                source: true,
                status: true,
                score: true,
                interestedProject: true,
                interestedConfig: true,
                budgetMin: true,
                budgetMax: true,
                assignedTo: true,
                assignedAt: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        siteVisits: true,
                        followUpTasks: true,
                    },
                },
            },
        }),
        prisma.lead.count({ where }),
    ]);

    const formatted = leads.map((l) => ({
        ...l,
        budgetMin: l.budgetMin ? Number(l.budgetMin) / 100 : null,
        budgetMax: l.budgetMax ? Number(l.budgetMax) / 100 : null,
    }));

    return buildPaginatedResponse(formatted, total, page, pageSize);
};

// ── Get Single Lead ───────────────────────────────────────────────────────────

export const getLead = async (organizationId, leadId) => {
    const lead = await prisma.lead.findFirst({
        where: { id: leadId, organizationId, isActive: true },
        include: {
            siteVisits: {
                orderBy: { visitDate: 'desc' },
                select: {
                    id: true,
                    visitDate: true,
                    visitType: true,
                    feedback: true,
                    visitorCount: true,
                    checkInAt: true,
                    checkOutAt: true,
                    remarks: true,
                },
            },
            followUpTasks: {
                orderBy: { scheduledAt: 'asc' },
                select: {
                    id: true,
                    taskType: true,
                    priority: true,
                    status: true,
                    scheduledAt: true,
                    completedAt: true,
                    outcome: true,
                    remarks: true,
                },
            },
        },
    });

    if (!lead) throw new NotFoundError('Lead');

    return buildSingleResponse({
        ...lead,
        budgetMin: lead.budgetMin ? Number(lead.budgetMin) / 100 : null,
        budgetMax: lead.budgetMax ? Number(lead.budgetMax) / 100 : null,
    });
};

// ── Create Lead ───────────────────────────────────────────────────────────────

export const createLead = async (organizationId, userId, body) => {
    const {
        fullName,
        mobile,
        email,
        source,
        interestedProject,
        interestedConfig,
        budgetMin,
        budgetMax,
        assignedTo,
        remarks,
    } = body;

    // Check for duplicate mobile within org
    const existing = await prisma.lead.findFirst({
        where: { organizationId, mobile, isActive: true },
    });
    if (existing) {
        throw new ConflictError(
            `A lead with mobile ${mobile} already exists (${existing.leadCode}).`
        );
    }

    const leadCode = await generateLeadCode(organizationId);

    const lead = await prisma.lead.create({
        data: {
            organizationId,
            leadCode,
            fullName,
            mobile,
            email: email || null,
            source: source || 'walk_in',
            status: 'new',
            score: 0,
            interestedProject: interestedProject || null,
            interestedConfig: interestedConfig || null,
            budgetMin: budgetMin ? BigInt(Math.round(budgetMin * 100)) : null,
            budgetMax: budgetMax ? BigInt(Math.round(budgetMax * 100)) : null,
            assignedTo: assignedTo || null,
            assignedAt: assignedTo ? new Date() : null,
            remarks: remarks || null,
            isActive: true,
            createdBy: userId,
        },
    });

    return buildActionResponse(
        {
            id: lead.id,
            leadCode: lead.leadCode,
            fullName: lead.fullName,
            mobile: lead.mobile,
            status: lead.status,
            source: lead.source,
        },
        `Lead ${leadCode} created successfully.`
    );
};

// ── Update Lead ───────────────────────────────────────────────────────────────

export const updateLead = async (
    organizationId,
    leadId,
    userId,
    body
) => {
    const lead = await prisma.lead.findFirst({
        where: { id: leadId, organizationId, isActive: true },
    });
    if (!lead) throw new NotFoundError('Lead');

    const updateData = { ...body };

    // Convert budget to paise if provided
    if (body.budgetMin !== undefined) {
        updateData.budgetMin = body.budgetMin
            ? BigInt(Math.round(body.budgetMin * 100))
            : null;
    }
    if (body.budgetMax !== undefined) {
        updateData.budgetMax = body.budgetMax
            ? BigInt(Math.round(body.budgetMax * 100))
            : null;
    }

    // Handle assignment change
    if (body.assignedTo && body.assignedTo !== lead.assignedTo) {
        updateData.assignedAt = new Date();
    }

    const updated = await prisma.lead.update({
        where: { id: leadId },
        data: updateData,
    });

    return buildActionResponse(
        { id: updated.id, leadCode: updated.leadCode },
        'Lead updated successfully.'
    );
};

// ── Update Lead Status ────────────────────────────────────────────────────────

export const updateLeadStatus = async (
    organizationId,
    leadId,
    userId,
    body
) => {
    const lead = await prisma.lead.findFirst({
        where: { id: leadId, organizationId, isActive: true },
    });
    if (!lead) throw new NotFoundError('Lead');

    const { status, remarks, lostReason, convertedBookingId } = body;

    // Validate state machine transition
    const allowedTransitions = VALID_TRANSITIONS[lead.status] || [];
    if (!allowedTransitions.includes(status)) {
        throw new BusinessRuleError(
            `Cannot transition lead from "${lead.status}" to "${status}". ` +
            `Allowed transitions: ${allowedTransitions.join(', ') || 'none'}.`
        );
    }

    // Require lostReason when marking as lost
    if (status === 'lost' && !lostReason && !lead.lostReason) {
        throw new BusinessRuleError(
            'A reason is required when marking a lead as lost.'
        );
    }

    // Require convertedBookingId when marking as won
    if (status === 'won' && !convertedBookingId) {
        throw new BusinessRuleError(
            'A booking ID is required when marking a lead as won.'
        );
    }

    const updated = await prisma.lead.update({
        where: { id: leadId },
        data: {
            status,
            remarks: remarks || lead.remarks,
            lostReason: lostReason || lead.lostReason,
            convertedBookingId: convertedBookingId || lead.convertedBookingId,
        },
    });

    return buildActionResponse(
        {
            id: updated.id,
            leadCode: updated.leadCode,
            previousStatus: lead.status,
            newStatus: updated.status,
        },
        `Lead status updated from "${lead.status}" to "${status}".`
    );
};
