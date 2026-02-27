import { z } from 'zod';

export const registerSchema = z.object({
    orgName: z.string().min(2, 'Organization name must be at least 2 characters').max(100),
    orgSlug: z
        .string()
        .min(2)
        .max(50)
        .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
    fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
    email: z.string().email('Invalid email address'),
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const loginSchema = z.object({
    organizationSlug: z.string().min(1, 'Organization slug is required'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});

export const refreshSchema = z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * validateBody — middleware factory that validates req.body against a Zod schema.
 * On failure returns 400 with field-level error details.
 */
export const validateBody = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Request validation failed.',
                details: result.error.flatten().fieldErrors,
            },
        });
    }
    req.body = result.data;
    next();
};
