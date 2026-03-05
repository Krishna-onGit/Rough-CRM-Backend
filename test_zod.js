import { z } from 'zod';

const towerSchema = z.object({
    name: z.string().min(1).max(50),
    floors: z.number().int().min(1).max(100),
    unitsPerFloor: z.number().int().min(1).max(50),
});

const createProjectSchema = z.object({
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

const validateBody = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        return {
            status: 400,
            json: {
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Request validation failed.',
                    details: result.error.flatten().fieldErrors,
                },
            }
        };
    }
    req.body = result.data;
    return "next";
};

try {
    const req = { body: { "projectCode": "TEST-001", "name": "Test Project", "city": "Mumbai", "projectType": "residential" } };
    const res = validateBody(createProjectSchema)(req, null, null);
    console.log(JSON.stringify(res, null, 2));
} catch (e) {
    console.error("CRASH", e);
}
