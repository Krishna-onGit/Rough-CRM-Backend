import { z } from 'zod';
import { validateBody } from '../auth/auth.schema.js';

export const updatePossessionSchema = z.object({
    possessionDate: z.string().datetime().optional(),
    handoverBy: z.string().uuid().optional(),
    remarks: z.string().max(500).optional(),
    checklist: z
        .object({
            possession_letter: z.boolean().optional(),
            keys_handed: z.boolean().optional(),
            meter_readings: z.boolean().optional(),
            welcome_kit: z.boolean().optional(),
            noc_obtained: z.boolean().optional(),
        })
        .optional(),
});

export const completePossessionSchema = z.object({
    possessionDate: z.string().datetime(
        'Invalid possession date format'
    ),
    handoverBy: z.string().uuid('Invalid handover person ID'),
    remarks: z.string().max(500).optional(),
});

export const createSnagSchema = z.object({
    possessionId: z.string().uuid('Invalid possession ID'),
    unitId: z.string().uuid('Invalid unit ID'),
    description: z
        .string()
        .min(5, 'Description must be at least 5 characters')
        .max(500),
    category: z
        .enum(['plumbing', 'electrical', 'civil', 'painting'])
        .default('civil'),
    priority: z.enum(['high', 'medium', 'low']).default('medium'),
    reportedDate: z.string().datetime('Invalid date format'),
});

export const updateSnagSchema = z.object({
    status: z
        .enum(['open', 'in_progress', 'resolved'])
        .optional(),
    priority: z.enum(['high', 'medium', 'low']).optional(),
    resolvedDate: z.string().datetime().optional(),
    resolvedBy: z.string().uuid().optional(),
    remarks: z.string().max(500).optional(),
});

export { validateBody };
