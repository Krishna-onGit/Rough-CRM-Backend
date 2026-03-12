# Possessions Module — API Reference

> **Verified:** Traced from source files on 2026-03-11. Response shapes reflect actual runtime output.

> **Base Path:** `/v1/possessions`
> **Auth Required:** Yes (`Authorization: Bearer <token>` + `x-organization-id`)
> **Service:** `src/modules/postSales/possession.service.js`

---

## Overview

Manages the final handover process of units to customers. Possession records are auto-created when a booking is registered (`PATCH /v1/bookings/:id/register`). Includes snag (defect) tracking for pre-possession inspections. Completing a possession triggers the `POSSESSION_COMPLETED` cascade: booking → `possession_handed`, unit → `possession_handed`. Open snags warn but do not block completion.

---

## Possession Status Lifecycle

| Status | Description |
|---|---|
| `pending` | Possession record created, handover not yet scheduled |
| `scheduled` | Handover date set |
| `completed` | Possession handed over, cascade triggered |

---

## Endpoints

### 1. List Possessions

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/possessions` |
| **Permission** | `possession:read` |

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `bookingId` | UUID | Filter by booking |
| `unitId` | UUID | Filter by unit |
| `customerId` | UUID | Filter by customer |
| `status` | string | `pending`, `scheduled`, `completed` |
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Items per page (default: 20) |

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "unitId": "uuid",
      "bookingId": "uuid",
      "customerId": "uuid",
      "possessionDate": "ISO datetime | null",
      "status": "pending | scheduled | completed",
      "checklist": "object | null",
      "handoverBy": "uuid | null",
      "remarks": "string | null",
      "createdAt": "ISO datetime",
      "_count": {
        "snagItems": "number"
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

> `_count.snagItems` is included in the list response — use it to show a snag badge without fetching the full snag list.

---

### 2. Get Possession

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/possessions/:id` |
| **Permission** | `possession:read` |

**Response `200`**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "unitId": "uuid",
    "bookingId": "uuid",
    "customerId": "uuid",
    "possessionDate": "ISO datetime | null",
    "status": "string",
    "checklist": "object | null",
    "handoverBy": "uuid | null",
    "remarks": "string | null",
    "createdAt": "ISO datetime",
    "updatedAt": "ISO datetime",
    "checklistSummary": {
      "completed": "number",
      "total": "number",
      "percentage": "number"
    },
    "snagSummary": {
      "total": "number",
      "open": "number",
      "in_progress": "number",
      "resolved": "number"
    },
    "snagItems": [
      {
        "id": "uuid",
        "description": "string",
        "category": "string",
        "priority": "string",
        "status": "string",
        "reportedDate": "ISO datetime",
        "resolvedDate": "ISO datetime | null",
        "resolvedBy": "uuid | null",
        "remarks": "string | null"
      }
    ]
  }
}
```

> Snag items are ordered by priority ascending, then `reportedDate` descending.

---

### 3. Update Possession

| Field | Value |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/v1/possessions/:id` |
| **Permission** | `possession:update` |

> Cannot update completed possessions. Checklist is **merged** — existing keys are preserved. Send only the keys you want to change.

**Request Body** (all optional)

```json
{
  "possessionDate": "ISO datetime",
  "handoverBy": "uuid",
  "remarks": "string",
  "checklist": {
    "possession_letter": "boolean",
    "keys_handed": "boolean",
    "meter_readings": "boolean",
    "welcome_kit": "boolean",
    "noc_obtained": "boolean"
  }
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Possession record updated successfully.",
  "data": {
    "id": "uuid",
    "status": "string",
    "checklist": "object",
    "possessionDate": "ISO datetime | null"
  }
}
```

---

