import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

// General API rate limiter
export const apiRateLimiter = rateLimit({
    windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS, 10),
    max: parseInt(env.RATE_LIMIT_MAX_REQUESTS, 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
        },
    },
    skip: (req) => req.path === '/health',
});

// Stricter limiter for auth routes (prevent brute force)
export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 10,                     // 10 attempts per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: 'AUTH_RATE_LIMIT_EXCEEDED',
            message: 'Too many login attempts. Please try again in 15 minutes.',
        },
    },
});
