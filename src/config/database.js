import { PrismaClient } from '@prisma/client';
import { isDev } from './env.js';
import { logger } from './logger.js';

const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma ?? new PrismaClient({
    log: [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
    ],
});

if (isDev) {
    globalForPrisma.prisma = prisma;
}

// Log Prisma warnings and errors through our logger
prisma.$on('warn', (e) => {
    logger.warn('[Prisma] Warning', { message: e.message });
});

prisma.$on('error', (e) => {
    logger.error('[Prisma] Error', { message: e.message });
});

// Graceful disconnect on process exit
// Prevents connection pool exhaustion on restart
process.on('beforeExit', async () => {
    await prisma.$disconnect();
    logger.info('[Prisma] Disconnected gracefully');
});

export default prisma;