### 4. Complete Possession

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/possessions/:id/complete` |
| **Permission** | `possession:update` |

> Triggers `POSSESSION_COMPLETED` cascade atomically. Open snags warn (`openSnagWarning`) but do NOT block completion. Incomplete checklist items are logged as warnings only.

**Request Body**

```json
{
  "possessionDate": "ISO datetime (required)",
  "handoverBy": "uuid (required — user conducting handover)",
  "remarks": "string (optional)"
}
```

**Cascade on completion:**
- Booking → `possession_handed`
- Unit → `possession_handed`
- Analytics cache invalidated

**Response `200`**

```json
{
  "success": true,
  "message": "Possession completed successfully. Unit and booking updated to possession_handed.",
  "data": {
    "possessionId": "uuid",
    "status": "completed",
    "possessionDate": "ISO datetime",
    "bookingStatusUpdated": "possession_handed",
    "unitStatusUpdated": "possession_handed",
    "openSnagWarning": "string | null (e.g. '3 unresolved snag(s) remain.')"
  }
}
```

---

### 5. List Snags

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/possessions/:id/snags` |
| **Permission** | `possession:read` |

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `status` | string | `open`, `in_progress`, `resolved` |
| `category` | string | `plumbing`, `electrical`, `civil`, `painting` |
| `priority` | string | `high`, `medium`, `low` |
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Items per page (default: 20) |

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "possessionId": "uuid",
      "unitId": "uuid",
      "description": "string",
      "category": "string",
      "priority": "string",
      "status": "string",
      "reportedDate": "ISO datetime",
      "resolvedDate": "ISO datetime | null",
      "resolvedBy": "uuid | null",
      "remarks": "string | null"
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

> Ordered by priority ascending, then `reportedDate` descending.

---

### 6. Create Snag

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/possessions/snags` |
| **Permission** | `possession:create` |

> Cannot add snags to a `completed` possession.

**Request Body**

```json
{
  "possessionId": "uuid (required)",
  "unitId": "uuid (required — must match possession's unitId)",
  "description": "string (5–500 chars, required)",
  "category": "plumbing | electrical | civil | painting (optional, default: civil)",
  "priority": "high | medium | low (optional, default: medium)",
  "reportedDate": "ISO datetime (required)"
}
```

**Response `201`**

```json
{
  "success": true,
  "message": "Snag item reported successfully.",
  "data": {
    "id": "uuid",
    "description": "string",
    "category": "string",
    "priority": "string",
    "status": "open",
    "reportedDate": "ISO datetime"
  }
}
```

---

### 7. Update Snag

| Field | Value |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/v1/possessions/snags/:snagId` |
| **Permission** | `possession:update` |

> `resolvedBy` is **required** when setting `status: 'resolved'`. `resolvedDate` auto-sets to now if not provided. A resolved snag can only be re-opened (`status: 'open'`).

**Request Body** (all optional)

```json
{
  "status": "open | in_progress | resolved",
  "priority": "high | medium | low",
  "resolvedDate": "ISO datetime (optional — auto-set to now if resolving without date)",
  "resolvedBy": "uuid (required when status = 'resolved')",
  "remarks": "string"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Snag item updated to \"resolved\".",
  "data": {
    "id": "uuid",
    "description": "string",
    "status": "string",
    "resolvedDate": "ISO datetime | null",
    "resolvedBy": "uuid | null"
  }
}
```

---

## Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `NOT_FOUND` | 404 | Possession or snag not found |
| `BUSINESS_RULE_ERROR` | 422 | Cannot update/add snags to completed possession, or unit mismatch, or `resolvedBy` missing |
| `FORBIDDEN` | 403 | Insufficient permission |

---

## Notes for Frontend Developers

- Possession records are **auto-created** when a booking is registered — do not create them manually.
- `_count.snagItems` in the list response lets you show a snag badge without a separate fetch.
- `checklistSummary.percentage` is useful for a progress bar in the handover checklist UI.
- `PATCH /:id` merges the checklist object — only send changed keys, not the full checklist.
- Use `POST /:id/complete` (not `PATCH`) for the final handover — this fires the cascade.
- `openSnagWarning` will be non-null if snags were unresolved at completion. Show a warning banner but do not block the flow.
- `resolvedBy` must be provided when resolving a snag via `PATCH /snags/:snagId`.
