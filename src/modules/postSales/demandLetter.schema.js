import { z } from 'zod';
import { validateBody } from '../auth/auth.schema.js';

export const createDemandLetterSchema = z.object({
    bookingId: z.string().uuid('Invalid booking ID'),
    customerId: z.string().uuid('Invalid customer ID'),
    unitId: z.string().uuid('Invalid unit ID'),
    milestoneName: z.string().min(2).max(100),
    milestonePct: z.number().min(0).max(100),
    demandAmount: z.number().positive('Demand amount must be positive'),
    dueDate: z.string().datetime('Invalid date format'),
});

export const sendReminderSchema = z.object({
    reminderNote: z.string().max(500).optional(),
});

export { validateBody };
