import { z } from 'zod';
import { validateBody } from '../auth/auth.schema.js';

export const createSiteVisitSchema = z.object({
    leadId: z.string().uuid('Invalid lead ID'),
    projectId: z.string().uuid('Invalid project ID'),
    salesPersonId: z.string().uuid('Invalid sales person ID').optional(),
    visitDate: z.string().datetime('Invalid date format'),
    visitType: z
        .enum(['first_visit', 'revisit', 'family_visit', 'loan_agent_visit'])
        .default('first_visit'),
    visitorCount: z.number().int().min(1).max(20).default(1),
    remarks: z.string().max(500).optional(),
});

export const updateSiteVisitSchema = z.object({
    visitDate: z.string().datetime().optional(),
    visitType: z
        .enum(['first_visit', 'revisit', 'family_visit', 'loan_agent_visit'])
        .optional(),
    visitorCount: z.number().int().min(1).max(20).optional(),
    checkInAt: z.string().datetime().optional(),
    checkOutAt: z.string().datetime().optional(),
    feedback: z
        .enum([
            'interested',
            'thinking',
            'not_interested',
            'price_concern',
            'location_concern',
        ])
        .optional(),
    remarks: z.string().max(500).optional(),
});

export { validateBody };
