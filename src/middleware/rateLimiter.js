import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

// ── Auth Rate Limiter ────────────────────────────────────────────────────────
// Strict limits on auth endpoints to prevent brute force

export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 10 : 100,
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
    max: process.env.NODE_ENV === 'production' ? 120 : 500,
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

// ── Org-level Rate Limiter ────────────────────────────────────────────────────
// Applied after requireAuth so req.organizationId is populated.
// Limits each organization to 300 requests per minute regardless
// of how many IPs or users the org has.
// Prevents one tenant from starving others on shared infrastructure.

export const orgRateLimiter = rateLimit({
    windowMs: 60 * 1000,    // 1 minute window
    max: process.env.NODE_ENV === 'production' ? 300 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.organizationId
            ? `org:${req.organizationId}:ratelimit`
            : ipKeyGenerator(req);
    },
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: {
                code: 'ORG_RATE_LIMIT_EXCEEDED',
                message:
                    'Your organization has exceeded the request limit ' +
                    '(300 requests/minute). Please slow down.',
                retryAfter: Math.ceil(60),
            },
        });
    },
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health';
    },
});
