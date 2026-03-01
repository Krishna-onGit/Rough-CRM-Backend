// ── Structured Logger ────────────────────────────────────────────────────────
// Lightweight structured logger for LeadFlow AI.
// In production replace with Winston or Pino.

import { env } from './env.js';

const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};

const currentLevel =
    env.NODE_ENV === 'production'
        ? LOG_LEVELS.info
        : LOG_LEVELS.debug;

const formatLog = (level, message, meta = {}) => {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        environment: env.NODE_ENV,
        ...(Object.keys(meta).length > 0 && { meta }),
    };
    return JSON.stringify(entry);
};

export const logger = {
    error: (message, meta = {}) => {
        if (currentLevel >= LOG_LEVELS.error) {
            console.error(formatLog('error', message, meta));
        }
    },
    warn: (message, meta = {}) => {
        if (currentLevel >= LOG_LEVELS.warn) {
            console.warn(formatLog('warn', message, meta));
        }
    },
    info: (message, meta = {}) => {
        if (currentLevel >= LOG_LEVELS.info) {
            console.info(formatLog('info', message, meta));
        }
    },
    debug: (message, meta = {}) => {
        if (currentLevel >= LOG_LEVELS.debug) {
            console.debug(formatLog('debug', message, meta));
        }
    },
    // HTTP request logger — call in morgan/request log middleware
    http: (req, statusCode, responseTimeMs) => {
        const level =
            statusCode >= 500
                ? 'error'
                : statusCode >= 400
                    ? 'warn'
                    : 'info';

        console[level === 'info' ? 'info' : level](
            formatLog(level, 'HTTP Request', {
                method: req.method,
                path: req.path,
                statusCode,
                responseTimeMs,
                requestId: req.requestId,
                ip:
                    req.headers['x-forwarded-for'] ||
                    req.socket?.remoteAddress,
            })
        );
    },
};
