import { z } from 'zod';
import { validateBody } from '../auth/auth.schema.js';

export const initiateCancellationSchema = z.object({
    bookingId: z.string().uuid('Invalid booking ID'),
    reason: z.string().min(10, 'Reason must be at least 10 characters').max(1000),
    requestedBy: z.string().uuid('Invalid requestor ID').optional(),
});

export const processCancellationSchema = z.object({
    forfeiturePct: z
        .number()
        .min(0)
        .max(100, 'Forfeiture cannot exceed 100%'),
    adminFee: z.number().min(0).default(5000),
    brokerageRecovery: z.number().min(0).default(0),
    approvedBy: z.string().uuid('Invalid approver ID'),
    remarks: z.string().max(500).optional(),
});

export { validateBody };
