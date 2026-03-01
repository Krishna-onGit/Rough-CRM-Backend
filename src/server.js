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
import bookingRouter from './modules/salesEngine/booking.routes.js';
import {
    blockExpiryWorker,
    scheduleBlockExpiryJob,
} from './jobs/blockExpiry.job.js';

import {
    demandOverdueWorker,
    scheduleDemandOverdueJob,
} from './jobs/demandOverdue.job.js';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isDev } from './config/env.js';
import prisma from './config/database.js';
import { redis } from './config/redis.js';
import { apiRateLimiter } from './middleware/rateLimit.js';
import { AppError, formatErrorResponse } from './shared/errors.js';
import authRouter from './modules/auth/auth.routes.js';
import projectRouter from './modules/projects/project.routes.js';
import unitRouter from './modules/units/unit.routes.js';
const app = express();

// ── Security Middleware ─────────────────────────────────────────────────────
app.use(helmet());

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

// ── Rate Limiting ───────────────────────────────────────────────────────────
app.use('/v1', apiRateLimiter);

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

    // Check Redis
    try {
        await redis.ping();
        health.services.redis = 'ok';
    } catch {
        health.services.redis = 'error';
        health.status = 'degraded';
    }

    const statusCode = health.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(health);
});

// ── API Routes ───────────────────────────────────────────────────────────────
app.use('/v1/auth', authRouter);
app.use('/v1/projects', projectRouter);
app.use('/v1/units', unitRouter);
app.use('/v1/bookings', bookingRouter);
app.use('/v1/leads', leadRouter);
app.use('/v1/site-visits', siteVisitRouter);
app.use('/v1/follow-ups', followUpRouter);
app.use('/v1/payments', paymentRouter);
app.use('/v1/demand-letters', demandLetterRouter);
app.use('/v1/cancellations', cancellationRouter);
app.use('/v1/transfers', transferRouter);
app.use('/v1/possessions', possessionRouter);
app.use('/v1/customers', customerRouter);
app.use('/v1/documents', documentRouter);
app.use('/v1/complaints', complaintRouter);
app.use('/v1/communications', communicationRouter);
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

// ── Global Error Handler ────────────────────────────────────────────────────
// Must have 4 parameters for Express to treat it as error middleware
app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const isOperational = err.isOperational || false;

    // Log all 500s
    if (statusCode >= 500) {
        console.error('UNHANDLED ERROR:', err);
    }

    res.status(statusCode).json(formatErrorResponse(err, isDev));
});

// ── Server Startup ──────────────────────────────────────────────────────────
const PORT = parseInt(env.PORT, 10);

const server = app.listen(PORT, async () => {
    console.log('=========================================');
    console.log(`  ${env.APP_NAME} Backend`);
    console.log(`  Environment : ${env.NODE_ENV}`);
    console.log(`  Port        : ${PORT}`);
    console.log(`  API         : http://localhost:${PORT}/v1`);
    console.log(`  Health      : http://localhost:${PORT}/health`);
    console.log('=========================================');

    // ── Start Background Jobs ───────────────────────────────────────────────────
    try {
        await scheduleBlockExpiryJob();
        await scheduleDemandOverdueJob();
        console.log('Background jobs scheduled successfully.');
    } catch (err) {
        console.error('Failed to schedule background jobs:', err.message);
    }
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
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export default app;
