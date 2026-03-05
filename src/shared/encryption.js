import crypto from 'node:crypto';
import { env } from '../config/env.js';

// ── Constants ────────────────────────────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;         // 96-bit IV for GCM
const AUTH_TAG_LENGTH = 16;   // 128-bit auth tag
const CURRENT_KEY_VERSION = 'v1';

// ── Key store — supports key rotation without data loss ───────────────────────
// When rotating: add v2 key to env, set CURRENT_KEY_VERSION = 'v2'
// Old v1 records remain decryptable via KEY_STORE['v1']

const KEY_STORE = {
    v1: Buffer.from(env.PII_ENCRYPTION_KEY, 'hex'),
};

// Validate key length on startup
if (KEY_STORE.v1.length !== 32) {
    throw new Error(
        'PII_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes).'
    );
}

// ── Encrypt ───────────────────────────────────────────────────────────────────

/**
 * encrypt — AES-256-GCM encryption with key versioning.
 * Output format: {version}:{ivHex}:{authTagHex}:{ciphertextHex}
 * Example:       v1:a3f1...:b2c9...:deadbeef...
 *
 * @param {string} plaintext
 * @returns {string|null}
 */
export const encrypt = (plaintext) => {
    if (!plaintext) return null;

    const key = KEY_STORE[CURRENT_KEY_VERSION];
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
    });

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    return [
        CURRENT_KEY_VERSION,
        iv.toString('hex'),
        authTag,
        encrypted,
    ].join(':');
};

// ── Decrypt ───────────────────────────────────────────────────────────────────

/**
 * decrypt — AES-256-GCM decryption with key version resolution.
 * Handles both versioned format (v1:...) and legacy 3-part format.
 *
 * @param {string} encryptedString
 * @returns {string|null}
 */
export const decrypt = (encryptedString) => {
    if (!encryptedString) return null;

    // Detect format: versioned (4 parts) vs legacy (3 parts)
    const parts = encryptedString.split(':');

    let version, ivHex, authTagHex, ciphertext;

    if (parts.length === 4) {
        [version, ivHex, authTagHex, ciphertext] = parts;
    } else if (parts.length === 3) {
        // Legacy format without version — assume v1
        version = 'v1';
        [ivHex, authTagHex, ciphertext] = parts;
    } else {
        throw new Error('Invalid encrypted string format.');
    }

    const key = KEY_STORE[version];
    if (!key) {
        throw new Error(
            `Unknown encryption key version: "${version}". ` +
            `Cannot decrypt this record. Check PII_ENCRYPTION_KEY env vars.`
        );
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
};

// ── isEncrypted ───────────────────────────────────────────────────────────────

/**
 * isEncrypted — strict format check using regex.
 * Matches versioned (v1:ivHex:authTagHex:ciphertext) format.
 * Used by migration script to skip already-encrypted values.
 *
 * @param {string} value
 * @returns {boolean}
 */
export const isEncrypted = (value) => {
    if (!value || typeof value !== 'string') return false;
    // v1: 24 hex chars (IV) : 32 hex chars (authTag) : any hex chars
    return /^v\d+:[a-f0-9]{24}:[a-f0-9]{32}:[a-f0-9]+$/.test(value);
};

// ── safeDecrypt ───────────────────────────────────────────────────────────────

/**
 * safeDecrypt — decrypt without throwing.
 * Returns null on any error (decryption failure, bad format, missing key).
 * Use only for display/masking — not for security-critical paths.
 *
 * @param {string} encryptedString
 * @returns {string|null}
 */
export const safeDecrypt = (encryptedString) => {
    try {
        return decrypt(encryptedString);
    } catch {
        return null;
    }
};
