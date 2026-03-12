# Transfers Module — API Reference

> **Verified:** Traced from source files on 2026-03-11. Response shapes reflect actual runtime output.

> **Base Path:** `/v1/transfers`
> **Auth Required:** Yes (`Authorization: Bearer <token>` + `x-organization-id`)
> **Service:** `src/modules/postSales/transfer.service.js`

---

## Overview

Manages ownership transfer requests for booked units. Transferring allows the current buyer to transfer their booking to a new customer. Requires a NOC document (`category: 'noc'`) and follows a two-step workflow: initiate (creates transfer + approval request atomically) → process (executes cascade after approval). Booking must be in `booked`, `agreement_done`, or `registered` status.

---

## Transfer Status Lifecycle

| Status | Description |
|---|---|
| `pending_approval` | Transfer request initiated, awaiting approval |
| `executed` | Transfer approved and ownership migrated |
| `rejected` | Transfer request rejected |

---

## Endpoints

### 1. List Transfers

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/transfers` |
| **Permission** | `transfers:read` |

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `bookingId` | UUID | Filter by booking |
| `unitId` | UUID | Filter by unit |
| `status` | string | `pending_approval`, `executed`, `rejected` |
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Items per page (default: 20) |

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "transferCode": "string",
      "bookingId": "uuid",
      "unitId": "uuid",
      "fromCustomerId": "uuid",
      "toCustomerId": "uuid",
      "transferFee": "number (rupees)",
      "status": "pending_approval | executed | rejected",
      "transferDate": "ISO datetime | null",
      "requestedBy": "uuid",
      "approvedBy": "uuid | null",
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

> `transferFee` is converted from paise → rupees via `paiseToRupees`.

---

### 2. Get Transfers by Booking

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/transfers/:id` |
| **Permission** | `transfers:read` |

> **Important:** The `:id` parameter is a **booking ID**, not a transfer ID. This route calls `listTransfers({ bookingId: req.params.id })` internally and returns a paginated list of transfers for that booking.

**Response `200`** — same paginated shape as List Transfers above, filtered to the specified booking.

---

### 3. Initiate Transfer

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/transfers` |
| **Permission** | `transfers:create` |

> Creates transfer record + approval request atomically. Status starts as `pending_approval`. Transfer code format: `TRF-0001`.

**Request Body**

```json
{
  "bookingId": "uuid (required)",
  "unitId": "uuid (required — must match the booking's unit)",
  "toCustomerId": "uuid (required — new owner, must be different from current customer)",
  "transferFee": "number (rupees, optional — defaults to 0)",
  "nocDocumentId": "uuid (required — must be a document with category: 'noc')",
  "remarks": "string (max 500 chars, optional)"
}
```

**Business Rules:**
- Booking must be in `booked`, `agreement_done`, or `registered` status
- `toCustomerId` must differ from current booking customer
- `nocDocumentId` must reference a document with `category: 'noc'` (verified status is NOT checked)
- Only one `pending_approval` or `approved` transfer allowed per booking at a time

**Response `201`**

```json
{
  "success": true,
  "message": "Transfer TRF-0001 initiated. Pending approval.",
  "data": {
    "id": "uuid",
    "transferCode": "string",
    "fromCustomerId": "uuid",
    "toCustomerId": "uuid",
    "transferFee": "number (rupees)",
    "status": "pending_approval",
    "approvalId": "uuid"
  }
}
```

---

### 4. Process Transfer

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/transfers/:id/process` |
| **Permission** | `approvals:approve` |

> Executes the transfer cascade atomically. Also called internally when the linked approval is approved via `POST /v1/approvals/:id/review`.

**Path Parameters**

| Param | Type | Description |
|---|---|---|
| `id` | UUID | Transfer ID (not booking ID) |

**Request Body**

```json
{
  "approvedBy": "uuid (required — approver user ID)",
  "remarks": "string (optional)"
}
```

**Cascade on processing (`TRANSFER_INITIATED`):**
- Booking `customerId` → updated to `toCustomerId`
- All subsequent payments and documents linked to new customer
- Audit log written

**Response `200`**

```json
{
  "success": true,
  "message": "Transfer TRF-0001 executed successfully. Ownership transferred to new customer.",
  "data": {
    "transferCode": "string",
    "fromCustomerId": "uuid",
    "toCustomerId": "uuid",
    "status": "executed",
    "transferDate": "ISO datetime"
  }
}
```

---

## Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `NOT_FOUND` | 404 | Transfer, booking, or customer not found |
| `BUSINESS_RULE_ERROR` | 422 | Booking status ineligible, same customer, no NOC doc, or unit mismatch |
| `CONFLICT` | 409 | Pending/executed transfer already exists for this booking |
| `FORBIDDEN` | 403 | `approvals:approve` required for processing |

---

## Notes for Frontend Developers

- `GET /v1/transfers/:id` — the `:id` is a **booking ID**, not a transfer ID. Returns all transfers for that booking.
- Transfer code format: `TRF-0001` (sequential per org).
- NOC document only requires `category: 'noc'` — the API does **not** check `status: 'verified'`. Enforce verification in the UI before allowing transfer initiation.
- `processCancellation` is also triggered automatically when the linked approval is approved via the Approvals module.
- Final status after processing is `executed` (not `approved`).
- After execution, the booking is re-linked to the new customer. All new payments/documents should reference the new customer ID.
- `transferFee` is in rupees in all responses.
