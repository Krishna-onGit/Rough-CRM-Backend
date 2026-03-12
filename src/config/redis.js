import { Redis } from '@upstash/redis';
import IORedis from 'ioredis';
import { env } from './env.js';

// ── Upstash Redis client (for caching: get, set, del) ──────────────────────
export const redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
});

// ── BullMQ connection (local Redis — avoids Upstash request limit) ──────────
// BullMQ fires many Redis commands per tick; keep it off Upstash.
export const bullMQConnection = new IORedis(
    env.BULL_REDIS_URL || 'redis://localhost:6379',
    { maxRetriesPerRequest: null }  // required by BullMQ
);

// ── Cache key helpers (centralized — never hardcode keys elsewhere) ─────────
export const CacheKeys = {
    orgSettings: (orgId) => `org:${orgId}:settings`,
    projectStats: (projectId) => `project:${projectId}:stats`,
    spActiveBlocks: (spId) => `sp:${spId}:active_blocks`,
    unitStatus: (unitId) => `unit:${unitId}:status`,
    analyticsDashboard: (orgId) => `analytics:dashboard:${orgId}`,
};

// ── Cache TTL constants (in seconds) ───────────────────────────────────────
export const CacheTTL = {
    orgSettings: 300,        // 5 minutes
    projectStats: 60,         // 1 minute
    spActiveBlocks: 30,       // 30 seconds
    unitStatus: 30,           // 30 seconds
    analyticsDashboard: 300,  // 5 minutes
};

export default redis;
