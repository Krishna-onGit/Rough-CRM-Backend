import { z } from 'zod';
import { validateBody } from '../auth/auth.schema.js';

export const initiateTransferSchema = z.object({
    bookingId: z.string().uuid('Invalid booking ID'),
    unitId: z.string().uuid('Invalid unit ID'),
    toCustomerId: z.string().uuid('Invalid customer ID'),
    transferFee: z.number().min(0).default(0),
    remarks: z.string().max(500).optional(),
});

export const processTransferSchema = z.object({
    approvedBy: z.string().uuid('Invalid approver ID'),
    remarks: z.string().max(500).optional(),
});

export { validateBody };
