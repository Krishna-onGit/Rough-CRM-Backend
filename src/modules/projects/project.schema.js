import { z } from 'zod';
import { validateBody } from '../auth/auth.schema.js';

const towerSchema = z.object({
    name: z.string().min(1).max(50),
    floors: z.number().int().min(1).max(100),
    unitsPerFloor: z.number().int().min(1).max(50),
});

export const createProjectSchema = z.object({
    projectCode: z
        .string()
        .min(3)
        .max(20)
        .regex(/^[A-Z0-9-]+$/, 'Project code must be uppercase letters, numbers, hyphens only'),
    name: z.string().min(2).max(100),
    city: z.string().min(2).max(50),
    location: z.string().max(200).optional(),
    projectType: z.enum(['Residential', 'Commercial', 'Mixed']).default('Residential'),
    baseRate: z.number().positive('Base rate must be positive'),
    reraNumber: z.string().max(50).optional(),
    settings: z
        .object({
            floorRise: z
                .object({
                    startFloor: z.number().int().min(0),
                    risePerFloor: z.number().min(0),
                })
                .optional(),
            plc: z.record(z.string(), z.number()).optional(),
            stampDutyRate: z.number().min(0).max(20).optional(),
        })
        .default({}),
    towers: z
        .array(towerSchema)
        .min(1, 'At least one tower is required')
        .max(20),
});

export const updateProjectSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    city: z.string().min(2).max(50).optional(),
    location: z.string().max(200).optional(),
    baseRate: z.number().positive().optional(),
    reraNumber: z.string().max(50).optional(),
    completionPct: z.number().min(0).max(100).optional(),
    settings: z.record(z.string(), z.any()).optional(),
});

export const updateProjectStatusSchema = z.object({
    status: z.enum(['active', 'pre_launch', 'completed']),
});

export const addTowerSchema = z.object({
    towers: z.array(towerSchema).min(1).max(10),
});

export {
    validateBody,
};
