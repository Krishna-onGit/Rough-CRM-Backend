import { z } from 'zod';
import { validateBody } from '../auth/auth.schema.js';

export const createLeadSchema = z.object({
    fullName: z.string().min(2).max(100),
    mobile: z
        .string()
        .regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),
    email: z.string().email().optional(),
    source: z
        .enum(['whatsapp', 'website', 'referral', 'walk_in'])
        .default('walk_in'),
    interestedProject: z.string().uuid().optional(),
    interestedConfig: z
        .enum(['BHK_1', 'BHK_2', 'BHK_3', 'BHK_4', 'Penthouse'])
        .optional(),
    budgetMin: z.number().min(0).optional(),
    budgetMax: z.number().min(0).optional(),
    assignedTo: z.string().uuid().optional(),
    remarks: z.string().max(500).optional(),
});

export const updateLeadSchema = z.object({
    fullName: z.string().min(2).max(100).optional(),
    mobile: z
        .string()
        .regex(/^[6-9]\d{9}$/)
        .optional(),
    email: z.string().email().optional(),
    source: z
        .enum(['whatsapp', 'website', 'referral', 'walk_in'])
        .optional(),
    interestedProject: z.string().uuid().optional(),
    interestedConfig: z
        .enum(['BHK_1', 'BHK_2', 'BHK_3', 'BHK_4', 'Penthouse'])
        .optional(),
    budgetMin: z.number().min(0).optional(),
    budgetMax: z.number().min(0).optional(),
    assignedTo: z.string().uuid().optional(),
    score: z.number().int().min(0).max(100).optional(),
    remarks: z.string().max(500).optional(),
    lostReason: z.string().max(500).optional(),
});

export const updateLeadStatusSchema = z.object({
    status: z.enum([
        'new',
        'contacted',
        'site_visit_scheduled',
        'site_visit_done',
        'interested',
        'negotiation',
        'won',
        'lost',
        'junk',
    ]),
    remarks: z.string().max(500).optional(),
    lostReason: z.string().max(500).optional(),
    convertedBookingId: z.string().uuid().optional(),
});

export { validateBody };
