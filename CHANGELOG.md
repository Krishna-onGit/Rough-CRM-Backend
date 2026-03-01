# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.8.0] — 2026-02-28

### 👥 Phase 8 — Customers, Documents, Complaints & Communications

> **Scope:** Complete customer management, KYC document uploads,
> SLA-driven complaint tracking, and communication logging.
> **Status:** ✅ Complete

### Added

#### Phase 8A — Customers & Documents Modules
- Implemented src/modules/customers/customer.schema.js —
  Zod schemas enforcing PAN format (ABCDE1234F), 12-digit
  Aadhaar, and Indian mobile numbers.
- Implemented src/modules/customers/customer.service.js —
  listCustomers, getCustomer (with linked bookings + metrics),
  createCustomer (unique PAN + mobile per org, sequential
  CUST-XXXX code), updateCustomer, verifyKyc (blocks if no[]
  PAN on file).
- Implemented maskSensitiveData helper — hides exact PAN
  and Aadhaar components from non-admin/finance roles.
- Implemented src/modules/documents/document.schema.js —
  Zod schemas for upload and verify flows.
- Implemented src/modules/documents/document.service.js —
  uploadDocument (auto-updates customer.kycDocuments JSONB
  on approved categories), verifyDocument (only targets
  uploaded status).

#### Phase 8B — Complaints & Communications Modules
- Implemented src/modules/complaints/complaint.schema.js —
  Zod schemas for create, update, resolve, and escalate.
- Implemented src/modules/complaints/complaint.service.js —
  listComplaints, getComplaint (dynamic SLA breach check),
  createComplaint (auto-calculates SLA deadline based on priority),
  updateComplaint (auto-sets to in_progress on assignment),
  resolveComplaint (computes resolutionHours), escalateComplaint
  (upgrades priority to high, flags breach).
- Implemented src/modules/communications/communication.schema.js —
  Zod schema requiring EITHER customerId or leadId (via .refine),
  blocks duration on non-call channels.
- Implemented src/modules/communications/communication.service.js —
  logCommunication, getCommunicationSummary (groups metrics
  by channel, direction, and aggregates total call duration).
- Mounted all 4 routers in server.js (/v1/customers, /v1/documents,
  /v1/complaints, /v1/communications).

---

## [0.7.0] — 2026-02-28

### 🏢 Phase 7 — Post-Sales Module

> **Scope:** Payments, demand letters, cancellations, transfers,
> possession handover, and snag items.
> **Status:** ✅ Complete

### Added

#### Phase 7A — Payments & Demand Letters
- Implemented src/modules/postSales/payment.schema.js and
  payment.service.js — recordPayment (links to demand letter,
  generates RCT-XXXX), updatePaymentStatus (handles bounces
  by reversing paid amount on linked demand letter).
- Implemented src/modules/postSales/demandLetter.schema.js and
  demandLetter.service.js — createDemandLetter, sendReminder
  (throttled to 24 hours per letter).

#### Phase 7B — Cancellations & Transfers
- Implemented src/modules/postSales/cancellation.schema.js and
  cancellation.service.js — initiateCancellation (creates an
  ApprovalRequest), previewRefund, processCancellation
  (releases unit, cancels commissions, updates booking status
  atomically).
- Implemented src/modules/postSales/transfer.schema.js and
  transfer.service.js — initiateTransfer, processTransfer
  (updates unit owner, links new customer atomically).

#### Phase 7C — Possession & Snag Items
- Implemented src/modules/postSales/possession.schema.js and
  possession.service.js — list/get possessions, updatePossession,
  completePossession (blocks if checklist incomplete, pushes
  status to possession_handed natively).
- Integrated Snag Item endpoints inside possession service —
  createSnag (blocks on completed possessions), updateSnag
  (auto-injects resolvedDate on resolved status).
- Mounted all 5 routers in server.js.

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
