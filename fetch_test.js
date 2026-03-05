import { PrismaClient } from '@prisma/client';
import { getCustomer } from './src/modules/customers/customer.service.js';

const prisma = new PrismaClient();
async function run() {
    const c = await prisma.$queryRaw`SELECT customer_code, pan_number, pan_hash FROM customers LIMIT 3;`;
    console.log('--- DB Raw ---');
    console.dir(c, { depth: null });

    if (c.length > 0) {
        const cust = await prisma.customer.findFirst({ where: { customerCode: c[0].customer_code } });
        console.log('\n--- Admin View ---');
        console.dir(await getCustomer(cust.organizationId, cust.id, { role: 'admin' }), { depth: null });

        console.log('\n--- Sales View ---');
        console.dir(await getCustomer(cust.organizationId, cust.id, { role: 'sales_executive' }), { depth: null });
    }
}
run().catch(console.error).finally(() => prisma.$disconnect());
