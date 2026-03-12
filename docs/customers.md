# Customers Module — API Reference

> **Verified:** Traced from source files on 2026-03-10. Response shapes reflect actual runtime output.

> **Base Path:** `/v1/customers`
> **Auth Required:** Yes (`Authorization: Bearer <token>` + `x-organization-id`)
> **Service:** `src/modules/customers/customer.service.js`

---

## Overview

Manages customer profiles. Customers are linked to bookings, payments, and documents. PAN number is masked for non-admin/non-finance roles. KYC verification is required before a booking can be created for a customer.

---

## Endpoints

### 1. List Customers

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/customers` |
| **Permission** | `customers:read` |

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `search` | string | Search by name, mobile, or email |
| `kycVerified` | boolean | Filter by KYC status |
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
      "customerCode": "string",
      "fullName": "string",
      "mobilePrimary": "string",
      "email": "string | null",
      "panNumber": "string (masked for non-admin/non-finance: XXXXXX####X)",
      "kycVerified": "boolean",
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

> `panNumber` is masked unless the caller has `admin` or `finance` role.

---

### 2. Get Customer

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/customers/:id` |
| **Permission** | `customers:read` |

**Response `200`**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "customerCode": "string",
    "fullName": "string",
    "mobilePrimary": "string",
    "mobileSecondary": "string | null",
    "email": "string | null",
    "panNumber": "string (masked for non-admin/non-finance)",
    "dateOfBirth": "ISO datetime | null",
    "currentAddress": "string | null",
    "permanentAddress": "string | null",
    "annualIncome": "number (rupees) | null",
    "loanAmount": "number (rupees) | null",
    "kycVerified": "boolean",
    "kycDocuments": "object | null",
    "isActive": "boolean",
    "createdAt": "ISO datetime",
    "bookings": [
      {
        "id": "uuid",
        "bookingCode": "string",
        "unitId": "uuid",
        "projectId": "uuid",
        "status": "string",
        "finalValue": "number (rupees)",
        "bookingDate": "ISO datetime"
      }
    ]
  }
}
```

---

### 3. Create Customer

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/customers` |
| **Permission** | `customers:create` |

**Request Body**

```json
{
  "fullName": "string (required)",
  "mobilePrimary": "string (required — unique)",
  "mobileSecondary": "string (optional)",
  "email": "string (optional)",
  "panNumber": "string (optional — must be unique if provided)",
  "dateOfBirth": "ISO datetime (optional)",
  "currentAddress": "string (optional)",
  "permanentAddress": "string (optional)",
  "annualIncome": "number (rupees, optional)",
  "loanAmount": "number (rupees, optional)"
}
```

**Response `201`** (new customer)

```json
{
  "success": true,
  "message": "...",
  "data": {
    "id": "uuid",
    "customerCode": "string",
    "fullName": "string",
    "mobilePrimary": "string"
  }
}
```

**Response `200`** (PAN already exists — returns existing customer)

```json
{
  "success": true,
  "message": "...",
  "data": {
    "id": "uuid",
    "customerCode": "string",
    "fullName": "string",
    "mobilePrimary": "string",
    "isExisting": true
  }
}
```

> If PAN already exists, returns the existing customer record with HTTP `200` (not `201`). If mobile is duplicate (without PAN match), throws `CONFLICT`.

---

### 4. Update Customer

| Field | Value |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/v1/customers/:id` |
| **Permission** | `customers:update` |

**Request Body** (all optional)

```json
{
  "fullName": "string",
  "mobilePrimary": "string",
  "mobileSecondary": "string",
  "email": "string",
  "currentAddress": "string",
  "permanentAddress": "string",
  "annualIncome": "number (rupees)",
  "loanAmount": "number (rupees)"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "...",
  "data": {
    "id": "uuid",
    "customerCode": "string"
  }
}
```

---

### 5. Verify KYC

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/customers/:id/verify-kyc` |
| **Permission** | `customers:update` |

> Requires customer to have a PAN number on file before KYC can be verified.

**Response `200`**

```json
{
  "success": true,
  "message": "...",
  "data": {
    "id": "uuid",
    "customerCode": "string",
    "kycVerified": true
  }
}
```

---

## KYC Requirements for Booking

A customer must have all of the following fields populated before a booking can be created:
- `fullName`
- `dateOfBirth`
- `mobilePrimary`
- `email`
- `currentAddress`
- `panNumber`

---

## Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `NOT_FOUND` | 404 | Customer not found |
| `CONFLICT` | 409 | Mobile number already in use |
| `BUSINESS_RULE_ERROR` | 422 | PAN required for KYC verification |
| `FORBIDDEN` | 403 | Insufficient permission |

---

## Notes for Frontend Developers

- `panNumber` is **masked** for all roles except `admin` and `finance`. Show the masked version in public views.
- `annualIncome` and `loanAmount` are in **rupees**.
- KYC verification (`POST /verify-kyc`) requires the customer to have `panNumber` set. Prompt users to add PAN first.
- When creating with an existing PAN, the API returns `200` with `isExisting: true` — handle this to avoid creating duplicate records.
- `bookings` array in `GET /v1/customers/:id` — `finalValue` is in **rupees**.
- `customerCode` is auto-generated.
