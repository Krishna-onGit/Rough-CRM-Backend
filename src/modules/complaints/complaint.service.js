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
    buildSearchFilter,
    buildEnumFilter,
    buildDateRangeFilter,
    buildBooleanFilter,
    cleanObject,
} from '../../shared/filters.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const generateComplaintCode = async (organizationId) => {
    const count = await prisma.complaint.count({
        where: { organizationId },
    });
    return `CMP-${String(count + 1).padStart(4, '0')}`;
};

/**
 * calculateSlaDeadline — SLA deadline based on priority.
 * high: 24 hours, medium: 48 hours, low: 72 hours
 */
const calculateSlaDeadline = (priority, slaHours) => {
    const hours =
        priority === 'high'
            ? 24
            : priority === 'medium'
                ? 48
                : 72;
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + (slaHours || hours));
    return { deadline, hours: slaHours || hours };
};

// ── List Complaints ───────────────────────────────────────────────────────────

export const listComplaints = async (
    organizationId,
    query = {},
    user = {}
) => {
    const { skip, take, page, pageSize } = parsePagination(query);

    const where = cleanObject({
        organizationId,
        status: buildEnumFilter(query.status),
        category: buildEnumFilter(query.category),
        priority: buildEnumFilter(query.priority),
        assignedTo: query.assignedTo || undefined,
        customerId: query.customerId || undefined,
        slaBreached: buildBooleanFilter(query.slaBreached),
        createdAt: buildDateRangeFilter(query.from, query.to),
    });

    const searchFilter = buildSearchFilter(query.search, [
        'subject',
        'complaintCode',
    ]);
    if (searchFilter) where.OR = searchFilter;

    const [complaints, total] = await Promise.all([
        prisma.complaint.findMany({
            where,
            skip,
            take,
            orderBy: [
                { priority: 'asc' },
                { createdAt: 'desc' },
            ],
            select: {
                id: true,
                complaintCode: true,
                customerId: true,
                category: true,
                subject: true,
                priority: true,
                status: true,
                assignedTo: true,
                slaHours: true,
                slaDeadline: true,
                slaBreached: true,
                resolvedAt: true,
                createdAt: true,
            },
        }),
        prisma.complaint.count({ where }),
    ]);

    return buildPaginatedResponse(complaints, total, page, pageSize);
};

// ── Get Single Complaint ──────────────────────────────────────────────────────

export const getComplaint = async (
    organizationId,
    complaintId
) => {
    const complaint = await prisma.complaint.findFirst({
        where: { id: complaintId, organizationId },
    });
    if (!complaint) throw new NotFoundError('Complaint');

    // Check if SLA has been breached (real-time check)
    let slaBreached = complaint.slaBreached;
    if (
        !slaBreached &&
        complaint.slaDeadline &&
        !['resolved', 'closed'].includes(complaint.status)
    ) {
        if (new Date() > new Date(complaint.slaDeadline)) {
            slaBreached = true;
            // Update in DB
            await prisma.complaint.update({
                where: { id: complaintId },
                data: { slaBreached: true },
            });
        }
    }

    return buildSingleResponse({ ...complaint, slaBreached });
};

// ── Create Complaint ──────────────────────────────────────────────────────────

export const createComplaint = async (
    organizationId,
    userId,
    body
) => {
    const {
        customerId,
        unitId,
        bookingId,
        category,
        subject,
        description,
        priority,
    } = body;

    // Verify customer exists
    const customer = await prisma.customer.findFirst({
        where: { id: customerId, organizationId, isActive: true },
    });
    if (!customer) throw new NotFoundError('Customer');

    const complaintCode = await generateComplaintCode(organizationId);

    const { deadline, hours } = calculateSlaDeadline(
        priority || 'medium'
    );

    const complaint = await prisma.complaint.create({
        data: {
            organizationId,
            complaintCode,
            customerId,
            unitId: unitId || null,
            bookingId: bookingId || null,
            category: category || 'general',
            subject,
            description,
            priority: priority || 'medium',
            status: 'open',
            slaHours: hours,
            slaDeadline: deadline,
            slaBreached: false,
        },
    });

    return buildActionResponse(
        {
            id: complaint.id,
            complaintCode: complaint.complaintCode,
            subject: complaint.subject,
            priority: complaint.priority,
            status: complaint.status,
            slaDeadline: complaint.slaDeadline,
        },
        `Complaint ${complaintCode} raised successfully. ` +
        `SLA deadline: ${deadline.toISOString()}.`
    );
};

