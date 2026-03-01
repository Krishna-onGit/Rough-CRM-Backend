import { z } from 'zod';
import { validateBody } from '../auth/auth.schema.js';

export const createComplaintSchema = z.object({
    customerId: z.string().uuid('Invalid customer ID'),
    unitId: z.string().uuid('Invalid unit ID').optional(),
    bookingId: z.string().uuid('Invalid booking ID').optional(),
    category: z
        .enum(['payment', 'construction', 'documentation', 'general'])
        .default('general'),
    subject: z.string().min(5).max(200),
    description: z
        .string()
        .min(10, 'Description must be at least 10 characters')
        .max(2000),
    priority: z.enum(['high', 'medium', 'low']).default('medium'),
});

export const updateComplaintSchema = z.object({
    assignedTo: z.string().uuid().optional(),
    priority: z.enum(['high', 'medium', 'low']).optional(),
    remarks: z.string().max(500).optional(),
});

export const resolveComplaintSchema = z.object({
    resolution: z
        .string()
        .min(10, 'Resolution must be at least 10 characters')
        .max(2000),
    remarks: z.string().max(500).optional(),
});

export const escalateComplaintSchema = z.object({
    remarks: z
        .string()
        .min(5, 'Escalation reason required')
        .max(500),
});

export { validateBody };
