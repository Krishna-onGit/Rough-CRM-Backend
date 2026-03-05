import { z } from 'zod';
import { validateBody } from '../auth/auth.schema.js';

export const reviewApprovalSchema = z.object({
    status: z.enum(['approved', 'rejected']),
    reviewRemarks: z.string().min(5).max(500),
});

export const createApprovalSchema = z.object({
    requestType: z.enum([
        'cancellation',
        'transfer',
        'discount',
        'refund',
        'possession',
        'other',
    ]),
    entityType: z.string().min(2).max(100),
    entityId: z.string().uuid({ message: 'Invalid entity ID' }),
    justification: z
        .string()
        .min(10, 'Justification must be at least 10 characters')
        .max(1000),
    requestData: z.record(z.string(), z.any()).optional(),
});

export { validateBody };
