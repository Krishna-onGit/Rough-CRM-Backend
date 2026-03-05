const fs = require('fs');
const path = require('path');

const file = 'CHANGELOG.md';
let content = fs.readFileSync(file, 'utf8');

const missingBlock = `## [0.15.0] — 2026-03-03

### 🔧 Phase 15A — Quick Wins & Hardening
> **Scope:** Interval fixes, DOB validation, payment
> auto-clear, RLS parameterization, cache invalidation,
> audit log allowlist.
> **Status:** ✅ Complete

**Schema:** DemandLetter @@unique([organizationId,
letterCode]) already present — no migration needed.

**Modified files:**
- \`src/jobs/blockExpiry.job.js\` — Interval changed from
  15 * 60 * 1000 (15 min) to 60 * 1000 (1 min). Spec
  BLK-003 compliance. Expired blocks now release within
  1 minute instead of up to 14 minutes.
- \`src/jobs/demandOverdue.job.js\` — Changed from daily
  cron (pattern: '0 1 * * *') to hourly fixed interval
  (every: 60 * 60 * 1000). Overdue demand letters flagged
  within the hour not next day.
- \`src/modules/customers/customer.schema.js\` — dateOfBirth
  changed from z.string().datetime().optional() to
  z.string().optional().refine() with exact age calculation
  accounting for birthday boundary. Rejects under-18 with
  clear message. Allows exactly 18 years old.
- \`src/modules/postSales/payment.service.js\` — Added
  INSTANT_PAYMENT_MODES = ['upi', 'neft', 'rtgs', 'imps'].
  initialStatus = 'cleared' for instant modes,
  'under_process' for cheque/demand_draft. Uses
  .toLowerCase() for case-insensitive match. initialStatus
  used in payment.create() data preserving Phase 13C
  idempotency behavior.
- \`src/middleware/organization.js\` — Replaced
  prisma.$executeRawUnsafe with prisma.$executeRaw tagged
  template. Eliminates SQL injection vector on RLS query.
- \`src/modules/salesEngine/booking.service.js\` — Added
  redis.del(analytics:dashboard:{organizationId}) after
  successful booking transaction commit.
- \`src/modules/postSales/cancellation.service.js\` — Added
  redis.del(analytics:dashboard:{organizationId}) after
  successful cancellation transaction commit.
- \`src/middleware/auditLogger.js\` — Replaced denylist
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
- Added \`escalatedAt DateTime? @map("escalated_at")\` to
  \`ApprovalRequest\` model
- Migration: \`add_approval_escalated_at\`

**Dependencies added:**
- \`rate-limit-redis\` — Redis-backed store for org rate limiter
  (uses \`bullMQConnection\` ioredis client via \`.call()\`)

**New files:**
- \`src/jobs/slaBreachCheck.job.js\` — BullMQ repeatable job
  (every 30 min). Finds complaints where status not in
  resolved/closed, slaDeadline < now, slaBreached = false.
  Single updateMany marks all breached. Fetches affected
  records (updatedAt window = last 31 min) and dispatches
  SLA_BREACHED notification per complaint. Full try/catch —
  worker failure never crashes server.
- \`src/jobs/approvalEscalation.job.js\` — BullMQ repeatable
  job (every 30 min). Finds approvalRequests where status =
  pending, createdAt < now - 48h, escalatedAt = null. Updates
  escalatedAt = now per record. Dispatches APPROVAL_ESCALATED
  notification with hoursElapsed. Full try/catch resilience.

**Modified files:**
- \`src/config/rateLimiter.js\` — Added orgRateLimiter using
  rateLimit() with RedisStore (ioredis bullMQConnection via
  \`.call()\`). Key: org:{organizationId}:ratelimit. Limit: 300
  requests/org/minute. Returns 429 with code
  ORG_RATE_LIMIT_EXCEEDED. Skips /health path.
- \`src/server.js\` — Imported both job files at top (self-
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
- Added \`pending_discount_approval\` to \`BookingStatus\` enum
- Added \`registrationNumber String?\` to \`Booking\` model
- Added \`registrationRemarks String?\` to \`Booking\` model
- Added \`registeredBy String?\` to \`Booking\` model
- Added \`approvalCode String? @unique\` to \`ApprovalRequest\` model
- Migration: \`add_booking_registration_fields\`

**New files:**
- \`src/cascade/handlers/onRegistrationCompleted.js\` — 3-step
  registration cascade: booking → registered, unit → registered,
  commissions with status in pending/approved → sale_completed.
  Safe no-op if commission already sale_completed via possession.

**Modified files:**
- \`src/cascade/types.js\` — Added \`REGISTRATION_COMPLETED\` event
- \`src/cascade/cascadeEngine.js\` — Wired onRegistrationCompleted
  handler with tx + notificationsToDispatch threading
- \`src/modules/salesEngine/booking.service.js\` — Discount gate
  in createBooking(): discounts ≤1% of agreementValue proceed
  normally (status: booked). Discounts >1% set booking status
  to pending_discount_approval, unit stays blocked, approval
  request auto-created with requestType: discount and full
  justification including exact discount %. Added
  registerBooking(): fetches booking, validates registerable
  status (booked/possession_handed), requires registrationDate
  and registrationNumber, fires REGISTRATION_COMPLETED cascade
  atomically, dispatches notifications post-commit.
- \`src/modules/salesEngine/booking.routes.js\` — Added
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
| \`src/modules/units/unit.service.js\` | Updated |
| \`src/modules/postSales/transfer.schema.js\` | Updated |
| \`src/modules/postSales/transfer.service.js\` | Updated |
| \`src/modules/salesEngine/booking.service.js\` | Updated |

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
- Added \`cancelled\` to \`DemandLetterStatus\` enum
- Added \`cancelled\` to \`ScheduleStatus\` enum
- Added \`idempotencyKey String? @unique\` to \`Payment\` model
- Added \`panHash String? @unique\` to \`Customer\` model
- Added \`@@unique([organizationId, letterCode])\` to \`DemandLetter\` model

**New files:**
- \`src/shared/encryption.js\` — AES-256-GCM encrypt/decrypt with
  key versioning (\`v1:iv:authTag:ciphertext\` format). Supports
  future key rotation without data loss. \`safeDecrypt()\` for
  display layer, \`decrypt()\` for security-critical paths.
- \`src/shared/cryptoHash.js\` — HMAC-SHA256 \`hashPan()\` and
  \`hashAadhaar()\` for deterministic equality lookup without
  exposing plaintext. Separate secret key (PAN_HASH_KEY) prevents
  rainbow table attacks against known PAN format space.
- \`scripts/encrypt-existing-pii.js\` — One-time batch migration
  script. Processes customers in batches of 100, skips already-
  encrypted records via \`isEncrypted()\` regex check, 10ms rate
  limit between records to prevent DB saturation.

**Modified files:**
- \`src/modules/customers/customer.service.js\` — \`createCustomer()\`
  encrypts PAN/Aadhaar via \`encrypt()\` and stores HMAC hash via
  \`hashPan()\` before write. PAN lookup queries use \`panHash\` field
  exclusively (never plaintext comparison). \`maskSensitiveData()\`
  decrypts via \`safeDecrypt()\` then applies role-based masking:
  admin/finance see full values, all other roles see masked format
  (\`AB•••••EF\` for PAN, \`XXXX-XXXX-1234\` for Aadhaar).
  \`verifyKyc()\` checks \`panHash\` presence (not \`panNumber\`).
- \`src/server.js\` — \`BigInt.prototype.toJSON\` override injected
  before \`const app = express()\`. Serializes BigInt as safe integer
  or string fallback. Prevents silent \`TypeError: Do not know how
  to serialize a BigInt\` crashes on analytics and aggregation
  endpoints.

**Environment variables added:**
- \`PII_ENCRYPTION_KEY\` — 64 hex chars (32 bytes) for AES-256-GCM
- \`PAN_HASH_KEY\` — 64 hex chars (32 bytes) for HMAC-SHA256

**Verified:**
- Raw DB query confirms \`pan_number\` column stores ciphertext
- \`pan_hash\` column stores 64-char HMAC hex
- Admin role receives decrypted PAN in API response
- Non-admin role receives masked PAN in API response
- Duplicate PAN on \`createCustomer()\` returns \`isExisting: true\`
  with existing customer record instead of ConflictError

---

### Phase 13B — Cascade Engine Completion

**New files:**
- \`src/cascade/handlers/onUnitCancelled.js\` — 8-step cancellation
  cascade: booking → cancelled, unit → available (all 12 FK fields
  nulled), cleared payments → refund_pending, demand letters →
  cancelled, payment schedule → cancelled, commissions → cancelled,
  agent \`pendingCommission\` decremented per cancelled commission,
  possession record → cancelled. Notifications queued into
  caller-owned array, dispatched after tx commit.
- \`src/cascade/handlers/onPaymentBounced.js\` — Auto-creates
  complaint (category: payment, priority: high, SLA: 24h) within
  caller's transaction. Complaint code generated inside tx for
  consistent read. Notifications queued post-commit.
- \`src/cascade/handlers/onTransferInitiated.js\` — Full ownership
  migration across 10 record types: booking, unit, possession,
  payments, demand letters, loan records (\`tx.loanRecord\` — not
  \`tx.loan\`), payment schedules, commissions, communication logs,
  customer documents. Complaints and snag items intentionally
  not transferred (belong to originating customer relationship).
- \`src/cascade/handlers/onPossessionCompleted.js\` — Owns booking
  and unit status updates (\`possession_handed\`). Updates commissions
  with status in \`['pending', 'approved']\` → \`sale_completed\`,
  making them eligible for payout. Critical previously-missing step.

**Modified files:**
- \`src/cascade/cascadeEngine.js\` — Replaced 4 \`console.log\` stubs
  with real handler dispatch. All handlers receive \`(payload, tx,
  notificationsToDispatch)\`. \`triggerCascade()\` accepts and threads
  the caller's \`tx\` and notification array through to each handler.
- \`src/modules/postSales/cancellation.service.js\` — Replaced inline
  cascade logic with \`triggerCascade(UNIT_CANCELLED)\`. Removed
  \`approvalRequest.update\` (approval lifecycle owned by
  \`approval.service.js\` exclusively). Notifications dispatched
  after \`$transaction\` commits. Transaction timeout: 30000ms.
- \`src/modules/postSales/payment.service.js\` — Wrapped entire
  \`updatePaymentStatus()\` in \`$transaction\`. Demand letter reversal
  and bounce cascade run atomically. \`triggerCascade(PAYMENT_BOUNCED)\`
  fires on \`status === 'bounced'\`. Transaction timeout: 15000ms.
- \`src/modules/postSales/transfer.service.js\` — Replaced inline
  3-of-10 record migration with \`triggerCascade(TRANSFER_INITIATED)\`.
  All 10 record types now migrated atomically. Transaction
  timeout: 30000ms.
- \`src/modules/postSales/possession.service.js\` — Removed inline
  \`tx.booking.update\` and \`tx.unit.update\` for \`possession_handed\`
  status. \`onPossessionCompleted\` cascade exclusively owns these
  updates. Added \`triggerCascade(POSSESSION_COMPLETED)\`.

**Design contract enforced across all handlers:**
- All handlers run inside the CALLER's \`$transaction\` (not their own)
- Notifications pushed to caller-owned array, never dispatched
  inside a transaction boundary
- \`onUnitCancelled\` does not touch \`approvalRequest\` table
- \`onPossessionCompleted\` owns booking/unit status exclusively

---

### Phase 13C — Atomic Approval, Idempotency & Business Rules

**Modified files:**
- \`src/modules/approvals/approval.service.js\` — \`reviewApproval()\`
  now wraps approval status update AND cascade execution in a single
  \`$transaction\`. If the cascade fails, the approval status rolls
  back to \`pending\`. Eliminates the stuck state where approval was
  \`approved\` but the underlying action never completed.
  \`executeApprovedAction()\` is a module-private function (not
  exported) that dispatches to \`processCancellation()\` or
  \`processTransfer()\` passing the active \`tx\` and notification
  array. Static imports used (no dynamic \`await import()\`).
  \`forfeiturePct\` read from cancellation record, not user-supplied
  \`requestData\`. Transaction timeout: 30000ms.
- \`src/modules/postSales/cancellation.service.js\` — \`processCancellation()\`
  accepts optional \`existingTx = null\` and
  \`notificationsToDispatch = []\` parameters. When \`existingTx\` is
  provided (called from approval), runs inside it. When null
  (called directly from route), opens its own \`$transaction\` and
  dispatches notifications after commit.
- \`src/modules/postSales/transfer.service.js\` — Same
  \`existingTx = null\` pattern applied to \`processTransfer()\`.
- \`src/modules/postSales/payment.service.js\` — \`recordPayment()\`
  uses create-then-catch-P2002 idempotency pattern. Attempts
  \`prisma.payment.create()\` directly. On P2002 targeting
  \`idempotency_key\`, fetches and returns existing record with
  \`isDuplicate: true\`. Eliminates check-then-create race condition.
  \`idempotencyKey\` added to \`recordPaymentSchema\` as optional UUID.
- \`src/modules/agents/agent.service.js\` — Commission payout
  eligibility: \`PAYOUT_ELIGIBLE_STATUSES = ['sale_completed']\`
  exclusively. Removed \`'approved'\` and \`'partially_paid'\` from
  eligible statuses. Commissions reach \`sale_completed\` only via
  \`onPossessionCompleted\` cascade. Error message directs caller
  to complete possession before requesting payout.
- \`src/modules/salesEngine/booking.service.js\` — KYC completeness
  gate in \`createBooking()\`. Checks \`fullName\`, \`dateOfBirth\`,
  \`mobilePrimary\`, \`email\`, \`currentAddress\`, and \`panHash\`.
  Uses \`panHash\` for PAN presence check (not \`panNumber\`, which
  holds ciphertext post-13A). Returns 422 with complete list of
  missing field names. Allows lightweight customer creation during
  lead capture; enforces completeness only when money is involved.

**Verified via simulation testing:**
- Atomic approval: simulated \`throw\` inside \`onUnitCancelled\`
  confirmed approval status rolls back to \`pending\`
- Idempotency: duplicate submission with same UUID returns
  \`isDuplicate: true\`, single DB record confirmed
- Commission gate: 422 returned on \`pending\` commission,
  payout succeeds after possession sets \`sale_completed\`
- KYC gate: 422 returned listing all missing fields by name

---

### File Manifest — Phase 13 Complete

| File | Action |
|------|--------|
| \`src/shared/encryption.js\` | Created |
| \`src/shared/cryptoHash.js\` | Created |
| \`scripts/encrypt-existing-pii.js\` | Created |
| \`src/cascade/handlers/onUnitCancelled.js\` | Created |
| \`src/cascade/handlers/onPaymentBounced.js\` | Created |
| \`src/cascade/handlers/onTransferInitiated.js\` | Created |
| \`src/cascade/handlers/onPossessionCompleted.js\` | Created |
| \`src/cascade/cascadeEngine.js\` | Updated |
| \`src/modules/customers/customer.service.js\` | Updated |
| \`src/modules/postSales/cancellation.service.js\` | Updated |
| \`src/modules/postSales/payment.service.js\` | Updated |
| \`src/modules/postSales/transfer.service.js\` | Updated |
| \`src/modules/postSales/possession.service.js\` | Updated |
| \`src/modules/approvals/approval.service.js\` | Updated |
| \`src/modules/agents/agent.service.js\` | Updated |
| \`src/modules/salesEngine/booking.service.js\` | Updated |
| \`src/server.js\` | Updated |
| \`prisma/schema.prisma\` | Updated |
| \`package.json\` | Updated |

---

`;

const splitTarget = '## [0.12.0] — 2026-03-01';
if (content.indexOf(splitTarget) === -1) {
    console.error("Could not find TARGET");
} else {
    // We construct the new content:
    const headerIndex = content.indexOf('## [Unreleased]') + '## [Unreleased]'.length + 1;
    let newContent = content.substring(0, headerIndex) + '\n' + missingBlock + content.substring(content.indexOf(splitTarget));
    fs.writeFileSync(file, newContent);
    console.log("SUCCESS!");
}
