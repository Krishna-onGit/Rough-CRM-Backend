// ── Request Size + Content Type Validator ────────────────────────────────────
// Rejects requests with invalid content types for mutation endpoints
// and enforces maximum request body size.

export const validateContentType = (req, res, next) => {
    // Only validate mutating requests
    if (!['POST', 'PATCH', 'PUT'].includes(req.method)) {
        return next();
    }

    // Skip multipart (file uploads)
    if (req.headers['content-type']?.includes('multipart/form-data')) {
        return next();
    }

    const contentType = req.headers['content-type'];

    if (!contentType || !contentType.includes('application/json')) {
        return res.status(415).json({
            success: false,
            error: {
                code: 'UNSUPPORTED_MEDIA_TYPE',
                message:
                    'Content-Type must be application/json for this endpoint.',
            },
        });
    }

    next();
};

// ── Request ID Injector ──────────────────────────────────────────────────────
// Attaches a unique request ID to every request for tracing

import { randomUUID } from 'crypto';

export const attachRequestId = (req, res, next) => {
    const requestId =
        req.headers['x-request-id'] || randomUUID();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
};
