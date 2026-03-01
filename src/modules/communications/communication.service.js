import prisma from '../../config/database.js';
import {
    NotFoundError,
    BusinessRuleError,
} from '../../shared/errors.js';
import {
    parsePagination,
    buildPaginatedResponse,
    buildActionResponse,
} from '../../shared/pagination.js';
import {
    buildEnumFilter,
    buildDateRangeFilter,
    cleanObject,
} from '../../shared/filters.js';

// ── List Communications ───────────────────────────────────────────────────────

export const listCommunications = async (
    organizationId,
    query = {}
) => {
    const { skip, take, page, pageSize } = parsePagination(query);

    const where = cleanObject({
        organizationId,
        customerId: query.customerId || undefined,
        leadId: query.leadId || undefined,
        channel: buildEnumFilter(query.channel),
        direction: buildEnumFilter(query.direction),
        createdAt: buildDateRangeFilter(query.from, query.to),
    });

    const [logs, total] = await Promise.all([
        prisma.communicationLog.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                customerId: true,
                leadId: true,
                channel: true,
                direction: true,
                subject: true,
                content: true,
                initiatedBy: true,
                durationSeconds: true,
                createdAt: true,
            },
        }),
        prisma.communicationLog.count({ where }),
    ]);

    return buildPaginatedResponse(logs, total, page, pageSize);
};

// ── Log Communication ─────────────────────────────────────────────────────────

export const logCommunication = async (
    organizationId,
    userId,
    body
) => {
    const {
        customerId,
        leadId,
        channel,
        direction,
        subject,
        content,
        durationSeconds,
    } = body;

    // Verify customer if provided
    if (customerId) {
        const customer = await prisma.customer.findFirst({
            where: { id: customerId, organizationId },
        });
        if (!customer) throw new NotFoundError('Customer');
    }

    // Verify lead if provided
    if (leadId) {
        const lead = await prisma.lead.findFirst({
            where: { id: leadId, organizationId },
        });
        if (!lead) throw new NotFoundError('Lead');
    }

    // Duration only valid for calls
    if (durationSeconds && channel !== 'call') {
        throw new BusinessRuleError(
            'Duration in seconds is only applicable for call channel.'
        );
    }

    const log = await prisma.communicationLog.create({
        data: {
            organizationId,
            customerId: customerId || null,
            leadId: leadId || null,
            channel: channel || 'call',
            direction: direction || 'outbound',
            subject: subject || null,
            content: content || null,
            initiatedBy: userId,
            durationSeconds: durationSeconds || null,
        },
    });

    return buildActionResponse(
        {
            id: log.id,
            channel: log.channel,
            direction: log.direction,
            createdAt: log.createdAt,
        },
        `${channel} communication logged successfully.`
    );
};

// ── Get Communication Summary ─────────────────────────────────────────────────

export const getCommunicationSummary = async (
    organizationId,
    query = {}
) => {
    const where = cleanObject({
        organizationId,
        customerId: query.customerId || undefined,
        leadId: query.leadId || undefined,
    });

    // Group by channel
    const byChannel = await prisma.communicationLog.groupBy({
        by: ['channel'],
        where,
        _count: { channel: true },
    });

    // Group by direction
    const byDirection = await prisma.communicationLog.groupBy({
        by: ['direction'],
        where,
        _count: { direction: true },
    });

    // Total call duration
    const callLogs = await prisma.communicationLog.findMany({
        where: { ...where, channel: 'call' },
        select: { durationSeconds: true },
    });

    const totalCallSeconds = callLogs.reduce(
        (sum, l) => sum + (l.durationSeconds || 0),
        0
    );

    return {
        success: true,
        data: {
            byChannel: Object.fromEntries(
                byChannel.map((b) => [b.channel, b._count.channel])
            ),
            byDirection: Object.fromEntries(
                byDirection.map((b) => [b.direction, b._count.direction])
            ),
            totalCallDuration: {
                seconds: totalCallSeconds,
                minutes: Math.round(totalCallSeconds / 60),
            },
        },
    };
};
