# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.15.2] — 2026-03-04

### 📁 Phase 15C — S3 Documents & Notification Worker
> **Scope:** Presigned URL document pipeline, real email/SMS
> delivery, notification retry config.
> **Status:** ✅ Complete

**Dependencies added:**
- @aws-sdk/client-s3, @aws-sdk/s3-request-presigner
- @sendgrid/mail
- axios

**Schema changes:**
- Added to CustomerDocument: contentType String?,
  confirmedAt DateTime?, confirmedBy String?,
  uploadedBy String?
- Added 'pending' to DocumentStatus enum
- Migrations: add_document_upload_fields, add_uploadedBy

**New files:**
- `src/config/s3.js` — S3Client with ap-south-1 default.
  buildFileKey(): deterministic collision-resistant key
  format {orgId}/documents/{customerId}/{category}/{uuid}-
  {sanitizedFilename}. generateUploadUrl(): presigned PUT,
  5 min expiry. generateDownloadUrl(): presigned GET, 1hr
  expiry. deleteFile(): S3 object deletion. File bytes
  never flow through Express server.
- `src/integrations/email.js` — SendGrid transactional
  email. Returns false if API key not configured. Re-throws
  on failure so BullMQ retry triggers. Required only in
  production via env.js superRefine.
- `src/integrations/sms.js` — MSG91 transactional SMS.
  DEV MODE: logs instead of sending when
  NODE_ENV=development. Re-throws on failure. MSG91
  credentials fully optional (never blocks boot).

**Modified files:**
- `src/modules/documents/document.service.js` — Added
  getUploadUrl() (creates pending record + presigned PUT),
  confirmUpload() (pending → uploaded), getDownloadUrl()
  (generates presigned GET, rejects pending docs with 404).
- `src/modules/documents/document.routes.js` — Added
  POST /upload-url, POST /:id/confirm, GET /:id/download,
  all behind requireAuth.
- `src/jobs/notificationWorker.js` — Replaced commented
  stubs with real sendEmail() + sendSMS() calls.
  NOTIFICATION_TEMPLATES complete with 10 types: 
  BOOKING_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_BOUNCED,
  BOOKING_CANCELLED, TRANSFER_COMPLETED,
  POSSESSION_COMPLETED, REGISTRATION_COMPLETED,
  SLA_BREACHED, APPROVAL_ESCALATED, APPROVAL_PENDING.
  SMS uses DEV MODE bypass. Email re-throws for retry.
- `src/jobs/notificationDispatch.js` — Queue updated with
  attempts: 5, backoff: exponential 2s delay.
- `src/server.js` — Imported notificationWorker.js for
  auto-attach on boot.
- `src/config/env.js` — superRefine() enforces AWS_* and
  SENDGRID_* required in production only. MSG91 optional.

**Verified:**
- Full upload → confirm → download flow via S3
- Pending document download rejected with 404
- DEV MODE SMS log confirmed: [SMS] DEV MODE — not sending
- BullMQ exponential backoff confirmed under 401 failure
- Retry: attempts 5, delay 2s exponential

---

## [0.15.1] — 2026-03-04

### 🔐 Phase 15B — Connection Pool, JWT Race Fix & Cleanup
> **Scope:** Prisma pool hardening, refresh token family
> pattern, duplicate stub removal.
> **Status:** ✅ Complete

**Modified files:**
- `src/config/database.js` — PrismaClient updated to use
  emit: 'event' for warn/error levels. prisma.$on('warn')
  and prisma.$on('error') route through structured logger.
  process.on('beforeExit') triggers prisma.$disconnect()
  for graceful pool release on restart.
  .env instruction: append ?connection_limit=25&pool_timeout=10
  to DATABASE_URL. Add &pgbouncer=true if using Supabase
  or PgBouncer.
- `src/modules/auth/auth.service.js` — family field added
  to refresh token payload (was missing). refreshToken()
  now checks Redis family cache key
  refresh:family:{family} before blacklist check. On cache
  hit: returns same token pair (idempotent — handles
  concurrent tab refresh). On miss: generates new pair,
  stores in family cache with 30s TTL, blacklists old
  token. Redis set() uses { ex: N } format matching
  existing codebase pattern.

**Deleted files (confirmed stubs, no imports):**
- src/modules/salesEngine/agent.routes.js
- src/modules/salesEngine/agent.service.js
- src/modules/salesEngine/salesTeam.routes.js
- src/modules/salesEngine/salesTeam.service.js
- src/modules/salesEngine/commission.routes.js
- src/modules/salesEngine/commission.service.js
- src/modules/postSales/complaint.routes.js
- src/modules/postSales/complaint.service.js
- src/approval/approval.routes.js
- src/approval/approval.service.js
- src/approval/approval.schema.js

**Verified:**
- Concurrent refresh: both tabs receive 200 with same
  token (family cache hit confirmed in logs)
- Server boots with zero Cannot find module errors
  after stub deletion

---

## [0.15.0] — 2026-03-03

### 🔧 Phase 15A — Quick Wins & Hardening
> **Scope:** Interval fixes, DOB validation, payment
> auto-clear, RLS parameterization, cache invalidation,
> audit log allowlist.
> **Status:** ✅ Complete

**Schema:** DemandLetter @@unique([organizationId,
letterCode]) already present — no migration needed.

**Modified files:**
- `src/jobs/blockExpiry.job.js` — Interval changed from
  15 * 60 * 1000 (15 min) to 60 * 1000 (1 min). Spec
  BLK-003 compliance. Expired blocks now release within
  1 minute instead of up to 14 minutes.
- `src/jobs/demandOverdue.job.js` — Changed from daily
  cron (pattern: '0 1 * * *') to hourly fixed interval
  (every: 60 * 60 * 1000). Overdue demand letters flagged
  within the hour not next day.
- `src/modules/customers/customer.schema.js` — dateOfBirth
  changed from z.string().datetime().optional() to
  z.string().optional().refine() with exact age calculation
  accounting for birthday boundary. Rejects under-18 with
  clear message. Allows exactly 18 years old.
- `src/modules/postSales/payment.service.js` — Added
  INSTANT_PAYMENT_MODES = ['upi', 'neft', 'rtgs', 'imps'].
  initialStatus = 'cleared' for instant modes,
  'under_process' for cheque/demand_draft. Uses
  .toLowerCase() for case-insensitive match. initialStatus
  used in payment.create() data preserving Phase 13C
  idempotency behavior.
- `src/middleware/organization.js` — Replaced
  prisma.$executeRawUnsafe with prisma.$executeRaw tagged
  template. Eliminates SQL injection vector on RLS query.
- `src/modules/salesEngine/booking.service.js` — Added
  redis.del(analytics:dashboard:{organizationId}) after
  successful booking transaction commit.
- `src/modules/postSales/cancellation.service.js` — Added
  redis.del(analytics:dashboard:{organizationId}) after
  successful cancellation transaction commit.
- `src/middleware/auditLogger.js` — Replaced denylist
  sanitization with AUDIT_SAFE_FIELDS allowlist Set (30
  explicit safe fields). sanitizeBodyForAudit() filters
  req.body to only allowed keys. Excludes: password,
  panNumber, aadhaarNumber, refreshToken, token,
  requestData, kycDocuments, fileKey.

