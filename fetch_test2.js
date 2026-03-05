import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { getCustomer } from './src/modules/customers/customer.service.js';

const prisma = new PrismaClient();
async function run() {
    const c = await prisma.$queryRaw`SELECT customer_code, pan_number, pan_hash FROM customers LIMIT 3;`;

    if (c.length > 0) {
        const cust = await prisma.customer.findFirst({ where: { customerCode: c[0].customer_code } });
        const admin = await getCustomer(cust.organizationId, cust.id, { role: 'admin' });
        const sales = await getCustomer(cust.organizationId, cust.id, { role: 'sales_executive' });

        fs.writeFileSync('report.json', JSON.stringify({ raw: c, admin, sales }, null, 2));
    }
}
run().finally(() => prisma.$disconnect());
