// ── Base Application Error ───────────────────────────────────────────────────
export class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;  // Operational errors are expected/safe to expose
        Error.captureStackTrace(this, this.constructor);
    }
}

// ── Specific Error Types ─────────────────────────────────────────────────────
export class ValidationError extends AppError {
    constructor(message, details = null) {
        super(message, 400, 'VALIDATION_ERROR');
        this.name = 'ValidationError';
        this.details = details;
    }
}

export class AuthenticationError extends AppError {
    constructor(message = 'Authentication required') {
        super(message, 401, 'AUTHENTICATION_ERROR');
        this.name = 'AuthenticationError';
    }
}

export class AuthorizationError extends AppError {
    constructor(message = 'Insufficient permissions') {
        super(message, 403, 'AUTHORIZATION_ERROR');
        this.name = 'AuthorizationError';
    }
}

export class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404, 'NOT_FOUND');
        this.name = 'NotFoundError';
    }
}

export class ConflictError extends AppError {
    constructor(message) {
        super(message, 409, 'CONFLICT');
        this.name = 'ConflictError';
    }
}

export class BusinessRuleError extends AppError {
    constructor(message) {
        super(message, 422, 'BUSINESS_RULE_VIOLATION');
        this.name = 'BusinessRuleError';
    }
}

// ── Error Response Formatter ─────────────────────────────────────────────────
export const formatErrorResponse = (err, includeStack = false) => {
    const response = {
        success: false,
        error: {
            code: err.code || 'INTERNAL_ERROR',
            message: err.isOperational
                ? err.message
                : 'An unexpected error occurred. Please try again.',
        },
    };

    if (err.details) {
        response.error.details = err.details;
    }

    if (includeStack && err.stack) {
        response.error.stack = err.stack;
    }

    return response;
};
