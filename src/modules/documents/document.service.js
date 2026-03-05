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
    cleanObject,
} from '../../shared/filters.js';
import {
    buildFileKey,
    generateUploadUrl,
    generateDownloadUrl,
    deleteFile,
} from '../../config/s3.js';

// ── List Documents ────────────────────────────────────────────────────────────

export const listDocuments = async (
    organizationId,
    query = {}
) => {
    const { skip, take, page, pageSize } = parsePagination(query);

    const where = cleanObject({
        organizationId,
        customerId: query.customerId || undefined,
        bookingId: query.bookingId || undefined,
        category: buildEnumFilter(query.category),
        status: buildEnumFilter(query.status),
    });

    const [documents, total] = await Promise.all([
        prisma.customerDocument.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                customerId: true,
                bookingId: true,
                category: true,
                fileName: true,
                fileKey: true,
                fileSize: true,
                mimeType: true,
                status: true,
                verifiedBy: true,
                remarks: true,
                createdAt: true,
            },
        }),
        prisma.customerDocument.count({ where }),
    ]);

    const formatted = documents.map((d) => ({
        ...d,
        fileSize: Number(d.fileSize),
        // Generate a signed URL placeholder
        // Phase 11 will replace with real S3 presigned URLs
        downloadUrl: `/v1/documents/${d.id}/download`,
    }));

    return buildPaginatedResponse(formatted, total, page, pageSize);
};

// ── Upload Document (register in DB) ─────────────────────────────────────────

export const uploadDocument = async (
    organizationId,
    userId,
    body
) => {
    const {
        customerId,
        bookingId,
        category,
        fileName,
        fileKey,
        fileSize,
        mimeType,
        remarks,
    } = body;

    // Verify customer exists
    const customer = await prisma.customer.findFirst({
        where: { id: customerId, organizationId, isActive: true },
    });
    if (!customer) throw new NotFoundError('Customer');

    // Verify booking if provided
    if (bookingId) {
        const booking = await prisma.booking.findFirst({
            where: { id: bookingId, organizationId },
        });
        if (!booking) throw new NotFoundError('Booking');
    }

    const document = await prisma.customerDocument.create({
        data: {
            organizationId,
            customerId,
            bookingId: bookingId || null,
            category,
            fileName,
            fileKey,
            fileSize: BigInt(fileSize),
            mimeType: mimeType || null,
            status: 'uploaded',
            remarks: remarks || null,
        },
    });

    // Update customer KYC documents list
    const kycCategories = [
        'pan_card', 'aadhaar', 'photo',
        'address_proof', 'income_proof',
    ];

    if (kycCategories.includes(category)) {
        const existing = Array.isArray(customer.kycDocuments)
            ? customer.kycDocuments
            : [];

        const updated = [
            ...existing.filter((d) => d.category !== category),
            {
                category,
                documentId: document.id,
                uploadedAt: new Date().toISOString(),
            },
        ];

        await prisma.customer.update({
            where: { id: customerId },
            data: { kycDocuments: updated },
        });
    }

    return buildActionResponse(
        {
            id: document.id,
            category: document.category,
            fileName: document.fileName,
            fileSize: Number(document.fileSize),
            status: document.status,
        },
        `Document "${fileName}" uploaded successfully.`
    );
};

// ── Verify Document ───────────────────────────────────────────────────────────

export const verifyDocument = async (
    organizationId,
    documentId,
    userId,
    body
) => {
    const document = await prisma.customerDocument.findFirst({
        where: { id: documentId, organizationId },
    });
    if (!document) throw new NotFoundError('Document');

    if (document.status !== 'uploaded') {
        throw new BusinessRuleError(
            `Document is already "${document.status}". ` +
            `Only uploaded documents can be verified or rejected.`
        );
    }

    const updated = await prisma.customerDocument.update({
        where: { id: documentId },
        data: {
            status: body.status,
            verifiedBy: userId,
            remarks: body.remarks || null,
        },
    });

    return buildActionResponse(
        {
            id: updated.id,
            fileName: updated.fileName,
            status: updated.status,
            verifiedBy: updated.verifiedBy,
        },
        `Document "${updated.fileName}" ${body.status}.`
    );
};

// ── S3 Operations ────────────────────────────────────────────────────────────

/**
 * getUploadUrl — returns a presigned S3 upload URL.
 * Client uploads directly to S3, then calls confirmUpload().
 */
export const getUploadUrl = async (
    organizationId,
    body,
    userId
) => {
    const { customerId, category, fileName, contentType } = body;

    // Validate customer belongs to org
    const customer = await prisma.customer.findFirst({
        where: { id: customerId, organizationId },
    });
    if (!customer) throw new NotFoundError('Customer');

    // Generate unique S3 key
    const fileKey = buildFileKey(
        organizationId,
        customerId,
        category,
        fileName
    );

    // Generate presigned upload URL (5 min expiry)
    const uploadUrl = await generateUploadUrl(fileKey, contentType);

    // Create pending document record
    const document = await prisma.customerDocument.create({
        data: {
            organizationId,
            customerId,
            category,
            fileName,
            fileKey,
            contentType: contentType || 'application/octet-stream',
            status: 'pending',   // becomes 'uploaded' after confirm
            uploadedBy: userId,
        },
    });

    return buildActionResponse(
        {
            documentId: document.id,
            uploadUrl,
            fileKey,
            expiresInSeconds: 300,
        },
        'Upload URL generated. Upload the file directly to S3, ' +
        'then call POST /v1/documents/:id/confirm to activate.'
    );
};

/**
 * confirmUpload — marks document as uploaded after S3 PUT completes.
 * Called by client after successful direct S3 upload.
 */
export const confirmUpload = async (
    organizationId,
    documentId,
    userId
) => {
    const document = await prisma.customerDocument.findFirst({
        where: { id: documentId, organizationId },
    });
    if (!document) throw new NotFoundError('Document');

    if (document.status !== 'pending') {
        throw new BusinessRuleError(
            `Document is already ${document.status}.`
        );
    }

    const updated = await prisma.customerDocument.update({
        where: { id: documentId },
        data: {
            status: 'uploaded',
            confirmedAt: new Date(),
            confirmedBy: userId,
        },
    });

    return buildActionResponse(
        { documentId, status: 'uploaded' },
        'Document upload confirmed successfully.'
    );
};

/**
 * getDownloadUrl — returns a presigned S3 download URL.
 * Never serves the file directly through the app server.
 */
export const getDownloadUrl = async (
    organizationId,
    documentId,
    userId
) => {
    const document = await prisma.customerDocument.findFirst({
        where: {
            id: documentId,
            organizationId,
            status: { in: ['uploaded', 'verified'] },
        },
    });

    if (!document) {
        throw new NotFoundError(
            'Document not found or not yet uploaded.'
        );
    }

    const downloadUrl = await generateDownloadUrl(document.fileKey);

    return buildActionResponse(
        {
            documentId,
            downloadUrl,
            fileName: document.fileName,
            expiresInSeconds: 3600,
        },
        'Download URL generated. URL expires in 1 hour.'
    );
};
