# Sales Team Module — API Reference

> **Verified:** Traced from source files on 2026-03-10. Response shapes reflect actual runtime output.

> **Base Path:** `/v1/sales-team`
> **Auth Required:** Yes (`Authorization: Bearer <token>` + `x-organization-id`)
> **Service:** `src/modules/salesTeam/salesPerson.service.js`

---

## Overview

Manages sales person records and team performance. Sales persons are linked to bookings, unit blocks, and payment schedules. Each sales person tracks monthly targets vs. revenue achieved.

---

## Endpoints

### 1. List Sales Persons

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/sales-team` |
| **Permission** | `salesTeam:read` |

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `team` | string | Filter by team name |
| `isActive` | boolean | Filter active/inactive |
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Items per page (default: 20) |

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "spCode": "string",
      "fullName": "string",
      "mobile": "string",
      "email": "string | null",
      "team": "string | null",
      "designation": "string | null",
      "reportingTo": "uuid | null",
      "monthlyTarget": "number (rupees)",
      "isActive": "boolean",
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

> `monthlyTarget` is in **rupees**.

---

### 2. Get Sales Person

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/sales-team/:id` |
| **Permission** | `salesTeam:read` |

**Response `200`**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "spCode": "string",
    "fullName": "string",
    "mobile": "string",
    "email": "string | null",
    "team": "string | null",
    "designation": "string | null",
    "reportingTo": "uuid | null",
    "monthlyTarget": "number (rupees)",
    "isActive": "boolean",
    "createdAt": "ISO datetime",
    "performance": {
      "totalBookings": "number",
      "activeBlocks": "number",
      "monthlyBookings": "number",
      "totalRevenue": "number (rupees)",
      "achievementPct": "number"
    }
  }
}
```

---

### 3. Create Sales Person

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/sales-team` |
| **Permission** | `salesTeam:create` |

**Request Body**

```json
{
  "fullName": "string (required)",
  "mobile": "string (required — unique)",
  "email": "string (optional)",
  "team": "string (optional)",
  "designation": "string (optional)",
  "reportingTo": "uuid (optional — another salesPerson ID)",
  "monthlyTarget": "number (rupees, optional)"
}
```

**Response `201`**

```json
{
  "success": true,
  "message": "...",
  "data": {
    "id": "uuid",
    "spCode": "string",
    "fullName": "string",
    "designation": "string | null"
  }
}
```

---

### 4. Update Sales Person

| Field | Value |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/v1/sales-team/:id` |
| **Permission** | `salesTeam:update` |

**Request Body** (all optional)

```json
{
  "fullName": "string",
  "mobile": "string",
  "email": "string",
  "team": "string",
  "designation": "string",
  "reportingTo": "uuid",
  "monthlyTarget": "number (rupees)",
  "isActive": "boolean"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "...",
  "data": {
    "id": "uuid",
    "spCode": "string",
    "isActive": "boolean"
  }
}
```

---

### 5. Get Team Performance

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/sales-team/performance` |
| **Permission** | `salesTeam:read` |

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `team` | string | Filter by team name |
| `month` | string | Month in `YYYY-MM` format (default: current month) |

**Response `200`**

```json
{
  "success": true,
  "data": {
    "team": "string | null",
    "month": "string",
    "salesPersons": [
      {
        "id": "uuid",
        "spCode": "string",
        "fullName": "string",
        "team": "string | null",
        "designation": "string | null",
        "monthlyTarget": "number (rupees)",
        "monthlyRevenue": "number (rupees)",
        "monthlyBookings": "number",
        "achievementPct": "number"
      }
    ],
    "summary": {
      "totalSalesPersons": "number",
      "totalRevenue": "number (rupees)",
      "totalBookings": "number",
      "avgAchievement": "number"
    }
  }
}
```

> This endpoint does NOT use `buildPaginatedResponse` — response shape is raw (no `meta`).

---

## Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `NOT_FOUND` | 404 | Sales person not found |
| `CONFLICT` | 409 | Mobile number already in use |
| `FORBIDDEN` | 403 | Insufficient permission |

---

## Notes for Frontend Developers

- `monthlyTarget` and all revenue fields are in **rupees**.
- `achievementPct` = `(monthlyRevenue / monthlyTarget) * 100`.
- `activeBlocks` in `performance` is the current number of units blocked by this sales person (max 3).
- `GET /v1/sales-team/performance` returns a non-paginated list — the response shape has `data.salesPersons` array, NOT `data` array with `meta`.
- `spCode` is auto-generated — you do not set it during creation.
- `reportingTo` references another `salesPerson.id` in the same organization.
