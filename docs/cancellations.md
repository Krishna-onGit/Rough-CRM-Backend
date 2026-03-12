# Cancellations Module — API Reference

> **Verified:** Traced from source files on 2026-03-11. Response shapes reflect actual runtime output.

> **Base Path:** `/v1/cancellations`
> **Auth Required:** Yes (`Authorization: Bearer <token>` + `x-organization-id`)
> **Service:** `src/modules/postSales/cancellation.service.js`

---

## Overview

Manages booking cancellation requests with automatic refund calculation. Initiating a cancellation creates both a cancellation record and an approval request atomically. Processing (after approval) triggers the `UNIT_CANCELLED` cascade: unit → `available`, booking → `cancelled`, commissions voided. Cannot cancel after possession.

---

## Refund Calculation Rules

Forfeiture percentage based on booking lifecycle stage:

| Booking Status at Cancellation | Default Forfeiture % |
|---|---|
| `booked` or `token_received` | 2% |
| `agreement_done` | 5% |
| `registered` | 10% |

Additional deductions: GST on forfeiture (18%), TDS (1% of total received), brokerage recovery (50% of agent commission), admin fee (₹5,000 default).

---

## Endpoints

### 1. List Cancellations

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/cancellations` |
| **Permission** | `cancellations:read` |

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `refundStatus` | string | Filter by refund status |
| `from` | ISO datetime | Filter by cancellation date (from) |
| `to` | ISO datetime | Filter by cancellation date (to) |
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Items per page (default: 20) |

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "cancelCode": "string",
      "bookingId": "uuid",
      "unitId": "uuid",
      "customerId": "uuid",
      "cancellationDate": "ISO datetime",
      "reason": "string",
      "totalReceived": "number (rupees)",
      "forfeiturePct": "number",
      "forfeitureAmt": "number (rupees)",
      "netRefund": "number (rupees)",
      "refundStatus": "string",
      "refundDate": "ISO datetime | null",
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

### 2. Get Cancellation Preview

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/cancellations/preview/:bookingId` |
| **Permission** | `cancellations:read` |

> Shows refund breakdown **before** initiating. Use to display what the customer will receive.

**Response `200`**

```json
{
  "success": true,
  "data": {
    "bookingId": "uuid",
    "bookingCode": "string",
    "bookingStatus": "string",
    "refundBreakdown": {
      "totalReceived": "number (rupees)",
      "forfeiturePct": "number",
      "forfeitureAmt": "number (rupees)",
      "gstDeduction": "number (rupees)",
      "tdsDeduction": "number (rupees)",
      "brokerageRecovery": "number (rupees)",
      "adminFee": "number (rupees)",
      "netRefund": "number (rupees)",
      "currency": "INR"
    }
  }
}
```

---

### 3. Initiate Cancellation

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/cancellations` |
| **Permission** | `cancellations:create` |

> Creates cancellation record + approval request atomically. Status starts as `pending_approval`. Refund auto-calculated.

**Request Body**

```json
{
  "bookingId": "uuid (required)",
  "reason": "string (required)",
  "requestedBy": "uuid (optional — defaults to logged-in user)"
}
```

**Business Rules:**
- Booking must not be already cancelled or in `possession_handed` status
- Only one pending cancellation allowed per booking

**Response `201`**

```json
{
  "success": true,
  "message": "Cancellation CAN-0001 initiated. Pending approval.",
  "data": {
    "id": "uuid",
    "cancelCode": "string",
    "refundBreakdown": {
      "totalReceived": "number (rupees)",
      "forfeiturePct": "number",
      "forfeitureAmt": "number (rupees)",
      "gstDeduction": "number (rupees)",
      "tdsDeduction": "number (rupees)",
      "brokerageRecovery": "number (rupees)",
      "adminFee": "number (rupees)",
      "netRefund": "number (rupees)",
      "currency": "INR"
    },
    "approvalId": "uuid",
    "status": "pending_approval"
  }
}
```

---

### 4. Process Cancellation

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/cancellations/:id/process` |
| **Permission** | `approvals:approve` |

> Processes after approval. Triggers `UNIT_CANCELLED` cascade atomically. Also called internally when the linked approval is approved via `POST /v1/approvals/:id/review`.

**Request Body**

```json
{
  "forfeiturePct": "number (required — approved forfeiture percentage)",
  "adminFee": "number (rupees, required)",
  "brokerageRecovery": "number (rupees, required)",
  "approvedBy": "uuid (required)",
  "remarks": "string (optional)"
}
```

**Cascade on processing:**
- Booking → `cancelled`
- Unit → `available` (released back to inventory)
- Commission records voided
- Analytics cache invalidated

**Response `200`**

```json
{
  "success": true,
  "message": "Cancellation processed. Unit released back to inventory. Net refund: ₹X,XX,XXX.",
  "data": {
    "cancelCode": "string",
    "netRefund": "number (rupees)",
    "refundStatus": "approved",
    "unitReleased": true,
    "bookingStatus": "cancelled"
  }
}
```

---

## Refund Status Values

| Status | Description |
|---|---|
| `pending` | Cancellation initiated, awaiting approval |
| `approved` | Cancellation approved, refund authorized |
| `paid` | Refund disbursed to customer |

---

## Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `NOT_FOUND` | 404 | Booking or cancellation not found |
| `CONFLICT` | 409 | Already cancelled or pending cancellation exists |
| `BUSINESS_RULE_ERROR` | 422 | Cannot cancel after possession |
| `FORBIDDEN` | 403 | `approvals:approve` required for processing |

---

## Notes for Frontend Developers

- Always call `GET /v1/cancellations/preview/:bookingId` first to show the customer the refund breakdown.
- `cancelCode` format: `CAN-0001` (sequential per org).
- `initiateCancellation` automatically creates an approval request — find it via `GET /v1/approvals?requestType=cancellation`.
- `processCancellation` is also triggered automatically when the linked approval is approved via the Approvals module.
- All monetary fields in `refundBreakdown` are in **rupees**.
- After processing: poll `GET /v1/units/:id` to confirm status returns to `available`.
