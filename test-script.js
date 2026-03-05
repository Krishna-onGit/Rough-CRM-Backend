import prisma from './src/config/database.js';
import { getUploadUrl, confirmUpload, getDownloadUrl } from './src/modules/documents/document.service.js';
import { notificationQueue } from './src/jobs/notificationDispatch.js';
import axios from 'axios';
import { logger } from './src/config/logger.js';

const runTests = async () => {
    try {
        const org = await prisma.organization.findFirst();
        if (!org) {
            console.log('No organization found! Create one first.');
            return;
        }
        const user = await prisma.user.findFirst({ where: { organizationId: org.id } });
        let customer = await prisma.customer.findFirst({ where: { organizationId: org.id } });

        if (!customer) {
            console.log('No customer found. Creating a dummy customer...');
            customer = await prisma.customer.create({
                data: {
                    organizationId: org.id,
                    customerCode: 'TEST-CUST-01',
                    fullName: 'Test Customer',
                    mobilePrimary: '918888888888',
                }
            });
        }

        console.log('== TEST 1: S3 Upload Flow ==');
        const uploadRes = await getUploadUrl(
            org.id,
            { customerId: customer.id, category: 'pan_card', fileName: 'testpan.txt', contentType: 'text/plain' },
            user.id
        );
        console.log('[Upload URL generated]', uploadRes.data.uploadUrl);
        const documentId = uploadRes.data.documentId;

        // Put file
        try {
            console.log('Uploading file to S3...');
            await axios.put(uploadRes.data.uploadUrl, 'hello world dummy content', {
                headers: { 'Content-Type': 'text/plain' }
            });
            console.log('File uploaded to S3.');
        } catch (err) {
            console.error('Failed to upload via axios', err.message);
        }

        // Confirm upload
        const confirmRes = await confirmUpload(org.id, documentId, user.id);
        console.log('[Confirm Upload]', confirmRes.message);

        // Get download
        const downloadRes = await getDownloadUrl(org.id, documentId, user.id);
        console.log('[Download URL]', downloadRes.data.downloadUrl);

        console.log('\n== TEST 2: Download expired document ==');
        // create a pending document directly
        const pendingDoc = await getUploadUrl(org.id, { customerId: customer.id, category: 'aadhaar', fileName: 'aadhaar.txt', contentType: 'text/plain' }, user.id);
        try {
            await getDownloadUrl(org.id, pendingDoc.data.documentId, user.id);
        } catch (err) {
            console.log('Caught expected error (pending doc):', err.message);
        }

        console.log('\n== TEST 3: Notification Worker (dev mode) ==');
        console.log('Dispatching a PAYMENT_BOUNCED notification...');
        await notificationQueue.add('PAYMENT_BOUNCED', {
            customerName: 'Test Customer',
            amount: '50000',
            bounceReason: 'Insufficient Funds',
            complaintCode: 'COMP-123',
            customerMobile: '918888888888',
            customerEmail: 'test@example.com'
        });

        console.log('Job dispatched to queue. Check the server logs (run `npm run dev` separately or the worker logs here).');

    } catch (err) {
        console.error('Test error:', err);
    } finally {
        // await prisma.$disconnect();
        setTimeout(() => process.exit(0), 3000); // give bullmq time to process
    }
};

runTests();
