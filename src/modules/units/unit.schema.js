import { z } from 'zod';
import { validateBody } from '../auth/auth.schema.js';

export const blockUnitSchema = z.object({
    salesPersonId: z.string().uuid('Invalid sales person ID'),
    agentId: z.string().uuid('Invalid agent ID').optional(),
    remarks: z.string().max(500).optional(),
});

export const tokenSchema = z.object({
    tokenAmount: z.number().positive('Token amount must be positive'),
    paymentMode: z.enum(['cheque', 'neft', 'rtgs', 'upi', 'dd', 'cash']),
    transactionRef: z.string().max(100).optional(),
    remarks: z.string().max(500).optional(),
});

export { validateBody };
