# Verification Notes — API Documentation Audit

> **Verified:** All 24 module docs re-traced from source files on 2026-03-11.
> This file documents corrections found vs. the original scaffold documentation.

---

## Summary of Corrections Found

The original scaffold docs contained several structural and behavioral errors. All have been corrected in the individual module files.

---

## 1. Pagination Shape (Affects All List Endpoints)

**Old (wrong):**
```json
{ "data": { "items": [...], "pagination": { "total", "page", "limit", "pages" } } }
```

**Correct (`buildPaginatedResponse` output):**
```json
{ "success": true, "data": [...], "meta": { "page", "pageSize", "total", "totalPages", "hasNextPage", "hasPrevPage" } }
```

Key differences:
- `data` is a **top-level array**, not nested under a module-name key
- Pagination key is `meta` (not `pagination`)
- Per-page key is `pageSize` (not `limit`)
- `totalPages` (not `pages`)
- Adds `hasNextPage` and `hasPrevPage` booleans

**Affected:** Every module that had a list endpoint. Fixed in all 24 docs.

---

## 2. Single/Action Response Shapes

**Old (wrong):** Some docs showed `{ "data": { "booking": {...} } }` — nested under the entity name.

**Correct:**
- `buildSingleResponse(data)` → `{ success: true, data: {...} }` (flat)
- `buildActionResponse(data, message)` → `{ success: true, message: "...", data: {...} }` (flat)

**Affected:** Bookings, Payments, Transfers, Possessions, Loans, Cancellations.

---

## 3. Monetary Fields: Rupees vs Paise

All monetary values are **stored in paise (BigInt)** and **exposed in rupees** via `paiseToRupees`. The original docs did not consistently label currency units.

Key corrections:
- `payments.amount` → rupees (not raw paise)
- `cancellation.refundBreakdown.*` → all rupees via `formatRefundForDisplay`
- `loans.loanAmount`, `sanctionedAmount`, `disbursedAmount`, `calculatedEmi` → rupees
- `transfers.transferFee` → rupees
- `analytics.revenue.*`, `analytics.totalCollected`, `analytics.byMode[].amount` → rupees
- `analytics.overdue.totalAmount`, `overdue.letters[].demandAmount/.remaining` → rupees

---

## 4. Transfers Module

**Status values corrected:**
- Old: `pending`, `approved`, `rejected`
- Correct: `pending_approval`, `executed`, `rejected`

**NOC document check corrected:**
- Old doc stated: `nocDocumentId` must be `status: "verified"`
- Correct: service only checks `category: 'noc'` — `status` is NOT checked

**`GET /v1/transfers/:id` clarified:**
- `:id` is a **booking ID**, not a transfer ID
- Route calls `listTransfers({ bookingId: req.params.id })`
- Returns paginated list, not a single transfer object

**`processTransfer` return status corrected:**
- Old: `status: "approved"`
- Correct: `status: "executed"`

---

## 5. Analytics Module

**Dashboard response corrected:**
- Old: `{ summary: { totalProjects, totalUnits, ... }, recentActivity: {...}, unitsByStatus: {...}, topProjects: [...] }`
- Correct: `{ generatedAt, inventory: { total, available, blocked, booked, registered, possession_handed, soldPct }, bookings: { total, thisMonth, cancelled }, revenue: { totalBookingValue, monthlyBookingValue, totalCollected }, leads: { total, new, contacted, site_visit_done, won, lost, conversionRate }, complaints: { open, slaBreached } }`
- Response also includes `cached: boolean` (Redis hit indicator)

**Sales analytics corrected:**
- Old: `{ totals: {...}, trend: [...], byConfig: [...], bySalesPerson: [...] }`
- Correct: `{ period, byProject: [...], monthlyTrend: [...], byConfig: [...] }`
- `monthlyTrend` always returns last 6 months (not scoped by `from`/`to`)
- `byConfig` returns `(config, status, count)` rows — not revenue
- No `bySalesPerson` array exists in the service

**Collections analytics corrected:**
- Old: `{ totals: { totalDemanded, totalCollected, ... }, trend: [...], byPaymentMode: [...], overdueAging: [...] }`
- Correct: `{ period, totalCollected, byMode: [{ mode, status, count, amount }], overdue: { count, totalAmount, letters: [...] } }`
- `byMode` groups by `(paymentMode, status)` — not just mode
- `overdue.letters` contains full demand letter records (not aging buckets)
- No `trend`, `totalDemanded`, `overdueAging` in the service

---

## 6. Audit Log Module

