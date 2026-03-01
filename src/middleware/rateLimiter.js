import rateLimit from 'express-rate-limit';
import { redis } from '../config/redis.js';

// ── Auth Rate Limiter ────────────────────────────────────────────────────────
// Strict limits on auth endpoints to prevent brute force

export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message:
                'Too many requests from this IP. ' +
                'Please try again after 15 minutes.',
        },
    },
    skip: (req) => req.method === 'GET',
});

// ── API Rate Limiter ─────────────────────────────────────────────────────────
// General API rate limit — prevents abuse

export const apiRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message:
                'Too many requests. ' +
                'Please slow down and try again in a minute.',
        },
    },
});

// ── Analytics Rate Limiter ───────────────────────────────────────────────────
// Analytics are expensive — limit more aggressively

export const analyticsRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message:
                'Analytics rate limit exceeded. ' +
                'Please wait before requesting again.',
        },
    },
});
