import { z } from 'zod';
import { validateBody } from '../auth/auth.schema.js';

export const uploadDocumentSchema = z.object({
    customerId: z.string().uuid('Invalid customer ID'),
    bookingId: z.string().uuid().optional(),
    category: z.enum([
        'pan_card', 'aadhaar', 'photo',
        'address_proof', 'income_proof', 'bank_statement',
        'agreement', 'registration', 'noc',
        'allotment_letter', 'possession_letter', 'other',
    ]),
    fileName: z.string().min(1).max(255),
    fileKey: z.string().min(1).max(500),
    fileSize: z.number().positive().max(10485760), // 10MB max
    mimeType: z.string().max(100).optional(),
    remarks: z.string().max(500).optional(),
});

export const verifyDocumentSchema = z.object({
    status: z.enum(['verified', 'rejected']),
    remarks: z.string().max(500).optional(),
});

export { validateBody };
