# Demand Letters Module — API Reference

> **Verified:** Traced from source files on 2026-03-10. Response shapes reflect actual runtime output.

> **Base Path:** `/v1/demand-letters`
> **Auth Required:** Yes (`Authorization: Bearer <token>` + `x-organization-id`)
> **Service:** `src/modules/postSales/demandLetter.service.js`

---

## Overview

Manages payment demand notices issued to customers at project construction milestones. Demand letters track milestone-based payment due dates. When a payment is recorded against a demand letter, its `paidAmount` and status are auto-updated. Reminders are throttled to once per 24 hours.

---

## Demand Letter Status

| Status | Description |
|---|---|
| `pending` | Due but no payments received |
| `partially_paid` | Some payment received |
| `paid` | Fully paid |
| `overdue` | Past due date with outstanding balance |

---

## Endpoints

### 1. List Demand Letters

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/demand-letters` |
| **Permission** | `demandLetters:read` |

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `bookingId` | UUID | Filter by booking |
| `customerId` | UUID | Filter by customer |
| `status` | string | Filter by status |
| `from` | ISO datetime | Filter by due date (from) |
| `to` | ISO datetime | Filter by due date (to) |
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Items per page (default: 20) |

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "letterCode": "string",
      "bookingId": "uuid",
      "customerId": "uuid",
      "unitId": "uuid",
      "milestoneName": "string",
      "milestonePct": "number",
      "demandAmount": "number (rupees)",
      "paidAmount": "number (rupees)",
      "remaining": "number (rupees)",
      "dueDate": "ISO datetime",
      "status": "string",
      "reminderCount": "number",
      "lastReminder": "ISO datetime | null",
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

> `milestonePct` is a plain Number. `demandAmount`, `paidAmount`, `remaining` are in **rupees**.

---

### 2. Get Demand Letter

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/demand-letters/:id` |
| **Permission** | `demandLetters:read` |

**Response `200`**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "letterCode": "string",
    "bookingId": "uuid",
    "customerId": "uuid",
    "unitId": "uuid",
    "milestoneName": "string",
    "milestonePct": "number",
    "demandAmount": "number (rupees)",
    "paidAmount": "number (rupees)",
    "remaining": "number (rupees)",
    "dueDate": "ISO datetime",
    "status": "string",
    "reminderCount": "number",
    "lastReminder": "ISO datetime | null",
    "createdAt": "ISO datetime",
    "paymentSchedules": [
      {
        "id": "uuid",
        "milestoneOrder": "number",
        "milestoneName": "string",
        "percentage": "number",
        "amount": "number (rupees)",
        "status": "string",
        "dueDate": "ISO datetime | null"
      }
    ]
  }
}
```

---

### 3. Create Demand Letter

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/demand-letters` |
| **Permission** | `demandLetters:create` |

> Demand letters are also auto-created by the booking cascade. Use this endpoint to manually create additional milestone-based demands.

**Request Body**

```json
{
  "bookingId": "uuid (required)",
  "customerId": "uuid (required)",
  "unitId": "uuid (required)",
  "milestoneName": "string (required — e.g., 'Foundation Completion')",
  "milestonePct": "number (required — percentage of total value)",
  "demandAmount": "number (rupees, required)",
  "dueDate": "ISO datetime (required)"
}
```

**Business Rules:**
- Booking must exist and not be cancelled
- `letterCode` is auto-generated: format `DL-{bookingCode}-{nn}` (sequential per booking)

**Response `201`**

```json
{
  "success": true,
  "message": "Demand letter DL-BK-0001-01 created successfully.",
  "data": {
    "id": "uuid",
    "letterCode": "string",
    "milestoneName": "string",
    "demandAmount": "number (rupees)",
    "dueDate": "ISO datetime",
    "status": "pending"
  }
}
```

---

### 4. Send Reminder

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/demand-letters/:id/reminder` |
| **Permission** | `demandLetters:update` |

> Sends a payment reminder for the demand letter. Throttled to once every 24 hours. Cannot send reminder for a fully paid letter.

**Response `200`**

```json
{
  "success": true,
  "message": "Reminder #2 sent for DL-BK-0001-01.",
  "data": {
    "id": "uuid",
    "letterCode": "string",
    "reminderCount": "number",
    "lastReminder": "ISO datetime"
  }
}
```

---

## Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `NOT_FOUND` | 404 | Demand letter or booking not found |
| `BUSINESS_RULE_ERROR` | 422 | Reminder throttled (24h) or letter already paid |
| `FORBIDDEN` | 403 | Insufficient permission |

---

## Notes for Frontend Developers

- `demandAmount`, `paidAmount`, and `remaining` are in **rupees**. `milestonePct` is a plain Number.
- `letterCode` format: `DL-{bookingCode}-{nn}` (e.g., `DL-BK-0001-01`).
- To link a payment to a demand letter, pass `demandLetterId` in `POST /v1/payments` — the demand letter status is auto-updated.
- Reminder throttling: check `lastReminder` and compare to current time. The API will reject if < 24 hours have passed.
- `remaining` = `demandAmount` - `paidAmount`. Do not compute this client-side — use the value from the API.
- `overdue` status is set by the `demandOverdue.job.js` background job automatically.
- `paymentSchedules` in `GET /v1/demand-letters/:id` shows the linked milestone plan — `amount` and `percentage` are converted to rupees and Number respectively.
