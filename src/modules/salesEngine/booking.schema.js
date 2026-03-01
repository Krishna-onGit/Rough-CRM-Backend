import { z } from 'zod';
import { validateBody } from '../auth/auth.schema.js';

export const createBookingSchema = z.object({
    unitId: z.string().uuid('Invalid unit ID'),
    customerId: z.string().uuid('Invalid customer ID'),
    salesPersonId: z.string().uuid('Invalid sales person ID'),
    agentId: z.string().uuid('Invalid agent ID').optional(),
    tokenAmount: z.number().min(0).default(0),
    discountAmount: z.number().min(0).default(0),
    paymentMode: z.enum([
        'cheque', 'neft', 'rtgs', 'upi', 'dd', 'cash'
    ]).default('cheque'),
    remarks: z.string().max(500).optional(),
});

export { validateBody };
