// ── Audit Logger Middleware ───────────────────────────────────────────────────
// Automatically logs every mutating API call (POST, PATCH, PUT, DELETE)
// to the AuditLog table. Attached after route handlers complete.

import prisma from '../config/database.js';

// Routes to skip audit logging (high frequency, low value)
const SKIP_ROUTES = [
    '/health',
    '/v1/auth/refresh',
    '/v1/analytics',
    '/v1/communications',
];

/**
 * auditLogger — Express middleware that logs mutating requests.
 * Attach as app.use() AFTER routes are mounted.
 * Uses res.on('finish') to capture response status.
 */
export const auditLogger = (req, res, next) => {
    // Only log mutating methods
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
        return next();
    }

    // Skip configured routes
    const shouldSkip = SKIP_ROUTES.some((route) =>
        req.path.startsWith(route)
    );
    if (shouldSkip) return next();

    // Capture response finish event
    res.on('finish', async () => {
        try {
            // Only log successful mutations
            if (res.statusCode < 200 || res.statusCode >= 400) return;

            // Only log if we have org context
            if (!req.organizationId) return;

            // Extract entity info from URL
            // e.g. /v1/bookings/uuid → entity = bookings, entityId = uuid
            const parts = req.path.split('/').filter(Boolean);
            const entity = parts[1] || 'unknown';
            const entityId = parts[2] || null;
            const action = parts[3] || null;

            // Determine action type
            let actionType;
            if (req.method === 'POST' && !action) {
                actionType = 'CREATE';
            } else if (req.method === 'POST' && action) {
                actionType = action.toUpperCase();
            } else if (req.method === 'PATCH' || req.method === 'PUT') {
                actionType = 'UPDATE';
            } else if (req.method === 'DELETE') {
                actionType = 'DELETE';
            } else {
                actionType = req.method;
            }

            // Sanitize request body — remove sensitive fields
            const sanitizedBody = { ...req.body };
            delete sanitizedBody.password;
            delete sanitizedBody.refreshToken;
            delete sanitizedBody.panNumber;
            delete sanitizedBody.aadhaarNumber;

            await prisma.auditLog.create({
                data: {
                    organizationId: req.organizationId,
                    userId: req.user?.userId || null,
                    action: `${actionType}_${entity.toUpperCase()}`,
                    entityType: entity,
                    entityId: entityId || null,
                    metadata: {
                        method: req.method,
                        path: req.path,
                        statusCode: res.statusCode,
                        body: sanitizedBody,
                        query: req.query,
                    },
                    ipAddress:
                        req.headers['x-forwarded-for']?.split(',')[0] ||
                        req.socket?.remoteAddress ||
                        null,
                    userAgent: req.headers['user-agent'] || null,
                },
            });
        } catch (err) {
            // Never crash the request because of audit logging
            console.error('[AuditLog] Failed to write log:', err.message);
        }
    });

    next();
};
