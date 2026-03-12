import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({

    // Server
    NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
    PORT: z.string().default('5000'),

    // Database (Supabase PostgreSQL)
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    // Redis (Upstash — caching only)
    UPSTASH_REDIS_REST_URL: z.string().min(1, 'UPSTASH_REDIS_REST_URL is required'),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1, 'UPSTASH_REDIS_REST_TOKEN is required'),

    // Redis (local — BullMQ queues)
    BULL_REDIS_URL: z.string().default('redis://localhost:6379'),

    // JWT
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES_IN: z.string().default('7d'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

    // PII Encryption
    PII_ENCRYPTION_KEY: z.string().length(64, 'PII_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)'),

    // AWS S3
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_REGION: z.string().default('ap-south-1'),
    AWS_S3_BUCKET: z.string().optional(),

    // SendGrid
    SENDGRID_API_KEY: z.string().optional(),
    SENDGRID_FROM_EMAIL: z.string().optional(),
    SENDGRID_FROM_NAME: z.string().optional(),

    // MSG91
    MSG91_AUTH_KEY: z.string().optional(),
    MSG91_SENDER_ID: z.string().default('LEADFW'),
    MSG91_ROUTE: z.string().default('4'),

    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
    RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),

    // CORS
    CORS_ORIGIN: z.string().default('http://localhost:3000'),

    // App
    APP_NAME: z.string().default('LeadFlow AI'),
    API_VERSION: z.string().default('v1'),
    LOG_LEVEL: z.string().default('info'),

}).superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
        const requiredInProd = [
            'AWS_ACCESS_KEY_ID',
            'AWS_SECRET_ACCESS_KEY',
            'AWS_S3_BUCKET',
            'SENDGRID_API_KEY',
            'SENDGRID_FROM_EMAIL',
        ];

        requiredInProd.forEach((key) => {
            if (!data[key]) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `${key} is required in production`,
                    path: [key],
                });
            }
        });
    }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('=========================================');
    console.error('  FATAL: Invalid environment variables  ');
    console.error('=========================================');
    console.error(parsed.error.flatten().fieldErrors);
    console.error('');
    console.error('Fix the above variables in your .env file and restart.');
    process.exit(1);
}

export const env = parsed.data;

// Convenience helpers used throughout the app
export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';
export const isStaging = env.NODE_ENV === 'staging';
