import { z } from 'zod';
import { validateBody } from '../auth/auth.schema.js';

export const createSalesPersonSchema = z.object({
    userId: z.string().uuid().optional(),
    spCode: z
        .string()
        .min(2)
        .max(20)
        .regex(
            /^[A-Z0-9-]+$/,
            'SP code must be uppercase letters, numbers, hyphens only'
        ),
    fullName: z.string().min(2).max(100),
    mobile: z
        .string()
        .regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),
    email: z.string().email().optional(),
    team: z.string().max(50).optional(),
    designation: z
        .enum(['VP_Sales', 'Manager', 'Executive', 'Trainee'])
        .default('Executive'),
    reportingTo: z.string().uuid().optional(),
    monthlyTarget: z.number().min(0).default(0),
});

export const updateSalesPersonSchema = z.object({
    fullName: z.string().min(2).max(100).optional(),
    mobile: z
        .string()
        .regex(/^[6-9]\d{9}$/)
        .optional(),
    email: z.string().email().optional(),
    team: z.string().max(50).optional(),
    designation: z
        .enum(['VP_Sales', 'Manager', 'Executive', 'Trainee'])
        .optional(),
    reportingTo: z.string().uuid().optional(),
    monthlyTarget: z.number().min(0).optional(),
    isActive: z.boolean().optional(),
});

export { validateBody };
