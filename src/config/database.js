import { PrismaClient } from '@prisma/client';
import { isDev } from './env.js';

const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma ?? new PrismaClient({
    log: isDev ? ['query', 'warn', 'error'] : ['warn', 'error'],
});

if (isDev) {
    globalForPrisma.prisma = prisma;
}

process.on('beforeExit', async () => {
    await prisma.$disconnect();
});

export default prisma;