**Verified:**
- 17-year-old rejected with 400, 18-year-old accepted
- UPI payment status = cleared, cheque = under_process
- No $executeRawUnsafe remaining in organization.js
- Analytics cache invalidated on booking creation
- PAN not present in audit log metadata

---

## [0.14.2] — 2026-03-03

### 🔁 Phase 14C — SLA Jobs, Escalation & Org Rate Limiting
> **Scope:** Background breach detection, stale approval
> escalation, per-organization request throttling.
> **Status:** ✅ Complete

**Schema changes:**
- Added `escalatedAt DateTime? @map("escalated_at")` to
  `ApprovalRequest` model
- Migration: `add_approval_escalated_at`

**Dependencies added:**
- `rate-limit-redis` — Redis-backed store for org rate limiter
  (uses `bullMQConnection` ioredis client via `.call()`)

**New files:**
- `src/jobs/slaBreachCheck.job.js` — BullMQ repeatable job
  (every 30 min). Finds complaints where status not in
  resolved/closed, slaDeadline < now, slaBreached = false.
  Single updateMany marks all breached. Fetches affected
  records (updatedAt window = last 31 min) and dispatches
  SLA_BREACHED notification per complaint. Full try/catch —
  worker failure never crashes server.
- `src/jobs/approvalEscalation.job.js` — BullMQ repeatable
  job (every 30 min). Finds approvalRequests where status =
  pending, createdAt < now - 48h, escalatedAt = null. Updates
  escalatedAt = now per record. Dispatches APPROVAL_ESCALATED
  notification with hoursElapsed. Full try/catch resilience.

**Modified files:**
- `src/config/rateLimiter.js` — Added orgRateLimiter using
  rateLimit() with RedisStore (ioredis bullMQConnection via
  `.call()`). Key: org:{organizationId}:ratelimit. Limit: 300
  requests/org/minute. Returns 429 with code
  ORG_RATE_LIMIT_EXCEEDED. Skips /health path.
- `src/server.js` — Imported both job files at top (self-
  register on boot). Mounted orgRateLimiter after requireAuth
  and requireOrganization on all /v1 route handlers.

**Verified:**
- Boot logs: both job scheduled messages appear on npm run dev
- SLA breach: slaBreached flipped to true, notification queued
- Escalation: escalatedAt populated after job run
- Org rate limit: 301st request returns 429
  ORG_RATE_LIMIT_EXCEEDED with retryAfter: 60

---

## [0.14.1] — 2026-03-03

### ⚙️ Phase 14B — Discount Gate & Registration Cascade
> **Scope:** Discount approval workflow, registration endpoint,
> commission eligibility via registration event.
> **Status:** ✅ Complete

**Schema changes (prisma/schema.prisma):**
- Added `pending_discount_approval` to `BookingStatus` enum
- Added `registrationNumber String?` to `Booking` model
- Added `registrationRemarks String?` to `Booking` model
- Added `registeredBy String?` to `Booking` model
- Added `approvalCode String? @unique` to `ApprovalRequest` model
- Migration: `add_booking_registration_fields`

**New files:**
- `src/cascade/handlers/onRegistrationCompleted.js` — 3-step
  registration cascade: booking → registered, unit → registered,
  commissions with status in pending/approved → sale_completed.
  Safe no-op if commission already sale_completed via possession.

**Modified files:**
- `src/cascade/types.js` — Added `REGISTRATION_COMPLETED` event
- `src/cascade/cascadeEngine.js` — Wired onRegistrationCompleted
  handler with tx + notificationsToDispatch threading
- `src/modules/salesEngine/booking.service.js` — Discount gate
  in createBooking(): discounts ≤1% of agreementValue proceed
  normally (status: booked). Discounts >1% set booking status
  to pending_discount_approval, unit stays blocked, approval
  request auto-created with requestType: discount and full
  justification including exact discount %. Added
  registerBooking(): fetches booking, validates registerable
  status (booked/possession_handed), requires registrationDate
  and registrationNumber, fires REGISTRATION_COMPLETED cascade
  atomically, dispatches notifications post-commit.
- `src/modules/salesEngine/booking.routes.js` — Added
  PATCH /:id/register protected by requireAuth +
  requirePermission('bookings', 'update')

**Verified:**
- Discount ≤1%: booking booked, unit booked, no approval created
- Discount >1%: booking pending_discount_approval, unit stays
  blocked, approval request created with correct percentage
- Registration cascade: booking+unit registered,
  commission → sale_completed
- Registration on possessed unit: commission already
  sale_completed → graceful no-op (0 records updated)
- Cannot register cancelled booking: 422 BusinessRuleError

---

## [0.14.0] — 2026-03-03

### 🧱 Phase 14 — Core Mechanisms Enforcement

#### Phase 14A — Units blocks & Transfer Limits Integrity
> **Scope:** Unit block lock implementations restricting agents recursively logically ensuring fair locking rules constraint. Lazy block expirations efficiently unblocks dynamically eliminating lock limitations cleanly smoothly implicitly tracking variables flawlessly reliably correctly synchronously. NOC validation checks ensure smooth transactions organically smoothly.

**Implementations:**
- Ensured a restrictive variable limits boundary tracking 3 maximum dynamic blocks natively tracked through optimal atomics structures intelligently safely efficiently tracking. (See custom error logic outputting natively directly) using internal node module integration securely locally seamlessly executing smoothly synchronously natively properly correctly smoothly dynamically updating asynchronously locally efficiently.

**File Manifest — Phase 14A Complete**
| File | Action |
|------|--------|
| `src/modules/units/unit.service.js` | Updated |
| `src/modules/postSales/transfer.schema.js` | Updated |
| `src/modules/postSales/transfer.service.js` | Updated |
| `src/modules/salesEngine/booking.service.js` | Updated |

---

### 🛡️ Phase 14A — Block Safety, Lazy Expiry & NOC Enforcement
> **Scope:** Atomic SP block limiting, Redis-fallback lazy expiry,
> verified NOC requirement for transfers.
> **Status:** ✅ Complete

**Modified files:**
- `src/modules/units/unit.service.js` — Redis atomic block counter
  (INCR/DECR helpers with DB fallback on Redis outage). 3-block
  limit enforced in blockUnit(). Counter decremented on release
  and on block consumed by booking. Lazy expiry in getUnit()
  (awaited, inline release). Lazy expiry in listUnits()
  (fire-and-forget updateMany, in-memory result corrected).
- `src/modules/postSales/transfer.schema.js` — nocDocumentId
  added as required UUID field.
- `src/modules/postSales/transfer.service.js` — NOC verified
  document check: org + bookingId + category='noc' +
  status='verified' all required. nocDocumentId populated
  on transferRecord.create().

---

## [0.13.0] — 2026-03-03

### 🔒 Phase 13 — Pre-Production Hardening
> **Scope:** Encryption foundation, cascade engine completion,
> atomic approval execution, payment idempotency, commission
> payout gate, KYC enforcement at booking.
> **Sub-phases:** 13A (Schema + Encryption) · 13B (Cascades) · 13C (Business Rules)
> **Status:** ✅ Complete

---

### Phase 13A — Schema & Encryption Foundation

