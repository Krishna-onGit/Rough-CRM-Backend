import { PrismaClient } from '@prisma/client';
import { createCustomer, getCustomer } from './src/modules/customers/customer.service.js';

const prisma = new PrismaClient();

async function runTest() {
    try {
        // Setup dummy org and user
        const org = await prisma.organization.create({
            data: {
                name: 'Test Org',
                slug: 'test-org-' + Date.now(),
                isActive: true,
            }
        });

        const user = await prisma.user.create({
            data: {
                organizationId: org.id,
                fullName: 'Admin User',
                email: 'admin@test.local',
                passwordHash: 'dummy',
                role: 'admin',
                isActive: true
            }
        });

        const nonAdminUser = { role: 'sales_executive' };

        console.log('--- Creating Customer ---');
        const customer1 = await createCustomer(org.id, user.id, {
            fullName: 'John Doe',
            mobilePrimary: '9876543210',
            panNumber: 'ABCDE1234F',
            aadhaarNumber: '123456789012'
        });
        console.log('Customer Created:', customer1);

        console.log('\n--- Checking DB Raw ---');
        const rawCustomers = await prisma.$queryRaw`SELECT customer_code, pan_number, pan_hash FROM customers LIMIT 3;`;
        console.log('DB SQL Result:', rawCustomers);

        console.log('\n--- GET Customer (Admin mode) ---');
        const adminView = await getCustomer(org.id, customer1.id, { role: 'admin' });
        console.log('Admin PAN:', adminView.panNumber);
        console.log('Admin Aadhaar:', adminView.aadhaarNumber);

        console.log('\n--- GET Customer (Non-Admin mode) ---');
        const salesView = await getCustomer(org.id, customer1.id, { role: 'sales_executive' });
        console.log('Masked PAN:', salesView.panNumber);
        console.log('Masked Aadhaar:', salesView.aadhaarNumber);

        console.log('\n--- Duplicate PAN Create ---');
        const duplicateRes = await createCustomer(org.id, user.id, {
            fullName: 'Dup John',
            mobilePrimary: '9999999999',
            panNumber: 'ABCDE1234F'
        });
        console.log('Duplicate Result:', duplicateRes);

    } catch (error) {
        console.error('Test Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

runTest();
