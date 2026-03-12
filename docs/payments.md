# Payments Module — API Reference

> **Verified:** Traced from source files on 2026-03-10. Response shapes reflect actual runtime output.

> **Base Path:** `/v1/payments`
> **Auth Required:** Yes (`Authorization: Bearer <token>` + `x-organization-id`)
> **Service:** `src/modules/postSales/payment.service.js`

---

## Overview

Records and tracks payments against bookings. Supports multiple payment modes with auto-clearing for digital payments (UPI/NEFT/RTGS/IMPS). Supports idempotency keys to prevent duplicate submissions. Payment bounce triggers the `PAYMENT_BOUNCED` cascade (auto-creates complaint).

---

## Payment Status Lifecycle

| Status | Description |
|---|---|
| `under_process` | Cheque/demand draft — awaiting bank clearing |
| `cleared` | Payment confirmed |
| `bounced` | Cheque bounced or payment reversed |

**Auto-clearing rules:**
- `upi`, `neft`, `rtgs`, `imps` → created with status `cleared`
- `cheque`, `demand_draft` → created with status `under_process`

---

## Endpoints

### 1. List Payments

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/payments` |
| **Permission** | `payments:read` |

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `bookingId` | UUID | Filter by booking |
| `customerId` | UUID | Filter by customer |
| `unitId` | UUID | Filter by unit |
| `status` | string | Filter by payment status |
| `paymentMode` | string | Filter by mode |
| `from` | ISO datetime | Filter by payment date (from) |
| `to` | ISO datetime | Filter by payment date (to) |
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Items per page (default: 20) |

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "receiptNumber": "string",
      "bookingId": "uuid",
      "customerId": "uuid",
      "unitId": "uuid",
      "amount": "number (rupees)",
      "paymentMode": "string",
      "transactionRef": "string | null",
      "paymentDate": "ISO datetime",
      "status": "under_process | cleared | bounced",
      "bounceReason": "string | null",
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

### 2. Record Payment

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/payments` |
| **Permission** | `payments:create` |

**Request Body**

```json
{
  "bookingId": "uuid (required)",
  "customerId": "uuid (required — must match booking)",
  "unitId": "uuid (required — must match booking)",
  "demandLetterId": "uuid (optional — links payment to demand letter)",
  "amount": "number (rupees, required)",
  "paymentMode": "upi | neft | rtgs | imps | cheque | demand_draft (required)",
  "transactionRef": "string (optional — bank ref or cheque number)",
  "paymentDate": "ISO datetime (required)",
  "remarks": "string (optional)",
  "idempotencyKey": "string (optional — UUID for duplicate prevention)"
}
```

**Business Rules:**
- `customerId` and `unitId` must match the booking record
- Booking must not be cancelled
- Digital modes (upi/neft/rtgs/imps) → status `cleared` immediately
- Physical modes (cheque/demand_draft) → status `under_process`
- If `demandLetterId` provided → demand letter `paidAmount` is updated, status set to `paid` or `partially_paid`

**Response `201`**

```json
{
  "success": true,
  "message": "Payment RCPT-0001 recorded successfully.",
  "data": {
    "id": "uuid",
    "receiptNumber": "string",
    "amount": "number (rupees)",
    "paymentMode": "string",
    "paymentDate": "ISO datetime",
    "status": "cleared | under_process"
  }
}
```

**Response `201`** (idempotent duplicate retry)

```json
{
  "success": true,
  "message": "Payment already recorded (idempotent retry). Receipt: RCPT-0001.",
  "data": {
    "id": "uuid",
    "receiptNumber": "string",
    "amount": "number (rupees)",
    "status": "string",
    "isDuplicate": true
  }
}
```

---

### 3. Update Payment Status

| Field | Value |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/v1/payments/:id/status` |
| **Permission** | `payments:update` |

> Used to mark cheques as cleared or bounced. Cannot update already-cleared payments.

**Request Body**

```json
{
  "status": "cleared | bounced (required)",
  "bounceReason": "string (required when status = 'bounced')",
  "bounceDate": "ISO datetime (optional)"
}
```

**Business Rules:**
- Cannot update a `cleared` payment
- Bouncing reverses the linked demand letter `paidAmount`
- Bouncing triggers `PAYMENT_BOUNCED` cascade (auto-creates complaint)

**Response `200`**

```json
{
  "success": true,
  "message": "Payment status updated to \"bounced\".",
  "data": {
    "id": "uuid",
    "status": "string"
  }
}
```

---

### 4. Get Booking Payment Summary

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/payments/summary/:bookingId` |
| **Permission** | `payments:read` |

**Response `200`**

```json
{
  "success": true,
  "data": {
    "bookingId": "uuid",
    "bookingCode": "string",
    "finalValue": "number (rupees)",
    "totalCollected": "number (rupees — cleared + under_process)",
    "clearedAmount": "number (rupees — only cleared payments)",
    "pendingAmount": "number (rupees — finalValue - clearedAmount)",
    "paymentCount": "number",
    "collectionPct": "number (percentage of finalValue cleared)"
  }
}
```

---

## Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `NOT_FOUND` | 404 | Booking or payment not found |
| `BUSINESS_RULE_ERROR` | 409 | Unit/customer mismatch, or clearing already-cleared payment |
| `FORBIDDEN` | 403 | Insufficient permission |

---

## Notes for Frontend Developers

- All monetary fields are in **rupees**.
- Use `idempotencyKey` (a UUID you generate client-side) on the create request to safely retry on network errors without duplicating payments.
- `receiptNumber` format: `RCPT-0001` (sequential per organization).
- `totalCollected` in payment summary includes `under_process` payments; `clearedAmount` only includes confirmed payments — use `clearedAmount` for financial calculations.
- `collectionPct` = `(clearedAmount / finalValue) * 100`.
- Linking a payment to a `demandLetterId` automatically updates the demand letter status — always link when paying against a demand letter.
