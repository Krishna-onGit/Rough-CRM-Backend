import { z } from 'zod';
import { validateBody } from '../auth/auth.schema.js';

export const createCustomerSchema = z.object({
    fullName: z.string().min(2).max(100),
    fatherSpouse: z.string().max(100).optional(),
    dateOfBirth: z.string().datetime().optional(),
    panNumber: z
        .string()
        .regex(
            /^[A-Z]{5}[0-9]{4}[A-Z]$/,
            'Invalid PAN format (e.g. ABCDE1234F)'
        )
        .optional(),
    aadhaarNumber: z
        .string()
        .regex(/^\d{12}$/, 'Aadhaar must be exactly 12 digits')
        .optional(),
    mobilePrimary: z
        .string()
        .regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),
    mobileAlternate: z
        .string()
        .regex(/^[6-9]\d{9}$/)
        .optional(),
    email: z.string().email().optional(),
    currentAddress: z.string().max(500).optional(),
    occupation: z.string().max(100).optional(),
    companyName: z.string().max(100).optional(),
    annualIncome: z.number().min(0).optional(),
    paymentMode: z
        .enum(['self', 'loan', 'nri'])
        .optional(),
    preferredBank: z.string().max(100).optional(),
    loanAmount: z.number().min(0).optional(),
    coApplicantName: z.string().max(100).optional(),
    coApplicantPan: z
        .string()
        .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/)
        .optional(),
    coApplicantRel: z.string().max(50).optional(),
});

export const updateCustomerSchema = createCustomerSchema
    .partial()
    .omit({ panNumber: true, aadhaarNumber: true });

export const verifyKycSchema = z.object({
    kycVerified: z.boolean(),
    remarks: z.string().max(500).optional(),
});

export { validateBody };
