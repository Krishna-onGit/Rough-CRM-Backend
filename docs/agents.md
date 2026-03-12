# Agents Module — API Reference

> **Verified:** Traced from source files on 2026-03-10. Response shapes reflect actual runtime output.

> **Base Path:** `/v1/agents`
> **Auth Required:** Yes (`Authorization: Bearer <token>` + `x-organization-id`)
> **Service:** `src/modules/agents/agent.service.js`

---

## Overview

Manages external channel partners/brokers (agents) and their commission records. Commissions are auto-created when a booking is made via an agent. Commission payments can be recorded once a commission reaches `sale_completed` status (after possession).

---

## Endpoints

### 1. List Agents

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/agents` |
| **Permission** | `agents:read` |

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `isActive` | boolean | Filter active/inactive |
| `search` | string | Search by firm name or contact |
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Items per page (default: 20) |

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "agentCode": "string",
      "firmName": "string",
      "contactPerson": "string",
      "mobile": "string",
      "email": "string | null",
      "reraNumber": "string | null",
      "commissionPct": "number",
      "rating": "number",
      "totalCommission": "number (rupees)",
      "pendingCommission": "number (rupees)",
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

> `commissionPct` and `rating` are plain Numbers. `totalCommission` and `pendingCommission` are in **rupees**.

---

### 2. Get Agent

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/agents/:id` |
| **Permission** | `agents:read` |

**Response `200`**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "agentCode": "string",
    "firmName": "string",
    "contactPerson": "string",
    "mobile": "string",
    "email": "string | null",
    "reraNumber": "string | null",
    "commissionPct": "number",
    "rating": "number",
    "totalCommission": "number (rupees)",
    "pendingCommission": "number (rupees)",
    "isActive": "boolean",
    "createdAt": "ISO datetime",
    "commissions": [
      {
        "id": "uuid",
        "bookingId": "uuid",
        "agreementValue": "number (rupees)",
        "grossCommission": "number (rupees)",
        "gstAmount": "number (rupees)",
        "tdsAmount": "number (rupees)",
        "netPayable": "number (rupees)",
        "paidAmount": "number (rupees)",
        "pendingAmount": "number (rupees)",
        "status": "string",
        "createdAt": "ISO datetime"
      }
    ],
    "commissionSummary": {
      "totalGross": "number (rupees)",
      "totalPaid": "number (rupees)",
      "totalPending": "number (rupees)",
      "totalBookings": "number"
    }
  }
}
```

---

### 3. Create Agent

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/agents` |
| **Permission** | `agents:create` |

**Request Body**

```json
{
  "firmName": "string (required)",
  "contactPerson": "string (required)",
  "mobile": "string (required — unique)",
  "email": "string (optional)",
  "reraNumber": "string (optional)",
  "commissionPct": "number (required — percentage, e.g. 2.5)"
}
```

**Response `201`**

```json
{
  "success": true,
  "message": "...",
  "data": {
    "id": "uuid",
    "agentCode": "string",
    "contactPerson": "string",
    "reraNumber": "string | null",
    "commissionPct": "number"
  }
}
```

---

### 4. Update Agent

| Field | Value |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/v1/agents/:id` |
| **Permission** | `agents:update` |

**Request Body** (all optional)

```json
{
  "firmName": "string",
  "contactPerson": "string",
  "mobile": "string",
  "email": "string",
  "reraNumber": "string",
  "commissionPct": "number",
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
    "agentCode": "string",
    "isActive": "boolean"
  }
}
```

---

### 5. Record Commission Payment

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/agents/:id/commission-payment` |
| **Permission** | `commissions:update` |

> Commission payment can only be recorded when the commission status is `sale_completed` (set automatically after possession completion).

**Request Body**

```json
{
  "commissionId": "uuid (required)",
  "amount": "number (rupees, required — amount being paid now)"
}
```

**Response `201`**

```json
{
  "success": true,
  "message": "...",
  "data": {
    "commissionId": "uuid",
    "amountPaid": "number (rupees)",
    "newPaidAmount": "number (rupees)",
    "newPendingAmount": "number (rupees)",
    "commissionStatus": "paid | partially_paid"
  }
}
```

---

### 6. Rate Agent

| Field | Value |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/v1/agents/:id/rating` |
| **Permission** | `agents:update` |

**Request Body**

```json
{
  "rating": "number (1–5, required)"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "...",
  "data": {
    "id": "uuid",
    "agentCode": "string",
    "rating": "number"
  }
}
```

---

## Commission Statuses

| Status | Description |
|---|---|
| `pending` | Commission record created with booking |
| `sale_completed` | Possession handed over — commission eligible for payment |
| `partially_paid` | Partial payment recorded |
| `paid` | Fully paid |

---

## Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `NOT_FOUND` | 404 | Agent or commission not found |
| `CONFLICT` | 409 | Mobile already in use |
| `BUSINESS_RULE_ERROR` | 409 | Commission not yet eligible for payment |
| `FORBIDDEN` | 403 | Insufficient permission |

---

## Notes for Frontend Developers

- `commissionPct` is stored as a plain percentage number (e.g., `2.5` means 2.5%).
- Commission payments require `commissions:update` permission (finance role).
- `commissionStatus` after payment will be `paid` (fully settled) or `partially_paid` (balance remains).
- `commissions` array in `GET /v1/agents/:id` shows all commission records for that agent — all monetary fields are in **rupees**.
- The `agentCode` is auto-generated on creation.
