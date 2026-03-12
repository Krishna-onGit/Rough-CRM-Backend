# Site Visits Module — API Reference

> **Verified:** Traced from source files on 2026-03-10. Response shapes reflect actual runtime output.

> **Base Path:** `/v1/site-visits`
> **Auth Required:** Yes (`Authorization: Bearer <token>` + `x-organization-id`)
> **Service:** `src/modules/preSales/siteVisit.service.js`

---

## Overview

Tracks physical site visits by leads. Creating a site visit auto-advances lead status to `site_visit_scheduled` (if lead was `new` or `contacted`). Updating a visit with `feedback` + `checkOutAt` auto-advances lead to `site_visit_done`.

---

## Endpoints

### 1. List Site Visits

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/site-visits` |
| **Permission** | `siteVisits:read` |

> Sales executives (`sales_executive` role) automatically see only their own visits.

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `leadId` | UUID | Filter by lead |
| `projectId` | UUID | Filter by project |
| `salesPersonId` | UUID | Filter by sales person |
| `visitType` | string | `first_visit`, `revisit`, `virtual` |
| `feedback` | string | Filter by feedback value |
| `from` | ISO datetime | Filter by visit date (from) |
| `to` | ISO datetime | Filter by visit date (to) |
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
      "projectId": "uuid",
      "salesPersonId": "uuid | null",
      "visitDate": "ISO datetime",
      "visitType": "first_visit | revisit | virtual",
      "visitorCount": "number",
      "checkInAt": "ISO datetime | null",
      "checkOutAt": "ISO datetime | null",
      "feedback": "string | null",
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

### 2. Create Site Visit

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/site-visits` |
| **Permission** | `siteVisits:create` |

**Request Body**

```json
{
  "leadId": "uuid (required)",
  "projectId": "uuid (required)",
  "salesPersonId": "uuid (optional)",
  "visitDate": "ISO datetime (required)",
  "visitType": "first_visit | revisit | virtual (optional, default: first_visit)",
  "visitorCount": "number (optional, default: 1)",
  "remarks": "string (optional)"
}
```

**Business Rules:**
- Lead must be active and not `won` or `junk` status
- Project must be active
- Auto-advances lead status to `site_visit_scheduled` if lead was `new` or `contacted`

**Response `201`**

```json
{
  "success": true,
  "message": "Site visit scheduled successfully.",
  "data": {
    "id": "uuid",
    "leadId": "uuid",
    "projectId": "uuid",
    "visitDate": "ISO datetime",
    "visitType": "string",
    "leadStatusUpdated": "boolean (true if lead status was auto-advanced)"
  }
}
```

---

### 3. Update Site Visit

| Field | Value |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/v1/site-visits/:id` |
| **Permission** | `siteVisits:update` |

**Request Body** (all optional)

```json
{
  "visitDate": "ISO datetime",
  "visitType": "string",
  "visitorCount": "number",
  "checkInAt": "ISO datetime",
  "checkOutAt": "ISO datetime (must be after checkInAt)",
  "feedback": "string",
  "remarks": "string"
}
```

**Business Rules:**
- `checkOutAt` must be after `checkInAt`
- Cannot set `checkOutAt` without `checkInAt` (either in body or already set)
- If `feedback` + `checkOutAt` are both set → auto-advances lead to `site_visit_done` (if lead was `site_visit_scheduled`)

**Response `200`**

```json
{
  "success": true,
  "message": "Site visit updated successfully.",
  "data": {
    "id": "uuid",
    "visitType": "string",
    "feedback": "string | null",
    "checkInAt": "ISO datetime | null",
    "checkOutAt": "ISO datetime | null"
  }
}
```

---

## Visit Types

| Value | Description |
|---|---|
| `first_visit` | First-time site visit |
| `revisit` | Return visit |
| `virtual` | Virtual/online site tour |

---

## Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `NOT_FOUND` | 404 | Lead or project not found |
| `BUSINESS_RULE_ERROR` | 422 | Lead status invalid for site visit, or checkout before checkin |
| `FORBIDDEN` | 403 | Insufficient permission |

---

## Notes for Frontend Developers

- Creating a site visit auto-advances the lead status — check `leadStatusUpdated` in the response to update UI accordingly.
- Recording `feedback` + `checkOutAt` together in an update will auto-advance the lead to `site_visit_done` — useful for the post-visit feedback flow.
- `sales_executive` role automatically sees only their own visits.
- `visitorCount` tracks how many people visited (useful for analytics).
- There is no `GET /v1/site-visits/:id` endpoint — use the list with `leadId` filter to fetch visits for a specific lead.
