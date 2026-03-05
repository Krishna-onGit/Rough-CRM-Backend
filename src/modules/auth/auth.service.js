import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import {
    AuthenticationError,
    ConflictError,
    NotFoundError,
    ValidationError,
} from '../../shared/errors.js';

// ── Token TTLs in seconds ───────────────────────────────────────────────────
const ACCESS_TOKEN_TTL_SEC = 7 * 24 * 60 * 60;     // 7 days
const REFRESH_TOKEN_TTL_SEC = 30 * 24 * 60 * 60;   // 30 days

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build JWT custom claims payload — same structure on every token
 */
const buildTokenPayload = (user) => ({
    sub: user.id,
    userId: user.id,
    organizationId: user.organizationId,
    role: user.role,
    email: user.email,
    permissions: getRolePermissions(user.role),
});

/**
 * Map a role to its default permission strings.
 * This is the single source of truth for default permissions.
 * Fine-grained overrides can be stored in DB later.
 */
export const getRolePermissions = (role) => {
    const permissionMap = {
        admin: [
            'projects:read', 'projects:create', 'projects:update',
            'units:read', 'units:block', 'units:token',
            'bookings:read', 'bookings:create', 'bookings:update',
            'payments:read', 'payments:create', 'payments:update',
            'leads:read', 'leads:create', 'leads:update',
            'site_visits:read', 'site_visits:create', 'site_visits:update',
            'follow_ups:read', 'follow_ups:create', 'follow_ups:update',
            'sales_team:read', 'sales_team:create', 'sales_team:update',
            'agents:read', 'agents:create', 'agents:update',
            'commissions:read', 'commissions:update',
            'demand_letters:read', 'demand_letters:create', 'demand_letters:update',
            'cancellations:read', 'cancellations:create',
            'transfers:read', 'transfers:create',
            'possession:read', 'possession:create', 'possession:update',
            'complaints:read', 'complaints:create', 'complaints:update',
            'customers:read', 'customers:update',
            'documents:read', 'documents:create', 'documents:update',
            'communications:read', 'communications:create',
            'loans:read', 'loans:create', 'loans:update',
            'approvals:read', 'approvals:approve',
            'analytics:read', 'analytics:financial',
            'audit:read', 'org:settings:update',
        ],
        sales_manager: [
            'projects:read', 'projects:update',
            'units:read', 'units:block', 'units:token',
            'bookings:read', 'bookings:create', 'bookings:update',
            'leads:read', 'leads:create', 'leads:update',
            'site_visits:read', 'site_visits:create', 'site_visits:update',
            'follow_ups:read', 'follow_ups:create', 'follow_ups:update',
            'sales_team:read',
            'agents:read', 'agents:create', 'agents:update',
            'commissions:read',
            'cancellations:read', 'cancellations:create',
            'transfers:read', 'transfers:create',
            'complaints:read', 'complaints:create', 'complaints:update',
            'customers:read', 'customers:update',
            'documents:read', 'documents:create',
            'communications:read', 'communications:create',
            'loans:read',
            'approvals:read', 'approvals:approve',
            'analytics:read',
        ],
        sales_executive: [
            'projects:read',
            'units:read', 'units:block', 'units:token',
            'bookings:read', 'bookings:create',
            'leads:read', 'leads:create', 'leads:update',
            'site_visits:read', 'site_visits:create', 'site_visits:update',
            'follow_ups:read', 'follow_ups:create', 'follow_ups:update',
            'sales_team:read',
            'agents:read',
            'commissions:read',
            'complaints:read', 'complaints:create',
            'customers:read',
            'documents:read', 'documents:create',
            'communications:read', 'communications:create',
            'analytics:read',
        ],
        finance: [
            'projects:read', 'units:read',
            'bookings:read',
            'payments:read', 'payments:create', 'payments:update',
            'demand_letters:read', 'demand_letters:create', 'demand_letters:update',
            'commissions:read', 'commissions:update',
            'cancellations:read',
            'customers:read', 'customers:update',
            'documents:read', 'documents:create', 'documents:update',
            'loans:read', 'loans:create', 'loans:update',
            'approvals:read',
            'analytics:read', 'analytics:financial',
        ],
        operations: [
            'projects:read', 'units:read',
            'bookings:read',
            'site_visits:read',
            'possession:read', 'possession:create', 'possession:update',
            'complaints:read', 'complaints:create', 'complaints:update',
            'customers:read',
            'documents:read',
            'communications:read', 'communications:create',
        ],
    };

    return permissionMap[role] || [];
};

