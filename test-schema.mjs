import { createCustomerSchema } from './src/modules/customers/customer.schema.js';
import fs from 'fs';
import { z } from 'zod';

console.log('--- TEST 2 & 7 ---');
let date17 = new Date();
date17.setFullYear(date17.getFullYear() - 17);
const res1 = createCustomerSchema.safeParse({
    fullName: 'Test User',
    mobilePrimary: '9876543210',
    dateOfBirth: date17.toISOString()
});
console.log('TEST 2 (17yo):', res1.success ? 'ACCEPTED' : 'REJECTED - ' + res1.error.issues[0].message);

let date18 = new Date();
date18.setFullYear(date18.getFullYear() - 18);
const res2 = createCustomerSchema.safeParse({
    fullName: 'Test User 2',
    mobilePrimary: '9876543210',
    dateOfBirth: date18.toISOString()
});
console.log('TEST 7 (exact 18yo):', res2.success ? 'ACCEPTED' : 'REJECTED - ' + res2.error.issues[0].message);

const orgFile = fs.readFileSync('./src/middleware/organization.js', 'utf8');
console.log('TEST 4: Has $executeRawUnsafe?', orgFile.includes('$executeRawUnsafe'));
