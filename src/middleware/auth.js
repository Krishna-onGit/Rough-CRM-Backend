import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AuthenticationError } from '../shared/errors.js';
import { redis } from '../config/redis.js';

/**
 * requireAuth — verifies JWT access token on every protected route.
 * Attaches decoded payload to req.user
 * Checks Redis blacklist to reject logged-out tokens
 */
export const requireAuth = async (req, res, next) => {
    try {
        // 1. Extract token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AuthenticationError('Authorization header missing or malformed');
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            throw new AuthenticationError('Bearer token missing');
        }

        // 2. Check if token is blacklisted (user logged out)
        const blacklisted = await redis.get(`blacklist:${token}`);
        if (blacklisted) {
            throw new AuthenticationError('Token has been invalidated. Please log in again.');
        }

        // 3. Verify token signature and expiry
        let decoded;
        try {
            decoded = jwt.verify(token, env.JWT_SECRET);
        } catch (jwtError) {
            if (jwtError.name === 'TokenExpiredError') {
                throw new AuthenticationError('Access token expired. Please refresh your token.');
            }
            if (jwtError.name === 'JsonWebTokenError') {
                throw new AuthenticationError('Invalid token signature.');
            }
            throw new AuthenticationError('Token verification failed.');
        }

        // 4. Validate required claims exist in token
        if (!decoded.sub || !decoded.organizationId || !decoded.role) {
            throw new AuthenticationError('Token payload is incomplete.');
        }

        // 5. Attach full decoded payload to request
        req.user = {
            userId: decoded.sub,
            organizationId: decoded.organizationId,
            role: decoded.role,
            permissions: decoded.permissions || [],
            email: decoded.email,
        };

        // 6. Store raw token for potential blacklisting on logout
        req.token = token;

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * optionalAuth — same as requireAuth but does NOT fail if no token present.
 * Used for routes that work both authenticated and unauthenticated.
 */
export const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }
    return requireAuth(req, res, next);
};
