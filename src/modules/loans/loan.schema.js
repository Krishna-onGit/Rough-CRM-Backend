import { z } from 'zod';
import { validateBody } from '../auth/auth.schema.js';

export const createLoanSchema = z.object({
    bookingId: z.string().uuid('Invalid booking ID'),
    customerId: z.string().uuid('Invalid customer ID'),
    unitId: z.string().uuid('Invalid unit ID'),
    bankName: z.string().min(2).max(100),
    branchName: z.string().max(100).optional(),
    loanAccountNumber: z.string().max(50).optional(),
    sanctionedAmount: z
        .number()
        .positive('Sanctioned amount must be positive'),
    interestRate: z
        .number()
        .min(0)
        .max(30, 'Interest rate cannot exceed 30%'),
    tenureMonths: z
        .number()
        .int()
        .min(12)
        .max(360, 'Tenure cannot exceed 360 months (30 years)'),
    emiAmount: z.number().positive().optional(),
    loanOfficer: z.string().max(100).optional(),
    loanOfficerMobile: z
        .string()
        .regex(/^[6-9]\d{9}$/)
        .optional(),
    remarks: z.string().max(500).optional(),
});

export const updateLoanSchema = z.object({
    bankName: z.string().min(2).max(100).optional(),
    branchName: z.string().max(100).optional(),
    loanAccountNumber: z.string().max(50).optional(),
    loanOfficer: z.string().max(100).optional(),
    loanOfficerMobile: z
        .string()
        .regex(/^[6-9]\d{9}$/)
        .optional(),
    remarks: z.string().max(500).optional(),
});

export const recordDisbursementSchema = z.object({
    amount: z.number().positive('Disbursement amount must be positive'),
    disbursementDate: z
        .string()
        .datetime('Invalid disbursement date'),
    transactionRef: z.string().max(100).optional(),
    remarks: z.string().max(500).optional(),
});

export const updateLoanStatusSchema = z.object({
    status: z.enum([
        'applied',
        'sanctioned',
        'disbursing',
        'fully_disbursed',
        'rejected',
    ]),
    remarks: z.string().max(500).optional(),
});

export { validateBody };