**Schema migrations:**
- Added `cancelled` to `DemandLetterStatus` enum
- Added `cancelled` to `ScheduleStatus` enum
- Added `idempotencyKey String? @unique` to `Payment` model
- Added `panHash String? @unique` to `Customer` model
- Added `@@unique([organizationId, letterCode])` to `DemandLetter` model

**New files:**
- `src/shared/encryption.js` — AES-256-GCM encrypt/decrypt with
  key versioning (`v1:iv:authTag:ciphertext` format). Supports
  future key rotation without data loss. `safeDecrypt()` for
  display layer, `decrypt()` for security-critical paths.
- `src/shared/cryptoHash.js` — HMAC-SHA256 `hashPan()` and
  `hashAadhaar()` for deterministic equality lookup without
  exposing plaintext. Separate secret key (PAN_HASH_KEY) prevents
  rainbow table attacks against known PAN format space.
- `scripts/encrypt-existing-pii.js` — One-time batch migration
  script. Processes customers in batches of 100, skips already-
  encrypted records via `isEncrypted()` regex check, 10ms rate
  limit between records to prevent DB saturation.

**Modified files:**
- `src/modules/customers/customer.service.js` — `createCustomer()`
  encrypts PAN/Aadhaar via `encrypt()` and stores HMAC hash via
  `hashPan()` before write. PAN lookup queries use `panHash` field
  exclusively (never plaintext comparison). `maskSensitiveData()`
  decrypts via `safeDecrypt()` then applies role-based masking:
  admin/finance see full values, all other roles see masked format
  (`AB•••••EF` for PAN, `XXXX-XXXX-1234` for Aadhaar).
  `verifyKyc()` checks `panHash` presence (not `panNumber`).
- `src/server.js` — `BigInt.prototype.toJSON` override injected
  before `const app = express()`. Serializes BigInt as safe integer
  or string fallback. Prevents silent `TypeError: Do not know how
  to serialize a BigInt` crashes on analytics and aggregation
  endpoints.

**Environment variables added:**
- `PII_ENCRYPTION_KEY` — 64 hex chars (32 bytes) for AES-256-GCM
- `PAN_HASH_KEY` — 64 hex chars (32 bytes) for HMAC-SHA256

**Verified:**
- Raw DB query confirms `pan_number` column stores ciphertext
- `pan_hash` column stores 64-char HMAC hex
- Admin role receives decrypted PAN in API response
- Non-admin role receives masked PAN in API response
- Duplicate PAN on `createCustomer()` returns `isExisting: true`
  with existing customer record instead of ConflictError

---

### Phase 13B — Cascade Engine Completion

**New files:**
- `src/cascade/handlers/onUnitCancelled.js` — 8-step cancellation
  cascade: booking → cancelled, unit → available (all 12 FK fields
  nulled), cleared payments → refund_pending, demand letters →
  cancelled, payment schedule → cancelled, commissions → cancelled,
  agent `pendingCommission` decremented per cancelled commission,
  possession record → cancelled. Notifications queued into
  caller-owned array, dispatched after tx commit.
- `src/cascade/handlers/onPaymentBounced.js` — Auto-creates
  complaint (category: payment, priority: high, SLA: 24h) within
  caller's transaction. Complaint code generated inside tx for
  consistent read. Notifications queued post-commit.
- `src/cascade/handlers/onTransferInitiated.js` — Full ownership
  migration across 10 record types: booking, unit, possession,
  payments, demand letters, loan records (`tx.loanRecord` — not
  `tx.loan`), payment schedules, commissions, communication logs,
  customer documents. Complaints and snag items intentionally
  not transferred (belong to originating customer relationship).
- `src/cascade/handlers/onPossessionCompleted.js` — Owns booking
  and unit status updates (`possession_handed`). Updates commissions
  with status in `['pending', 'approved']` → `sale_completed`,
  making them eligible for payout. Critical previously-missing step.

**Modified files:**
- `src/cascade/cascadeEngine.js` — Replaced 4 `console.log` stubs
  with real handler dispatch. All handlers receive `(payload, tx,
  notificationsToDispatch)`. `triggerCascade()` accepts and threads
  the caller's `tx` and notification array through to each handler.
- `src/modules/postSales/cancellation.service.js` — Replaced inline
  cascade logic with `triggerCascade(UNIT_CANCELLED)`. Removed
  `approvalRequest.update` (approval lifecycle owned by
  `approval.service.js` exclusively). Notifications dispatched
  after `$transaction` commits. Transaction timeout: 30000ms.
- `src/modules/postSales/payment.service.js` — Wrapped entire
  `updatePaymentStatus()` in `$transaction`. Demand letter reversal
  and bounce cascade run atomically. `triggerCascade(PAYMENT_BOUNCED)`
  fires on `status === 'bounced'`. Transaction timeout: 15000ms.
- `src/modules/postSales/transfer.service.js` — Replaced inline
  3-of-10 record migration with `triggerCascade(TRANSFER_INITIATED)`.
  All 10 record types now migrated atomically. Transaction
  timeout: 30000ms.
- `src/modules/postSales/possession.service.js` — Removed inline
  `tx.booking.update` and `tx.unit.update` for `possession_handed`
  status. `onPossessionCompleted` cascade exclusively owns these
  updates. Added `triggerCascade(POSSESSION_COMPLETED)`.

**Design contract enforced across all handlers:**
- All handlers run inside the CALLER's `$transaction` (not their own)
- Notifications pushed to caller-owned array, never dispatched
  inside a transaction boundary
- `onUnitCancelled` does not touch `approvalRequest` table
- `onPossessionCompleted` owns booking/unit status exclusively

---

### Phase 13C — Atomic Approval, Idempotency & Business Rules

**Modified files:**
- `src/modules/approvals/approval.service.js` — `reviewApproval()`
  now wraps approval status update AND cascade execution in a single
  `$transaction`. If the cascade fails, the approval status rolls
  back to `pending`. Eliminates the stuck state where approval was
  `approved` but the underlying action never completed.
  `executeApprovedAction()` is a module-private function (not
  exported) that dispatches to `processCancellation()` or
  `processTransfer()` passing the active `tx` and notification
  array. Static imports used (no dynamic `await import()`).
  `forfeiturePct` read from cancellation record, not user-supplied
  `requestData`. Transaction timeout: 30000ms.
- `src/modules/postSales/cancellation.service.js` — `processCancellation()`
  accepts optional `existingTx = null` and
  `notificationsToDispatch = []` parameters. When `existingTx` is
  provided (called from approval), runs inside it. When null
  (called directly from route), opens its own `$transaction` and
  dispatches notifications after commit.
- `src/modules/postSales/transfer.service.js` — Same
  `existingTx = null` pattern applied to `processTransfer()`.
- `src/modules/postSales/payment.service.js` — `recordPayment()`
  uses create-then-catch-P2002 idempotency pattern. Attempts
  `prisma.payment.create()` directly. On P2002 targeting
  `idempotency_key`, fetches and returns existing record with
  `isDuplicate: true`. Eliminates check-then-create race condition.
  `idempotencyKey` added to `recordPaymentSchema` as optional UUID.
