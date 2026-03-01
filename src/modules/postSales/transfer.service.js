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
    buildEnumFilter,
    cleanObject,
} from '../../shared/filters.js';
import { paiseToRupees, rupeesToPaise } from '../../shared/costSheet.js';

// ── List Transfers ────────────────────────────────────────────────────────────

export const listTransfers = async (
    organizationId,
    query = {}
) => {
    const { skip, take, page, pageSize } = parsePagination(query);

    const where = cleanObject({
        organizationId,
        status: buildEnumFilter(query.status),
        unitId: query.unitId || undefined,
        bookingId: query.bookingId || undefined,
    });

    const [transfers, total] = await Promise.all([
        prisma.transferRecord.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                transferCode: true,
                bookingId: true,
                unitId: true,
                fromCustomerId: true,
                toCustomerId: true,
                transferFee: true,
                status: true,
                transferDate: true,
                requestedBy: true,
                approvedBy: true,
                remarks: true,
                createdAt: true,
            },
        }),
        prisma.transferRecord.count({ where }),
    ]);

    const formatted = transfers.map((t) => ({
        ...t,
        transferFee: paiseToRupees(t.transferFee),
    }));

    return buildPaginatedResponse(formatted, total, page, pageSize);
};

// ── Initiate Transfer ─────────────────────────────────────────────────────────

export const initiateTransfer = async (
    organizationId,
    userId,
    body
) => {
    const {
        bookingId,
        unitId,
        toCustomerId,
        transferFee,
        remarks,
    } = body;

    // Verify booking exists and is in transferable state
    const booking = await prisma.booking.findFirst({
        where: { id: bookingId, organizationId },
    });
    if (!booking) throw new NotFoundError('Booking');

    if (
        !['booked', 'agreement_done', 'registered'].includes(
            booking.status
        )
    ) {
        throw new BusinessRuleError(
            `Transfer can only be initiated for bookings in booked, ` +
            `agreement_done, or registered status. ` +
            `Current status: "${booking.status}".`
        );
    }

    // Verify unit matches booking
    if (booking.unitId !== unitId) {
        throw new BusinessRuleError(
            'Unit ID does not match the booking.'
        );
    }

    // Verify new customer exists and is different
    if (booking.customerId === toCustomerId) {
        throw new BusinessRuleError(
            'Transfer must be to a different customer.'
        );
    }

    const toCustomer = await prisma.customer.findFirst({
        where: { id: toCustomerId, organizationId, isActive: true },
    });
    if (!toCustomer) throw new NotFoundError('New customer');

    // Check no pending transfer exists
    const existingTransfer = await prisma.transferRecord.findFirst({
        where: {
            bookingId,
            organizationId,
            status: { in: ['pending_approval', 'approved'] },
        },
    });
    if (existingTransfer) {
        throw new ConflictError(
            `A transfer request already exists for this booking ` +
            `(${existingTransfer.transferCode}).`
        );
    }

    // Generate transfer code
    const count = await prisma.transferRecord.count({
        where: { organizationId },
    });
    const transferCode = `TRF-${String(count + 1).padStart(4, '0')}`;

    const transferFeePaise = rupeesToPaise(transferFee || 0);

    // Create transfer record + approval request atomically
    const result = await prisma.$transaction(async (tx) => {
        const transfer = await tx.transferRecord.create({
            data: {
                organizationId,
                unitId,
                bookingId,
                transferCode,
                fromCustomerId: booking.customerId,
                toCustomerId,
                transferFee: transferFeePaise,
                status: 'pending_approval',
                requestedBy: userId,
                remarks: remarks || null,
            },
        });

        // Auto-create approval request
        const approval = await tx.approvalRequest.create({
            data: {
                organizationId,
                requestType: 'transfer',
                entityType: 'transfer_record',
                entityId: transfer.id,
                requestedBy: userId,
                requestData: {
                    transferCode,
                    bookingCode: booking.bookingCode,
                    fromCustomerId: booking.customerId,
                    toCustomerId,
                    transferFee: transferFeePaise.toString(),
                },
                justification: remarks || 'Transfer request',
                status: 'pending',
            },
        });

        return { transfer, approvalId: approval.id };
    });

    return buildActionResponse(
        {
            id: result.transfer.id,
            transferCode: result.transfer.transferCode,
            fromCustomerId: result.transfer.fromCustomerId,
            toCustomerId: result.transfer.toCustomerId,
            transferFee: paiseToRupees(transferFeePaise),
            status: result.transfer.status,
            approvalId: result.approvalId,
        },
        `Transfer ${transferCode} initiated. Pending approval.`
    );
};

// ── Process Transfer (after approval) ────────────────────────────────────────

export const processTransfer = async (
    organizationId,
    transferId,
    userId,
    body
) => {
    const transfer = await prisma.transferRecord.findFirst({
        where: { id: transferId, organizationId },
    });
    if (!transfer) throw new NotFoundError('Transfer record');

    if (transfer.status !== 'pending_approval') {
        throw new BusinessRuleError(
            `Transfer is already in "${transfer.status}" status.`
        );
    }

    const { approvedBy, remarks } = body;

    await prisma.$transaction(async (tx) => {
        // 1. Update transfer to executed
        await tx.transferRecord.update({
            where: { id: transferId },
            data: {
                status: 'executed',
                approvedBy,
                transferDate: new Date(),
            },
        });

        // 2. Update booking — change customer
        await tx.booking.update({
            where: { id: transfer.bookingId },
            data: { customerId: transfer.toCustomerId },
        });

        // 3. Update unit — change customer
        await tx.unit.update({
            where: { id: transfer.unitId },
            data: { customerId: transfer.toCustomerId },
        });

        // 4. Update possession record if exists
        await tx.possessionRecord.updateMany({
            where: {
                bookingId: transfer.bookingId,
                organizationId,
            },
            data: { customerId: transfer.toCustomerId },
        });

        // 5. Approve the approval request
        await tx.approvalRequest.updateMany({
            where: {
                entityId: transferId,
                organizationId,
                status: 'pending',
            },
            data: {
                status: 'approved',
                reviewedBy: approvedBy,
                reviewedAt: new Date(),
                reviewRemarks: remarks || null,
            },
        });
    });

    return buildActionResponse(
        {
            transferCode: transfer.transferCode,
            fromCustomerId: transfer.fromCustomerId,
            toCustomerId: transfer.toCustomerId,
            status: 'executed',
            transferDate: new Date(),
        },
        `Transfer ${transfer.transferCode} executed successfully. ` +
        `Ownership transferred to new customer.`
    );
};
