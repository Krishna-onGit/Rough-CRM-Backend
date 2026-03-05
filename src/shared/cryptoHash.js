import crypto from 'node:crypto';
import { env } from '../config/env.js';

// ── HMAC-SHA256 PAN Hash ──────────────────────────────────────────────────────
//
// WHY HMAC and not plain SHA-256:
// PAN format is known: 5 letters + 4 digits + 1 letter = ~1.18B combinations.
// A rainbow table of all possible SHA-256(PAN) values is feasible.
// HMAC with a secret key makes rainbow tables computationally infeasible
// because the attacker needs the key to generate candidates.
//
// This hash is used for equality lookup only (find by PAN).
// The actual PAN value is stored encrypted via encryption.js.

const PAN_HASH_KEY = Buffer.from(
    env.PAN_HASH_KEY || env.PII_ENCRYPTION_KEY,
    'hex'
);

/**
 * hashPan — HMAC-SHA256 of a PAN number for database lookup.
 * Always uppercases and trims to ensure consistency.
 * Deterministic: same PAN always produces same hash.
 *
 * @param {string} pan
 * @returns {string} 64-char hex string
 */
export const hashPan = (pan) => {
    if (!pan) return null;
    return crypto
        .createHmac('sha256', PAN_HASH_KEY)
        .update(pan.trim().toUpperCase())
        .digest('hex');
};

/**
 * hashAadhaar — HMAC-SHA256 of Aadhaar number.
 * Separate function for clarity and future key-separation.
 *
 * @param {string} aadhaar
 * @returns {string} 64-char hex string
 */
export const hashAadhaar = (aadhaar) => {
    if (!aadhaar) return null;
    return crypto
        .createHmac('sha256', PAN_HASH_KEY)
        .update(aadhaar.trim())
        .digest('hex');
};
