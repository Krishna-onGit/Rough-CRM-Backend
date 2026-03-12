# Documents Module — API Reference

> **Verified:** Traced from source files on 2026-03-11. Response shapes reflect actual runtime output.

> **Base Path:** `/v1/documents`
> **Auth Required:** Yes (`Authorization: Bearer <token>` + `x-organization-id`)
> **Service:** `src/modules/documents/document.service.js`

---

## Overview

Manages customer KYC and booking documents. Supports two upload flows: direct registration (provide S3 `fileKey` after uploading externally) and S3 presigned URL flow (get upload URL → upload directly to S3 → confirm). Uploading KYC category documents automatically updates the customer's `kycDocuments` JSON field.

---

## Document Categories

| Category | Description | KYC Category? |
|---|---|---|
| `pan_card` | PAN card | Yes |
| `aadhaar` | Aadhaar card | Yes |
| `photo` | Passport photo | Yes |
| `address_proof` | Address proof | Yes |
| `income_proof` | Income/salary documents | Yes |
| `noc` | No Objection Certificate | No |
| `sale_deed` | Sale deed | No |
| `agreement` | Booking/sale agreement | No |
| `other` | Any other document | No |

---

## Document Status

| Status | Description |
|---|---|
| `pending` | Presigned URL generated, upload not confirmed |
| `uploaded` | File uploaded and registered |
| `verified` | Document verified by staff |
| `rejected` | Document rejected (re-upload required) |

---

## Endpoints

### 1. List Documents

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/documents` |
| **Permission** | `documents:read` |

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `customerId` | UUID | Filter by customer |
| `bookingId` | UUID | Filter by booking |
| `category` | string | Filter by document category |
| `status` | string | Filter by document status |
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Items per page (default: 20) |

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "customerId": "uuid",
      "bookingId": "uuid | null",
      "category": "string",
      "fileName": "string",
      "fileKey": "string (S3 object key)",
      "fileSize": "number (bytes)",
      "mimeType": "string | null",
      "status": "pending | uploaded | verified | rejected",
      "verifiedBy": "uuid | null",
      "remarks": "string | null",
      "createdAt": "ISO datetime",
      "downloadUrl": "string (/v1/documents/:id/download)"
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

> `downloadUrl` is a placeholder path — call `GET /v1/documents/:id/download` to get a fresh presigned S3 URL.

---

### 2. Upload Document (Direct Registration)

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/documents` |
| **Permission** | `documents:create` |

> Use when you already have the `fileKey` from a prior S3 upload. For the presigned URL flow, use `POST /v1/documents/upload-url` instead.

**Request Body**

```json
{
  "customerId": "uuid (required)",
  "bookingId": "uuid (optional)",
  "category": "string (required)",
  "fileName": "string (required)",
  "fileKey": "string (required — S3 object key)",
  "fileSize": "number (bytes, required)",
  "mimeType": "string (optional)",
  "remarks": "string (optional)"
}
```

**Response `201`**

```json
{
  "success": true,
  "message": "Document \"filename.pdf\" uploaded successfully.",
  "data": {
    "id": "uuid",
    "category": "string",
    "fileName": "string",
    "fileSize": "number (bytes)",
    "status": "uploaded"
  }
}
```

---

### 3. Get Upload URL (Presigned S3 Flow — Step 1)

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/documents/upload-url` |
| **Permission** | `documents:create` |

> Returns a presigned S3 PUT URL (5 min expiry) and creates a `pending` document record. After uploading to S3, call `POST /v1/documents/:id/confirm`.

**Request Body**

```json
{
  "customerId": "uuid (required)",
  "category": "string (required)",
  "fileName": "string (required)",
  "contentType": "string (required — MIME type, e.g., 'application/pdf')"
}
```

**Response `201`**

```json
{
  "success": true,
  "message": "Upload URL generated. Upload the file directly to S3, then call POST /v1/documents/:id/confirm to activate.",
  "data": {
    "documentId": "uuid",
    "uploadUrl": "string (presigned S3 PUT URL, expires in 5 min)",
    "fileKey": "string",
    "expiresInSeconds": 300
  }
}
```

---

### 4. Confirm Upload (Presigned S3 Flow — Step 2)

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/documents/:id/confirm` |
| **Permission** | `documents:create` |

> Call after successfully uploading to S3. Changes document status from `pending` to `uploaded`.

**Response `200`**

```json
{
  "success": true,
  "message": "Document upload confirmed successfully.",
  "data": {
    "documentId": "uuid",
    "status": "uploaded"
  }
}
```

---

### 5. Get Download URL

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/documents/:id/download` |
| **Permission** | `documents:read` |

> Returns a presigned S3 download URL (1 hour expiry). Only available for `uploaded` or `verified` documents.

**Response `200`**

```json
{
  "success": true,
  "message": "Download URL generated. URL expires in 1 hour.",
  "data": {
    "documentId": "uuid",
    "downloadUrl": "string (presigned S3 URL, expires in 1 hour)",
    "fileName": "string",
    "expiresInSeconds": 3600
  }
}
```

---

### 6. Verify / Reject Document

| Field | Value |
|---|---|
| **Method** | `PATCH` |
| **Path** | `/v1/documents/:id/verify` |
| **Permission** | `documents:verify` |

> Can only act on documents in `uploaded` status.

**Request Body**

```json
{
  "status": "verified | rejected (required)",
  "remarks": "string (optional — reason for rejection)"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Document \"filename.pdf\" verified.",
  "data": {
    "id": "uuid",
    "fileName": "string",
    "status": "verified | rejected",
    "verifiedBy": "uuid"
  }
}
```

---

## Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `NOT_FOUND` | 404 | Document, customer, or booking not found |
| `BUSINESS_RULE_ERROR` | 422 | Document not in `uploaded` status for verification; or not uploaded for download |
| `FORBIDDEN` | 403 | Insufficient permission |

---

## Notes for Frontend Developers

- **Two upload flows:** (1) Direct — upload to S3 yourself → `POST /v1/documents` with `fileKey`. (2) Presigned — `POST /v1/documents/upload-url` → PUT to S3 → `POST /v1/documents/:id/confirm`.
- Never use `downloadUrl` from the list response directly — call `GET /v1/documents/:id/download` for a fresh presigned URL.
- Upload `pan_card`, `aadhaar`, `photo`, `address_proof`, `income_proof` to satisfy KYC — these auto-update the customer's `kycDocuments` JSON.
- For transfers: upload a `noc` category document before initiating — the transfer API requires `category: 'noc'`.
- `verifiedBy` is the UUID of the staff user who verified the document.
- `fileSize` is in bytes (Number, not BigInt).
