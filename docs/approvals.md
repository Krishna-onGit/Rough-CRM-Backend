# Approvals Module — API Reference

> **Verified:** Traced from source files on 2026-03-11. Response shapes reflect actual runtime output.

> **Base Path:** `/v1/approvals`
> **Auth Required:** Yes (`Authorization: Bearer <token>` + `x-organization-id`)
> **Service:** `src/modules/approvals/approval.service.js`

---

## Overview

Manages approval requests for operations requiring authorization. Supported types: `cancellation`, `transfer`, `discount`, `refund`, `possession`. When approved, downstream actions execute atomically in the same transaction (cancellation cascade, transfer cascade). A user cannot review their own request.

---

## Approval Request Types

| requestType | Trigger | Auto-Execute on Approval |
|---|---|---|
| `cancellation` | `POST /v1/cancellations` (auto-created) | Yes — executes cancellation cascade |
| `transfer` | `POST /v1/transfers` (auto-created) | Yes — executes transfer cascade |
| `discount` | Booking with >1% discount (auto-created) | Yes — logs discount confirmation |
| `refund` | Manual | No — informational only |
| `possession` | Manual | No — informational only |

---

## Endpoints

### 1. List Approvals

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/approvals` |
| **Permission** | `approvals:read` |

> Non-admin/finance/operations users see only their own requests automatically.

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `status` | string | `pending`, `approved`, `rejected` |
| `requestType` | string | Filter by type |
| `entityType` | string | Filter by entity type |
| `from` | ISO datetime | Filter by creation date (from) |
| `to` | ISO datetime | Filter by creation date (to) |
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Items per page (default: 20) |

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "requestType": "cancellation | transfer | discount | refund | possession",
      "entityType": "string",
      "entityId": "uuid",
      "requestedBy": "uuid",
      "status": "pending | approved | rejected",
      "justification": "string",
      "requestData": "object",
      "reviewedBy": "uuid | null",
      "reviewedAt": "ISO datetime | null",
      "reviewRemarks": "string | null",
      "createdAt": "ISO datetime",
      "updatedAt": "ISO datetime"
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

### 2. Get Approval

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/approvals/:id` |
| **Permission** | `approvals:read` |

**Response `200`**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "requestType": "string",
    "entityType": "string",
    "entityId": "uuid",
    "requestedBy": "uuid",
    "status": "string",
    "justification": "string",
    "requestData": "object",
    "reviewedBy": "uuid | null",
    "reviewedAt": "ISO datetime | null",
    "reviewRemarks": "string | null",
    "createdAt": "ISO datetime",
    "updatedAt": "ISO datetime",
    "hoursPending": "number | null (null if not in pending status)"
  }
}
```

---

### 3. Create Approval Request

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/approvals` |
| **Permission** | `approvals:create` |

> `cancellation` and `transfer` approvals are auto-created. Use this for manual `refund`, `possession`, or custom workflows.

**Request Body**

```json
{
  "requestType": "cancellation | transfer | discount | refund | possession (required)",
  "entityType": "string (required)",
  "entityId": "uuid (required)",
  "justification": "string (required)",
  "requestData": "object (optional — additional context)"
}
```

**Business Rules:**
- Only one `pending` approval per `entityId` at a time

**Response `201`**

```json
{
  "success": true,
  "message": "Approval request created successfully. Pending review by authorized approver.",
  "data": {
    "id": "uuid",
    "requestType": "string",
    "entityType": "string",
    "entityId": "uuid",
    "status": "pending"
  }
}
```

---

### 4. Review Approval

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/approvals/:id/review` |
| **Permission** | `approvals:approve` |

> Reviewer cannot be the requester. On approval, downstream cascade executes atomically — if cascade fails, approval status is rolled back (both succeed or both fail).

**Request Body**

```json
{
  "status": "approved | rejected (required)",
  "reviewRemarks": "string (optional)"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Approval request has been approved.",
  "data": {
    "approvalId": "uuid",
    "status": "approved | rejected",
    "requestType": "string"
  }
}
```

---

### 5. Get Pending Count

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/approvals/pending-count` |
| **Permission** | `approvals:read` |

> Returns pending counts by type. Used for dashboard badge indicators.

**Response `200`**

```json
{
  "success": true,
  "data": {
    "total": "number",
    "byType": {
      "cancellation": "number",
      "transfer": "number",
      "discount": "number",
      "refund": "number",
      "possession": "number"
    }
  }
}
```

> Not paginated — raw response with no `meta` key.

---

## Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `NOT_FOUND` | 404 | Approval request not found |
| `CONFLICT` | 409 | Pending approval already exists for this entity |
| `BUSINESS_RULE_ERROR` | 422 | Not pending, or reviewer is the requester |
| `FORBIDDEN` | 403 | `approvals:approve` required for reviewing |

---

## Notes for Frontend Developers

- `hoursPending` in `GET /v1/approvals/:id` — populated only when status is `pending`.
- `requestData` contains context (booking code, refund amounts, etc.) — display to the reviewer for informed decision-making.
- `GET /v1/approvals/pending-count` is ideal for notification badges and approval queues.
- `approvals:approve` permission is typically restricted to `admin`, `manager`, and `finance` roles.
- Non-admin users automatically see only their own requests — no client-side filtering needed for self-view.
- Approved cancellations and transfers trigger cascades synchronously — expect slightly longer response times.