- `src/modules/agents/agent.service.js` — Commission payout
  eligibility: `PAYOUT_ELIGIBLE_STATUSES = ['sale_completed']`
  exclusively. Removed `'approved'` and `'partially_paid'` from
  eligible statuses. Commissions reach `sale_completed` only via
  `onPossessionCompleted` cascade. Error message directs caller
  to complete possession before requesting payout.
- `src/modules/salesEngine/booking.service.js` — KYC completeness
  gate in `createBooking()`. Checks `fullName`, `dateOfBirth`,
  `mobilePrimary`, `email`, `currentAddress`, and `panHash`.
  Uses `panHash` for PAN presence check (not `panNumber`, which
  holds ciphertext post-13A). Returns 422 with complete list of
  missing field names. Allows lightweight customer creation during
  lead capture; enforces completeness only when money is involved.

**Verified via simulation testing:**
- Atomic approval: simulated `throw` inside `onUnitCancelled`
  confirmed approval status rolls back to `pending`
- Idempotency: duplicate submission with same UUID returns
  `isDuplicate: true`, single DB record confirmed
- Commission gate: 422 returned on `pending` commission,
  payout succeeds after possession sets `sale_completed`
- KYC gate: 422 returned listing all missing fields by name

---

### File Manifest — Phase 13 Complete

| File | Action |
|------|--------|
| `src/shared/encryption.js` | Created |
| `src/shared/cryptoHash.js` | Created |
| `scripts/encrypt-existing-pii.js` | Created |
| `src/cascade/handlers/onUnitCancelled.js` | Created |
| `src/cascade/handlers/onPaymentBounced.js` | Created |
| `src/cascade/handlers/onTransferInitiated.js` | Created |
| `src/cascade/handlers/onPossessionCompleted.js` | Created |
| `src/cascade/cascadeEngine.js` | Updated |
| `src/modules/customers/customer.service.js` | Updated |
| `src/modules/postSales/cancellation.service.js` | Updated |
| `src/modules/postSales/payment.service.js` | Updated |
| `src/modules/postSales/transfer.service.js` | Updated |
| `src/modules/postSales/possession.service.js` | Updated |
| `src/modules/approvals/approval.service.js` | Updated |
| `src/modules/agents/agent.service.js` | Updated |
| `src/modules/salesEngine/booking.service.js` | Updated |
| `src/server.js` | Updated |
| `prisma/schema.prisma` | Updated |
| `package.json` | Updated |

---

## [0.12.0] — 2026-03-01

### 🔒 Phase 12 — Production Hardening

> **Scope:** Security headers, rate limiting, request
> tracing, structured logging, global error handling.
> **Status:** ✅ Complete

### Added
- src/middleware/rateLimiter.js — three tiered limiters:
  apiRateLimiter (120/min all routes), authRateLimiter
  (20/15min on /v1/auth), analyticsRateLimiter (20/min).
- src/middleware/requestValidator.js — validateContentType
  (415 on non-JSON POST/PATCH/PUT), attachRequestId
  (injects x-request-id UUID on every request/response).
- src/shared/errors.js — enhanced with globalErrorHandler
  covering Prisma P2002/P2025/P2003 codes, JWT errors,
  Zod errors, and operational AppErrors. Added aliases
  AuthenticationError and AuthorizationError for backward
  compatibility with existing middleware.
- src/config/logger.js — structured JSON logger with
  4 levels (error/warn/info/debug), HTTP request logger,
  environment-aware log level.
- helmet() — security headers on all responses.
- compression() — gzip response compression.
- Packages: helmet@8.0.0, compression@1.8.0,
  express-rate-limit@7.5.0

### File Manifest
src/middleware/rateLimiter.js        (created)
src/middleware/requestValidator.js   (created)
src/shared/errors.js                 (updated)
src/config/logger.js                 (created)
src/server.js                        (updated)
package.json                         (updated)

---

## [0.11.0] — 2026-03-01

### ✅ Phase 11 — Approvals + Loans

> **Scope:** Approval workflow management and loan
> records with disbursement tracking.
> **Status:** ✅ Complete

### Added
- Approvals module — createApproval, reviewApproval
  (cannot self-approve), listApprovals (non-admin sees
  own only), getPendingCount (grouped by type),
  hoursPending calculated on get. Mounted /v1/approvals.
- Loans module — createLoan (EMI auto-calculated via
  standard formula, validates against booking value),
  recordDisbursement (JSONB array append, auto-status
  to disbursed when fully drawn), updateLoanStatus,
  updateLoan. Mounted /v1/loans.

### File Manifest
src/modules/approvals/approval.schema.js   (created)
src/modules/approvals/approval.service.js  (created)
src/modules/approvals/approval.routes.js   (created)
src/modules/loans/loan.schema.js           (created)
src/modules/loans/loan.service.js          (created)
src/modules/loans/loan.routes.js           (created)
src/server.js                              (updated)

---

## [0.10.0] — 2026-03-01

### 📊 Phase 10 — Analytics + Audit Log

> **Scope:** Executive dashboard, sales and collection
> analytics, automatic audit trail on all mutations.
> **Status:** ✅ Complete

### Added
- Analytics module — getExecutiveDashboard (Redis 5min
  cache, inventory/booking/revenue/lead/complaint KPIs),
  getSalesAnalytics (6-month trend, by-project, by-config),
  getCollectionAnalytics (by payment mode, overdue summary).
  Mounted /v1/analytics.
- Audit module — listAuditLogs, getEntityAuditTrail,
  getUserActivity. Mounted /v1/audit.
- auditLogger middleware — auto-logs all POST/PATCH/PUT/
  DELETE mutations via res.on('finish'). Sanitizes
  password/PAN/Aadhaar from metadata. Skips GET and
  configured SKIP_ROUTES. Never crashes requests.
  Mounted after all routes, before error handler.

### File Manifest
src/modules/analytics/analytics.service.js  (created)
src/modules/analytics/analytics.routes.js   (created)
src/modules/audit/audit.service.js          (created)
src/modules/audit/audit.routes.js           (created)
src/middleware/auditLogger.js               (created)
src/server.js                               (updated)

---

## [0.9.0] — 2026-03-01

### 👥 Phase 9 — Sales Team + Agents

> **Scope:** Sales person management with performance
> tracking and agent/broker management with commission
> payment recording.
> **Status:** ✅ Complete

### Added
- Sales Team module — createSalesPerson (SP code +
  mobile uniqueness, reportingTo validation),
  getSalesPerson (performance: totalBookings,
  activeBlocks, monthlyRevenue, achievementPct),
  getTeamPerformance (sorted by achievement, team
  summary), deactivation blocked on active unit blocks.
  Mounted /v1/sales-team.
- Agents module — createAgent (agentCode + RERA +
  mobile uniqueness), recordCommissionPayment (atomic:
  updates commission + agent running totals, payment
  overflow blocked), rateAgent (0-5), deactivation
  blocked on pending commissions.
  Mounted /v1/agents.

### File Manifest
src/modules/salesTeam/salesPerson.schema.js  (created)
src/modules/salesTeam/salesPerson.service.js (created)
src/modules/salesTeam/salesPerson.routes.js  (created)
src/modules/agents/agent.schema.js           (created)
src/modules/agents/agent.service.js          (created)
src/modules/agents/agent.routes.js           (created)
src/server.js                                (updated x2)