// ── Update Complaint ──────────────────────────────────────────────────────────

export const updateComplaint = async (
    organizationId,
    complaintId,
    userId,
    body
) => {
    const complaint = await prisma.complaint.findFirst({
        where: { id: complaintId, organizationId },
    });
    if (!complaint) throw new NotFoundError('Complaint');

    if (['resolved', 'closed'].includes(complaint.status)) {
        throw new BusinessRuleError(
            `Cannot update a ${complaint.status} complaint.`
        );
    }

    // Only allow updating fields that exist on the Complaint model
    const updateData = {};
    if (body.assignedTo !== undefined) updateData.assignedTo = body.assignedTo;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.subject !== undefined) updateData.subject = body.subject;

    // Recalculate SLA if priority changes
    if (body.priority && body.priority !== complaint.priority) {
        const { deadline, hours } = calculateSlaDeadline(body.priority);
        updateData.slaDeadline = deadline;
        updateData.slaHours = hours;
    }

    // Move to in_progress when assigned
    if (body.assignedTo && complaint.status === 'open') {
        updateData.status = 'in_progress';
    }

    const updated = await prisma.complaint.update({
        where: { id: complaintId },
        data: updateData,
    });

    return buildActionResponse(
        {
            id: updated.id,
            complaintCode: updated.complaintCode,
            status: updated.status,
            assignedTo: updated.assignedTo,
            priority: updated.priority,
        },
        'Complaint updated successfully.'
    );
};

// ── Resolve Complaint ─────────────────────────────────────────────────────────

export const resolveComplaint = async (
    organizationId,
    complaintId,
    userId,
    body
) => {
    const complaint = await prisma.complaint.findFirst({
        where: { id: complaintId, organizationId },
    });
    if (!complaint) throw new NotFoundError('Complaint');

    if (['resolved', 'closed'].includes(complaint.status)) {
        throw new BusinessRuleError(
            `Complaint is already "${complaint.status}".`
        );
    }

    const resolvedAt = new Date();

    const updated = await prisma.complaint.update({
        where: { id: complaintId },
        data: {
            status: 'resolved',
            resolution: body.resolution,
            resolvedAt,
        },
    });

    // Calculate resolution time
    const resolutionHours = Math.round(
        (resolvedAt - new Date(complaint.createdAt)) / (1000 * 60 * 60)
    );

    return buildActionResponse(
        {
            id: updated.id,
            complaintCode: updated.complaintCode,
            status: updated.status,
            resolvedAt: updated.resolvedAt,
            resolutionHours,
            withinSla: !complaint.slaBreached,
        },
        `Complaint ${updated.complaintCode} resolved in ` +
        `${resolutionHours} hour(s).`
    );
};

// ── Escalate Complaint ────────────────────────────────────────────────────────

export const escalateComplaint = async (
    organizationId,
    complaintId,
    userId,
    body
) => {
    const complaint = await prisma.complaint.findFirst({
        where: { id: complaintId, organizationId },
    });
    if (!complaint) throw new NotFoundError('Complaint');

    if (['closed', 'escalated'].includes(complaint.status)) {
        throw new BusinessRuleError(
            `Cannot escalate a complaint with status "${complaint.status}".`
        );
    }

    // Escalation upgrades priority to high
    const updated = await prisma.complaint.update({
        where: { id: complaintId },
        data: {
            status: 'escalated',
            priority: 'high',
            slaBreached: true,
        },
    });

    return buildActionResponse(
        {
            id: updated.id,
            complaintCode: updated.complaintCode,
            status: updated.status,
            priority: updated.priority,
        },
        `Complaint ${updated.complaintCode} escalated. ` +
        `Priority upgraded to high.`
    );
};
