import { Router } from 'express';
import { authRateLimiter } from '../../middleware/rateLimit.js';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody, registerSchema, loginSchema, refreshSchema } from './auth.schema.js';
import * as authService from './auth.service.js';

const router = Router();

// Apply strict rate limiting to ALL auth routes
router.use(authRateLimiter);

/**
 * POST /v1/auth/register
 * Create a new organization with first admin user.
 * Public route — no auth required.
 */
router.post('/register', validateBody(registerSchema), async (req, res, next) => {
    try {
        const result = await authService.registerOrganization(req.body);
        res.status(201).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /v1/auth/login
 * Authenticate user, return access + refresh tokens.
 * Public route — no auth required.
 */
router.post('/login', validateBody(loginSchema), async (req, res, next) => {
    try {
        const result = await authService.login(req.body);
        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /v1/auth/refresh
 * Exchange a valid refresh token for a new token pair.
 * Public route — no auth required (token IS the credential).
 */
router.post('/refresh', validateBody(refreshSchema), async (req, res, next) => {
    try {
        const result = await authService.refreshTokens(req.body.refreshToken);
        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /v1/auth/logout
 * Blacklist current access token.
 * Protected — must be authenticated to logout.
 */
router.post('/logout', requireAuth, async (req, res, next) => {
    try {
        const result = await authService.logout(req.token);
        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /v1/auth/me
 * Get current authenticated user's profile.
 * Protected route.
 */
router.get('/me', requireAuth, async (req, res, next) => {
    try {
        const result = await authService.getMe(req.user.userId);
        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
});

export default router;
