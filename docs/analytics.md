# Analytics Module — API Reference

> **Verified:** Traced from source files on 2026-03-11. Response shapes reflect actual runtime output.

> **Base Path:** `/v1/analytics`
> **Auth Required:** Yes (`Authorization: Bearer <token>` + `x-organization-id`)
> **Rate Limiter:** `analyticsRateLimiter` (separate from `orgRateLimiter` — more restrictive)
> **Service:** `src/modules/analytics/analytics.service.js`

---

## Overview

Provides aggregated business intelligence. Three endpoints: executive dashboard (KPIs), sales analytics (bookings by project/config/trend), and collection analytics (payments by mode and overdue demand letters). Dashboard results are cached in Redis for 5 minutes. All monetary values in rupees.

---

## Endpoints

### 1. Executive Dashboard

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/analytics/dashboard` |
| **Permission** | `analytics:read` |

> Results cached in Redis for 5 minutes. `cached: true` in response indicates a cache hit.

**Response `200`**

```json
{
  "success": true,
  "data": {
    "generatedAt": "ISO datetime",
    "inventory": {
      "total": "number",
      "available": "number",
      "blocked": "number",
      "booked": "number",
      "registered": "number",
      "possession_handed": "number",
      "soldPct": "number (% of units sold — booked + registered + possession_handed)"
    },
    "bookings": {
      "total": "number (all non-cancelled)",
      "thisMonth": "number",
      "cancelled": "number"
    },
    "revenue": {
      "totalBookingValue": "number (rupees — sum of finalValue for active bookings)",
      "monthlyBookingValue": "number (rupees — bookings this month)",
      "totalCollected": "number (rupees — sum of cleared payments all time)"
    },
    "leads": {
      "total": "number",
      "new": "number",
      "contacted": "number",
      "site_visit_done": "number",
      "won": "number",
      "lost": "number",
      "conversionRate": "number (% — won / total * 100)"
    },
    "complaints": {
      "open": "number (open + in_progress + escalated)",
      "slaBreached": "number (breached and not resolved/closed)"
    }
  },
  "cached": "boolean"
}
```

> No query parameters — dashboard is org-wide.

---

### 2. Sales Analytics

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/analytics/sales` |
| **Permission** | `analytics:read` |

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `from` | ISO datetime | Date range start (default: start of current month) |
| `to` | ISO datetime | Date range end (default: now) |

**Response `200`**

```json
{
  "success": true,
  "data": {
    "period": {
      "from": "ISO datetime",
      "to": "ISO datetime"
    },
    "byProject": [
      {
        "projectId": "uuid",
        "projectName": "string",
        "projectCode": "string",
        "bookings": "number",
        "revenue": "number (rupees)"
      }
    ],
    "monthlyTrend": [
      {
        "month": "string (e.g. 'Mar 2026' — last 6 months, en-IN locale)",
        "bookings": "number",
        "revenue": "number (rupees)"
      }
    ],
    "byConfig": [
      {
        "config": "BHK_1 | BHK_2 | BHK_3 | BHK_4 | Penthouse",
        "status": "booked | registered | possession_handed",
        "count": "number"
      }
    ]
  }
}
```

> `monthlyTrend` always returns last 6 months regardless of the `from`/`to` range. `byConfig` counts units currently in sold statuses (not historical bookings).

---

### 3. Collection Analytics

| Field | Value |
|---|---|
| **Method** | `GET` |
| **Path** | `/v1/analytics/collections` |
| **Permission** | `analytics:read` |

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `from` | ISO datetime | Date range start (default: start of current month) |
| `to` | ISO datetime | Date range end (default: now) |

**Response `200`**

```json
{
  "success": true,
  "data": {
    "period": {
      "from": "ISO datetime",
      "to": "ISO datetime"
    },
    "totalCollected": "number (rupees — cleared payments in period)",
    "byMode": [
      {
        "mode": "cash | cheque | neft | rtgs | upi | imps | dd",
        "status": "cleared | pending | bounced",
        "count": "number",
        "amount": "number (rupees)"
      }
    ],
    "overdue": {
      "count": "number",
      "totalAmount": "number (rupees — sum of remaining on overdue demand letters)",
      "letters": [
        {
          "id": "uuid",
          "letterCode": "string",
          "demandAmount": "number (rupees)",
          "remaining": "number (rupees)",
          "dueDate": "ISO datetime"
        }
      ]
    }
  }
}
```

> `byMode` groups by both `paymentMode` and `status` — a single mode may appear multiple times (once per status). `overdue.letters` lists all currently-overdue demand letters (no pagination).

---

## Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid query parameters |
| `FORBIDDEN` | 403 | `analytics:read` permission required |
| `RATE_LIMIT_EXCEEDED` | 429 | Analytics rate limit exceeded |

---

## Notes for Frontend Developers

- Analytics endpoints use a **dedicated rate limiter** (`analyticsRateLimiter`) — avoid polling. Cache results client-side.
- All monetary values are in **rupees**.
- Dashboard `cached: true` means Redis served the response — no DB queries were made.
- `inventory.soldPct` = `(booked + registered + possession_handed) / total * 100`.
- `leads.conversionRate` = `won / total * 100`.
- `byConfig` in sales analytics has one row per `(config, status)` combination — aggregate by `config` in the UI if you want a single count per configuration type.
- `byMode` in collections has one row per `(mode, status)` combination — filter for `status: 'cleared'` to get actual collected amounts by payment mode.
- `overdue.letters` is not paginated — it returns all overdue demand letters. Filter/page client-side for large lists.
