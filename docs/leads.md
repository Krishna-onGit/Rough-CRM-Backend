# Leads Module — API Reference

> **Verified:** Traced from source files on 2026-03-10. Response shapes reflect actual runtime output.

> **Base Path:** `/v1/leads`
> **Auth Required:** Yes (`Authorization: Bearer <token>` + `x-organization-id`)
> **Service:** `src/modules/preSales/lead.service.js`

---

## Overview

Manages the pre-sales lead pipeline. Leads move through a status state machine from `new` through to `won` (converted to booking) or `lost`/`junk`. Site visits and follow-up tasks are linked to leads. Converting a lead to `won` requires a linked booking ID.

---

## Lead Status State Machine

| Status | Transitions To |
|---|---|
| `new` | `contacted`, `junk` |
| `contacted` | `site_visit_scheduled`, `junk`, `lost` |
| `site_visit_scheduled` | `site_visit_done`, `junk`, `lost` |
| `site_visit_done` | `negotiation`, `junk`, `lost` |
| `negotiation` | `won`, `lost` |
| `won` | (terminal — requires `convertedBookingId`) |
| `lost` | (terminal — requires `lostReason`) |
| `junk` | (terminal) |

---

## Endpoints

### 1. List Leads

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/leads` |
| **Permission** | `leads:read` |

> Sales executives (`sales_executive` role) automatically see only their own leads.

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `status` | string | Filter by status |
| `source` | string | Filter by lead source |
| `assignedTo` | UUID | Filter by assigned sales person |
| `interestedProject` | UUID | Filter by project interest |
| `search` | string | Search by name/mobile/email |
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
      "leadCode": "string",
      "fullName": "string",
      "mobile": "string",
      "email": "string | null",
      "source": "string",
      "status": "string",
      "score": "number | null",
      "interestedProject": "uuid | null",
      "interestedConfig": "string | null",
      "budgetMin": "number (rupees) | null",
      "budgetMax": "number (rupees) | null",
      "assignedTo": "uuid | null",
      "assignedAt": "ISO datetime | null",
      "createdAt": "ISO datetime",
      "updatedAt": "ISO datetime",
      "_count": {
        "siteVisits": "number",
        "followUpTasks": "number"
      }
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

> `budgetMin` and `budgetMax` are in **rupees**.

---

### 2. Get Lead

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/leads/:id` |
| **Permission** | `leads:read` |

**Response `200`**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "leadCode": "string",
    "fullName": "string",
    "mobile": "string",
    "email": "string | null",
    "source": "string",
    "status": "string",
    "score": "number | null",
    "interestedProject": "uuid | null",
    "interestedConfig": "string | null",
    "budgetMin": "number (rupees) | null",
    "budgetMax": "number (rupees) | null",
    "assignedTo": "uuid | null",
    "lostReason": "string | null",
    "convertedBookingId": "uuid | null",
    "createdAt": "ISO datetime",
    "siteVisits": ["array of site visit records"],
    "followUpTasks": ["array of follow-up task records"]
  }
}
```

---

### 3. Create Lead

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/leads` |
| **Permission** | `leads:create` |

**Request Body**

```json
{
  "fullName": "string (required)",
  "mobile": "string (required — unique per org)",
  "email": "string (optional)",
  "source": "string (required — e.g., 'website', 'referral', 'walkin')",
  "interestedProject": "uuid (optional)",
  "interestedConfig": "string (optional)",
  "budgetMin": "number (rupees, optional)",
  "budgetMax": "number (rupees, optional)",
  "assignedTo": "uuid (optional — salesPerson ID)"
}
```

> Throws `CONFLICT` if mobile number already exists for this organization.

**Response `201`**

```json
{
  "success": true,
  "message": "...",
  "data": {
    "id": "uuid",
    "leadCode": "string",
    "fullName": "string",
    "mobile": "string",
    "status": "new",
    "source": "string"
  }
}
```

---

### 4. Update Lead

| Field | Value |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/v1/leads/:id` |
| **Permission** | `leads:update` |

**Request Body** (all optional)

```json
{
  "fullName": "string",
  "email": "string",
  "interestedProject": "uuid",
  "interestedConfig": "string",
  "budgetMin": "number (rupees)",
  "budgetMax": "number (rupees)",
  "assignedTo": "uuid",
  "score": "number",
  "remarks": "string"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "...",
  "data": {
    "id": "uuid",
    "leadCode": "string"
  }
}
```

---

### 5. Update Lead Status

| Field | Value |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/v1/leads/:id/status` |
| **Permission** | `leads:update` |

**Request Body**

```json
{
  "status": "string (required — must follow state machine)",
  "lostReason": "string (required when status = 'lost')",
  "convertedBookingId": "uuid (required when status = 'won')"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "...",
  "data": {
    "id": "uuid",
    "leadCode": "string",
    "previousStatus": "string",
    "newStatus": "string"
  }
}
```

---

## Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `CONFLICT` | 409 | Mobile number already exists |
| `NOT_FOUND` | 404 | Lead not found |
| `BUSINESS_RULE_ERROR` | 422 | Invalid status transition or missing required field |
| `FORBIDDEN` | 403 | Insufficient permission |

---

## Notes for Frontend Developers

- `budgetMin` and `budgetMax` are in **rupees**.
- Status transitions are enforced by the API — use `GET /v1/leads/:id` to check current status before showing transition options.
- Transitioning to `won` requires providing `convertedBookingId` — create the booking first, then update the lead status.
- Transitioning to `lost` requires `lostReason`.
- `sales_executive` role users see only their own leads (filtered by `assignedTo = userId` automatically).
- `_count.siteVisits` and `_count.followUpTasks` in the list response help render activity indicators without additional API calls.
- `leadCode` is auto-generated (format: `LEAD-XXXX`).
