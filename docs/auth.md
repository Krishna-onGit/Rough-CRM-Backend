# Auth Module — API Reference

> **Verified:** Traced from source files on 2026-03-10. Response shapes reflect actual runtime output.

> **Base Path:** `/v1/auth`
> **Auth Required:** See per-endpoint notes
> **Service:** `src/modules/auth/auth.service.js`

---

## Overview

Handles organization registration, login, token refresh, logout, and current-user lookup. JWT tokens are used with Redis-backed blacklisting on logout.

---

## Endpoints

### 1. Register Organization

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/auth/register` |
| **Auth Required** | No |
| **Rate Limiter** | `authRateLimiter` |

**Request Body**

```json
{
  "organizationName": "string (required)",
  "slug": "string (required — unique org slug)",
  "plan": "string (optional)",
  "fullName": "string (required — first admin user)",
  "email": "string (required)",
  "password": "string (required)",
  "mobile": "string (optional)"
}
```

**Response `201`**

```json
{
  "success": true,
  "message": "...",
  "data": {
    "organization": {
      "id": "uuid",
      "name": "string",
      "slug": "string",
      "plan": "string"
    },
    "user": {
      "id": "uuid",
      "fullName": "string",
      "email": "string",
      "role": "admin"
    },
    "tokens": {
      "accessToken": "string (JWT, 7-day TTL)",
      "refreshToken": "string (JWT, 30-day TTL)"
    }
  }
}
```

---

### 2. Login

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/auth/login` |
| **Auth Required** | No |
| **Rate Limiter** | `authRateLimiter` |

**Request Body**

```json
{
  "email": "string (required)",
  "password": "string (required)",
  "organizationId": "uuid (required)"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "...",
  "data": {
    "user": {
      "id": "uuid",
      "fullName": "string",
      "email": "string",
      "role": "string",
      "organizationId": "uuid"
    },
    "tokens": {
      "accessToken": "string (JWT, 7-day TTL)",
      "refreshToken": "string (JWT, 30-day TTL)"
    }
  }
}
```

> Tokens are nested under `tokens`, NOT returned flat at the data level.

---

### 3. Refresh Tokens

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/auth/refresh` |
| **Auth Required** | No (uses refresh token in body) |
| **Rate Limiter** | `authRateLimiter` |

**Request Body**

```json
{
  "refreshToken": "string (required)"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "...",
  "data": {
    "tokens": {
      "accessToken": "string",
      "refreshToken": "string"
    }
  }
}
```

---

### 4. Logout

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/auth/logout` |
| **Auth Required** | Yes |

**Request Body**

```json
{
  "refreshToken": "string (optional — blacklists refresh token if provided)"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Logged out successfully.",
  "data": {
    "message": "Logged out successfully."
  }
}
```

---

### 5. Get Current User

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/auth/me` |
| **Auth Required** | Yes |

**Response `200`**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "fullName": "string",
    "email": "string",
    "mobile": "string | null",
    "role": "string",
    "isActive": "boolean",
    "lastLoginAt": "ISO datetime | null",
    "permissions": ["string", "..."],
    "organization": {
      "id": "uuid",
      "name": "string",
      "slug": "string",
      "plan": "string"
    }
  }
}
```

---

## Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Missing or invalid fields |
| `UNAUTHORIZED` | 401 | Invalid credentials or expired token |
| `CONFLICT` | 409 | Email or slug already exists |
| `RATE_LIMIT_EXCEEDED` | 429 | Auth rate limit hit |

---

## Notes for Frontend Developers

- Store `accessToken` and `refreshToken` separately. The `accessToken` TTL is 7 days, `refreshToken` is 30 days.
- Call `POST /v1/auth/refresh` with the stored refreshToken when the access token expires (HTTP 401 response).
- After logout, clear both tokens from storage; they are blacklisted in Redis server-side.
- `GET /v1/auth/me` is the authoritative source for user role and permissions — use it to gate UI elements.
- `permissions` array contains specific action strings (e.g., `bookings:create`, `analytics:read`) — check these for fine-grained UI access.
- `x-organization-id` header is required on all protected requests (not on `/auth/register`, `/auth/login`, `/auth/refresh`).