---
## [0.8.0] — 2026-03-01

### 👥 Phase 8 — Customers, Documents, Complaints & Communications

> **Scope:** Customer profile management with KYC, document
> registry, complaint SLA engine, and communication logging.
> **Status:** ✅ Complete

### Added

#### Phase 8A — Customers Module
- Implemented customer.schema.js — PAN regex validation
  (ABCDE1234F format), Aadhaar 12-digit validation, Indian
  mobile regex, updateSchema omits PAN/Aadhaar (immutable).
- Implemented customer.service.js — generateCustomerCode
  (CUST-XXXX), maskSensitiveData (hides PAN + Aadhaar for
  non-admin/finance roles), createCustomer (PAN uniqueness
  + mobile uniqueness per org), updateCustomer, verifyKyc
  (requires PAN on file before verification).
- Implemented customer.routes.js — 5 endpoints with RBAC.
- Mounted at /v1/customers.

#### Phase 8A — Documents Module
- Implemented document.schema.js — 12 document categories,
  10MB file size limit validation.
- Implemented document.service.js — uploadDocument (registers
  S3 fileKey in DB, updates customer kycDocuments JSONB for
  KYC categories), verifyDocument (only uploaded status can
  be verified/rejected), listDocuments with downloadUrl
  placeholder (Phase 12 replaces with S3 presigned URLs).
- Implemented document.routes.js — 3 endpoints with RBAC.
- Mounted at /v1/documents.

#### Phase 8B — Complaints Module
- Implemented complaint.schema.js — create, update, resolve
  (requires 10+ char resolution), escalate schemas.
- Implemented complaint.service.js — generateComplaintCode
  (CMP-XXXX), calculateSlaDeadline (high=24h, medium=48h,
  low=72h), createComplaint (auto SLA deadline),
  getComplaint (real-time SLA breach detection + DB update),
  updateComplaint (auto in_progress when assigned),
  resolveComplaint (resolutionHours + withinSla returned),
  escalateComplaint (priority forced to high, slaBreached
  set true).
- Implemented complaint.routes.js — 6 endpoints with RBAC.
- Mounted at /v1/complaints.

#### Phase 8B — Communications Module
- Implemented communication.schema.js — Zod refine
  validation requiring either customerId or leadId.
- Implemented communication.service.js — listCommunications,
  logCommunication (durationSeconds rejected for non-call
  channels), getCommunicationSummary (groupBy channel +
  direction, total call duration in seconds and minutes).
- Implemented communication.routes.js — 3 endpoints.
- Mounted at /v1/communications.

### API Endpoints Added

| Method | Route | Permission |
|---|---|---|
| GET | /v1/customers | customers:read |
| POST | /v1/customers | customers:read |
| GET | /v1/customers/:id | customers:read |
| PATCH | /v1/customers/:id | customers:update |
| PATCH | /v1/customers/:id/kyc | customers:update |
| GET | /v1/documents | documents:read |
| POST | /v1/documents | documents:create |
| PATCH | /v1/documents/:id/verify | documents:update |
| GET | /v1/complaints | complaints:read |
| POST | /v1/complaints | complaints:create |
| GET | /v1/complaints/:id | complaints:read |
| PATCH | /v1/complaints/:id | complaints:update |
| POST | /v1/complaints/:id/resolve | complaints:update |
| POST | /v1/complaints/:id/escalate | complaints:update |
| GET | /v1/communications | communications:read |
| POST | /v1/communications | communications:create |
| GET | /v1/communications/summary | communications:read |

### File Manifest

src/modules/customers/customer.schema.js        (created)
src/modules/customers/customer.service.js       (created)
src/modules/customers/customer.routes.js        (created)
src/modules/documents/document.schema.js        (created)
src/modules/documents/document.service.js       (created)
src/modules/documents/document.routes.js        (created)
src/modules/complaints/complaint.schema.js      (created)
src/modules/complaints/complaint.service.js     (created)
src/modules/complaints/complaint.routes.js      (created)
src/modules/communications/communication.schema.js  (created)
src/modules/communications/communication.service.js (created)
src/modules/communications/communication.routes.js  (created)
src/server.js                                   (updated x2)

---

## [0.7.0] — 2026-03-01

### 🏦 Phase 7 — Post-Sales Module

> **Scope:** Complete post-sale lifecycle — payments,
> demand letters, cancellations, transfers, possession
> handover, and snag management.
> **Status:** ✅ Complete

### Added

#### Phase 7A — Payments Module
- Implemented payment.schema.js — recordPayment and
  updatePaymentStatus schemas.
- Implemented payment.service.js — generateReceiptNumber
  (RCPT-XXXX), recordPayment (updates demand letter
  paidAmount + remaining when demandLetterId provided),
  updatePaymentStatus (bounce reverses demand letter
  paid amount, cleared updates PaymentSchedule to paid),
  getBookingPaymentSummary (collectionPct calculation).
- Implemented payment.routes.js — 4 endpoints.
- Mounted at /v1/payments.

#### Phase 7A — Demand Letters Module
- Implemented demandLetter.schema.js — create and
  reminder schemas.
- Implemented demandLetter.service.js — generateLetterCode
  (DL-{bookingCode}-XX), createDemandLetter, getDemandLetter
  (with payment schedules), sendReminder (24-hour throttle,
  reminderCount tracking).
- Implemented demandLetter.routes.js — 4 endpoints.
- Mounted at /v1/demand-letters.

#### Phase 7B — Cancellations Module
- Implemented cancellation.schema.js — initiate and
  process schemas.
- Implemented cancellation.service.js —
  getCancellationPreview (refund breakdown before
  confirming), initiateCancellation (uses calculateRefund,
  auto-creates ApprovalRequest atomically, generates
  CAN-XXXX code), processCancellation (releases unit to
  available, cancels commissions, updates booking to
  cancelled — all atomic).
- Implemented cancellation.routes.js — 4 endpoints.
- Mounted at /v1/cancellations.

#### Phase 7B — Transfers Module
- Implemented transfer.schema.js — initiate and
  process schemas.
- Implemented transfer.service.js — initiateTransfer
  (validates booking state, prevents self-transfer,
  auto-creates ApprovalRequest atomically, generates
  TRF-XXXX), processTransfer (updates booking + unit +
  possession customerId in one transaction).
- Implemented transfer.routes.js — 4 endpoints.
- Mounted at /v1/transfers.

#### Phase 7C — Possession + Snag Module
- Implemented possession.schema.js — update, complete,
  createSnag, updateSnag schemas.
- Implemented possession.service.js — listPossessions,
  getPossession (checklist % + snag summary),
  updatePossession (checklist merge preserves existing),
  completePossession (enforces all checklist items true,
  warns on open snags but does not block, updates booking
  + unit to possession_handed atomically), createSnag
  (rejects on completed possession), updateSnag
  (auto-sets resolvedDate, resolvedBy required).
- Implemented possession.routes.js — 7 endpoints.
- Mounted at /v1/possessions.

### Business Rules Implemented

| Rule | Module |
|---|---|
| Bounce reverses demand letter paid amount | payments |
| 24hr reminder throttle | demand-letters |
| Cancellation preview before confirming | cancellations |
| Unit released atomically on cancellation | cancellations |
| Commission cancelled on booking cancel | cancellations |
| Transfer blocks self-transfer | transfers |
| Checklist 100% required to complete possession | possessions |
| Open snags warn but do not block possession | possessions |