/**
 * Sign a short-lived access token
 */
const signAccessToken = (user) => {
    return jwt.sign(buildTokenPayload(user), env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN,
    });
};

/**
 * Sign a long-lived refresh token and store it in Redis
 */
const signRefreshToken = async (user, existingFamily = null) => {
    const family = existingFamily || uuidv4();
    const tokenId = uuidv4();
    const token = jwt.sign(
        { sub: user.id, tokenId, organizationId: user.organizationId, family },
        env.JWT_REFRESH_SECRET,
        { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
    );

    // Store refresh token in Redis for validation (non-fatal if Redis unavailable)
    await redis.set(
        `refresh:${user.id}:${tokenId}`,
        JSON.stringify({ userId: user.id, organizationId: user.organizationId }),
        { ex: REFRESH_TOKEN_TTL_SEC }
    ).catch((err) => {
        logger.warn('[Auth] Refresh token store failed', { err: err.message });
    });

    return { token, tokenId, family };
};

// ── Service Functions ────────────────────────────────────────────────────────

/**
 * registerOrganization — creates a new org + first admin user in one transaction.
 * This is the entry point for onboarding a new real-estate company.
 */
export const registerOrganization = async ({ orgName, orgSlug, fullName, email, password }) => {
    // Check slug uniqueness
    const existingOrg = await prisma.organization.findUnique({
        where: { slug: orgSlug },
    });
    if (existingOrg) {
        throw new ConflictError(`Organization slug "${orgSlug}" is already taken.`);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create org + admin user atomically
    const result = await prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
            data: {
                name: orgName,
                slug: orgSlug,
                plan: 'standard',
                settings: {},
            },
        });

        const user = await tx.user.create({
            data: {
                organizationId: org.id,
                fullName,
                email: email.toLowerCase().trim(),
                passwordHash,
                role: 'admin',
                isActive: true,
            },
        });

        return { org, user };
    });

    // Generate tokens
    const accessToken = signAccessToken(result.user);
    const { token: refreshToken } = await signRefreshToken(result.user);

    return {
        organization: {
            id: result.org.id,
            name: result.org.name,
            slug: result.org.slug,
            plan: result.org.plan,
        },
        user: {
            id: result.user.id,
            fullName: result.user.fullName,
            email: result.user.email,
            role: result.user.role,
        },
        tokens: { accessToken, refreshToken },
    };
};

/**
 * login — validates credentials and returns tokens.
 */
export const login = async ({ email, password, organizationSlug }) => {
    // Find org by slug
    const org = await prisma.organization.findUnique({
        where: { slug: organizationSlug },
    });
    if (!org || !org.isActive) {
        throw new AuthenticationError('Invalid organization, email, or password.');
    }

    // Find user within that org
    const user = await prisma.user.findFirst({
        where: {
            organizationId: org.id,
            email: email.toLowerCase().trim(),
            isActive: true,
        },
    });

    // Deliberate vague message — never reveal which field is wrong
    if (!user) {
        throw new AuthenticationError('Invalid organization, email, or password.');
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
        throw new AuthenticationError('Invalid organization, email, or password.');
    }

    // Update last login timestamp
    await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const accessToken = signAccessToken(user);
    const { token: refreshToken } = await signRefreshToken(user);

    return {
        user: {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            organizationId: user.organizationId,
        },
        tokens: { accessToken, refreshToken },
    };
};

/**
 * refreshTokens — validates refresh token and issues new token pair.
 * Old refresh token is deleted (rotation).
 */
