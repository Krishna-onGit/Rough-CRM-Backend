# Bookings Module — API Reference

> **Verified:** Traced from source files on 2026-03-10. Response shapes reflect actual runtime output.

> **Base Path:** `/v1/bookings`
> **Auth Required:** Yes (`Authorization: Bearer <token>` + `x-organization-id`)
> **Service:** `src/modules/salesEngine/booking.service.js`

---

## Overview

Manages the core booking lifecycle. Creating a booking triggers a cascade that creates payment schedules, demand letters, and optionally a commission record. Discounts exceeding 1% of agreementValue auto-create a pending approval request. Booking registration requires both registration date and number.

---

## Booking Status Lifecycle

| Status | Description |
|---|---|
| `booked` | Initial booking created |
| `pending_discount_approval` | Booking created with discount >1% — awaiting approval |
| `agreement_done` | Agreement registered |
| `registered` | Property registration done |
| `possession_handed` | Physical possession completed |
| `cancelled` | Booking cancelled |

---

## Endpoints

### 1. List Bookings

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/bookings` |
| **Permission** | `bookings:read` |

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `projectId` | UUID | Filter by project |
| `unitId` | UUID | Filter by unit |
| `customerId` | UUID | Filter by customer |
| `salesPersonId` | UUID | Filter by sales person |
| `status` | string | Filter by booking status |
| `from` | ISO datetime | Filter by booking date (from) |
| `to` | ISO datetime | Filter by booking date (to) |
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Items per page (default: 20) |

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "bookingCode": "string",
      "unitId": "uuid",
      "projectId": "uuid",
      "customerId": "uuid",
      "salesPersonId": "uuid | null",
      "agentId": "uuid | null",
      "agreementValue": "number (rupees)",
      "finalValue": "number (rupees)",
      "discountAmount": "number (rupees)",
      "tokenAmount": "number (rupees)",
      "paymentMode": "string",
      "status": "string",
      "bookingDate": "ISO datetime",
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

> All monetary fields are in **rupees**.

---

### 2. Get Booking

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/bookings/:id` |
| **Permission** | `bookings:read` |

**Response `200`**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "bookingCode": "string",
    "unitId": "uuid",
    "projectId": "uuid",
    "customerId": "uuid",
    "salesPersonId": "uuid | null",
    "agentId": "uuid | null",
    "agreementValue": "number (rupees)",
    "finalValue": "number (rupees)",
    "discountAmount": "number (rupees)",
    "tokenAmount": "number (rupees)",
    "paymentMode": "string",
    "status": "string",
    "registrationNumber": "string | null",
    "registrationDate": "ISO datetime | null",
    "bookingDate": "ISO datetime",
    "createdAt": "ISO datetime",
    "payments": [
      {
        "id": "uuid",
        "receiptNumber": "string",
        "amount": "number (rupees)",
        "paymentMode": "string",
        "paymentDate": "ISO datetime",
        "status": "string"
      }
    ],
    "commissions": [
      {
        "id": "uuid",
        "agentId": "uuid",
        "grossCommission": "number (rupees)",
        "netPayable": "number (rupees)",
        "status": "string"
      }
    ],
    "demandLetters": [
      {
        "id": "uuid",
        "letterCode": "string",
        "milestoneName": "string",
        "demandAmount": "number (rupees)",
        "paidAmount": "number (rupees)",
        "remaining": "number (rupees)",
        "dueDate": "ISO datetime",
        "status": "string"
      }
    ],
    "paymentSchedules": [
      {
        "id": "uuid",
        "milestoneOrder": "number",
        "milestoneName": "string",
        "amount": "number (rupees)",
        "percentage": "number",
        "dueDate": "ISO datetime | null",
        "status": "string"
      }
    ]
  }
}
```

---

### 3. Create Booking

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/bookings` |
| **Permission** | `bookings:create` |

**Request Body**

```json
{
  "unitId": "uuid (required)",
  "customerId": "uuid (required)",
  "salesPersonId": "uuid (optional)",
  "agentId": "uuid (optional)",
  "agreementValue": "number (rupees, required)",
  "discountAmount": "number (rupees, optional — default: 0)",
  "tokenAmount": "number (rupees, required)",
  "paymentMode": "string (required — e.g., 'cheque', 'upi', 'neft')",
  "bookingDate": "ISO datetime (required)"
}
```

**Business Rules:**
- Unit must be in `blocked` or `token_received` status
- Customer must have complete KYC: `fullName`, `dateOfBirth`, `mobilePrimary`, `email`, `currentAddress`, `panNumber`
- Discount > 1% of `agreementValue` → booking created with status `pending_discount_approval` + approval request auto-created
- `finalValue` = `agreementValue` - `discountAmount`

**Response `201`**

```json
{
  "success": true,
  "message": "...",
  "data": {
    "booking": {
      "id": "uuid",
      "bookingCode": "string",
      "status": "booked | pending_discount_approval",
      "agreementValue": "number (rupees)",
      "finalValue": "number (rupees)",
      "discountAmount": "number (rupees)",
      "tokenAmount": "number (rupees)",
      "bookingDate": "ISO datetime"
    },
    "cascadeResults": "object (payment schedules, demand letters created)"
  }
}
```

---

### 4. Register Booking

| Field | Value |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/v1/bookings/:id/register` |
| **Permission** | `bookings:update` |

> Records property registration details. Auto-creates a possession record upon registration.

**Request Body**

```json
{
  "registrationDate": "ISO datetime (required)",
  "registrationNumber": "string (required)"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "...",
  "data": {
    "bookingId": "uuid",
    "status": "registered",
    "registrationNumber": "string",
    "registrationDate": "ISO datetime"
  }
}
```

---

## Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `NOT_FOUND` | 404 | Booking, unit, or customer not found |
| `UNIT_NOT_AVAILABLE` | 409 | Unit not in blocked or token_received status |
| `KYC_INCOMPLETE` | 422 | Customer KYC not complete |
| `BOOKING_NOT_ACTIVE` | 409 | Booking not in correct status for registration |
| `FORBIDDEN` | 403 | Insufficient permission |

---

## Notes for Frontend Developers

- All monetary fields (`agreementValue`, `finalValue`, `discountAmount`, `tokenAmount`) are in **rupees**.
- Check `status` after creation — if `pending_discount_approval`, the booking is on hold until an admin/manager approves the discount.
- `PATCH /v1/bookings/:id/register` requires **both** `registrationDate` AND `registrationNumber` — both are mandatory.
- Registration auto-creates a possession record — use `GET /v1/possessions?bookingId=:id` to retrieve it.
- KYC must be complete before creating a booking — verify customer KYC via `POST /v1/customers/:id/verify-kyc` if needed.
- `cascadeResults` in the create response contains details of auto-created payment schedules and demand letters.
