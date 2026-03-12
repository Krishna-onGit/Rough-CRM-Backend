# Communications Module — API Reference

> **Verified:** Traced from source files on 2026-03-11. Response shapes reflect actual runtime output.

> **Base Path:** `/v1/communications`
> **Auth Required:** Yes (`Authorization: Bearer <token>` + `x-organization-id`)
> **Service:** `src/modules/communications/communication.service.js`

---

## Overview

Logs all communication interactions with customers and leads (calls, emails, WhatsApp, meetings). Provides history timeline and summary analytics. `durationSeconds` is only valid for `call` channel — the API rejects it on other channels.

---

## Endpoints

### 1. List Communications

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/communications` |
| **Permission** | `communications:read` |

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `customerId` | UUID | Filter by customer |
| `leadId` | UUID | Filter by lead |
| `channel` | string | `call`, `email`, `whatsapp`, `meeting` |
| `direction` | string | `inbound`, `outbound` |
| `from` | ISO datetime | Filter by date (from) |
| `to` | ISO datetime | Filter by date (to) |
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Items per page (default: 20) |

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "customerId": "uuid | null",
      "leadId": "uuid | null",
      "channel": "call | email | whatsapp | meeting",
      "direction": "inbound | outbound",
      "subject": "string | null",
      "content": "string | null",
      "initiatedBy": "uuid",
      "durationSeconds": "number | null (only populated for call channel)",
      "createdAt": "ISO datetime"
    }
  ],
  "meta": {
    "page": "number",
    "pageSize": "number",
    "total": "number",
    "totalPages": "number",
    "hasNextPage": "boolean",
    "hasPrevPage": "boolean"
  }
}
```

---

### 2. Log Communication

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/communications` |
| **Permission** | `communications:create` |

**Request Body**

```json
{
  "customerId": "uuid (optional — provide at least one of customerId or leadId)",
  "leadId": "uuid (optional)",
  "channel": "call | email | whatsapp | meeting (optional, default: call)",
  "direction": "inbound | outbound (optional, default: outbound)",
  "subject": "string (optional)",
  "content": "string (optional — call notes, email body, message text)",
  "durationSeconds": "number (optional — ONLY valid when channel = 'call')"
}
```

**Business Rules:**
- `durationSeconds` is rejected if `channel` is not `call`

**Response `201`**

```json
{
  "success": true,
  "message": "call communication logged successfully.",
  "data": {
    "id": "uuid",
    "channel": "string",
    "direction": "string",
    "createdAt": "ISO datetime"
  }
}
```

---

### 3. Get Communication Summary

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/communications/summary` |
| **Permission** | `communications:read` |

> Returns aggregated counts by channel and direction. **Not paginated.**

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `customerId` | UUID | Scope summary to a customer |
| `leadId` | UUID | Scope summary to a lead |

**Response `200`**

```json
{
  "success": true,
  "data": {
    "byChannel": {
      "call": "number",
      "email": "number",
      "whatsapp": "number",
      "meeting": "number"
    },
    "byDirection": {
      "inbound": "number",
      "outbound": "number"
    },
    "totalCallDuration": {
      "seconds": "number",
      "minutes": "number"
    }
  }
}
```

> This endpoint does NOT use `buildPaginatedResponse` — no `meta` key. Only channels/directions with entries appear in the response.

---

## Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | `durationSeconds` sent on non-call channel |
| `NOT_FOUND` | 404 | Customer or lead not found |
| `BUSINESS_RULE_ERROR` | 422 | Business rule violation |
| `FORBIDDEN` | 403 | Insufficient permission |

---

## Notes for Frontend Developers

- `durationSeconds` is only meaningful for `call` channel — the API rejects it otherwise.
- `GET /v1/communications/summary` is not paginated — use `customerId` or `leadId` to scope it.
- Zero-count channels may be absent from `byChannel` (result of SQL `GROUP BY` — no rows = no key).
- Use this module to build a communication timeline for customer/lead detail views.
- `initiatedBy` is the UUID of the staff user who logged the communication.
