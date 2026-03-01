import { z } from 'zod';
import { validateBody } from '../auth/auth.schema.js';

export const createFollowUpSchema = z.object({
    leadId: z.string().uuid('Invalid lead ID'),
    assignedTo: z.string().uuid('Invalid sales person ID').optional(),
    taskType: z
        .enum(['call', 'whatsapp', 'email', 'meeting', 'site_visit'])
        .default('call'),
    priority: z.enum(['high', 'medium', 'low']).default('medium'),
    scheduledAt: z.string().datetime('Invalid datetime format'),
    remarks: z.string().max(500).optional(),
});

export const updateFollowUpSchema = z.object({
    taskType: z
        .enum(['call', 'whatsapp', 'email', 'meeting', 'site_visit'])
        .optional(),
    priority: z.enum(['high', 'medium', 'low']).optional(),
    status: z
        .enum(['pending', 'completed', 'missed', 'rescheduled'])
        .optional(),
    scheduledAt: z.string().datetime().optional(),
    completedAt: z.string().datetime().optional(),
    outcome: z.string().max(500).optional(),
    remarks: z.string().max(500).optional(),
});

export { validateBody };
