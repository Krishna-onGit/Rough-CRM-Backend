# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