export const refreshTokens = async (incomingRefreshToken) => {
    // ── Verify token structure ──────────────────────────────────
    let decoded;
    try {
        decoded = jwt.verify(incomingRefreshToken, env.JWT_REFRESH_SECRET);
    } catch {
        throw new AuthenticationError('Invalid or expired refresh token.');
    }

    const { sub: userId, tokenId, family } = decoded;

    // ── Check token family grace window (race condition fix) ────
    // If this family was refreshed recently (within 30 seconds),
    // return the same new token pair — idempotent refresh.
    // This handles two browser tabs refreshing simultaneously.
    const familyKey = `refresh:family:${family}`;

    if (family) {
        try {
            const cached = await redis.get(familyKey);
            if (cached) {
                logger.info('[Auth] Refresh token family cache hit', { userId, family });
                return typeof cached === 'string' ? JSON.parse(cached) : cached;
            }
        } catch (err) {
            logger.warn('[Auth] Family cache get failed', { err: err.message });
        }
    }

    // ── Check blacklist (non-fatal if Redis unavailable) ────────
    const blacklistKey = `blacklist:${incomingRefreshToken}`;
    let redisAvailable = true;
    try {
        const isBlacklisted = await redis.get(blacklistKey);
        if (isBlacklisted) {
            throw new AuthenticationError('Refresh token has been revoked. Please log in again.');
        }
    } catch (err) {
        if (err instanceof AuthenticationError) throw err;
        redisAvailable = false;
        logger.warn('[Auth] Blacklist check failed', { err: err.message });
    }

    // Legacy whitelist check — non-fatal if Redis unavailable or token not stored
    // (when Redis is down/limited, signRefreshToken silently skips the SET,
    //  so a missing key does not mean the token is invalid)
    const redisKey = `refresh:${userId}:${tokenId}`;
    if (redisAvailable) {
        try {
            const stored = await redis.get(redisKey);
            if (!stored) {
                // Token not in whitelist — Redis may have been unavailable during login.
                // Log and proceed (non-blocking) rather than locking the user out.
                logger.warn('[Auth] Refresh token not in whitelist — possible Redis miss, proceeding.', { userId });
            }
        } catch (err) {
            logger.warn('[Auth] Whitelist check failed', { err: err.message });
        }
    }

    // ── Fetch user ──────────────────────────────────────────────
    const user = await prisma.user.findUnique({
        where: { id: userId },
    });
    if (!user || !user.isActive) {
        throw new AuthenticationError('User account not found or deactivated.');
    }

    // ── Generate new token pair ─────────────────────────────────
    // New refresh token carries the SAME family ID
    // so subsequent refreshes within grace window are idempotent
    const newAccessToken = signAccessToken(user);
    const { token: newRefreshToken, family: newFamily } = await signRefreshToken(user, family);

    const tokenPair = {
        tokens: {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        },
    };

    // ── Store in family cache for 30-second grace window ────────
    if (newFamily) {
        await redis.set(
            familyKey,
            JSON.stringify(tokenPair),
            { ex: 30 }   // 30-second TTL
        ).catch((err) => {
            logger.warn('[Auth] Family cache set failed', {
                err: err.message,
            });
        });
    }

    // ── Blacklist the old refresh token ─────────────────────────
    const refreshExpiry = 7 * 24 * 60 * 60; // 7 days in seconds
    await redis.set(
        blacklistKey,
        '1',
        { ex: refreshExpiry }
    ).catch((err) => {
        logger.warn('[Auth] Blacklist set failed', {
            err: err.message,
        });
    });

    // Delete old refresh token from whitelist (non-fatal)
    await redis.del(redisKey).catch(() => {});

    logger.info('[Auth] Token refreshed successfully', {
        userId,
        family: newFamily,
    });

    return tokenPair;
};

/**
 * logout — blacklists the current access token in Redis.
 * Token blacklist entry expires when the token would have expired anyway.
 */
export const logout = async (token) => {
    // Decode without verifying (we already verified in auth middleware)
    const decoded = jwt.decode(token);
    if (decoded?.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
            await redis.set(`blacklist:${token}`, '1', { ex: ttl }).catch((err) => {
                logger.warn('[Auth] Logout blacklist failed', { err: err.message });
            });
        }
    }
    return { message: 'Logged out successfully.' };
};

/**
 * getMe — returns full profile of the currently authenticated user.
 */
export const getMe = async (userId) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { organization: true },
    });

    if (!user) {
        throw new NotFoundError('User');
    }

    return {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        permissions: getRolePermissions(user.role),
        organization: {
            id: user.organization.id,
            name: user.organization.name,
            slug: user.organization.slug,
            plan: user.organization.plan,
        },
    };
};
