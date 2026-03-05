import express from 'express';
import leadRouter from './modules/preSales/lead.routes.js';
import siteVisitRouter from './modules/preSales/siteVisit.routes.js';
import followUpRouter from './modules/preSales/followUp.routes.js';
import paymentRouter from './modules/postSales/payment.routes.js';
import demandLetterRouter from './modules/postSales/demandLetter.routes.js';
import cancellationRouter from './modules/postSales/cancellation.routes.js';
import transferRouter from './modules/postSales/transfer.routes.js';
import possessionRouter from './modules/postSales/possession.routes.js';
import customerRouter from './modules/customers/customer.routes.js';
import documentRouter from './modules/documents/document.routes.js';
import complaintRouter from './modules/complaints/complaint.routes.js';
import communicationRouter from './modules/communications/communication.routes.js';
import salesTeamRouter from './modules/salesTeam/salesPerson.routes.js';
import agentRouter from './modules/agents/agent.routes.js';
import analyticsRouter from './modules/analytics/analytics.routes.js';
import approvalRouter from './modules/approvals/approval.routes.js';
import auditRouter from './modules/audit/audit.routes.js';
import loanRouter from './modules/loans/loan.routes.js';
import { auditLogger } from './middleware/auditLogger.js';
import bookingRouter from './modules/salesEngine/booking.routes.js';
// Jobs loaded dynamically after server starts to prevent Redis errors crashing startup
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { env, isDev } from './config/env.js';
import prisma from './config/database.js';
import { redis } from './config/redis.js';
import {
    authRateLimiter,
    apiRateLimiter,
    analyticsRateLimiter,
    orgRateLimiter,
} from './middleware/rateLimiter.js';
import { requireAuth } from './middleware/auth.js';
import { requireOrganization } from './middleware/organization.js';
import {
    validateContentType,
    attachRequestId,
} from './middleware/requestValidator.js';
import { globalErrorHandler, AppError } from './shared/errors.js';
import { logger } from './config/logger.js';
import authRouter from './modules/auth/auth.routes.js';
import projectRouter from './modules/projects/project.routes.js';
import unitRouter from './modules/units/unit.routes.js';

// ── BigInt JSON Serializer ───────────────────────────────────────────────────
// BigInt does not serialize to JSON natively in JavaScript.
// This global override ensures BigInt values are safely serialized
// as numbers (or strings for very large values exceeding safe integer range).
BigInt.prototype.toJSON = function () {
    const int = Number.parseInt(this.toString());
    return Number.isSafeInteger(int) ? int : this.toString();
};

const app = express();

// ── Security Middleware ─────────────────────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(attachRequestId);
app.use(apiRateLimiter);
app.use(validateContentType);

app.use(cors({
    origin: env.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-organization-id'],
    credentials: true,
}));

// ── Request Parsing ─────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── HTTP Request Logging ────────────────────────────────────────────────────
app.use(morgan(isDev ? 'dev' : 'combined'));

// ── Health Check (no auth required) ────────────────────────────────────────
app.get('/health', async (req, res) => {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV,
        version: env.API_VERSION,
        services: {
            database: 'unknown',
            redis: 'unknown',
        },
    };

    // Check DB
    try {
        await prisma.$queryRaw`SELECT 1`;
        health.services.database = 'ok';
    } catch {
        health.services.database = 'error';
        health.status = 'degraded';
    }

    // Check Redis (non-fatal — Redis degraded does not fail health check)
    try {
        await redis.ping();
        health.services.redis = 'ok';
    } catch {
        health.services.redis = 'degraded';
    }

    // Only 503 if database is down (Redis degraded is tolerated)
    const statusCode = health.services.database === 'error' ? 503 : 200;
    res.status(statusCode).json(health);
});

