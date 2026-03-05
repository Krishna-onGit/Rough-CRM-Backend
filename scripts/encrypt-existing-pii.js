/**
 * encrypt-existing-pii.js
 * One-time migration script to encrypt all existing plaintext
 * PAN and Aadhaar values in the customers table.
 *
 * Run ONCE after the schema migration:
 *   node scripts/encrypt-existing-pii.js
 *
 * Safe to run multiple times — skips already-encrypted records.
 */

import { PrismaClient } from '@prisma/client';
import { encrypt, isEncrypted } from '../src/shared/encryption.js';
import { hashPan } from '../src/shared/cryptoHash.js';
import { config } from 'dotenv';

config(); // load .env

const prisma = new PrismaClient();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const run = async () => {
    console.log('[PII Migration] Starting encryption of existing PAN/Aadhaar...');

    let processed = 0;
    let encrypted = 0;
    let skipped = 0;
    let errors = 0;

    // Process in batches of 100 to avoid memory issues
    const BATCH_SIZE = 100;
    let cursor = null;

    while (true) {
        const customers = await prisma.customer.findMany({
            take: BATCH_SIZE,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: { id: 'asc' },
            select: {
                id: true,
                customerCode: true,
                panNumber: true,
                aadhaarNumber: true,
            },
        });

        if (customers.length === 0) break;

        cursor = customers[customers.length - 1].id;

        for (const customer of customers) {
            processed++;

            try {
                const updates = {};

                // Encrypt PAN if plaintext
                if (customer.panNumber && !isEncrypted(customer.panNumber)) {
                    updates.panNumber = encrypt(customer.panNumber);
                    updates.panHash = hashPan(customer.panNumber);
                } else if (customer.panNumber && isEncrypted(customer.panNumber)) {
                    // Already encrypted — ensure panHash exists
                    // NOTE: We cannot recover original PAN to re-hash.
                    // If panHash is missing, we must leave it null.
                    // Only way to populate is if the user re-enters PAN.
                    skipped++;
                    continue;
                }

                // Encrypt Aadhaar if plaintext
                if (
                    customer.aadhaarNumber &&
                    !isEncrypted(customer.aadhaarNumber)
                ) {
                    updates.aadhaarNumber = encrypt(customer.aadhaarNumber);
                }

                if (Object.keys(updates).length > 0) {
                    await prisma.customer.update({
                        where: { id: customer.id },
                        data: updates,
                    });
                    encrypted++;
                    console.log(
                        `[PII Migration] ✅ ${customer.customerCode} — encrypted`
                    );
                } else {
                    skipped++;
                }
            } catch (err) {
                errors++;
                console.error(
                    `[PII Migration] ❌ ${customer.customerCode} — ${err.message}`
                );
            }

            // Rate limit: 10ms between records to avoid DB saturation
            await sleep(10);
        }
    }

    console.log('\n[PII Migration] Complete:');
    console.log(`  Total processed : ${processed}`);
    console.log(`  Encrypted       : ${encrypted}`);
    console.log(`  Skipped         : ${skipped}`);
    console.log(`  Errors          : ${errors}`);

    await prisma.$disconnect();
};

run().catch(async (err) => {
    console.error('[PII Migration] Fatal error:', err);
    await prisma.$disconnect();
    process.exit(1);
});
