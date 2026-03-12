# Commissions Module — API Reference

> **Verified:** Traced from source files on 2026-03-11. Response shapes reflect actual runtime output.

> **Note:** There is no dedicated `/v1/commissions` route. Commission functionality is embedded within the **Agents** module.
> **Related Endpoint:** `POST /v1/agents/:id/commission-payment`
> **Service:** `src/modules/agents/agent.service.js`
> **Permission:** `commissions:update`

---

## Overview

Commission records are **automatically created** when a booking is created with an `agentId`. There is no manual endpoint to create commission records. The only action available is recording a payment against an existing commission record.

---

## How Commissions Work

```
1. POST /v1/bookings  (with agentId)
   → Commission record auto-created
   → Amount = agreementValue × agent.commissionPct / 100
   → Status = "pending"

2. POST /v1/agents/:agentId/commission-payment
   → Record partial or full payment against commission
   → Status auto-updates to "partial" or "paid"
```

---

## Commission Payment Endpoint

### Record Commission Payment

| Field | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/v1/agents/:id/commission-payment` |
| **Permission** | `commissions:update` |
| **Full Docs** | See [agents.md](agents.md#5-record-commission-payment) |

**Path Parameters**

| Param | Type | Description |
|---|---|---|
| `id` | UUID | Agent ID |

**Request Body**

```json
{
  "commissionId": "uuid (required — commission record ID to settle)",
  "amountPaid": "number (rupees, positive, required)",
  "paymentMode": "cheque | neft | rtgs | upi | dd | cash (required)",
  "transactionRef": "string (max 100 chars, optional)",
  "remarks": "string (max 500 chars, optional)"
}
```

**Response `201`**

```json
{
  "success": true,
  "message": "Commission payment of ₹X,XX,XXX recorded.",
  "data": {
    "commissionId": "uuid",
    "agentId": "uuid",
    "bookingId": "uuid",
    "totalAmount": "number (rupees)",
    "amountPaid": "number (rupees — cumulative total paid)",
    "balance": "number (rupees — remaining)",
    "status": "partial | paid"
  }
}
```

---

## Retrieving Commission Records

Commission details are accessible through the Agents and Bookings module responses:

| How to Access | Endpoint |
|---|---|
| Get agent with pending commissions | `GET /v1/agents/:id` |
| Get booking with commission detail | `GET /v1/bookings/:id` |

---

## Commission Statuses

| Status | Description |
|---|---|
| `pending` | Commission due, no payment made |
| `partial` | Some payment made, balance remaining |
| `paid` | Fully paid |

---

## Commission Calculation

```
Commission Amount = agreementValue × (commissionPct / 100)
```

- `agreementValue` — booking agreement value
- `commissionPct` — agent's commission percentage (max 10%)

---

## RBAC Notes

| Permission | Required For |
|---|---|
| `agents:read` | View agent with commission info |
| `commissions:update` | Record commission payments |

`commissions:update` is a separate permission from `agents:update`. Ensure Finance/Admin roles have this permission for commission payment operations.

---

## Notes for Frontend Developers

- `commissionId` is obtained from the booking's commission record (`GET /v1/bookings/:id`).
- There is no endpoint to list all commissions across all agents — access commission data through the agent or booking context.
- Commission payment is a finance operation — restrict UI access to Finance Manager or Admin roles only.
- `amountPaid` in the response is the cumulative total paid (not just this payment). `balance` is what remains.
