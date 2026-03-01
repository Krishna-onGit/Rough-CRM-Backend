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

// ── List Follow-Up Tasks ──────────────────────────────────────────────────────

export const listFollowUps = async (
    organizationId,
    query = {},
    user = {}
) => {
    const { skip, take, page, pageSize } = parsePagination(query);

    const where = cleanObject({
        organizationId,
        leadId: query.leadId || undefined,
        assignedTo: query.assignedTo || undefined,
        taskType: buildEnumFilter(query.taskType),
        priority: buildEnumFilter(query.priority),
        status: buildEnumFilter(query.status),
        scheduledAt: buildDateRangeFilter(query.from, query.to),
    });

    // Sales executives see only their own tasks
    if (user.role === 'sales_executive') {
        where.assignedTo = user.userId;
    }

    const [tasks, total] = await Promise.all([
        prisma.followUpTask.findMany({
            where,
            skip,
            take,
            orderBy: [
                { priority: 'asc' },
                { scheduledAt: 'asc' },
            ],
            select: {
                id: true,
                leadId: true,
                assignedTo: true,
                taskType: true,
                priority: true,
                status: true,
                scheduledAt: true,
                completedAt: true,
                outcome: true,
                remarks: true,
                createdAt: true,
            },
        }),
        prisma.followUpTask.count({ where }),
    ]);

    return buildPaginatedResponse(tasks, total, page, pageSize);
};

// ── Create Follow-Up Task ─────────────────────────────────────────────────────

export const createFollowUp = async (
    organizationId,
    userId,
    body
) => {
    const {
        leadId,
        assignedTo,
        taskType,
        priority,
        scheduledAt,
        remarks,
    } = body;

    // Verify lead exists
    const lead = await prisma.lead.findFirst({
        where: { id: leadId, organizationId, isActive: true },
    });
    if (!lead) throw new NotFoundError('Lead');

    // Cannot create tasks for terminal lead statuses
    if (['won', 'junk'].includes(lead.status)) {
        throw new BusinessRuleError(
            `Cannot create a follow-up task for a lead with ` +
            `status "${lead.status}".`
        );
    }

    // Scheduled date must be in the future
    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate <= new Date()) {
        throw new BusinessRuleError(
            'Scheduled date must be in the future.'
        );
    }

    const task = await prisma.followUpTask.create({
        data: {
            organizationId,
            leadId,
            assignedTo: assignedTo || null,
            taskType: taskType || 'call',
            priority: priority || 'medium',
            status: 'pending',
            scheduledAt: scheduledDate,
            remarks: remarks || null,
        },
    });

    return buildActionResponse(
        {
            id: task.id,
            leadId: task.leadId,
            taskType: task.taskType,
            priority: task.priority,
            scheduledAt: task.scheduledAt,
            status: task.status,
        },
        'Follow-up task created successfully.'
    );
};

// ── Update Follow-Up Task ─────────────────────────────────────────────────────

export const updateFollowUp = async (
    organizationId,
    taskId,
    userId,
    body
) => {
    const task = await prisma.followUpTask.findFirst({
        where: { id: taskId, organizationId },
    });
    if (!task) throw new NotFoundError('Follow-up task');

    // Cannot update already completed or missed tasks
    if (['completed', 'missed'].includes(task.status) && body.status) {
        if (!['rescheduled'].includes(body.status)) {
            throw new BusinessRuleError(
                `Task with status "${task.status}" can only be rescheduled.`
            );
        }
    }

    // Require outcome when marking as completed
    if (body.status === 'completed' && !body.outcome && !task.outcome) {
        throw new BusinessRuleError(
            'An outcome is required when marking a task as completed.'
        );
    }

    // Require scheduledAt when rescheduling
    if (body.status === 'rescheduled' && !body.scheduledAt) {
        throw new BusinessRuleError(
            'A new scheduled date is required when rescheduling a task.'
        );
    }

    const updateData = { ...body };

    if (body.scheduledAt) {
        updateData.scheduledAt = new Date(body.scheduledAt);
    }
    if (body.completedAt) {
        updateData.completedAt = new Date(body.completedAt);
    }

    // Auto-set completedAt when marking complete
    if (body.status === 'completed' && !body.completedAt) {
        updateData.completedAt = new Date();
    }

    const updated = await prisma.followUpTask.update({
        where: { id: taskId },
        data: updateData,
    });

    return buildActionResponse(
        {
            id: updated.id,
            status: updated.status,
            completedAt: updated.completedAt,
            outcome: updated.outcome,
        },
        `Follow-up task updated to "${updated.status}".`
    );
};
