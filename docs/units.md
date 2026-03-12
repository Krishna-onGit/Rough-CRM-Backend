# Units Module — API Reference

> **Verified:** Traced from source files on 2026-03-10. Response shapes reflect actual runtime output.

> **Base Path:** `/v1/units`
> **Auth Required:** Yes (`Authorization: Bearer <token>` + `x-organization-id`)
> **Service:** `src/modules/units/unit.service.js`

---

## Overview

Manages individual unit inventory within projects. Units move through a status lifecycle: `available` → `blocked` → `token_received` → `booked` → `agreement_done` → `registered` → `possession_handed`. Each sales person can hold a maximum of 3 active blocks at a time.

---

## Unit Status Lifecycle

| Status | Description |
|---|---|
| `available` | Unit is available for sale |
| `blocked` | Temporarily reserved by a sales person (with expiry) |
| `token_received` | Token amount received, interest confirmed |
| `booked` | Booking agreement created |
| `agreement_done` | Agreement registered |
| `registered` | Property registered |
| `possession_handed` | Physical possession given to customer |
| `cancelled` | Booking cancelled, unit returned to inventory |

---

## Endpoints

### 1. List Units

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/units` |
| **Permission** | `units:read` |

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `projectId` | UUID | Filter by project |
| `towerId` | UUID | Filter by tower |
| `status` | string | Filter by unit status |
| `config` | string | `BHK_1`, `BHK_2`, `BHK_3`, `BHK_4`, `Penthouse` |
| `facing` | string | Filter by facing direction |
| `floor` | number | Filter by floor number |
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Items per page (default: 20) |

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "unitNumber": "string",
      "unitCode": "string",
      "floor": "number",
      "config": "BHK_1 | BHK_2 | BHK_3 | BHK_4 | Penthouse",
      "facing": "string | null",
      "status": "string",
      "totalPrice": "number (rupees)",
      "agreementValue": "number (rupees)",
      "superBuiltUpArea": "number (sqft)",
      "parking": "boolean",
      "projectId": "uuid",
      "towerId": "uuid",
      "blockExpiresAt": "ISO datetime | null"
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

> `totalPrice`, `agreementValue` are in **rupees**. `superBuiltUpArea` is in sqft (converted from stored integer).

---

### 2. Get Unit

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/units/:id` |
| **Permission** | `units:read` |

**Response `200`**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "unitNumber": "string",
    "unitCode": "string",
    "floor": "number",
    "config": "string",
    "facing": "string | null",
    "status": "string",
    "totalPrice": "number (rupees)",
    "agreementValue": "number (rupees)",
    "superBuiltUpArea": "number (sqft)",
    "parking": "boolean",
    "projectId": "uuid",
    "towerId": "uuid",
    "blockExpiresAt": "ISO datetime | null",
    "costSheet": {
      "basePrice": "number (rupees)",
      "floorRise": "number (rupees)",
      "plc": "number (rupees)",
      "amenityCharge": "number (rupees)",
      "agreementValue": "number (rupees)",
      "gstAmount": "number (rupees)",
      "stampDuty": "number (rupees)",
      "registration": "number (rupees)",
      "totalPrice": "number (rupees)",
      "currency": "INR"
    }
  }
}
```

---

### 3. Get Cost Sheet

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/units/:id/cost-sheet` |
| **Permission** | `units:read` |

**Response `200`**

```json
{
  "success": true,
  "data": {
    "unit": {
      "id": "uuid",
      "unitNumber": "string",
      "unitCode": "string",
      "floor": "number",
      "config": "string",
      "facing": "string | null",
      "superBuiltUpArea": "number (sqft)",
      "status": "string",
      "project": "string (project name)",
      "tower": "string (tower name)"
    },
    "costSheet": {
      "basePrice": "number (rupees)",
      "floorRise": "number (rupees)",
      "plc": "number (rupees)",
      "amenityCharge": "number (rupees)",
      "agreementValue": "number (rupees)",
      "gstAmount": "number (rupees)",
      "stampDuty": "number (rupees)",
      "registration": "number (rupees)",
      "totalPrice": "number (rupees)",
      "currency": "INR"
    }
  }
}
```

---

### 4. Block Unit

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/units/:id/block` |
| **Permission** | `units:block` |

**Request Body**

```json
{
  "salesPersonId": "uuid (required)",
  "blockDurationHours": "number (optional, default: 48)"
}
```

**Business Rules:**
- Unit must be in `available` status
- Sales person cannot hold more than **3** active blocks simultaneously
- Block expires after `blockDurationHours` (managed by background job)

**Response `200`**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "unitNumber": "string",
    "status": "blocked",
    "blockedAt": "ISO datetime",
    "blockExpiresAt": "ISO datetime",
    "blockedBy": "uuid (salesPersonId)",
    "message": "string"
  }
}
```

---

### 5. Release Unit

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/units/:id/release` |
| **Permission** | `units:block` |

**Response `200`**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "unitNumber": "string",
    "status": "available",
    "message": "string"
  }
}
```

---

### 6. Record Token

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/units/:id/token` |
| **Permission** | `units:block` |

> Records token receipt and advances unit status to `token_received`. This is a **status change only** — it does not create a payment record. Use `POST /v1/payments` separately to record the actual token payment.

**Request Body**

```json
{
  "salesPersonId": "uuid (required)"
}
```

**Response `200`**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "unitNumber": "string",
    "status": "token_received",
    "message": "string"
  }
}
```

---

## Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `NOT_FOUND` | 404 | Unit not found |
| `UNIT_NOT_AVAILABLE` | 409 | Unit not in correct status for operation |
| `BLOCK_LIMIT_EXCEEDED` | 409 | Sales person already has 3 active blocks |
| `FORBIDDEN` | 403 | Insufficient permission |

---

## Notes for Frontend Developers

- All monetary fields (`totalPrice`, `agreementValue`, cost sheet fields) are in **rupees** (Number).
- `superBuiltUpArea` is in square feet (sqft), already converted.
- `POST /v1/units/:id/token` only changes status — record the actual payment separately via `POST /v1/payments`.
- Block expiry is managed by the `blockExpiry.job.js` background job — expired blocks are auto-released.
- A sales person cannot block more than 3 units. Enforce this constraint before calling the API by checking the current block count via `GET /v1/sales-team/:id`.
- `blockExpiresAt` in the list response helps build a countdown timer for blocked units.
