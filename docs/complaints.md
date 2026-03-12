# Complaints Module — API Reference

> **Verified:** Traced from source files on 2026-03-11. Response shapes reflect actual runtime output.

> **Base Path:** `/v1/complaints`
> **Auth Required:** Yes (`Authorization: Bearer <token>` + `x-organization-id`)
> **Service:** `src/modules/complaints/complaint.service.js`

---

## Overview

Tracks customer complaints with SLA (Service Level Agreement) monitoring. SLA deadlines are calculated at creation based on priority. Assigning a complaint auto-advances it to `in_progress`. Escalation upgrades priority to `high` and marks SLA as breached. The `slaBreachCheck.job.js` background job monitors SLA breaches automatically; `GET /v1/complaints/:id` also performs a real-time SLA check.

---

## Complaint Status Lifecycle

| Status | Description |
|---|---|
| `open` | Complaint raised, unassigned |
| `in_progress` | Assigned to a team member |
| `escalated` | Escalated — priority upgraded to `high`, SLA marked breached |
| `resolved` | Resolution provided |
| `closed` | Closed by customer/admin |

---

## SLA Hours by Priority

| Priority | SLA Hours |
|---|---|
| `high` | 24 hours |
| `medium` | 48 hours |
| `low` | 72 hours |

---

## Endpoints

### 1. List Complaints

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/complaints` |
| **Permission** | `complaints:read` |

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `status` | string | Filter by status |
| `category` | string | Filter by category |
| `priority` | string | `high`, `medium`, `low` |
| `assignedTo` | UUID | Filter by assigned user |
| `customerId` | UUID | Filter by customer |
| `slaBreached` | boolean | Filter breached/not-breached |
| `search` | string | Search by subject or complaint code |
| `from` | ISO datetime | Filter by creation date (from) |
| `to` | ISO datetime | Filter by creation date (to) |
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Items per page (default: 20) |

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "complaintCode": "string",
      "customerId": "uuid",
      "category": "string",
      "subject": "string",
      "priority": "high | medium | low",
      "status": "open | in_progress | escalated | resolved | closed",
      "assignedTo": "uuid | null",
      "slaHours": "number",
      "slaDeadline": "ISO datetime",
      "slaBreached": "boolean",
      "resolvedAt": "ISO datetime | null",
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

### 2. Get Complaint

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/complaints/:id` |
| **Permission** | `complaints:read` |

> Performs real-time SLA breach check — if `slaDeadline` has passed and status is not resolved/closed, `slaBreached` is updated in DB and returned as `true`.

**Response `200`**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "complaintCode": "string",
    "customerId": "uuid",
    "unitId": "uuid | null",
    "bookingId": "uuid | null",
    "category": "string",
    "subject": "string",
    "description": "string",
    "priority": "string",
    "status": "string",
    "assignedTo": "uuid | null",
    "slaHours": "number",
    "slaDeadline": "ISO datetime",
    "slaBreached": "boolean (real-time)",
    "resolution": "string | null",
    "resolvedAt": "ISO datetime | null",
    "createdAt": "ISO datetime",
    "updatedAt": "ISO datetime"
  }
}
```

---

### 3. Create Complaint

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/complaints` |
| **Permission** | `complaints:create` |

**Request Body**

```json
{
  "customerId": "uuid (required)",
  "unitId": "uuid (optional)",
  "bookingId": "uuid (optional)",
  "category": "general | maintenance | financial | legal | other (optional, default: general)",
  "subject": "string (required)",
  "description": "string (required)",
  "priority": "high | medium | low (optional, default: medium)"
}
```

**Response `201`**

```json
{
  "success": true,
  "message": "Complaint CMP-0001 raised successfully. SLA deadline: ISO datetime.",
  "data": {
    "id": "uuid",
    "complaintCode": "string",
    "subject": "string",
    "priority": "string",
    "status": "open",
    "slaDeadline": "ISO datetime"
  }
}
```

---

### 4. Update Complaint

| Field | Value |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/v1/complaints/:id` |
| **Permission** | `complaints:update` |

> Cannot update `resolved` or `closed` complaints. Assigning `assignedTo` auto-advances status from `open` → `in_progress`. Changing `priority` recalculates `slaDeadline`.

**Request Body** (all optional)

```json
{
  "assignedTo": "uuid",
  "priority": "high | medium | low",
  "subject": "string",
  "description": "string"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Complaint updated successfully.",
  "data": {
    "id": "uuid",
    "complaintCode": "string",
    "status": "string",
    "assignedTo": "uuid | null",
    "priority": "string"
  }
}
```

---

### 5. Resolve Complaint

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/complaints/:id/resolve` |
| **Permission** | `complaints:update` |

**Request Body**

```json
{
  "resolution": "string (required)"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Complaint CMP-0001 resolved in 36 hour(s).",
  "data": {
    "id": "uuid",
    "complaintCode": "string",
    "status": "resolved",
    "resolvedAt": "ISO datetime",
    "resolutionHours": "number",
    "withinSla": "boolean"
  }
}
```

---

### 6. Escalate Complaint

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/complaints/:id/escalate` |
| **Permission** | `complaints:update` |

> Sets priority to `high`, marks `slaBreached: true`, status → `escalated`. Cannot escalate `closed` or already-`escalated` complaints.

**Response `200`**

```json
{
  "success": true,
  "message": "Complaint CMP-0001 escalated. Priority upgraded to high.",
  "data": {
    "id": "uuid",
    "complaintCode": "string",
    "status": "escalated",
    "priority": "high"
  }
}
```

---

## Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `NOT_FOUND` | 404 | Complaint or customer not found |
| `BUSINESS_RULE_ERROR` | 422 | Cannot update/escalate resolved or closed complaint |
| `FORBIDDEN` | 403 | Insufficient permission |

---

## Notes for Frontend Developers

- `slaBreached` is checked in real-time on `GET /v1/complaints/:id` — always use the API value.
- `complaintCode` format: `CMP-0001` (sequential per org).
- `withinSla` in resolve response = `!slaBreached` — use for "resolved within SLA" badges.
- `resolutionHours` = hours between `createdAt` and `resolvedAt`.
- Assigning (`PATCH` with `assignedTo`) auto-advances status from `open` → `in_progress`.
- Changing `priority` in PATCH recalculates `slaDeadline` based on new priority hours.
- `slaBreachCheck.job.js` background job marks breaches automatically — real-time check on GET is a safety net for cases the job hasn't run yet.
