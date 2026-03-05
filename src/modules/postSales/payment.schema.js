import { z } from 'zod';
import { validateBody } from '../auth/auth.schema.js';

export const recordPaymentSchema = z.object({
    bookingId: z.string().uuid('Invalid booking ID'),
    customerId: z.string().uuid('Invalid customer ID'),
    unitId: z.string().uuid('Invalid unit ID'),
    demandLetterId: z.string().uuid().optional(),
    amount: z.number().positive('Amount must be positive'),
    paymentMode: z.enum([
        'cheque', 'neft', 'rtgs', 'upi', 'dd', 'cash'
    ]),
    transactionRef: z.string().max(100).optional(),
    paymentDate: z.string().datetime('Invalid date format'),
    remarks: z.string().max(500).optional(),
    idempotencyKey: z.string().uuid().optional(),
});

export const updatePaymentStatusSchema = z.object({
    status: z.enum([
        'cleared',
        'bounced',
        'under_process',
        'refund_pending',
        'refunded',
    ]),
    bounceReason: z.string().max(500).optional(),
    bounceDate: z.string().datetime().optional(),
    remarks: z.string().max(500).optional(),
});

export { validateBody };
