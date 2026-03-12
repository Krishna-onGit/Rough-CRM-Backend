# Follow-Up Tasks Module — API Reference

> **Verified:** Traced from source files on 2026-03-10. Response shapes reflect actual runtime output.

> **Base Path:** `/v1/follow-ups`
> **Auth Required:** Yes (`Authorization: Bearer <token>` + `x-organization-id`)
> **Service:** `src/modules/preSales/followUp.service.js`

---

## Overview

Manages scheduled follow-up tasks for leads. Tasks support call, email, WhatsApp, and meeting types. Sales executives see only their own tasks. Completing a task requires an outcome. Rescheduling requires a new scheduled date.

---

## Endpoints

### 1. List Follow-Up Tasks

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/follow-ups` |
| **Permission** | `followUps:read` |

> Sales executives (`sales_executive` role) automatically see only their own tasks.

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `leadId` | UUID | Filter by lead |
| `assignedTo` | UUID | Filter by assigned user |
| `taskType` | string | `call`, `email`, `whatsapp`, `meeting` |
| `priority` | string | `high`, `medium`, `low` |
| `status` | string | `pending`, `completed`, `missed`, `rescheduled` |
| `from` | ISO datetime | Filter by scheduled date (from) |
| `to` | ISO datetime | Filter by scheduled date (to) |
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Items per page (default: 20) |

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "leadId": "uuid",
      "assignedTo": "uuid | null",
      "taskType": "call | email | whatsapp | meeting",
      "priority": "high | medium | low",
      "status": "pending | completed | missed | rescheduled",
      "scheduledAt": "ISO datetime",
      "completedAt": "ISO datetime | null",
      "outcome": "string | null",
      "remarks": "string | null",
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

### 2. Create Follow-Up Task

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/follow-ups` |
| **Permission** | `followUps:create` |

**Request Body**

```json
{
  "leadId": "uuid (required)",
  "assignedTo": "uuid (optional — salesPerson ID)",
  "taskType": "call | email | whatsapp | meeting (optional, default: call)",
  "priority": "high | medium | low (optional, default: medium)",
  "scheduledAt": "ISO datetime (required — must be in the future)",
  "remarks": "string (optional)"
}
```

**Business Rules:**
- Lead must be active and not `won` or `junk` status
- `scheduledAt` must be in the future

**Response `201`**

```json
{
  "success": true,
  "message": "Follow-up task created successfully.",
  "data": {
    "id": "uuid",
    "leadId": "uuid",
    "taskType": "string",
    "priority": "string",
    "scheduledAt": "ISO datetime",
    "status": "pending"
  }
}
```

---

### 3. Update Follow-Up Task

| Field | Value |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/v1/follow-ups/:id` |
| **Permission** | `followUps:update` |

**Request Body** (all optional)

```json
{
  "status": "pending | completed | missed | rescheduled",
  "outcome": "string (required when status = 'completed')",
  "scheduledAt": "ISO datetime (required when status = 'rescheduled')",
  "completedAt": "ISO datetime (optional — auto-set to now if completing without this field)",
  "priority": "string",
  "remarks": "string"
}
```

**Business Rules:**
- `completed` and `missed` tasks can only be transitioned to `rescheduled`
- `outcome` is required when marking `completed`
- `scheduledAt` is required when status is `rescheduled`
- `completedAt` is auto-set to `now()` if not provided when completing

**Response `200`**

```json
{
  "success": true,
  "message": "Follow-up task updated to \"completed\".",
  "data": {
    "id": "uuid",
    "status": "string",
    "completedAt": "ISO datetime | null",
    "outcome": "string | null"
  }
}
```

---

## Task Types

| Value | Description |
|---|---|
| `call` | Phone call |
| `email` | Email follow-up |
| `whatsapp` | WhatsApp message |
| `meeting` | In-person or video meeting |

---

## Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `NOT_FOUND` | 404 | Task or lead not found |
| `BUSINESS_RULE_ERROR` | 422 | Lead is won/junk, scheduledAt in past, or invalid status transition |
| `FORBIDDEN` | 403 | Insufficient permission |

---

## Notes for Frontend Developers

- `sales_executive` users automatically see only their own tasks — no need to filter by `assignedTo` for self-view.
- When completing a task, always include `outcome` — the API will reject without it.
- When rescheduling, include the new `scheduledAt` — required by the API.
- `completedAt` is auto-set if you mark status as `completed` without providing it — the API sets it to the current server time.
- List results are ordered by priority (high first), then `scheduledAt` (earliest first) — good for a "what's next" task list.