### File Manifest

src/modules/postSales/payment.schema.js         (created)
src/modules/postSales/payment.service.js        (created)
src/modules/postSales/payment.routes.js         (created)
src/modules/postSales/demandLetter.schema.js    (created)
src/modules/postSales/demandLetter.service.js   (created)
src/modules/postSales/demandLetter.routes.js    (created)
src/modules/postSales/cancellation.schema.js    (created)
src/modules/postSales/cancellation.service.js   (created)
src/modules/postSales/cancellation.routes.js    (created)
src/modules/postSales/transfer.schema.js        (created)
src/modules/postSales/transfer.service.js       (created)
src/modules/postSales/transfer.routes.js        (created)
src/modules/postSales/possession.schema.js      (created)
src/modules/postSales/possession.service.js     (created)
src/modules/postSales/possession.routes.js      (created)
src/server.js                                   (updated x3)

---

## [0.6.0] — 2026-02-28

### 📋 Phase 6 — Pre-Sales Module (Leads, Site Visits, Follow-Ups)

> **Scope:** Complete pre-sales pipeline covering lead 
> management, site visit scheduling, and follow-up task
> tracking with automated lead status progression.
> **Status:** ✅ Complete

### Added

#### Phase 6A — Leads Module
- Implemented src/modules/preSales/lead.schema.js —
  Zod schemas for create (Indian mobile validation 
  regex), update, and status transition with
  convertedBookingId requirement on won status.
- Implemented src/modules/preSales/lead.service.js —
  listLeads (sales_executive role filter — own leads
  only), getLead (with siteVisits + followUpTasks
  included), createLead (sequential LEAD-XXXX code,
  duplicate mobile check per org), updateLead (budget
  stored in paise), updateLeadStatus (strict state
  machine with VALID_TRANSITIONS map, lostReason
  required on lost, bookingId required on won).
- Implemented src/modules/preSales/lead.routes.js —
  5 endpoints with full RBAC.
- Mounted lead router at /v1/leads in server.js.

#### Phase 6B — Site Visits Module
- Implemented src/modules/preSales/siteVisit.schema.js —
  Zod schemas for create and update with datetime
  validation.
- Implemented src/modules/preSales/siteVisit.service.js —
  listSiteVisits (sales_executive filter),
  createSiteVisit (verifies lead + project exist,
  blocks scheduling for won/junk leads, auto-advances
  lead status to site_visit_scheduled when lead is
  new/contacted), updateSiteVisit (checkout after
  checkin validation, auto-advances lead to
  site_visit_done when feedback + checkOutAt recorded).
- Implemented src/modules/preSales/siteVisit.routes.js —
  3 endpoints with RBAC.
- Mounted router at /v1/site-visits in server.js.

#### Phase 6B — Follow-Up Tasks Module
- Implemented src/modules/preSales/followUp.schema.js —
  Zod schemas for create and update with full enum
  coverage.
- Implemented src/modules/preSales/followUp.service.js —
  listFollowUps (ordered by priority then scheduledAt,
  sales_executive filter), createFollowUp (lead
  existence check, blocks tasks for won/junk leads,
  future date enforcement), updateFollowUp (outcome
  required on completion, scheduledAt required on
  reschedule, auto-sets completedAt timestamp).
- Implemented src/modules/preSales/followUp.routes.js —
  3 endpoints with RBAC.
- Mounted router at /v1/follow-ups in server.js.

### Business Rules Implemented

| Rule | Location |
|---|---|
| Lead state machine with VALID_TRANSITIONS | lead.service.js |
| Mobile uniqueness per org | lead.service.js |
| Auto-advance to site_visit_scheduled | siteVisit.service.js |
| Auto-advance to site_visit_done | siteVisit.service.js |
| Future date enforcement on follow-ups | followUp.service.js |
| Outcome required on task completion | followUp.service.js |
| Sales executive sees only own records | All 3 list services |

### API Endpoints Added

| Method | Route | Permission |
|---|---|---|
| GET | /v1/leads | leads:read |
| POST | /v1/leads | leads:create |
| GET | /v1/leads/:id | leads:read |
| PATCH | /v1/leads/:id | leads:update |
| PATCH | /v1/leads/:id/status | leads:update |
| GET | /v1/site-visits | site_visits:read |
| POST | /v1/site-visits | site_visits:create |
| PATCH | /v1/site-visits/:id | site_visits:update |
| GET | /v1/follow-ups | follow_ups:read |
| POST | /v1/follow-ups | follow_ups:create |
| PATCH | /v1/follow-ups/:id | follow_ups:update |

### File Manifest

src/modules/preSales/lead.schema.js       (created)
src/modules/preSales/lead.service.js      (created)
src/modules/preSales/lead.routes.js       (created)
src/modules/preSales/siteVisit.schema.js  (created)
src/modules/preSales/siteVisit.service.js (created)
src/modules/preSales/siteVisit.routes.js  (created)
src/modules/preSales/followUp.schema.js   (created)
src/modules/preSales/followUp.service.js  (created)
src/modules/preSales/followUp.routes.js   (created)
src/server.js                             (updated)

---

## [0.5.0] — 2026-02-28

### ⚡ Phase 5 — Live Inventory Engine & Booking Cascade

> **Scope:** BullMQ background jobs, booking creation with 
> full cascade engine, refund calculator.
> **Status:** ✅ Complete

### Added

#### Phase 5A — Background Jobs Infrastructure
- Implemented src/shared/refund.js — cancellation refund
  calculator with forfeiture rules based on booking lifecycle
  stage (2% before agreement, 5% after agreement, 10% after
  registration). GST 18% on forfeiture, TDS 1% on total
  received, 50% brokerage recovery, fixed admin fee.
- Implemented src/jobs/blockExpiry.job.js — BullMQ queue and
  worker that runs every 15 minutes. Batch-releases all units
  whose blockExpiresAt has passed. Uses updateMany for efficiency.
- Implemented src/jobs/demandOverdue.job.js — BullMQ queue and
  worker that runs daily at 1 AM. Marks overdue demand letters
  and associated payment schedule items simultaneously.
- Implemented src/jobs/notificationDispatch.js — Queue stub
  for notification dispatch. Worker implemented in Phase 8.
- Updated server.js — app.listen callback made async to support
  job scheduling. Both cron jobs scheduled on server startup.

#### Phase 5B — Booking Cascade Engine
- Implemented src/cascade/types.js — CascadeEvents registry
  (BOOKING_CREATED, UNIT_CANCELLED, PAYMENT_BOUNCED,
  TRANSFER_INITIATED, POSSESSION_COMPLETED).
- Implemented src/cascade/cascadeEngine.js — Central event
  dispatcher routing cascade events to handlers inside
  caller transaction context.
- Implemented src/cascade/handlers/onBookingCreated.js —
  Creates 4 records automatically on booking creation:
  (1) 10-milestone CLP payment schedule,
  (2) First demand letter with 7-day due date,
  (3) Commission record with GST 18% + TDS 5% calculation,
  (4) Possession record pre-created in pending state.
