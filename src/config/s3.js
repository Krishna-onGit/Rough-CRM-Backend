import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from './env.js';
import { logger } from './logger.js';
import crypto from 'node:crypto';

// ── S3 Client ─────────────────────────────────────────────────────────────────
export const s3Client = new S3Client({
    region: env.AWS_REGION || 'ap-south-1',
    credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
});

const BUCKET = env.AWS_S3_BUCKET;
const UPLOAD_EXPIRY_SECONDS = 300;    // 5 minutes
const DOWNLOAD_EXPIRY_SECONDS = 3600; // 1 hour

// ── buildFileKey ──────────────────────────────────────────────────────────────
/**
 * Generates a deterministic, collision-resistant S3 key.
 * Format: {orgId}/documents/{customerId}/{category}/{uuid}-{sanitizedFilename}
 *
 * @param {string} organizationId
 * @param {string} customerId
 * @param {string} category  — e.g. 'pan', 'aadhaar', 'noc', 'agreement'
 * @param {string} fileName  — original filename from client
 * @returns {string}
 */
export const buildFileKey = (
    organizationId,
    customerId,
    category,
    fileName
) => {
    const uuid = crypto.randomUUID();
    const sanitized = fileName
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .toLowerCase()
        .slice(0, 100); // cap length
    return `${organizationId}/documents/${customerId}/${category}/${uuid}-${sanitized}`;
};

// ── generateUploadUrl ─────────────────────────────────────────────────────────
/**
 * Returns a presigned PUT URL for direct browser-to-S3 upload.
 * The file never touches the app server.
 *
 * @param {string} fileKey     — from buildFileKey()
 * @param {string} contentType — e.g. 'image/jpeg', 'application/pdf'
 * @returns {Promise<string>}  — presigned URL
 */
export const generateUploadUrl = async (fileKey, contentType) => {
    const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: fileKey,
        ContentType: contentType,
    });

    const url = await getSignedUrl(s3Client, command, {
        expiresIn: UPLOAD_EXPIRY_SECONDS,
    });

    logger.info('[S3] Generated upload URL', {
        fileKey,
        contentType,
        expiresIn: UPLOAD_EXPIRY_SECONDS,
    });

    return url;
};

// ── generateDownloadUrl ───────────────────────────────────────────────────────
/**
 * Returns a presigned GET URL for direct download.
 *
 * @param {string} fileKey — stored S3 key from document record
 * @returns {Promise<string>}
 */
export const generateDownloadUrl = async (fileKey) => {
    if (!fileKey) {
        throw new Error('Cannot generate download URL: fileKey is empty.');
    }

    const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: fileKey,
    });

    const url = await getSignedUrl(s3Client, command, {
        expiresIn: DOWNLOAD_EXPIRY_SECONDS,
    });

    logger.info('[S3] Generated download URL', {
        fileKey,
        expiresIn: DOWNLOAD_EXPIRY_SECONDS,
    });

    return url;
};

// ── deleteFile ────────────────────────────────────────────────────────────────
/**
 * Deletes a file from S3. Used when a document record is deleted.
 *
 * @param {string} fileKey
 */
export const deleteFile = async (fileKey) => {
    if (!fileKey) return;

    const command = new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: fileKey,
    });

    await s3Client.send(command);

    logger.info('[S3] File deleted', { fileKey });
};
