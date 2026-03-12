# Projects Module — API Reference

> **Verified:** Traced from source files on 2026-03-10. Response shapes reflect actual runtime output.

> **Base Path:** `/v1/projects`
> **Auth Required:** Yes (`Authorization: Bearer <token>` + `x-organization-id`)
> **Service:** `src/modules/projects/project.service.js`

---

## Overview

Manages real estate project lifecycle. A project contains towers, which contain units. Creating a project with towers auto-creates all unit records. Projects have status tracking for active/on-hold/completed states.

---

## Endpoints

### 1. List Projects

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/projects` |
| **Permission** | `projects:read` |

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `status` | string | Filter by status (`active`, `on_hold`, `completed`) |
| `projectType` | string | Filter by type |
| `city` | string | Filter by city |
| `search` | string | Search by name/code |
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Items per page (default: 20) |

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "projectCode": "string",
      "name": "string",
      "city": "string",
      "location": "string",
      "projectType": "string",
      "status": "string",
      "baseRate": "number (rupees)",
      "completionPct": "number",
      "reraNumber": "string | null",
      "isActive": "boolean",
      "createdAt": "ISO datetime",
      "_count": {
        "towers": "number",
        "units": "number"
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

> `baseRate` is in **rupees**. `completionPct` is a plain Number (not BigInt).

---

### 2. Get Project

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/projects/:id` |
| **Permission** | `projects:read` |

**Response `200`**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "projectCode": "string",
    "name": "string",
    "city": "string",
    "location": "string",
    "projectType": "string",
    "status": "string",
    "baseRate": "number (rupees)",
    "completionPct": "number",
    "reraNumber": "string | null",
    "isActive": "boolean",
    "createdAt": "ISO datetime",
    "updatedAt": "ISO datetime",
    "unitStats": {
      "total": "number",
      "available": "number",
      "blocked": "number",
      "token_received": "number",
      "booked": "number",
      "agreement_done": "number",
      "registered": "number",
      "possession_handed": "number",
      "cancelled": "number"
    }
  }
}
```

---

### 3. Create Project

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/projects` |
| **Permission** | `projects:create` |

**Request Body**

```json
{
  "name": "string (required)",
  "city": "string (required)",
  "location": "string (required)",
  "projectType": "string (required)",
  "baseRate": "number (rupees, required — min 1)",
  "reraNumber": "string (optional)",
  "towers": [
    {
      "name": "string (required)",
      "floors": "number (required)",
      "unitsPerFloor": "number (required)",
      "configs": ["BHK_1", "BHK_2", "BHK_3", "BHK_4", "Penthouse"]
    }
  ]
}
```

**Response `201`**

```json
{
  "success": true,
  "message": "...",
  "data": {
    "project": {
      "id": "uuid",
      "projectCode": "string",
      "name": "string",
      "baseRate": "number (rupees)"
    },
    "towers": ["array of created tower objects"],
    "totalUnitsCreated": "number"
  }
}
```

---

### 4. Update Project

| Field | Value |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/v1/projects/:id` |
| **Permission** | `projects:update` |

**Request Body** (all optional)

```json
{
  "name": "string",
  "city": "string",
  "location": "string",
  "baseRate": "number (rupees)",
  "reraNumber": "string",
  "completionPct": "number (0–100)"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "...",
  "data": {
    "id": "uuid",
    "projectCode": "string",
    "name": "string",
    "baseRate": "number (rupees)"
  }
}
```

---

### 5. Update Project Status

| Field | Value |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/v1/projects/:id/status` |
| **Permission** | `projects:update` |

**Request Body**

```json
{
  "status": "active | on_hold | completed (required)"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "...",
  "data": {
    "id": "uuid",
    "status": "string"
  }
}
```

---

### 6. List Towers

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/projects/:id/towers` |
| **Permission** | `projects:read` |

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "string",
      "floors": "number",
      "unitsPerFloor": "number",
      "_count": { "units": "number" }
    }
  ]
}
```

> Returns raw array via `buildSingleResponse` — no pagination, no `meta`.

---

### 7. Add Towers

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/projects/:id/towers` |
| **Permission** | `projects:update` |

**Request Body**

```json
{
  "towers": [
    {
      "name": "string (required)",
      "floors": "number (required)",
      "unitsPerFloor": "number (required)",
      "configs": ["BHK_1", "BHK_2"]
    }
  ]
}
```

**Response `201`**

```json
{
  "success": true,
  "message": "...",
  "data": {
    "towers": ["array of created tower objects"],
    "totalUnitsCreated": "number"
  }
}
```

---

### 8. Get Unit Stats

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/projects/:id/unit-stats` |
| **Permission** | `projects:read` |

**Response `200`**

```json
{
  "success": true,
  "data": {
    "projectId": "uuid",
    "total": "number",
    "available": "number",
    "blocked": "number",
    "token_received": "number",
    "booked": "number",
    "agreement_done": "number",
    "registered": "number",
    "possession_handed": "number",
    "cancelled": "number"
  }
}
```

---

## Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `NOT_FOUND` | 404 | Project not found |
| `CONFLICT` | 409 | Project code or RERA already exists |
| `FORBIDDEN` | 403 | Insufficient permission |

---

## Notes for Frontend Developers

- `baseRate` throughout this module is in **rupees**, not paise.
- `completionPct` is a plain Number — render directly as a percentage.
- Unit stats (`unitStats` / `GET /unit-stats`) cover the full lifecycle from `available` to `possession_handed`.
- `GET /v1/projects/:id/towers` returns an array directly under `data` (not paginated).
- When creating a project, towers are optional in the body — you can add them later with `POST /v1/projects/:id/towers`.
