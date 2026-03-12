# Loans Module — API Reference

> **Verified:** Traced from source files on 2026-03-11. Response shapes reflect actual runtime output.

> **Base Path:** `/v1/loans`
> **Auth Required:** Yes (`Authorization: Bearer <token>` + `x-organization-id`)
> **Service:** `src/modules/loans/loan.service.js`

---

## Overview

Tracks home loan records linked to bookings. Only one active loan per booking (status not `rejected`). Disbursements are tracked as a JSONB array inside the loan record — there is no separate disbursement table. EMI is auto-calculated using the standard formula if not provided. Sanctioned amount cannot exceed the booking's final value.

---

## Loan Status Lifecycle

| Status | Description |
|---|---|
| `applied` | Loan application submitted |
| `sanctioned` | Loan approved by bank |
| `disbursing` | Partial disbursement in progress |
| `fully_disbursed` | All funds disbursed |
| `rejected` | Loan application rejected |

---

## Endpoints

### 1. List Loans

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/loans` |
| **Permission** | `loans:read` |

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `bookingId` | UUID | Filter by booking |
| `customerId` | UUID | Filter by customer |
| `status` | string | Filter by loan status |
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Items per page (default: 20) |

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "bookingId": "uuid",
      "customerId": "uuid",
      "bankName": "string",
      "loanAmount": "number (rupees)",
      "sanctionedAmount": "number (rupees)",
      "interestRate": "number (annual rate, plain Number)",
      "tenureMonths": "number",
      "status": "string",
      "disbursements": "array (JSONB — disbursement entries)",
      "sanctionDate": "ISO datetime | null",
      "createdAt": "ISO datetime",
      "disbursedAmount": "number (rupees — computed from disbursements array)"
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

> `loanAmount`, `sanctionedAmount`, `disbursedAmount` in **rupees**. `disbursedAmount` is computed by summing the `disbursements` JSONB array.

---

### 2. Get Loan

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/loans/:id` |
| **Permission** | `loans:read` |

**Response `200`**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "bookingId": "uuid",
    "customerId": "uuid",
    "bankName": "string",
    "loanAmount": "number (rupees)",
    "sanctionedAmount": "number (rupees)",
    "interestRate": "number",
    "tenureMonths": "number",
    "status": "string",
    "disbursements": [
      {
        "amount": "number (stored as Number in paise internally)",
        "disbursementDate": "ISO datetime",
        "transactionRef": "string | null",
        "remarks": "string | null",
        "recordedBy": "uuid",
        "recordedAt": "ISO datetime"
      }
    ],
    "sanctionDate": "ISO datetime | null",
    "remarks": "string | null",
    "createdAt": "ISO datetime",
    "disbursedAmount": "number (rupees)",
    "remainingToDisbursе": "number (rupees — sanctionedAmount - disbursedAmount)",
    "disbursementPct": "number (percentage disbursed)"
  }
}
```

---

### 3. Create Loan

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/loans` |
| **Permission** | `loans:create` |

**Request Body**

```json
{
  "bookingId": "uuid (required)",
  "customerId": "uuid (required)",
  "bankName": "string (required)",
  "sanctionedAmount": "number (rupees, required — cannot exceed booking finalValue)",
  "interestRate": "number (required — annual rate, e.g. 8.5 for 8.5%)",
  "tenureMonths": "number (required — e.g. 240 for 20 years)",
  "sanctionDate": "ISO datetime (optional)",
  "remarks": "string (optional)",
  "emiAmount": "number (rupees, optional — auto-calculated if not provided)"
}
```

**Business Rules:**
- One active loan per booking (status not `rejected`)
- `sanctionedAmount` cannot exceed booking `finalValue`
- EMI auto-calculated: `P × r × (1+r)^n / ((1+r)^n - 1)` where `r` = monthly rate

> **Note:** Fields `unitId`, `loanAccountNumber`, `branchName`, `loanOfficer`, `loanOfficerMobile` are silently ignored — they do not exist in the `LoanRecord` schema.

**Response `201`**

```json
{
  "success": true,
  "message": "Loan record created. Calculated EMI: ₹XX,XXX/month.",
  "data": {
    "id": "uuid",
    "bankName": "string",
    "sanctionedAmount": "number (rupees)",
    "calculatedEmi": "number (rupees)",
    "tenureMonths": "number",
    "status": "applied"
  }
}
```

---

### 4. Update Loan

| Field | Value |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/v1/loans/:id` |
| **Permission** | `loans:update` |

> Only `bankName`, `remarks`, and `sanctionDate` can be updated. Cannot update a rejected loan.

**Request Body** (all optional)

```json
{
  "bankName": "string",
  "remarks": "string",
  "sanctionDate": "ISO datetime"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Loan record updated successfully.",
  "data": {
    "id": "uuid",
    "bankName": "string",
    "status": "string"
  }
}
```

---

### 5. Record Disbursement

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/loans/:id/disbursement` |
| **Permission** | `loans:update` |

**Request Body**

```json
{
  "amount": "number (rupees, required)",
  "disbursementDate": "ISO datetime (required)",
  "transactionRef": "string (optional)",
  "remarks": "string (optional)"
}
```

**Business Rules:**
- Total disbursed cannot exceed `sanctionedAmount`
- Status auto-updates: `disbursing` (partial) or `fully_disbursed` (complete)

**Response `200`**

```json
{
  "success": true,
  "message": "Disbursement of ₹X,XX,XXX recorded. ₹X,XX,XXX remaining.",
  "data": {
    "loanId": "uuid",
    "disbursedAmount": "number (rupees — this disbursement amount)",
    "totalDisbursed": "number (rupees — cumulative total)",
    "remainingToDisbursе": "number (rupees)",
    "loanStatus": "disbursing | fully_disbursed",
    "fullyDisbursed": "boolean"
  }
}
```

---

### 6. Update Loan Status

| Field | Value |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/v1/loans/:id/status` |
| **Permission** | `loans:update` |

**Request Body**

```json
{
  "status": "applied | sanctioned | disbursing | fully_disbursed | rejected (required)",
  "remarks": "string (optional)"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Loan status updated from \"applied\" to \"sanctioned\".",
  "data": {
    "id": "uuid",
    "previousStatus": "string",
    "newStatus": "string"
  }
}
```

---

## Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `NOT_FOUND` | 404 | Loan or booking not found |
| `CONFLICT` | 409 | Active loan already exists for booking |
| `BUSINESS_RULE_ERROR` | 422 | Sanctioned amount exceeds booking value, or disbursement exceeds sanctioned |
| `FORBIDDEN` | 403 | Insufficient permission |

---

## Notes for Frontend Developers

- `loanAmount`, `sanctionedAmount`, `disbursedAmount`, `remainingToDisbursе`, `calculatedEmi` are all in **rupees**.
- `interestRate` is annual rate as a plain Number (e.g., `8.5` for 8.5%).
- `PATCH /v1/loans/:id` only accepts `bankName`, `remarks`, `sanctionDate` — other fields are ignored.
- Check `fullyDisbursed` in disbursement response to update UI when loan is fully settled.
- Fields like `loanAccountNumber`, `branchName`, `loanOfficer` are NOT stored — silently dropped if sent.
- The `disbursements` JSONB array `amount` field stores paise as a Number internally — use `disbursedAmount` from the response (rupees) for display.
