import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { env } from '../../config/env.js';
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
const signRefreshToken = async (user) => {
    const tokenId = uuidv4();
    const token = jwt.sign(
        { sub: user.id, tokenId, organizationId: user.organizationId },
        env.JWT_REFRESH_SECRET,
        { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
    );

    // Store refresh token in Redis for validation
    await redis.set(
        `refresh:${user.id}:${tokenId}`,
        JSON.stringify({ userId: user.id, organizationId: user.organizationId }),
        { ex: REFRESH_TOKEN_TTL_SEC }
    );

    return { token, tokenId };
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
export const refreshTokens = async (refreshToken) => {
    // Verify refresh token signature
    let decoded;
    try {
        decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    } catch {
        throw new AuthenticationError('Invalid or expired refresh token.');
    }

    const redisKey = `refresh:${decoded.sub}:${decoded.tokenId}`;

    // Check token exists in Redis
    const stored = await redis.get(redisKey);
    if (!stored) {
        throw new AuthenticationError('Refresh token not found or already used.');
    }

    // Delete old refresh token (rotation — each refresh token is single use)
    await redis.del(redisKey);

    // Get fresh user data
    const user = await prisma.user.findUnique({
        where: { id: decoded.sub },
    });
    if (!user || !user.isActive) {
        throw new AuthenticationError('User account not found or deactivated.');
    }

    // Issue new token pair
    const newAccessToken = signAccessToken(user);
    const { token: newRefreshToken } = await signRefreshToken(user);

    return {
        tokens: {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        },
    };
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
            await redis.set(`blacklist:${token}`, '1', { ex: ttl });
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