// ── API Routes ───────────────────────────────────────────────────────────────
app.use('/v1/auth', authRateLimiter, authRouter);
app.use('/v1/projects', requireAuth, requireOrganization, orgRateLimiter, projectRouter);
app.use('/v1/units', requireAuth, requireOrganization, orgRateLimiter, unitRouter);
app.use('/v1/bookings', requireAuth, requireOrganization, orgRateLimiter, bookingRouter);
app.use('/v1/leads', requireAuth, requireOrganization, orgRateLimiter, leadRouter);
app.use('/v1/site-visits', requireAuth, requireOrganization, orgRateLimiter, siteVisitRouter);
app.use('/v1/follow-ups', requireAuth, requireOrganization, orgRateLimiter, followUpRouter);
app.use('/v1/payments', requireAuth, requireOrganization, orgRateLimiter, paymentRouter);
app.use('/v1/demand-letters', requireAuth, requireOrganization, orgRateLimiter, demandLetterRouter);
app.use('/v1/cancellations', requireAuth, requireOrganization, orgRateLimiter, cancellationRouter);
app.use('/v1/transfers', requireAuth, requireOrganization, orgRateLimiter, transferRouter);
app.use('/v1/possessions', requireAuth, requireOrganization, orgRateLimiter, possessionRouter);
app.use('/v1/customers', requireAuth, requireOrganization, orgRateLimiter, customerRouter);
app.use('/v1/documents', requireAuth, requireOrganization, orgRateLimiter, documentRouter);
app.use('/v1/complaints', requireAuth, requireOrganization, orgRateLimiter, complaintRouter);
app.use('/v1/communications', requireAuth, requireOrganization, orgRateLimiter, communicationRouter);
app.use('/v1/sales-team', requireAuth, requireOrganization, orgRateLimiter, salesTeamRouter);
app.use('/v1/agents', requireAuth, requireOrganization, orgRateLimiter, agentRouter);
app.use('/v1/analytics', analyticsRateLimiter, requireAuth, requireOrganization, orgRateLimiter, analyticsRouter);
app.use('/v1/audit', requireAuth, requireOrganization, orgRateLimiter, auditRouter);
app.use('/v1/approvals', requireAuth, requireOrganization, orgRateLimiter, approvalRouter);
app.use('/v1/loans', requireAuth, requireOrganization, orgRateLimiter, loanRouter);
// Base API info route
app.get('/v1', (req, res) => {
    res.json({
        success: true,
        message: 'LeadFlow AI API',
        version: env.API_VERSION,
        environment: env.NODE_ENV,
    });
});

// ── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
    next(new AppError(`Route ${req.method} ${req.path} not found`, 404, 'ROUTE_NOT_FOUND'));
});

app.use(auditLogger);

// ── Global Error Handler ────────────────────────────────────────────────────
// Must have 4 parameters for Express to treat it as error middleware
app.use(globalErrorHandler);

// ── Server Startup ──────────────────────────────────────────────────────────
const PORT = parseInt(env.PORT, 10);

const server = app.listen(PORT, () => {
    logger.info('LeadFlow AI Backend started', {
        environment: env.NODE_ENV,
        port: PORT,
        api: `http://localhost:${PORT}/v1`,
        health: `http://localhost:${PORT}/health`,
    });

    // Load background jobs after server is ready — errors won't crash startup
    const jobFiles = [
        './jobs/blockExpiry.job.js',
        './jobs/demandOverdue.job.js',
        './jobs/slaBreachCheck.job.js',
        './jobs/approvalEscalation.job.js',
        './jobs/notificationWorker.js',
    ];
    jobFiles.forEach((file) => {
        import(file).catch((err) => {
            logger.warn(`Background job failed to start: ${file}`, { err: err.message });
        });
    });
});

// ── Graceful Shutdown ───────────────────────────────────────────────────────
const shutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(async () => {
        await prisma.$disconnect();
        console.log('Database disconnected.');
        process.exit(0);
    });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.warn('Unhandled Rejection', { reason: reason?.message || String(reason) });
});

// Prevent ioredis/BullMQ Redis errors from crashing the server in non-production
process.on('uncaughtException', (err) => {
    logger.warn('Uncaught Exception (non-fatal)', { message: err.message, code: err.code });
    if (env.NODE_ENV === 'production') {
        process.exit(1);
    }
});

export default app;
