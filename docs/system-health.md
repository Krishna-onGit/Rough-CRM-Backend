# System Health — API Reference

> **Verified:** Traced from source files on 2026-03-11. Response shapes reflect actual runtime output.

> **Base Path:** `/health` and `/v1`
> **Auth Required:** No
> **Implemented in:** `src/server.js`

---

## Overview

System-level endpoints for health monitoring and API information. Not part of any module — defined directly in the Express entry point. Used by monitoring tools, load balancers, and health check dashboards.

---

## Endpoints

### 1. Health Check

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/health` |
| **Auth Required** | No |
| **Rate Limited** | No |

**Response `200` (healthy)**

```json
{
  "status": "ok",
  "timestamp": "ISO datetime",
  "environment": "development | production | test",
  "version": "string (API_VERSION env var)",
  "services": {
    "database": "ok",
    "redis": "ok | degraded"
  }
}
```

**Response `503` (database down)**

```json
{
  "status": "degraded",
  "timestamp": "ISO datetime",
  "environment": "string",
  "version": "string",
  "services": {
    "database": "error",
    "redis": "ok | degraded"
  }
}
```

> Redis `degraded` does **NOT** cause a `503`. Only a database failure triggers a non-200 response.

---

### 2. API Info

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1` |
| **Auth Required** | No |
| **Rate Limited** | No |

**Response `200`**

```json
{
  "success": true,
  "message": "LeadFlow AI API",
  "version": "string",
  "environment": "string"
}
```

---

## Background Jobs

The following jobs start automatically after server startup. Not accessible via API but affect system behavior:

| Job File | Description |
|---|---|
| `blockExpiry.job.js` | Releases expired unit blocks (BullMQ delayed jobs) |
| `demandOverdue.job.js` | Marks demand letters as overdue past their `dueDate` |
| `slaBreachCheck.job.js` | Monitors SLA breaches for complaints |
| `approvalEscalation.job.js` | Auto-escalates long-pending approval requests |
| `notificationWorker.js` | Processes notification queue (SMS/Email/WhatsApp) |

---

## Server Configuration

| Setting | Value |
|---|---|
| **Port** | `5000` (configurable via `PORT` env) |
| **Payload Limit** | `10MB` |
| **CORS** | Configurable via `CORS_ORIGIN` env |
| **Allowed Methods** | `GET`, `POST`, `PATCH`, `DELETE`, `OPTIONS` |
| **Required Headers** | `Content-Type`, `Authorization`, `x-organization-id` |
| **Cache-Control** | `no-store` on all `/v1` responses |

---

## Rate Limiters

| Limiter | Applies To | Dev Limits |
|---|---|---|
| `authRateLimiter` | `/v1/auth` routes | 100 req/window |
| `apiRateLimiter` | All routes (global) | 500 req/window |
| `orgRateLimiter` | All protected routes | 1000 req/window |
| `analyticsRateLimiter` | `/v1/analytics` routes | Separate config |

---

## Error Response Format

All errors follow a consistent envelope:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": "object | array | null (validation field errors)"
  },
  "requestId": "uuid (X-Request-ID header)"
}
```

---

## Request Tracing

Every request gets a unique `requestId` via `attachRequestId` middleware:
- Available in the `X-Request-ID` response header
- Included in all error responses as `requestId`
- Written to server logs for debugging

---

## Notes for Frontend Developers

- Poll `GET /health` for a connection status indicator. Show a maintenance banner only when `status: 'degraded'` (database down).
- Redis `degraded` in the health response is a warning, not an outage — no user-facing action required.
- All protected endpoints require both `Authorization: Bearer <token>` and `x-organization-id` headers.
- Set `Content-Type: application/json` on all POST/PATCH requests.
- The `X-Request-ID` header on error responses is useful for server-side log correlation when reporting bugs.