- Implemented src/modules/salesEngine/booking.service.js —
  Full booking creation with pre-flight validation (unit
  status check, customer/SP/agent verification, duplicate
  booking check), pricing calculation, atomic transaction
  wrapping booking + unit update + cascade.
- Implemented booking.schema.js and booking.routes.js —
  3 endpoints (list, get, create) with full RBAC.
- Mounted booking router at /v1/bookings in server.js.

### Verified Endpoints

| Method | Route | Status |
|---|---|---|
| GET | /v1/bookings | ✅ 200 |
| GET | /v1/bookings/:id | ✅ 200 |
| POST | /v1/bookings | ✅ 201 |
| POST | /v1/bookings (duplicate) | ✅ 409 |

### Infrastructure Decisions

| Decision | Rationale |
|---|---|
| Cascade runs inside prisma.$transaction | Atomic — booking + 4 cascade records all or nothing |
| CLP 10 equal milestones at 10% each | Standard Indian residential real estate payment schedule |
| First demand letter due in 7 days | Industry standard for on-booking payment |
| Commission = gross - GST(18%) - TDS(5%) | Indian regulatory requirement for broker payments |
| Possession record pre-created at booking | Available immediately for operations team tracking |

### File Manifest

src/cascade/types.js                           (created)
src/cascade/cascadeEngine.js                   (created)
src/cascade/handlers/onBookingCreated.js       (created)
src/shared/refund.js                           (created)
src/jobs/blockExpiry.job.js                    (created)
src/jobs/demandOverdue.job.js                  (created)
src/jobs/notificationDispatch.js               (created)
src/modules/salesEngine/booking.service.js     (created)
src/modules/salesEngine/booking.schema.js      (created)
src/modules/salesEngine/booking.routes.js      (created)
src/server.js                                  (updated)

---

## [0.4.0] — 2026-02-28

### 🏗️ Phase 4 — Projects, Towers & Unit Generator

> **Scope:** Shared utilities, Projects CRUD API, Tower 
> creation, and automatic unit generation engine.
> **Status:** ✅ Complete

### Added

#### Phase 4A — Shared Utilities
- Implemented src/shared/pagination.js — parsePagination,
  buildPaginatedResponse (with hasNextPage/hasPrevPage),
  buildSingleResponse, buildActionResponse.
- Implemented src/shared/filters.js — buildDateRangeFilter,
  buildSearchFilter (case-insensitive multi-field),
  buildEnumFilter (comma-separated to Prisma IN),
  buildBooleanFilter, buildNumericRangeFilter (BigInt safe),
  cleanObject (removes undefined from WHERE clauses).
- Implemented src/shared/costSheet.js — calculateUnitCost
  with full BigInt arithmetic (base price, floor rise,
  PLC, amenity, GST 5%, stamp duty 6%, registration capped
  at Rs 30000). formatCostSheetForDisplay converts to rupees.
  paiseToRupees and rupeesToPaise converters.

#### Phase 4B — Projects Module
- Implemented project.schema.js — Zod schemas for create
  (with nested tower array), update, status update, add towers.
- Implemented project.service.js — listProjects (paginated,
  filterable), getProject (with unit stats breakdown),
  createProject (atomic: project + towers + units),
  updateProject (with cache invalidation), updateProjectStatus,
  listTowers, addTowers, getProjectUnitStats (Redis cached).
- Implemented project.routes.js — 8 endpoints with RBAC.
- Mounted project router at /v1/projects in server.js.

#### Phase 4C — Unit Generator + Units Module
- Implemented src/modules/units/unit.generator.js —
  generateUnitsForTower auto-assigns config by floor position
  (top floor = Penthouse), facing by position, area defaults
  by config, full cost sheet calculated per unit.
  Unit numbering: {TowerPrefix}-{Floor}{Position}.
- Implemented unit.service.js — listUnits, getUnit (with
  cost sheet), blockUnit (starts 48h timer, validates state
  machine), releaseUnit, recordToken, getCostSheet.
- Implemented unit.routes.js — 6 endpoints with RBAC.
- Mounted unit router at /v1/units in server.js.

### Verified

- POST /v1/projects → 140 units auto-generated (Tower A
  20x4=80 + Tower B 15x4=60)
- Unit numbering correct: A-0101, A-F01-U01 format
- Cost sheet calculating with BigInt arithmetic
- Redis cache working on project stats endpoint

### File Manifest

src/shared/pagination.js                  (created)
src/shared/filters.js                     (created)
src/shared/costSheet.js                   (created)
src/modules/projects/project.schema.js    (created)
src/modules/projects/project.service.js   (created)
src/modules/projects/project.routes.js    (created)
src/modules/units/unit.generator.js       (created)
src/modules/units/unit.schema.js          (created)
src/modules/units/unit.service.js         (created)
src/modules/units/unit.routes.js          (created)
src/server.js                             (updated x2)

---

## [0.3.0] — 2026-02-27

### 🗄️ Phase 3 — Full Database Schema (28 Models)

> **Scope:** Complete Prisma schema with all production models,
> enums, indexes, and constraints pushed to Supabase PostgreSQL.
> **Status:** ✅ Complete

### Added

#### Phase 3A — Enums + Core Entities
- Added 35+ production enums covering all domain states:
  ProjectType, ProjectStatus, UnitConfig, UnitFacing, ViewType,
  ParkingType, UnitStatus, Designation, LeadSource, LeadStatus,
  VisitType, VisitFeedback, TaskType, Priority, TaskStatus,
  BookingStatus, PaymentMode, CommissionStatus, PaymentStatus,
  DemandLetterStatus, ScheduleStatus, RefundStatus, TransferStatus,
  PossessionStatus, SnagCategory, SnagStatus, ComplaintCategory,
  ComplaintStatus, DocumentCategory, DocumentStatus, Channel,
  Direction, LoanStatus, ApprovalRequestType, ApprovalStatus,
  AuditAction.
- Added Project model — project_code, city, RERA number, base_rate
  (BigInt paise), settings JSONB for floor rise and PLC config.
  Unique on (organization_id, project_code). 3 composite indexes.
- Added Tower model — floors, units_per_floor, total_units.
  Unique on (organization_id, project_id, name).
- Added Unit model — 40+ fields covering identity, configuration,
  area (BigInt sqft x100), pricing (10 BigInt fields in paise),
  lifecycle status, block info (blockedBy, blockedAt,
  blockExpiresAt), and sale info (salesPersonId, agentId,
  customerId, bookingId, discountAmount). 7 composite indexes.
- Added SalesPerson model — sp_code, designation, reporting_to
  (self-reference), monthly_target. 3 indexes.
- Added Agent model — agent_code, rera_number (mandatory),
  commission_pct, rating, total_commission, pending_commission.
  Unique on (organization_id, rera_number).
- Added Customer model — full PII fields (pan_number,
  aadhaar_number — to be encrypted in Phase 11), co-applicant
  fields, KYC JSONB array, financial profile.

#### Phase 3B — Sales & Transaction Entities
- Added Lead model — lead_code, source, status pipeline (9 states),
  score (0-100), budget range, assigned_to, converted_booking_id.
  4 indexes.
- Added SiteVisit model — visit_type, visitor_count, check-in/out
  timestamps, feedback enum. 3 indexes.
