import { z } from 'zod';
import { validateBody } from '../auth/auth.schema.js';

export const logCommunicationSchema = z.object({
    customerId: z.string().uuid().optional(),
    leadId: z.string().uuid().optional(),
    channel: z
        .enum(['call', 'email', 'whatsapp', 'sms', 'in_person'])
        .default('call'),
    direction: z.enum(['inbound', 'outbound']).default('outbound'),
    subject: z.string().max(200).optional(),
    content: z.string().max(2000).optional(),
    durationSeconds: z.number().int().min(0).optional(),
}).refine(
    (data) => data.customerId || data.leadId,
    {
        message: 'Either customerId or leadId must be provided.',
        path: ['customerId'],
    }
);

export { validateBody };
