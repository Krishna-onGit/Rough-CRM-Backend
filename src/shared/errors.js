export class AppError extends Error {
    constructor(message, statusCode, code) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class ValidationError extends AppError {
    constructor(message, details = []) {
        super(message, 422, 'VALIDATION_ERROR');
        this.details = details;
    }
}

export class AuthError extends AppError {
    constructor(
        message = 'Authentication required.'
    ) {
        super(message, 401, 'UNAUTHORIZED');
    }
}

export class ForbiddenError extends AppError {
    constructor(
        message = 'You do not have permission to perform this action.'
    ) {
        super(message, 403, 'FORBIDDEN');
    }
}

export class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found.`, 404, 'NOT_FOUND');
    }
}

export class ConflictError extends AppError {
    constructor(message) {
        super(message, 409, 'CONFLICT');
    }
}

export class BusinessRuleError extends AppError {
    constructor(message) {
        super(message, 422, 'BUSINESS_RULE_VIOLATION');
    }
}

export class RateLimitError extends AppError {
    constructor(
        message = 'Too many requests. Please slow down.'
    ) {
        super(message, 429, 'RATE_LIMIT_EXCEEDED');
    }
}

// ── Global Error Handler ─────────────────────────────────────────────────────
// Express error handling middleware — must be mounted last.

export const globalErrorHandler = (err, req, res, next) => {
    // Log all errors in development
    if (process.env.NODE_ENV === 'development') {
        console.error(`[Error] ${req.method} ${req.path}`, {
            message: err.message,
            code: err.code,
            stack: err.stack?.split('\n').slice(0, 5),
        });
    }

    // Handle Zod validation errors
    if (err.name === 'ZodError') {
        return res.status(422).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Request validation failed.',
                details: err.errors.map((e) => ({
                    field: e.path.join('.'),
                    message: e.message,
                })),
            },
        });
    }

    // Handle Prisma errors
    if (err.code === 'P2002') {
        return res.status(409).json({
            success: false,
            error: {
                code: 'CONFLICT',
                message: 'A record with this value already exists.',
                field: err.meta?.target?.[0] || 'unknown',
            },
        });
    }

    if (err.code === 'P2025') {
        return res.status(404).json({
            success: false,
            error: {
                code: 'NOT_FOUND',
                message: 'The requested record does not exist.',
            },
        });
    }

    if (err.code === 'P2003') {
        return res.status(422).json({
            success: false,
            error: {
                code: 'FOREIGN_KEY_VIOLATION',
                message:
                    'Related record not found. ' +
                    'Check referenced IDs.',
            },
        });
    }

    // Handle operational errors (our custom AppErrors)
    if (err.isOperational) {
        return res.status(err.statusCode).json({
            success: false,
            error: {
                code: err.code,
                message: err.message,
                ...(err.details && { details: err.details }),
            },
        });
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            error: {
                code: 'INVALID_TOKEN',
                message: 'Invalid authentication token.',
            },
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            error: {
                code: 'TOKEN_EXPIRED',
                message: 'Authentication token has expired.',
            },
        });
    }

    // Unhandled/unexpected errors — do not leak details
    console.error('[UNHANDLED ERROR]', err);
    return res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_SERVER_ERROR',
            message:
                'An unexpected error occurred. ' +
                'Please try again or contact support.',
            requestId: req.requestId || null,
        },
    });
};

export const AuthenticationError = AuthError;
export const AuthorizationError = ForbiddenError;