- Added FollowUpTask model — task_type, priority, status,
  scheduled_at, outcome. 3 indexes.
- Added Booking model — booking_code, agreement_value, final_value,
  discount_amount, token_amount, full status lifecycle. Unique
  constraint on (organization_id, unit_id) enforcing one active
  booking per unit. 4 indexes. Relations to 9 child models.
- Added Commission model — gross_commission, gst_amount (18%),
  tds_amount (5%), net_payable, milestones JSONB, paid/pending
  tracking. 4 indexes.
- Added Payment model — receipt_number (unique), payment_mode,
  transaction_ref, bounce_reason, bounce_date. 5 indexes.
- Added DemandLetter model — milestone_name, milestone_pct,
  demand_amount, due_date, paid_amount, remaining, reminder_count,
  last_reminder. 3 indexes.
- Added PaymentSchedule model — CLP milestone order, percentage,
  amount, linked_demand_id FK. 1 index.

#### Phase 3C — Post-Sales + System Entities
- Added CancellationRecord model — full refund calculation fields
  (total_received, forfeiture_pct, forfeiture_amt, gst_deduction,
  tds_deduction, brokerage_recovery, admin_fee, net_refund),
  refund_status lifecycle.
- Added TransferRecord model — from/to customer, transfer_fee,
  noc_document_id, approval_id, status workflow.
- Added PossessionRecord model — possession_date, status, checklist
  JSONB for flexible item tracking. Parent of SnagItem.
- Added SnagItem model — category, priority, status, reported_date,
  resolved_date, resolved_by. Child of PossessionRecord.
- Added Complaint model — complaint_code, category, priority,
  sla_hours (default 48), sla_deadline, sla_breached boolean,
  resolution. 3 indexes.
- Added CustomerDocument model — file_key (S3), file_size, mime_type,
  status (uploaded/verified/rejected), verified_by. 2 indexes.
- Added CommunicationLog model — channel, direction, subject,
  content, duration_seconds (for calls). 2 indexes.
- Added LoanRecord model — bank_name, loan_amount, sanctioned_amount,
  interest_rate, tenure_months, disbursements JSONB array.
- Added AgreementRecord model — agreement_date, agreement_value,
  stamp_duty_paid, document_id FK.
- Added RegistrationRecord model — registration_date,
  registration_number, sub_registrar, registration_fee.
- Added ApprovalRequest model — request_type, entity_type, entity_id,
  request_data JSONB snapshot, justification, review_remarks.
  3 indexes.
- Added AuditLog model — actor_id, actor_role, action enum,
  entity_type, entity_id, entity_code, before_state JSONB,
  after_state JSONB, changes JSONB diff, metadata JSONB.
  5 indexes including createdAt DESC for latest-first queries.

### Infrastructure Decisions

| Decision | Rationale |
|---|---|
| All monetary values as BigInt (paise) | Eliminates floating-point errors on financial calculations. App layer converts to/from rupees. |
| Area stored as BigInt (sqft x100) | Preserves 2 decimal precision without floating-point risk |
| Dual DATABASE_URL + DIRECT_URL | Prisma official pattern for Supabase. Transaction pooler (6543) for runtime queries, Session pooler (5432) for DDL schema operations. Permanent fix. |
| db push over migrate dev | Used during all development phases. Migration files formalized in Phase 11 before production deployment. |
| JSONB for flexible fields | checklist, kyc_documents, milestones, disbursements, settings — all variable-structure data stored as JSONB |
| AuditLog no updatedAt | Audit logs are immutable append-only records. No updates ever. |
| Soft deletes via isActive | No physical deletes anywhere. Zero data loss guarantee. |

### File Manifest

prisma/schema.prisma    (updated: 28 models + 35 enums)
.env                    (updated: DIRECT_URL added)

---

## [0.2.0] — 2026-02-27

### 🔐 Phase 2 — Authentication & RBAC

> **Scope:** JWT authentication, organization middleware, RBAC permission 
> guard, and all auth API endpoints.
> **Status:** ✅ Complete

### Added

#### Phase 2A — Security Middleware
- Implemented src/middleware/auth.js — requireAuth middleware verifying 
  JWT Bearer tokens, checking Redis blacklist for logged-out tokens, 
  and attaching decoded payload (userId, organizationId, role, 
  permissions, email) to req.user.
- Implemented optionalAuth variant for routes that work both 
  authenticated and unauthenticated.
- Implemented src/middleware/organization.js — requireOrganization 
  middleware that sets PostgreSQL session variable 
  app.current_organization_id via Prisma $executeRawUnsafe for 
  automatic Row Level Security enforcement on all queries.
- Implemented src/middleware/rbac.js — requirePermission factory 
  that accepts permission strings and returns Express middleware. 
  Admin role bypasses all permission checks. requireRole guard added 
  for coarse role-level gating. Full permissions reference documented.

#### Phase 2B — Auth Service & Routes
- Created src/modules/auth/ folder with 3 files.
- Implemented auth.service.js with: registerOrganization (atomic 
  org + admin user creation via Prisma transaction), login (bcrypt 
  password verification, vague error messages to prevent enumeration), 
  refreshTokens (single-use rotation with Redis validation), logout 
  (Redis blacklisting with TTL matching token expiry), getMe (full 
  profile with permissions).
- Implemented getRolePermissions() — single source of truth mapping 
  each role (admin, sales_manager, sales_executive, finance, operations) 
  to its full permission string array.
- Implemented auth.schema.js — Zod validation schemas for register, 
  login, refresh requests plus validateBody middleware factory.
- Implemented auth.routes.js — 5 endpoints with authRateLimiter 
  applied to all auth routes.
- Mounted auth router in server.js at /v1/auth.

### Verified Endpoints

| Method | Route | Status |
|---|---|---|
| POST | /v1/auth/register | ✅ 201 |
| POST | /v1/auth/login | ✅ 200 |
| GET | /v1/auth/me | ✅ 200 |
| POST | /v1/auth/refresh | ✅ 200 |
| POST | /v1/auth/logout | ✅ 200 |
| GET | /v1/auth/me (after logout) | ✅ 401 |
| Any auth route (rate limit hit) | ✅ 429 |

### Security Decisions

| Decision | Rationale |
|---|---|
| Vague login errors | Never reveal which field is wrong — prevents user enumeration |
| Refresh token rotation | Each refresh token is single-use — stolen tokens cannot be reused |
| Redis blacklist on logout | Stateless JWTs invalidated instantly without waiting for expiry |
| bcrypt cost factor 12 | Balances security vs performance for production load |
| Auth rate limit 10/15min | Prevents brute-force without blocking legitimate users |

### File Manifest

src/modules/auth/auth.service.js   (created)
src/modules/auth/auth.schema.js    (created)
src/modules/auth/auth.routes.js    (created)
src/middleware/auth.js             (created)
src/middleware/organization.js     (created)
src/middleware/rbac.js             (created)
src/server.js                      (updated: auth router mounted)

## [0.1.0] — Foundation

### Phase 1 — Foundation

### Added
- Project initialization with Express and Prisma (v6)
- Database schema and Redis connection
- Environment configurations and Zod validations
- Rate limiting middleware and Global error handlers