**List endpoint query param clarified:**
- Query param accepted is `userId` (mapped to `actorId` filter internally). Not `actorId`.

**`getEntityAuditTrail` is NOT paginated:**
- Returns raw `{ success: true, data: { entityType, entityId, totalEvents, trail: [...] } }`
- `trail` includes `entityCode` field (was missing in old doc)
- Ordered oldest-first (chronological)

**`getUserActivity` field select corrected:**
- Does NOT include `metadata` or `actorRole` — those fields are excluded from the select
- Use `GET /v1/audit?userId=...` if those fields are needed

---

## 7. Possessions Module

**List response corrected:**
- Old: nested `{ data: { possessions: [...], pagination: {...} } }`
- Correct: flat `{ data: [...], meta: {...} }` via `buildPaginatedResponse`
- Each item includes `_count: { snagItems }` (was not documented)
- Supports `customerId` filter (was missing)

**`getPossession` response corrected:**
- Adds `checklistSummary: { completed, total, percentage }`
- Adds `snagSummary: { total, open, in_progress, resolved }`
- `snagItems` array is embedded (not separate request needed)

**`completePossession` response corrected:**
- Old: `{ data: { possession: { id, status, possessionDate, completedAt } } }`
- Correct: `{ message, data: { possessionId, status, possessionDate, bookingStatusUpdated, unitStatusUpdated, openSnagWarning } }`

**`createSnag` corrected:**
- Cannot add snags to `completed` possession (business rule added)

**`updateSnag` corrected:**
- `resolvedBy` is **required** when setting `status: 'resolved'`
- `resolvedDate` auto-sets to now if resolving without date

**`listSnags` is paginated** (was undocumented in old version).

---

## 8. Loans Module

**Create Loan — silently ignored fields documented:**
- `unitId`, `loanAccountNumber`, `branchName`, `loanOfficer`, `loanOfficerMobile`, `emiAmount`, `disbursedAmount` are NOT in the `LoanRecord` schema — silently dropped if sent

**`updateLoan` corrected:**
- Only `bankName`, `remarks`, `sanctionDate` are accepted — no other fields

**Disbursement fields clarified:**
- `disbursements` JSONB array stores amounts in paise internally
- Use `disbursedAmount` from response (rupees) for display

---

## 9. Communications Module

**`getCommunicationSummary` is NOT paginated:**
- Returns raw `{ success: true, data: { byChannel, byDirection, totalCallDuration } }`
- Zero-count channels may be absent (SQL GROUP BY behavior)

---

## 10. Approvals Module

**`getPendingCount` is NOT paginated:**
- Returns raw `{ success: true, data: { total, byType: {...} } }` — no `meta` key

**Access control clarified:**
- Non-admin/finance/operations users automatically see only their own requests — no client-side filtering needed

---

## 11. Cancellations Module

**Refund breakdown clarified:**
- All monetary fields in `refundBreakdown` are in rupees (via `formatRefundForDisplay`)
- `processCancellation` also triggered automatically when linked approval is approved

---

## 12. Commissions Module

**Response shape corrected:**
- Old: `{ data: { commission: { id, agentId, ... } } }` (nested under `commission`)
- Correct: flat `{ success: true, message, data: { commissionId, agentId, bookingId, totalAmount, amountPaid, balance, status } }`

---

## Files Verified

| Module Doc | Verification Status |
|---|---|
| auth.md | Verified 2026-03-11 |
| projects.md | Verified 2026-03-11 |
| units.md | Verified 2026-03-11 |
| sales-team.md | Verified 2026-03-11 |
| agents.md | Verified 2026-03-11 |
| customers.md | Verified 2026-03-11 |
| leads.md | Verified 2026-03-11 |
| site-visits.md | Verified 2026-03-11 |
| follow-ups.md | Verified 2026-03-11 |
| bookings.md | Verified 2026-03-11 |
| payments.md | Verified 2026-03-11 |
| demand-letters.md | Verified 2026-03-11 |
| documents.md | Verified 2026-03-11 |
| complaints.md | Verified 2026-03-11 |
| communications.md | Verified 2026-03-11 |
| approvals.md | Verified 2026-03-11 |
| loans.md | Verified 2026-03-11 |
| cancellations.md | Verified 2026-03-11 |
| transfers.md | Verified 2026-03-11 |
| possessions.md | Verified 2026-03-11 |
| analytics.md | Verified 2026-03-11 |
| audit-log.md | Verified 2026-03-11 |
| system-health.md | Verified 2026-03-11 |
| commissions.md | Verified 2026-03-11 |
