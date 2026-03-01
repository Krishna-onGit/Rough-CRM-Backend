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

// ── List Site Visits ──────────────────────────────────────────────────────────

export const listSiteVisits = async (
    organizationId,
    query = {},
    user = {}
) => {
    const { skip, take, page, pageSize } = parsePagination(query);

    const where = cleanObject({
        organizationId,
        leadId: query.leadId || undefined,
        projectId: query.projectId || undefined,
        salesPersonId: query.salesPersonId || undefined,
        visitType: buildEnumFilter(query.visitType),
        feedback: buildEnumFilter(query.feedback),
        visitDate: buildDateRangeFilter(query.from, query.to),
    });

    // Sales executives see only their own visits
    if (user.role === 'sales_executive') {
        where.salesPersonId = user.userId;
    }

    const [visits, total] = await Promise.all([
        prisma.siteVisit.findMany({
            where,
            skip,
            take,
            orderBy: { visitDate: 'desc' },
            select: {
                id: true,
                leadId: true,
                projectId: true,
                salesPersonId: true,
                visitDate: true,
                visitType: true,
                visitorCount: true,
                checkInAt: true,
                checkOutAt: true,
                feedback: true,
                remarks: true,
                createdAt: true,
            },
        }),
        prisma.siteVisit.count({ where }),
    ]);

    return buildPaginatedResponse(visits, total, page, pageSize);
};

// ── Create Site Visit ─────────────────────────────────────────────────────────

export const createSiteVisit = async (
    organizationId,
    userId,
    body
) => {
    const {
        leadId,
        projectId,
        salesPersonId,
        visitDate,
        visitType,
        visitorCount,
        remarks,
    } = body;

    // Verify lead exists and belongs to org
    const lead = await prisma.lead.findFirst({
        where: { id: leadId, organizationId, isActive: true },
    });
    if (!lead) throw new NotFoundError('Lead');

    // Prevent scheduling visit for won/junk/lost leads
    if (['won', 'junk'].includes(lead.status)) {
        throw new BusinessRuleError(
            `Cannot schedule a site visit for a lead with status "${lead.status}".`
        );
    }

    // Verify project exists
    const project = await prisma.project.findFirst({
        where: { id: projectId, organizationId, isActive: true },
    });
    if (!project) throw new NotFoundError('Project');

    // Create visit
    const visit = await prisma.siteVisit.create({
        data: {
            organizationId,
            leadId,
            projectId,
            salesPersonId: salesPersonId || null,
            visitDate: new Date(visitDate),
            visitType: visitType || 'first_visit',
            visitorCount: visitorCount || 1,
            remarks: remarks || null,
        },
    });

    // Auto-advance lead status to site_visit_scheduled
    // if still in new or contacted stage
    if (['new', 'contacted'].includes(lead.status)) {
        await prisma.lead.update({
            where: { id: leadId },
            data: { status: 'site_visit_scheduled' },
        });
    }

    return buildActionResponse(
        {
            id: visit.id,
            leadId: visit.leadId,
            projectId: visit.projectId,
            visitDate: visit.visitDate,
            visitType: visit.visitType,
            leadStatusUpdated: ['new', 'contacted'].includes(lead.status),
        },
        'Site visit scheduled successfully.'
    );
};

// ── Update Site Visit ─────────────────────────────────────────────────────────

export const updateSiteVisit = async (
    organizationId,
    visitId,
    userId,
    body
) => {
    const visit = await prisma.siteVisit.findFirst({
        where: { id: visitId, organizationId },
    });
    if (!visit) throw new NotFoundError('Site visit');

    // Validate checkout is after checkin
    if (body.checkOutAt && body.checkInAt) {
        if (new Date(body.checkOutAt) <= new Date(body.checkInAt)) {
            throw new BusinessRuleError(
                'Check-out time must be after check-in time.'
            );
        }
    }

    if (body.checkOutAt && !body.checkInAt && !visit.checkInAt) {
        throw new BusinessRuleError(
            'Cannot set check-out time without a check-in time.'
        );
    }

    const updateData = { ...body };
    if (body.visitDate) updateData.visitDate = new Date(body.visitDate);
    if (body.checkInAt) updateData.checkInAt = new Date(body.checkInAt);
    if (body.checkOutAt) updateData.checkOutAt = new Date(body.checkOutAt);

    const updated = await prisma.siteVisit.update({
        where: { id: visitId },
        data: updateData,
    });

    // If feedback recorded — auto-advance lead to site_visit_done
    if (body.feedback && body.checkOutAt) {
        const lead = await prisma.lead.findFirst({
            where: { id: visit.leadId, organizationId },
        });

        if (lead && lead.status === 'site_visit_scheduled') {
            await prisma.lead.update({
                where: { id: visit.leadId },
                data: { status: 'site_visit_done' },
            });
        }
    }

    return buildActionResponse(
        {
            id: updated.id,
            visitType: updated.visitType,
            feedback: updated.feedback,
            checkInAt: updated.checkInAt,
            checkOutAt: updated.checkOutAt,
        },
        'Site visit updated successfully.'
    );
};
