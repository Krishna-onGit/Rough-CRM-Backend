import { z } from 'zod';
import { validateBody } from '../auth/auth.schema.js';

export const createAgentSchema = z.object({
    firmName: z.string().min(1).max(100),
    contactPerson: z.string().min(2).max(100),
    mobile: z
        .string()
        .regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),
    email: z.string().email().optional(),
    reraNumber: z
        .string()
        .min(5)
        .max(50)
        .optional(),
    pan: z
        .string()
        .regex(
            /^[A-Z]{5}[0-9]{4}[A-Z]$/,
            'Invalid PAN format (e.g. ABCDE1234F)'
        )
        .optional(),
    gstNumber: z
        .string()
        .regex(
            /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
            'Invalid GST number format'
        )
        .optional(),
    commissionPct: z
        .number()
        .min(0)
        .max(10, 'Commission cannot exceed 10%')
        .default(2),
});

export const updateAgentSchema = z.object({
    firmName: z.string().max(100).optional(),
    contactPerson: z.string().min(2).max(100).optional(),
    mobile: z
        .string()
        .regex(/^[6-9]\d{9}$/)
        .optional(),
    email: z.string().email().optional(),
    pan: z
        .string()
        .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/)
        .optional(),
    gstNumber: z.string().optional(),
    commissionPct: z.number().min(0).max(10).optional(),
    isActive: z.boolean().optional(),
});

export const recordCommissionPaymentSchema = z.object({
    commissionId: z.string().uuid('Invalid commission ID'),
    amountPaid: z.number().positive('Amount must be positive'),
    paymentMode: z.enum([
        'cheque', 'neft', 'rtgs', 'upi', 'dd', 'cash'
    ]),
    transactionRef: z.string().max(100).optional(),
    remarks: z.string().max(500).optional(),
});

export { validateBody };
