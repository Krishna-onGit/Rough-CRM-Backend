# Audit Log Module — API Reference

> **Verified:** Traced from source files on 2026-03-11. Response shapes reflect actual runtime output.

> **Base Path:** `/v1/audit`
> **Auth Required:** Yes (`Authorization: Bearer <token>` + `x-organization-id`)
> **Service:** `src/modules/audit/audit.service.js`

---

## Overview

Read-only access to the system audit trail. All significant actions (create, update, status changes, approvals) are automatically logged. Three views: full log list, entity-specific trail (not paginated), and user activity (paginated).

> **Schema Note:** `AuditLog` fields are `actorId`, `actorRole`, `action`, `entityType`, `entityId`, `entityCode`, `metadata`. There is NO `userId`, `ipAddress`, or `userAgent` column.

---

## Endpoints

### 1. List Audit Logs

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/audit` |
| **Permission** | `audit:read` |

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `userId` | UUID | Filter by actor (maps to `actorId` internally) |
| `action` | string | Filter by action (e.g., `CREATE`, `UPDATE`) |
| `entityType` | string | Filter by entity type (e.g., `booking`, `lead`) |
| `entityId` | UUID | Filter by specific entity ID |
| `search` | string | Search across `action` and `entityType` fields |
| `from` | ISO datetime | Filter from date |
| `to` | ISO datetime | Filter to date |
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Items per page (default: 20) |

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "actorId": "uuid",
      "actorRole": "string",
      "action": "string",
      "entityType": "string",
      "entityId": "uuid | null",
      "entityCode": "string | null",
      "metadata": "object | null",
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

> Ordered by `createdAt` descending (newest first).

---

### 2. Get Entity Audit Trail

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/audit/entity/:entityType/:entityId` |
| **Permission** | `audit:read` |

> **Not paginated.** Returns the complete chronological history for a specific record, oldest first.

**Path Parameters**

| Param | Type | Description |
|---|---|---|
| `entityType` | string | Entity type (e.g., `booking`, `lead`, `customer`) |
| `entityId` | UUID | Entity ID |

**Response `200`**

```json
{
  "success": true,
  "data": {
    "entityType": "string",
    "entityId": "uuid",
    "totalEvents": "number",
    "trail": [
      {
        "id": "uuid",
        "actorId": "uuid",
        "actorRole": "string",
        "action": "string",
        "entityCode": "string | null",
        "metadata": "object | null",
        "createdAt": "ISO datetime"
      }
    ]
  }
}
```

> Ordered chronologically (oldest first). No `meta` key — this response is NOT paginated.

---

### 3. Get User Activity

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/audit/user/:userId` |
| **Permission** | `audit:read` |

**Path Parameters**

| Param | Type | Description |
|---|---|---|
| `userId` | UUID | Actor user ID |

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `from` | ISO datetime | Filter from date |
| `to` | ISO datetime | Filter to date |
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Items per page (default: 20) |

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "actorId": "uuid",
      "action": "string",
      "entityType": "string",
      "entityId": "uuid | null",
      "entityCode": "string | null",
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

> `metadata` and `actorRole` are **not included** in this select — use `GET /v1/audit` with a `userId` filter if you need those fields.

---

## Common Action Values

| Action | Description |
|---|---|
| `CREATE` | Entity created |
| `UPDATE` | Entity updated |
| `STATUS_CHANGE` | Entity status changed |
| `LOGIN` | User logged in |
| `LOGOUT` | User logged out |
| `APPROVE` | Approval granted |
| `REJECT` | Approval rejected |
| `VERIFY` | Document/KYC verified |
| `BLOCK` | Unit blocked |
| `RELEASE` | Unit released |
| `BOOK` | Unit booked |
| `REGISTER` | Booking registered |
| `CANCEL` | Booking cancelled |
| `TRANSFER` | Ownership transferred |
| `POSSESS` | Possession completed |
| `DISBURSE` | Loan disbursement recorded |

---

## Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `FORBIDDEN` | 403 | `audit:read` permission required |
| `NOT_FOUND` | 404 | Entity not found (for entity trail) |

---

## Notes for Frontend Developers

- Audit logs are **read-only** — no create, update, or delete endpoints exist.
- Use `GET /v1/audit/entity/:entityType/:entityId` to render a timeline/history view for any entity. This endpoint returns ALL events (not paginated) — use `totalEvents` to show a count badge.
- `GET /v1/audit/user/:userId` does NOT include `metadata` or `actorRole` — use `GET /v1/audit?userId=...` if you need those fields.
- Query param is `userId` (not `actorId`) for `GET /v1/audit` — it maps to `actorId` internally.
- `metadata` is a JSON object containing change details (before/after values, relevant IDs).
- `audit:read` is typically restricted to Admin and Manager roles.
