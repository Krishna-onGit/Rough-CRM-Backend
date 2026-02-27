# LeadFlow AI — Production Backend Specification

## Enterprise Real-Estate CRM Engine

**Version:** 1.0.0
**Last Updated:** February 2026
**Classification:** Internal Engineering Document

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture](#3-system-architecture)
4. [Multi-Organization Architecture](#4-multi-organization-architecture)
5. [Authentication & RBAC](#5-authentication--rbac)
6. [Database Schema (PostgreSQL)](#6-database-schema-postgresql)
7. [API Design](#7-api-design)
8. [Cross-Module Cascade Engine](#8-cross-module-cascade-engine)
9. [Background Jobs & Scheduling](#9-background-jobs--scheduling)
10. [Approval Workflow Engine](#10-approval-workflow-engine)
11. [Audit Logging System](#11-audit-logging-system)
12. [File Storage & Document Vault](#12-file-storage--document-vault)
13. [Business Rules & Validation](#13-business-rules--validation)
14. [Error Handling & Observability](#14-error-handling--observability)
15. [Deployment & Infrastructure (AWS)](#15-deployment--infrastructure-aws)
16. [Security Hardening](#16-security-hardening)
17. [Performance & Scaling](#17-performance--scaling)
18. [Migration Strategy](#18-migration-strategy)

---

## 1. Executive Summary

LeadFlow AI is an enterprise-grade real-estate CRM backend supporting the full property lifecycle — from lead acquisition through possession handover — across multiple projects, cities, and organizations. The system handles ~4,000+ units across 21+ projects with strict Indian regulatory compliance (RERA, GST, TDS, Stamp Duty).

### Core Design Principles

- **Event-Driven Cascades**: A single action (e.g., booking creation) triggers automatic record creation across 5+ modules via a transactional event bus.
- **Zero Data Loss**: Soft deletes everywhere. No entity is ever physically removed.
- **Multi-Organization Isolation**: Row-Level Security (RLS) at the PostgreSQL level ensures complete data isolation between real-estate companies.
- **Approval Gates**: Critical financial/legal operations require maker-checker approval before execution.
- **Full Audit Trail**: Every state change across every entity is recorded with actor, timestamp, before/after snapshots.

---

## 2. Technology Stack

| Layer | Technology | Justification |
|---|---|---|
| **Runtime** | Node.js 24.x.x LTS | Stable, long-term support |
| **Framework** | Express 5.x.x | Widely adopted, flexible middleware ecosystem |
| **Language** | JavaScript (ES2025+) | Broad ecosystem compatibility, no transpilation required |
| **Database** | Supabase PostgreSQL | Managed PostgreSQL with built-in RLS, real-time, and dashboard support |
| **ORM** | Prisma 10.x | Type-safe queries, migration management, introspection |
| **Cache** | Upstash Redis | Serverless Redis with HTTP-based access, no infrastructure management |
| **Job Queue** | BullMQ 5.x | Cron scheduling, retries, priority queues, dead-letter support |
| **Auth** | Custom-Built Authentication | Manually implemented JWT-based auth with session management and RBAC |
| **File Storage** | AWS S3 | Document vault, presigned URLs, lifecycle policies |
| **Search** | PostgreSQL Full-Text + trigram | Sufficient for CRM-scale; no need for Elasticsearch initially |
| **API Protocol** | REST (JSON) | Express schema-validated routes |
| **Monitoring** | AWS CloudWatch + Sentry | Logs, metrics, error tracking |
| **CI/CD** | GitHub Actions → ECR → ECS | Automated build, test, deploy pipeline |
| **Containerization** | Docker (multi-stage builds) | Consistent environments across dev/staging/prod |

---

## 3. System Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│          React 18 (Existing Frontend)                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS / REST
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AWS ALB (Load Balancer)                    │
│                    SSL Termination + WAF                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                             │
│              ┌──────────────────────────┐                       │
│              │   Express API Server     │                       │
│              │   (ECS Fargate x 2-4)    │                       │
│              │                          │                       │
│              │  ┌────────────────────┐  │                       │
│              │  │  Auth Middleware    │  │  ← Custom JWT verify  │
│              │  │  Org Middleware     │  │  ← RLS context set    │
│              │  │  RBAC Middleware    │  │  ← Permission check   │
│              │  │  Audit Middleware   │  │  ← Auto-log actions   │
│              │  └────────────────────┘  │                       │
│              │                          │                       │
│              │  ┌────────────────────┐  │                       │
│              │  │  Route Handlers    │  │                       │
│              │  │  Business Logic    │  │                       │
│              │  │  Cascade Engine    │  │                       │
│              │  │  Validation Layer  │  │                       │
│              │  └────────────────────┘  │                       │
│              └──────────┬───────────────┘                       │
│                         │                                       │
│              ┌──────────▼───────────────┐                       │
│              │   BullMQ Worker          │                       │
│              │   (ECS Fargate x 1-2)    │                       │
│              │                          │                       │
│              │  • Block expiry cron     │                       │
│              │  • Cascade side-effects  │                       │
│              │  • Notification dispatch │                       │
│              │  • Report generation     │                       │
│              └──────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
                           │
              ┌────────────┼────────────────┐
              ▼            ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Supabase    │  │   Upstash    │  │    AWS S3    │
│  PostgreSQL  │  │   Redis      │  │  (Documents) │
│              │  │              │  │              │
│ • All data   │  │ • Job queues │  │ • KYC docs   │
│ • RLS org    │  │ • Block cache│  │ • Agreements │
│ • Audit logs │  │ • Sessions   │  │ • NOCs       │
│ • Full-text  │  │ • Rate limit │  │ • Receipts   │
└──────────────┘  └──────────────┘  └──────────────┘
```

### Service Layer Organization

```
src/
├── server.js                    # Express bootstrap, middleware registration
├── config/
│   ├── env.js                   # Environment variables (validated)
│   ├── database.js              # Prisma client singleton
│   ├── redis.js                 # Upstash Redis / BullMQ connection
│   └── s3.js                    # AWS S3 client
├── middleware/
│   ├── auth.js                  # Custom JWT verification
│   ├── organization.js          # Organization context extraction + RLS SET
│   ├── rbac.js                  # Permission guard
│   ├── audit.js                 # Auto audit logging
│   └── rateLimit.js             # Per-organization rate limiting
├── modules/
│   ├── projects/
│   │   ├── project.routes.js
│   │   ├── project.service.js
│   │   └── project.schema.js    # Validation schemas
│   ├── units/
│   │   ├── unit.routes.js
│   │   ├── unit.service.js
│   │   ├── unit.generator.js    # Auto unit generation logic
│   │   └── unit.schema.js
│   ├── inventory/
│   │   ├── inventory.routes.js
│   │   ├── inventory.service.js
│   │   ├── blocking.service.js  # Block/release with timer logic
│   │   └── inventory.schema.js
│   ├── preSales/
│   │   ├── lead.routes.js
│   │   ├── lead.service.js
│   │   ├── siteVisit.routes.js
│   │   ├── siteVisit.service.js
│   │   ├── followUp.routes.js
│   │   └── followUp.service.js
│   ├── salesEngine/
│   │   ├── salesTeam.routes.js
│   │   ├── salesTeam.service.js
│   │   ├── agent.routes.js
│   │   ├── agent.service.js
│   │   ├── booking.routes.js
│   │   ├── booking.service.js
│   │   ├── commission.routes.js
│   │   └── commission.service.js
│   ├── postSales/
│   │   ├── payment.routes.js
│   │   ├── payment.service.js
│   │   ├── demandLetter.routes.js
│   │   ├── demandLetter.service.js
│   │   ├── paymentSchedule.routes.js
│   │   ├── possession.routes.js
│   │   ├── possession.service.js
│   │   ├── complaint.routes.js
│   │   ├── complaint.service.js
│   │   ├── cancellation.routes.js
│   │   ├── cancellation.service.js
│   │   ├── transfer.routes.js
│   │   └── transfer.service.js
│   ├── customer360/
│   │   ├── customer.routes.js
│   │   ├── customer.service.js
│   │   ├── document.routes.js
│   │   ├── communication.routes.js
│   │   ├── loan.routes.js
│   │   └── agreement.routes.js
│   ├── analytics/
│   │   ├── analytics.routes.js
│   │   ├── sales.analytics.js
│   │   ├── inventory.analytics.js
│   │   ├── financial.analytics.js
│   │   └── channel.analytics.js
│   └── audit/
│       ├── audit.routes.js
│       └── audit.service.js
├── cascade/
│   ├── cascadeEngine.js         # Central event dispatcher
│   ├── handlers/
│   │   ├── onBookingCreated.js
│   │   ├── onUnitCancelled.js
│   │   ├── onPaymentBounced.js
│   │   ├── onTransferInitiated.js
│   │   └── onPossessionCompleted.js
│   └── types.js
├── jobs/
│   ├── blockExpiry.job.js       # Cron: check & release expired blocks
│   ├── demandOverdue.job.js     # Cron: mark overdue demand letters
│   ├── notificationDispatch.js  # Queue: email/SMS notifications
│   └── reportGeneration.js      # Queue: async report building
├── approval/
│   ├── approval.routes.js
│   ├── approval.service.js
│   └── approval.schema.js
├── shared/
│   ├── errors.js                # Custom error classes
│   ├── pagination.js            # Cursor/offset pagination helpers
│   ├── filters.js               # Dynamic filter builder
│   ├── costSheet.js             # Unit cost calculation engine
│   └── refund.js                # Cancellation refund calculator
└── prisma/
    ├── schema.prisma
    ├── migrations/
    └── seed.js
```

---

## 4. Multi-Organization Architecture

### Strategy: Shared Database, Row-Level Security (RLS)

Every table includes an `organization_id` column. PostgreSQL RLS policies ensure organizations can never access each other's data, even in case of application bugs.

### PostgreSQL RLS Setup

RLS is enabled on every organization-scoped table. Each table has a policy ensuring rows are only visible when the `organization_id` matches the current session variable (`app.current_organization_id`). The application database role must not be a superuser, as superusers bypass RLS. The role is granted `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on all public schema tables.

### Express Organization Middleware

The organization middleware extracts the organization ID from the verified JWT custom claim. It then sets the PostgreSQL session variable for RLS using a raw Prisma query, and attaches the `organizationId` to the request object for downstream use. If no organization context is found in the token, the middleware returns a 403 error immediately.

### Organization Table

The `organizations` table stores: `id` (UUID primary key), `name` (company name), `slug` (URL-friendly unique identifier), `auth_org_id` (custom auth organization reference), `plan` (standard / premium / enterprise), `settings` (JSONB for organization-specific config), `is_active` (boolean), `created_at`, and `updated_at`.

---

## 5. Authentication & RBAC

### Custom Authentication

A manually built JWT-based authentication system is used. Each organization is treated as an isolated auth domain with its own user pool and role assignments. Authentication supports MFA enforcement at the organization level and machine-to-machine tokens for background service communication.

### Roles & Permissions Matrix

| Permission | Admin | Sales Manager | Sales Executive | Finance | Operations |
|---|---|---|---|---|---|
| **Projects** | CRUD | Read + Update | Read | Read | Read |
| **Units (View)** | All | All | All | All | All |
| **Block Unit** | Yes | Yes | Own Only | No | No |
| **Create Booking** | Yes | Yes | Own Blocks | No | No |
| **Cancel Unit** | Yes | Requires Approval | No | No | No |
| **Approve Cancellation** | Yes | Yes | No | No | No |
| **Record Payment** | Yes | No | No | Yes | No |
| **Demand Letters** | Yes | No | No | Yes | No |
| **Process Refund** | Yes | No | No | Requires Approval | No |
| **Approve Refund** | Yes | No | No | No | No |
| **Transfer Unit** | Yes | Requires Approval | No | No | No |
| **Approve Transfer** | Yes | Yes | No | No | No |
| **Leads (View)** | All | Team | Own Only | No | No |
| **Leads (Create/Edit)** | Yes | Yes | Own Only | No | No |
| **Site Visits** | All | Team | Own Only | No | Read |
| **Possession** | Yes | No | No | No | Yes |
| **Complaints** | All | All | Own | Read | All |
| **Sales Team CRUD** | Yes | Read | Read Own | No | No |
| **Agent/Broker CRUD** | Yes | Yes | Read | Read | No |
| **Commission Manage** | Yes | Read | Read Own | Yes | No |
| **Analytics** | All | Team | Own | Financial Only | Operational |
| **Audit Logs** | Yes | Read Team | No | Read Financial | Read Ops |
| **Discount Approval** | Yes | Up to Slab | No | No | No |
| **Organization Settings** | Yes | No | No | No | No |

### JWT Custom Claims Structure

The custom JWT payload includes: the user subject (`sub`), organization ID (`organization_id`), user role (`role`), internal user UUID (`user_id`), and a `permissions` array listing fine-grained permission strings such as `units:block`, `bookings:create`, `leads:read:team`, and `analytics:read:team`.

### RBAC Middleware

The `requirePermission` middleware factory accepts one or more permission strings and returns an Express middleware function. It reads the permissions array from the verified JWT on the request object and checks that all required permissions are present. If any permission is missing, it returns a 403 response with the list of required permissions. This middleware is applied at the route level after the auth and organization middlewares.

---

## 6. Database Schema (PostgreSQL)

### Core Design Decisions

- All primary keys are `UUID` (no sequential IDs exposed to clients).
- Every table has `organization_id`, `created_at`, `updated_at`, `created_by`, `updated_by`.
- Soft delete via `is_active BOOLEAN DEFAULT true` (projects, agents, sales persons) or status-based lifecycle (units, leads, bookings).
- All monetary values stored as `BIGINT` in **paise** (1/100 of INR) to avoid floating-point errors. Application layer converts to/from rupees.
- Timestamps are `TIMESTAMPTZ` (UTC storage, client-side timezone conversion).

### 6.1 Organizations & Users

The `organizations` table is defined in Section 4. The `users` table stores: `id` (UUID), `organization_id` (FK to organizations), `auth_user_id` (unique string from custom auth), `full_name`, `email`, `mobile`, `role` (admin / sales_manager / sales_executive / finance / operations), `is_active`, `last_login_at`, `created_at`, and `updated_at`. A unique constraint is applied on `(organization_id, email)`. Indexes are created on `organization_id` and `auth_user_id`.

### 6.2 Projects & Towers

The `projects` table stores: `id` (UUID), `organization_id` (FK), `project_code` (human-readable, e.g. PRJ-MUM-001), `name`, `city`, `location`, `project_type` (Residential / Commercial / Mixed), `status` (active / pre_launch / completed), `base_rate` (per sqft in paise, BIGINT), `completion_pct` (DECIMAL), `rera_number`, `settings` (JSONB for floor rise and PLC config), `is_active`, `created_by`, `updated_by`, `created_at`, `updated_at`. A unique constraint on `(organization_id, project_code)` is enforced. Indexes are created on `organization_id`, `(organization_id, status)`, and `(organization_id, city)`.

The `towers` table stores: `id` (UUID), `organization_id` (FK), `project_id` (FK), `name` (e.g. "Tower A", "Wing 1"), `floors`, `units_per_floor`, `total_units` (computed as floors × units_per_floor), `is_active`, `created_at`, `updated_at`. A unique constraint on `(organization_id, project_id, name)` is enforced. An index is created on `(organization_id, project_id)`.

### 6.3 Units (Central Entity — 60+ Fields)

The `units` table is the central entity of the system. Key field groups include:

**Identity**: `id` (UUID), `organization_id` (FK), `project_id` (FK), `tower_id` (FK), `unit_number` (e.g. "A-1201"), `unit_code` (unique display code).

**Configuration**: `floor`, `config` (1BHK / 2BHK / 3BHK / 4BHK / Penthouse), `facing` (N/S/E/W/NE/NW/SE/SW), `view_type` (Sea / Garden / Pool / Road / City), `parking` (Covered / Open / Stack / None).

**Area** (stored in sq.ft × 100 for precision): `carpet_area`, `built_up_area`, `super_built_up_area`.

**Pricing** (all in paise): `base_rate` (per sqft), `base_price`, `floor_rise`, `plc` (Preferential Location Charge), `amenity_charge`, `agreement_value`, `gst_amount` (5%), `stamp_duty` (6%), `registration`, `total_price`.

**Lifecycle Status**: `status` — available | blocked | token_received | booked | agreement_done | registered | possession_handed | cancelled.

**Block Info** (populated when status = blocked): `blocked_by` (FK to sales_persons), `blocked_at`, `block_expires_at`, `block_agent_id` (FK to agents).

**Sale Info** (populated after booking): `sales_person_id`, `agent_id`, `customer_id`, `booking_id`, `sale_date`, `final_sale_value`, `discount_amount`, `discount_approved_by`.

**Tracking**: `is_active`, `created_by`, `updated_by`, `created_at`, `updated_at`. A unique constraint on `(organization_id, project_id, unit_number)` is enforced. Performance indexes are created on `(organization_id, project_id)`, `(organization_id, tower_id)`, `(organization_id, status)`, `(organization_id, config)`, `(organization_id, customer_id)`, `(organization_id, sales_person_id)`, and a partial index on `block_expires_at` where `status = 'blocked'`.

### 6.4 Sales Persons

The `sales_persons` table stores: `id` (UUID), `organization_id` (FK), `user_id` (nullable FK to users for legacy records), `sp_code` (e.g. SP-001), `full_name`, `mobile`, `email`, `team`, `designation` (VP Sales / Manager / Executive / Trainee), `reporting_to` (self-referencing FK), `monthly_target` (BIGINT in paise), `is_active`, `created_at`, `updated_at`. Unique constraints on `(organization_id, sp_code)` and `(organization_id, mobile)`. Indexes on `organization_id`, `(organization_id, team)`, and `(organization_id, is_active)`.

### 6.5 Agents / Brokers

The `agents` table stores: `id` (UUID), `organization_id` (FK), `agent_code` (e.g. AGT-001), `firm_name`, `contact_person`, `mobile`, `email`, `rera_number` (mandatory per Indian regulation), `pan`, `gst_number`, `commission_pct` (DECIMAL 5,2), `rating` (0.0–5.0), `total_commission` (BIGINT lifetime in paise), `pending_commission` (BIGINT), `is_active`, `created_at`, `updated_at`. Unique constraints on `(organization_id, agent_code)` and `(organization_id, rera_number)`. Indexes on `organization_id` and `(organization_id, is_active)`.

### 6.6 Customers

The `customers` table stores:

**Personal** (mandatory at booking): `id` (UUID), `organization_id` (FK), `customer_code` (e.g. CUST-001), `full_name` (as per PAN), `father_spouse`, `date_of_birth`, `pan_number`, `aadhaar_number`, `mobile_primary`, `mobile_alternate`, `email`, `current_address`.

**Financial**: `occupation`, `company_name`, `annual_income` (BIGINT in paise), `payment_mode` (self_funded / bank_loan / part_loan), `preferred_bank`, `loan_amount` (BIGINT in paise).

**Co-applicant**: `co_applicant_name`, `co_applicant_pan`, `co_applicant_rel` (Spouse / Parent / Sibling).

**KYC**: `kyc_documents` (JSONB array of document status objects), `kyc_verified` (boolean).

**Tracking**: `is_active`, `created_by`, `created_at`, `updated_at`. Unique constraints on `(organization_id, customer_code)` and `(organization_id, pan_number)`. GIN full-text index on `full_name`, `mobile_primary`, and `email` for search.

### 6.7 Leads (Pre-Sales)

The `leads` table stores: `id` (UUID), `organization_id` (FK), `lead_code` (e.g. LEAD-001), `full_name`, `mobile`, `email`, `source` (whatsapp / website / referral / walk_in), `status` (new | contacted | site_visit_scheduled | site_visit_done | interested | negotiation | won | lost | junk), `score` (INT 0–100), `interested_project` (FK), `interested_config`, `budget_min` (BIGINT), `budget_max` (BIGINT), `assigned_to` (FK to sales_persons), `assigned_at`, `converted_booking_id` (FK, populated on Won), `remarks`, `lost_reason`, `is_active`, `created_by`, `created_at`, `updated_at`. Indexes on `organization_id`, `(organization_id, status)`, `(organization_id, assigned_to)`, and `(organization_id, source)`.

### 6.8 Site Visits

The `site_visits` table stores: `id` (UUID), `organization_id` (FK), `lead_id` (FK), `project_id` (FK), `sales_person_id` (FK), `visit_date`, `visit_type` (first_visit / revisit / family_visit / loan_agent_visit), `visitor_count`, `check_in_at`, `check_out_at`, `feedback` (interested / thinking / not_interested / price_concern / location_concern), `remarks`, `created_at`, `updated_at`. Indexes on `organization_id`, `(organization_id, lead_id)`, and `(organization_id, visit_date)`.

### 6.9 Follow-Up Tasks

The `follow_up_tasks` table stores: `id` (UUID), `organization_id` (FK), `lead_id` (FK), `assigned_to` (FK to sales_persons), `task_type` (call / whatsapp / email / meeting / site_visit), `priority` (high / medium / low), `status` (pending / completed / missed / rescheduled), `scheduled_at`, `completed_at`, `outcome`, `remarks`, `created_at`, `updated_at`. Indexes on `organization_id`, `(organization_id, assigned_to, status)`, and `(organization_id, scheduled_at)`.

### 6.10 Bookings

The `bookings` table stores: `id` (UUID), `organization_id` (FK), `booking_code` (e.g. BKG-001), `unit_id` (FK), `project_id` (FK), `customer_id` (FK), `sales_person_id` (FK), `agent_id` (nullable FK), `agreement_value` (BIGINT), `final_value` (BIGINT after discount), `discount_amount` (BIGINT), `token_amount` (BIGINT), `payment_mode`, `status` (booked | agreement_done | registered | possession_handed | cancelled), `booking_date`, `agreement_date`, `registration_date`, `source_lead_id` (FK), `remarks`, `created_by`, `created_at`, `updated_at`. A unique constraint on `(organization_id, unit_id)` enforces one active booking per unit. Indexes on `organization_id`, `(organization_id, customer_id)`, `(organization_id, status)`, and `(organization_id, project_id)`.

### 6.11 Commissions

The `commissions` table stores: `id` (UUID), `organization_id` (FK), `booking_id` (FK), `agent_id` (FK), `unit_id` (FK), `agreement_value` (BIGINT), `commission_pct` (DECIMAL 5,2), `gross_commission` (BIGINT = agreement_value × commission_pct), `gst_amount` (BIGINT = 18% of gross), `tds_amount` (BIGINT = 5% of gross), `net_payable` (BIGINT = gross - gst - tds), `status` (pending | sale_completed | approved | partially_paid | paid | cancelled), `milestones` (JSONB array of payout milestone objects), `paid_amount` (BIGINT), `pending_amount` (BIGINT), `created_at`, `updated_at`. Indexes on `organization_id`, `(organization_id, agent_id)`, `(organization_id, booking_id)`, and `(organization_id, status)`.

### 6.12 Payments

The `payments` table stores: `id` (UUID), `organization_id` (FK), `booking_id` (FK), `customer_id` (FK), `unit_id` (FK), `demand_letter_id` (nullable FK), `receipt_number` (auto-generated e.g. RCP-001), `amount` (BIGINT in paise), `payment_mode` (cheque / neft / rtgs / upi / dd / cash), `transaction_ref` (UTR / Cheque No / UPI Ref), `payment_date` (DATE), `status` (cleared | bounced | under_process | refund_pending | refunded), `bounce_reason`, `bounce_date`, `remarks`, `recorded_by` (FK to users), `created_at`, `updated_at`. Indexes on `organization_id`, `(organization_id, booking_id)`, `(organization_id, customer_id)`, `(organization_id, status)`, and `(organization_id, payment_date)`.

### 6.13 Demand Letters

The `demand_letters` table stores: `id` (UUID), `organization_id` (FK), `booking_id` (FK), `customer_id` (FK), `unit_id` (FK), `letter_code` (e.g. DL-BKG001-01), `milestone_name` (e.g. "On Booking" / "On Slab"), `milestone_pct` (DECIMAL 5,2), `demand_amount` (BIGINT in paise), `due_date` (DATE), `status` (pending | partially_paid | paid | overdue), `paid_amount` (BIGINT), `remaining` (BIGINT = demand_amount - paid_amount), `reminder_count`, `last_reminder`, `created_at`, `updated_at`. Indexes on `organization_id`, `(organization_id, booking_id)`, `(organization_id, status)`, and a partial index on `(organization_id, due_date)` where status is pending or partially_paid.

### 6.14 Payment Schedule (CLP Milestones)

The `payment_schedules` table stores: `id` (UUID), `organization_id` (FK), `booking_id` (FK), `unit_id` (FK), `milestone_order`, `milestone_name`, `percentage` (DECIMAL 5,2), `amount` (BIGINT), `due_date` (DATE), `status` (upcoming / due / paid / overdue), `linked_demand_id` (FK to demand_letters), `created_at`, `updated_at`. Index on `(organization_id, booking_id)`.

### 6.15 Cancellation Records

The `cancellation_records` table stores: `id` (UUID), `organization_id` (FK), `booking_id` (FK), `unit_id` (FK), `customer_id` (FK), `cancel_code` (e.g. CAN-001), `cancellation_date`, `reason`, `requested_by` (FK to users), `approved_by` (FK to users).

**Refund Calculation fields** (all BIGINT in paise): `total_received`, `forfeiture_pct` (DECIMAL 5,2), `forfeiture_amt`, `gst_deduction` (18% on forfeiture), `tds_deduction`, `brokerage_recovery`, `admin_fee`, `net_refund` (= total_received - forfeiture - gst - tds - brokerage - admin_fee).

`refund_status` (pending / approved / processed / paid), `refund_date`, `refund_ref`, `approval_id` (FK to approval_requests), `created_at`, `updated_at`. Indexes on `organization_id` and `(organization_id, booking_id)`.

### 6.16 Transfer Records

The `transfer_records` table stores: `id` (UUID), `organization_id` (FK), `unit_id` (FK), `booking_id` (FK), `transfer_code` (e.g. TRF-001), `transfer_date`, `from_customer_id` (FK), `to_customer_id` (FK), `transfer_fee` (BIGINT), `noc_document_id` (mandatory FK to customer_documents), `status` (pending_approval | approved | executed | rejected), `requested_by` (FK to users), `approved_by` (FK to users), `approval_id` (FK to approval_requests), `remarks`, `created_at`, `updated_at`. Indexes on `organization_id` and `(organization_id, unit_id)`.

### 6.17 Possession Records

The `possession_records` table stores: `id` (UUID), `organization_id` (FK), `unit_id` (FK), `booking_id` (FK), `customer_id` (FK), `possession_date` (DATE), `status` (pending / in_progress / completed), `checklist` (JSONB for flexible item tracking, e.g. possession_letter, keys_handed, meter_readings, welcome_kit), `handover_by` (FK to users), `remarks`, `created_at`, `updated_at`. Indexes on `organization_id` and `(organization_id, unit_id)`.

### 6.18 Snag Items

The `snag_items` table stores: `id` (UUID), `organization_id` (FK), `possession_id` (FK), `unit_id` (FK), `description`, `category` (plumbing / electrical / civil / painting), `priority` (high / medium / low), `status` (open / in_progress / resolved), `reported_date`, `resolved_date`, `resolved_by` (FK to users), `remarks`, `created_at`, `updated_at`. Indexes on `(organization_id, possession_id)` and `(organization_id, status)`.

### 6.19 Complaints

The `complaints` table stores: `id` (UUID), `organization_id` (FK), `complaint_code`, `customer_id` (FK), `unit_id` (nullable FK), `booking_id` (nullable FK), `category` (payment / construction / documentation / general), `subject`, `description`, `priority` (high / medium / low), `status` (open / in_progress / resolved / closed / escalated), `assigned_to` (FK to users), `sla_hours` (INT default 48), `sla_deadline`, `sla_breached` (boolean), `resolved_at`, `resolution`, `created_at`, `updated_at`. Indexes on `organization_id`, `(organization_id, customer_id)`, `(organization_id, status)`, and a partial index on `(organization_id, sla_deadline)` where sla not breached and status not resolved or closed.

### 6.20 Customer Documents

The `customer_documents` table stores: `id` (UUID), `organization_id` (FK), `customer_id` (FK), `booking_id` (nullable FK), `category` (pan_card / aadhaar / photo / address_proof / income_proof / bank_statement / agreement / registration / noc / allotment_letter / possession_letter / other), `file_name`, `file_key` (AWS S3 key), `file_size` (BIGINT bytes), `mime_type`, `status` (uploaded / verified / rejected), `verified_by` (FK to users), `remarks`, `created_at`, `updated_at`. Indexes on `(organization_id, customer_id)` and `(organization_id, category)`.

### 6.21 Communication Logs

The `communication_logs` table stores: `id` (UUID), `organization_id` (FK), `customer_id` (nullable FK), `lead_id` (nullable FK), `channel` (call / email / whatsapp / sms / in_person), `direction` (inbound / outbound), `subject`, `content`, `initiated_by` (FK to users), `duration_seconds` (for calls), `created_at`. Indexes on `(organization_id, customer_id)` and `(organization_id, lead_id)`.

### 6.22 Loan Records

The `loan_records` table stores: `id` (UUID), `organization_id` (FK), `customer_id` (FK), `booking_id` (FK), `bank_name`, `loan_amount` (BIGINT), `sanctioned_amount` (BIGINT), `interest_rate` (DECIMAL 5,2), `tenure_months`, `status` (applied | sanctioned | disbursing | fully_disbursed | rejected), `disbursements` (JSONB array of disbursement objects with date, amount, tranche_number, and reference), `sanction_date`, `remarks`, `created_at`, `updated_at`. Indexes on `(organization_id, customer_id)` and `(organization_id, booking_id)`.

### 6.23 Agreement & Registration Records

The `agreement_records` table stores: `id` (UUID), `organization_id` (FK), `booking_id` (FK), `customer_id` (FK), `unit_id` (FK), `agreement_date` (DATE), `agreement_value` (BIGINT), `stamp_duty_paid` (BIGINT), `document_id` (FK to customer_documents), `remarks`, `created_at`, `updated_at`.

The `registration_records` table stores: `id` (UUID), `organization_id` (FK), `booking_id` (FK), `customer_id` (FK), `unit_id` (FK), `registration_date` (DATE), `registration_number`, `sub_registrar`, `registration_fee` (BIGINT), `document_id` (FK to customer_documents), `remarks`, `created_at`, `updated_at`.

### 6.24 Approval Requests

The `approval_requests` table stores: `id` (UUID), `organization_id` (FK), `request_type` (cancellation | refund | transfer | discount), `entity_type` (booking / unit / payment), `entity_id` (UUID of related entity), `requested_by` (FK to users), `request_data` (JSONB snapshot of what needs approval), `justification`, `status` (pending | approved | rejected), `reviewed_by` (FK to users), `reviewed_at`, `review_remarks`, `created_at`, `updated_at`. Indexes on `organization_id`, `(organization_id, status)`, `(organization_id, request_type)`, and a partial index on `(organization_id, reviewed_by)` where status is pending.

### 6.25 Audit Logs

The `audit_logs` table stores: `id` (UUID), `organization_id` (FK), `actor_id` (FK to users), `actor_role`, `action` (create / update / delete / status_change / approve / reject), `entity_type` (unit / booking / payment / lead / etc.), `entity_id` (UUID), `entity_code` (human-readable code for easy lookup), `before_state` (JSONB), `after_state` (JSONB), `changes` (JSONB diff of what changed), `metadata` (JSONB with IP, user-agent, route), `created_at`. The table is partitioned by month for performance. Indexes on `organization_id`, `(organization_id, entity_type, entity_id)`, `(organization_id, actor_id)`, `(organization_id, action)`, and `(organization_id, created_at DESC)`.

---

## 7. API Design

### Base URL Pattern

```
https://api.leadflow.ai/v1/{resource}
```

### Standard Response Envelope

All API responses follow a standard envelope structure. Successful responses include `success: true`, a `data` object, and a `meta` object for paginated endpoints (containing `page`, `pageSize`, `total`, and `totalPages`). Error responses include `success: false` and an `error` object with `code`, `message`, and optional `details`.

### Complete API Route Map

#### Projects & Inventory

| Method | Route | Description | Permission |
|---|---|---|---|
| GET | `/v1/projects` | List projects (paginated, filterable) | `projects:read` |
| POST | `/v1/projects` | Create project + towers + auto-generate units | `projects:create` |
| GET | `/v1/projects/:id` | Project detail with tower summary | `projects:read` |
| PATCH | `/v1/projects/:id` | Update project metadata | `projects:update` |
| PATCH | `/v1/projects/:id/status` | Toggle active/inactive | `projects:update` |
| GET | `/v1/projects/:id/towers` | List towers for project | `projects:read` |
| POST | `/v1/projects/:id/towers` | Add tower(s) + generate units | `projects:create` |
| GET | `/v1/projects/:id/units` | All units for project (inventory grid) | `units:read` |
| GET | `/v1/projects/:id/units/stats` | Aggregated status counts | `units:read` |

#### Live Inventory & Unit Lifecycle

| Method | Route | Description | Permission |
|---|---|---|---|
| GET | `/v1/units` | Global unit search (cross-project) | `units:read` |
| GET | `/v1/units/:id` | Full unit detail + cost sheet | `units:read` |
| POST | `/v1/units/:id/block` | Block unit (starts 48h timer) | `units:block` |
| POST | `/v1/units/:id/release` | Release blocked unit | `units:block` |
| POST | `/v1/units/:id/token` | Record token collection | `units:token` |
| POST | `/v1/units/:id/book` | Create booking (full cascade) | `bookings:create` |
| POST | `/v1/units/:id/agreement` | Execute agreement | `bookings:update` |
| POST | `/v1/units/:id/register` | Mark registered | `bookings:update` |
| POST | `/v1/units/:id/possession` | Hand over possession | `possession:create` |
| POST | `/v1/units/:id/cancel` | Cancel unit (requires approval) | `cancellations:create` |
| GET | `/v1/units/:id/cost-sheet` | Generate printable cost sheet | `units:read` |

#### Pre-Sales

| Method | Route | Description | Permission |
|---|---|---|---|
| GET | `/v1/leads` | List leads (paginated, filterable) | `leads:read` |
| POST | `/v1/leads` | Create new lead | `leads:create` |
| GET | `/v1/leads/:id` | Lead detail | `leads:read` |
| PATCH | `/v1/leads/:id` | Update lead (status, score, assignment) | `leads:update` |
| PATCH | `/v1/leads/:id/status` | Update lead status | `leads:update` |
| GET | `/v1/site-visits` | List site visits | `site_visits:read` |
| POST | `/v1/site-visits` | Schedule site visit | `site_visits:create` |
| PATCH | `/v1/site-visits/:id` | Update visit (check-in, feedback) | `site_visits:update` |
| GET | `/v1/follow-ups` | List follow-up tasks | `follow_ups:read` |
| POST | `/v1/follow-ups` | Create follow-up task | `follow_ups:create` |
| PATCH | `/v1/follow-ups/:id` | Update task status/outcome | `follow_ups:update` |

#### Sales Engine

| Method | Route | Description | Permission |
|---|---|---|---|
| GET | `/v1/sales-persons` | List sales team | `sales_team:read` |
| POST | `/v1/sales-persons` | Add sales member | `sales_team:create` |
| GET | `/v1/sales-persons/:id` | Detail with targets/achievements | `sales_team:read` |
| PATCH | `/v1/sales-persons/:id` | Update member | `sales_team:update` |
| PATCH | `/v1/sales-persons/:id/status` | Activate/deactivate | `sales_team:update` |
| GET | `/v1/sales-persons/:id/blocks` | Active blocks for person | `sales_team:read` |
| GET | `/v1/agents` | List agents/brokers | `agents:read` |
| POST | `/v1/agents` | Add agent | `agents:create` |
| GET | `/v1/agents/:id` | Agent detail | `agents:read` |
| PATCH | `/v1/agents/:id` | Update agent | `agents:update` |
| PATCH | `/v1/agents/:id/status` | Activate/deactivate | `agents:update` |
| GET | `/v1/bookings` | List all bookings | `bookings:read` |
| GET | `/v1/bookings/:id` | Booking detail | `bookings:read` |
| GET | `/v1/commissions` | List commissions | `commissions:read` |
| GET | `/v1/commissions/:id` | Commission detail | `commissions:read` |
| PATCH | `/v1/commissions/:id/payout` | Record milestone payout | `commissions:update` |

#### Post-Sales

| Method | Route | Description | Permission |
|---|---|---|---|
| GET | `/v1/payments` | List payments | `payments:read` |
| POST | `/v1/payments` | Record payment | `payments:create` |
| PATCH | `/v1/payments/:id/status` | Update status (clear/bounce) | `payments:update` |
| GET | `/v1/demand-letters` | List demand letters | `demand_letters:read` |
| POST | `/v1/demand-letters` | Generate demand letter | `demand_letters:create` |
| PATCH | `/v1/demand-letters/:id` | Update (manual reconciliation) | `demand_letters:update` |
| GET | `/v1/payment-schedules/:bookingId` | Get CLP schedule for booking | `payments:read` |
| GET | `/v1/cancellations` | List cancellation records | `cancellations:read` |
| GET | `/v1/cancellations/:id` | Cancellation detail + refund | `cancellations:read` |
| GET | `/v1/transfers` | List transfers | `transfers:read` |
| POST | `/v1/transfers` | Initiate transfer (→ approval) | `transfers:create` |
| GET | `/v1/transfers/:id` | Transfer detail | `transfers:read` |
| GET | `/v1/possessions` | List possession records | `possession:read` |
| PATCH | `/v1/possessions/:id` | Update checklist | `possession:update` |
| POST | `/v1/possessions/:id/snags` | Report snag item | `possession:create` |
| PATCH | `/v1/possessions/:id/snags/:snagId` | Update snag status | `possession:update` |
| GET | `/v1/complaints` | List complaints | `complaints:read` |
| POST | `/v1/complaints` | Create complaint | `complaints:create` |
| PATCH | `/v1/complaints/:id` | Update / resolve complaint | `complaints:update` |

#### Customer 360

| Method | Route | Description | Permission |
|---|---|---|---|
| GET | `/v1/customers` | List customers | `customers:read` |
| GET | `/v1/customers/:id` | Full 360 view | `customers:read` |
| PATCH | `/v1/customers/:id` | Update customer info | `customers:update` |
| GET | `/v1/customers/:id/documents` | Document vault | `documents:read` |
| POST | `/v1/customers/:id/documents` | Upload document | `documents:create` |
| PATCH | `/v1/customers/:id/documents/:docId` | Verify/reject document | `documents:update` |
| GET | `/v1/customers/:id/communications` | Communication log | `communications:read` |
| POST | `/v1/customers/:id/communications` | Log communication | `communications:create` |
| GET | `/v1/customers/:id/loans` | Loan records | `loans:read` |
| POST | `/v1/customers/:id/loans` | Create loan record | `loans:create` |
| PATCH | `/v1/customers/:id/loans/:loanId` | Update loan / add disbursement | `loans:update` |

#### Approvals

| Method | Route | Description | Permission |
|---|---|---|---|
| GET | `/v1/approvals` | List pending approvals | `approvals:read` |
| GET | `/v1/approvals/:id` | Approval detail | `approvals:read` |
| POST | `/v1/approvals/:id/approve` | Approve request | `approvals:approve` |
| POST | `/v1/approvals/:id/reject` | Reject request | `approvals:approve` |

#### Analytics

| Method | Route | Description | Permission |
|---|---|---|---|
| GET | `/v1/analytics/dashboard` | Overview KPIs | `analytics:read` |
| GET | `/v1/analytics/sales` | Sales metrics | `analytics:read` |
| GET | `/v1/analytics/inventory` | Inventory heatmap data | `analytics:read` |
| GET | `/v1/analytics/financial` | Collection efficiency | `analytics:financial` |
| GET | `/v1/analytics/channels` | Channel partner performance | `analytics:read` |
| GET | `/v1/analytics/agents/:id` | Agent drill-down | `analytics:read` |

#### Audit

| Method | Route | Description | Permission |
|---|---|---|---|
| GET | `/v1/audit-logs` | Query audit logs (filterable) | `audit:read` |

---

## 8. Cross-Module Cascade Engine

The cascade engine is the core of LeadFlow AI's data consistency. It uses **database transactions** for synchronous cascades and **BullMQ jobs** for asynchronous side-effects.

### Architecture

The `CascadeEngine` class is initialized with a Prisma client instance and a BullMQ `Queue` instance. It accepts a `CascadePayload` object containing the `event` name, `organizationId`, `actorId`, and a `data` map. Synchronous cascades run inside the same database transaction as the triggering operation. Async side-effects (notifications, emails) are dispatched to BullMQ after the transaction commits.

Supported cascade events: `BOOKING_CREATED`, `UNIT_CANCELLED`, `PAYMENT_BOUNCED`, `TRANSFER_EXECUTED`, `POSSESSION_COMPLETED`, `BLOCK_EXPIRED`, `AGREEMENT_EXECUTED`, `REGISTRATION_DONE`.

### 8.1 CASCADE: Booking Created

**Trigger**: `POST /v1/units/:id/book`

```
TRANSACTION START
├── 1. Update unit status: token_received → booked
├── 2. Create customer record (if new PAN) or link existing
├── 3. Create booking record
├── 4. Update unit: set customer_id, booking_id, sale_date, sales_person_id
├── 5. Create commission record (status: pending)
│       └── Calculation: agreement_value × agent.commission_pct
│       └── GST = 18%, TDS = 5%, Net = Gross - GST - TDS
│       └── Initialize milestone payouts from project config
├── 6. Create payment record for token amount (status: cleared)
├── 7. Generate payment schedule (CLP milestones) from project template
├── 8. Create initial demand letters from payment schedule
├── 9. Create possession record (status: pending)
├── 10. Audit log: BOOKING_CREATED
TRANSACTION COMMIT

ASYNC (BullMQ):
├── Notification: SMS/Email to customer (booking confirmation)
├── Notification: Email to sales person
└── Notification: Email to agent (if applicable)
```

### 8.2 CASCADE: Unit Cancelled

**Trigger**: `POST /v1/units/:id/cancel` → Approval Approved

```
TRANSACTION START
├── 1. Update unit status → cancelled
├── 2. Clear unit: sales_person_id, agent_id, customer_id, booking_id → NULL
├── 3. Update booking status → cancelled
├── 4. Create cancellation record with refund calculation:
│       total_received = SUM(cleared payments)
│       forfeiture = total_received × forfeiture_pct
│       gst_deduction = forfeiture × 18%
│       tds_deduction = total_received × 1% (TDS on immovable property)
│       net_refund = total_received - forfeiture - gst - tds - brokerage - admin_fee
├── 5. Mark ALL payments for this booking as refund_pending
├── 6. Mark ALL pending demand letters as cancelled (new status)
├── 7. Update commission record:
│       IF status = 'sale_completed' → status = 'cancelled', clawback amounts
│       IF status = 'pending' → status = 'cancelled' (no financial impact)
├── 8. Update agent: recalculate pending_commission
├── 9. Audit log: UNIT_CANCELLED
TRANSACTION COMMIT

ASYNC (BullMQ):
├── Notification: SMS/Email to customer (cancellation + refund details)
├── Notification: Email to finance team (refund processing)
└── Notification: Email to agent (commission impact)
```

### 8.3 CASCADE: Payment Bounced

**Trigger**: `PATCH /v1/payments/:id/status` (status → bounced)

```
TRANSACTION START
├── 1. Update payment status → bounced, set bounce_reason, bounce_date
├── 2. IF linked to demand letter:
│       └── Revert demand letter: recalculate paid_amount, remaining
│       └── Update demand letter status (paid → partially_paid, or partially_paid → pending)
├── 3. Create complaint record automatically:
│       category: payment
│       subject: "Cheque Bounce - {receipt_number}"
│       priority: high
│       SLA: 24 hours
├── 4. Audit log: PAYMENT_BOUNCED
TRANSACTION COMMIT

ASYNC (BullMQ):
├── Notification: SMS to customer (bounce alert)
├── Notification: Email to finance (bounce details)
└── Notification: Email to assigned sales person
```

### 8.4 CASCADE: Transfer Executed

**Trigger**: Approval of transfer request

```
TRANSACTION START
├── 1. Validate NOC document exists and is verified
├── 2. Create new customer record for transferee (if new PAN)
├── 3. Record transfer fee payment
├── 4. Update unit: customer_id → new customer
├── 5. Update booking: customer_id → new customer
├── 6. Move payment history:
│       └── Update all payment records: customer_id → new customer
├── 7. Update demand letters: customer_id → new customer
├── 8. Update possession record: customer_id → new customer
├── 9. Update loan records: customer_id → new customer
├── 10. Create transfer record with full audit trail
├── 11. Link transfer record to both customer 360 views
├── 12. Audit log: TRANSFER_EXECUTED
TRANSACTION COMMIT

ASYNC (BullMQ):
├── Notification: Email to both customers
├── Notification: Email to finance
└── Notification: Email to sales person
```

### 8.5 CASCADE: Possession Completed

**Trigger**: `PATCH /v1/possessions/:id` (all checklist items = true)

```
TRANSACTION START
├── 1. Update possession record: status → completed, possession_date
├── 2. Update unit status → possession_handed
├── 3. Update booking status → possession_handed
├── 4. Unit is now CLOSED (no further financial actions)
├── 5. IF commission status = 'sale_completed':
│       └── Mark commission as eligible for final payout
├── 6. Audit log: POSSESSION_COMPLETED
TRANSACTION COMMIT

ASYNC (BullMQ):
├── Notification: SMS/Email to customer (congratulations + possession letter)
└── Notification: Email to sales person + agent
```

### 8.6 CASCADE: Block Expired (Cron-Triggered)

```
TRANSACTION START (per expired block)
├── 1. Update unit status: blocked → available
├── 2. Clear unit: blocked_by, blocked_at, block_expires_at, block_agent_id → NULL
├── 3. Decrement sales person's active block count (application-level counter or live query)
├── 4. Audit log: BLOCK_EXPIRED (actor = SYSTEM)
TRANSACTION COMMIT
```

---

## 9. Background Jobs & Scheduling

### BullMQ Configuration with Upstash Redis

BullMQ is configured to use Upstash Redis via the `@upstash/redis` client or via the standard `ioredis`-compatible Upstash REST URL. The connection uses the Upstash Redis REST URL and token from environment variables. TLS is enabled in production. The `maxRetriesPerRequest: null` setting is required for BullMQ compatibility.

### Job Definitions

| Job Name | Type | Schedule | Description |
|---|---|---|---|
| `block-expiry-check` | Cron | Every 1 minute | Find blocked units where `block_expires_at < NOW()`, run cascade |
| `demand-overdue-check` | Cron | Every 1 hour | Mark demand letters past `due_date` as "overdue" |
| `sla-breach-check` | Cron | Every 30 minutes | Flag complaints past SLA deadline |
| `notification-dispatch` | Queue | On event | Send email/SMS via provider |
| `report-generation` | Queue | On request | Async PDF/Excel report building |
| `commission-recalc` | Queue | On trigger | Recalculate agent commissions after status changes |

### Block Expiry Job

The `block-expiry` BullMQ queue runs a cron job every minute (`* * * * *`). The worker queries the database for all units with `status = 'blocked'` and `block_expires_at < NOW()`. For each expired unit, it dispatches a `BLOCK_EXPIRED` cascade event with `actorId = 'SYSTEM'`. The job returns the count of released units.

### Demand Overdue Job

The `demand-overdue` BullMQ queue runs a cron job every hour (`0 * * * *`). The worker performs a bulk update on the `demand_letters` table, setting `status = 'overdue'` for all records where status is `pending` or `partially_paid` and `due_date < NOW()`. It then dispatches notifications to the finance team for each affected record and returns the count of letters marked overdue.

---

## 10. Approval Workflow Engine

### Flow

```
Requester Action → Create Approval Request → Notify Approver(s)
                                                    │
                                            ┌───────▼────────┐
                                            │  Approver       │
                                            │  Reviews        │
                                            └───────┬────────┘
                                                    │
                                        ┌───────────┼───────────┐
                                        ▼                       ▼
                                   APPROVED                 REJECTED
                                        │                       │
                                Execute Cascade          Update Status
                                Notify Requester         Notify Requester
```

### Approval Rules

Approval rules are defined per request type. Each rule specifies the minimum `requiredRole` to approve, an `autoApproveIf` predicate function, the list of `notifyRoles` to alert, and an `escalateAfterHours` threshold.

**Cancellation**: Requires `sales_manager` role minimum. Never auto-approved. Notifies admin, sales_manager, and finance. Escalates after 48 hours.

**Discount**: Requires `sales_manager` role minimum. Auto-approved if discount percentage is ≤ 1.0% of agreement value. Notifies admin and sales_manager. Escalates after 24 hours.

**Refund**: Requires `admin` role only. Never auto-approved. Notifies admin and finance. Escalates after 72 hours.

**Transfer**: Requires `sales_manager` role minimum. Never auto-approved. Notifies admin and sales_manager. Escalates after 48 hours.

### Service Implementation

The `ApprovalService` exposes three core methods: `createRequest`, `approve`, and `reject`.

`createRequest` creates a new `approval_request` record in `pending` status, dispatches a BullMQ notification job to alert the relevant roles, and writes an audit log entry.

`approve` verifies the reviewer's role against the approval rule, then runs a database transaction that updates the approval status to `approved` and dispatches the appropriate cascade event for the approved action type (e.g. `UNIT_CANCELLED` for a cancellation approval).

`reject` updates the approval status to `rejected`, records the reviewer and review remarks, and dispatches a notification to the original requester.

---

## 11. Audit Logging System

### Middleware (Automatic Capture)

The audit middleware is an Express middleware factory that accepts an `entityType` string. For state-changing HTTP methods (POST, PATCH, PUT, DELETE), it constructs an audit entry with the organization ID, actor ID, actor role, action (derived from HTTP method), entity type, entity ID, before/after state snapshots (set by the service layer on `req.entityBeforeState` and `req.entityAfterState`), a computed diff of changes, and metadata (IP address, user-agent, route URL). The audit write is fire-and-forget via `prisma.auditLog.create` to avoid blocking the response.

### What Gets Audited

| Module | Actions Logged |
|---|---|
| **Units** | Every status change, block, release, price update |
| **Bookings** | Create, status change, cancellation |
| **Payments** | Record, clear, bounce, refund |
| **Demand Letters** | Generate, status change, manual reconciliation |
| **Leads** | Create, status change, assignment change |
| **Customers** | Create, update, document upload/verify |
| **Commissions** | Create, payout, clawback |
| **Transfers** | Initiate, approve, execute |
| **Possession** | Checklist update, snag CRUD, completion |
| **Complaints** | Create, assign, resolve, escalate |
| **Approvals** | Request, approve, reject |
| **Sales Persons** | Create, deactivate, target change |
| **Agents** | Create, deactivate, commission change |
| **Projects** | Create, update, status change |

---

## 12. File Storage & Document Vault

### S3 Bucket Structure

```
leadflow-documents-{env}/
├── {organization_id}/
│   ├── customers/
│   │   ├── {customer_id}/
│   │   │   ├── pan_card/
│   │   │   ├── aadhaar/
│   │   │   ├── photo/
│   │   │   ├── address_proof/
│   │   │   ├── income_proof/
│   │   │   ├── bank_statement/
│   │   │   ├── agreement/
│   │   │   ├── registration/
│   │   │   ├── noc/
│   │   │   ├── allotment_letter/
│   │   │   ├── possession_letter/
│   │   │   └── other/
│   │   │       └── {uuid}-{filename}.pdf
│   ├── receipts/
│   │   └── {booking_id}/
│   │       └── {receipt_number}.pdf
│   └── reports/
│       └── {report_id}.xlsx
```

### Upload Flow (Presigned URL Pattern)

The upload flow follows a three-step process. First, the client requests an upload URL via `POST /v1/customers/:id/documents/upload-url`, supplying the category, filename, and MIME type. The server generates an S3 key using the pattern `{organizationId}/customers/{customerId}/{category}/{nanoid}-{fileName}`, creates a presigned `PutObject` URL with a 5-minute expiry, creates a `customer_documents` record in `uploading` status, and returns both the presigned URL and the new document ID.

Second, the client uploads the file directly to S3 using the presigned URL, bypassing the API server entirely.

Third, the client confirms the upload via `POST /v1/customers/:id/documents/:docId/confirm`, which updates the document record status to `uploaded` and records the file size.

### Download Flow

Download requests to `GET /v1/customers/:id/documents/:docId/download` retrieve the document record, generate a presigned `GetObject` URL with a 1-hour expiry, and return the URL to the client.

### S3 Lifecycle Policies

- Move to S3 Infrequent Access after 90 days
- Move to S3 Glacier after 365 days
- Never delete (legal compliance for real-estate documents)

---

## 13. Business Rules & Validation

### 13.1 Unit Blocking Rules

The `BlockingService.blockUnit` method runs inside a database transaction and enforces the following checks in order: the unit must have `status = 'available'`; the sales person must be active; the sales person must have fewer than 3 currently blocked units; and if an agent is provided, the agent must be active. If all checks pass, the unit is updated with `status = 'blocked'`, the blocker's ID, the block timestamp, and a `block_expires_at` set to 48 hours from now.

### 13.2 Booking Validation (Strict — 8 Mandatory Fields)

Booking creation requires all of the following customer fields to be present and valid: `fullName` (minimum 2 characters), `fatherSpouse` (minimum 2 characters), `dateOfBirth` (valid date), `panNumber` (exactly 10 characters matching the regex `^[A-Z]{5}[0-9]{4}[A-Z]$`), `aadhaarNumber` (exactly 12 digits), `mobilePrimary` (exactly 10 digits), `email` (valid format), and `currentAddress` (minimum 10 characters). Token fields `tokenAmount` (positive number) and `tokenPaymentMode` (one of cheque / neft / rtgs / upi / dd / cash) are also required. All other fields (alternate mobile, occupation, co-applicant details, etc.) are optional.

### 13.3 Commission Calculation

Commission is calculated as follows: `gross = agreementValue × commissionPct / 100`. GST is 18% of gross. TDS is 5% of gross. Net payable equals gross minus GST minus TDS. All values are computed using BigInt arithmetic in paise to avoid floating-point errors.

### 13.4 Cancellation Refund Formula

The refund is calculated as: `forfeiture = totalReceived × forfeiturePct / 100`. GST on forfeiture is 18% of forfeiture. TDS is 1% of total received (TDS on immovable property). `netRefund = totalReceived - forfeiture - gstOnForfeiture - tds - brokerageRecovery - adminFee`. The net refund is floored at zero (no negative refunds).

### 13.5 Cost Sheet Calculation

The cost sheet is computed as: `basePrice = carpetArea × baseRate`. `floorRise = floor × projectSettings.floorRisePerFloor`. `plc = basePrice × projectSettings.plcPct / 100`. `amenity = projectSettings.amenityCharge`. `agreementValue = basePrice + floorRise + plc + amenity`. GST is 5% of agreement value. Stamp duty is 6% of agreement value. Registration is a flat fee (default ₹30,000). `totalPrice = agreementValue + gst + stampDuty + registration`. All arithmetic uses BigInt paise values.

### 13.6 Key Business Constraints Summary

| Rule | Enforcement |
|---|---|
| Max 3 active blocks per salesperson | DB check in transaction |
| Block expires in 48 hours | Cron job (every minute) |
| 8 mandatory fields for booking | Schema validation |
| PAN format: XXXXX0000X | Regex in validation schema |
| Aadhaar: exactly 12 digits | Regex in validation schema |
| RERA number mandatory for agents | DB NOT NULL + API validation |
| Commission only finalized after full sale | Status machine in commission service |
| Cancellation requires approval | Approval workflow gate |
| Transfer requires NOC document | DB check + approval gate |
| Refund requires finance approval | Approval workflow gate |
| Discount requires manager approval (>1%) | Conditional approval rule |
| No hard deletes anywhere | Soft delete only (is_active flag) |
| Inactive entities hidden from selectors | WHERE is_active = true in queries |
| All monetary values in paise | BIGINT storage, app-layer conversion |
| Organization data isolation | PostgreSQL RLS on every table |

---

## 14. Error Handling & Observability

### Custom Error Classes

A hierarchy of custom error classes is used throughout the application. `AppError` is the base class, carrying a `code` string, `message`, HTTP `statusCode` (default 400), and optional `details` object. `BusinessError` extends `AppError` for domain rule violations (status 400). `NotFoundError` extends `AppError` for missing records (status 404). `ForbiddenError` extends `AppError` for authorization failures (status 403).

A centralized `ERROR_CODES` constant map provides human-readable descriptions for all error codes, including: `UNIT_NOT_AVAILABLE`, `MAX_BLOCKS_REACHED`, `BOOKING_VALIDATION_FAILED`, `INVALID_PAN_FORMAT`, `INVALID_STATUS_TRANSITION`, `APPROVAL_REQUIRED`, `AGENT_INACTIVE`, `SP_INACTIVE`, `DUPLICATE_PAN`, `NOC_REQUIRED`, and `COMMISSION_NOT_FINALIZED`.

### Express Error Handler

A global Express error handler is registered as the last middleware. It handles `AppError` instances by returning the appropriate HTTP status with the standard error envelope. Prisma error code `P2025` (record not found) is mapped to a 404 response. Prisma error code `P2002` (unique constraint violation) is mapped to a 409 response. All unexpected errors are logged and reported to Sentry before returning a 500 response.

### Logging (Pino)

Structured JSON logging is implemented using Pino. In non-production environments, pino-pretty is used for human-readable output. Request serializers include method, URL, organizationId, and userId for correlation. The log level is configurable via the `LOG_LEVEL` environment variable, defaulting to `info`.

### Health Check Endpoint

A `GET /health` endpoint returns the current status, timestamp, application version, and results of three health checks: database connectivity (via a simple Prisma query), Upstash Redis connectivity, and AWS S3 reachability.

---

## 15. Deployment & Infrastructure (AWS)

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                        AWS VPC                          │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Public Subnet                       │   │
│  │  ┌──────────────┐                               │   │
│  │  │    ALB        │ ← HTTPS (ACM Certificate)    │   │
│  │  │  + WAF        │                               │   │
│  │  └──────┬───────┘                               │   │
│  └─────────┼───────────────────────────────────────┘   │
│            │                                            │
│  ┌─────────┼───────────────────────────────────────┐   │
│  │         │    Private Subnet                      │   │
│  │         ▼                                        │   │
│  │  ┌──────────────┐    ┌──────────────┐           │   │
│  │  │ ECS Fargate  │    │ ECS Fargate  │           │   │
│  │  │ API Service  │    │ Worker Svc   │           │   │
│  │  │ (2-4 tasks)  │    │ (1-2 tasks)  │           │   │
│  │  └──────┬───────┘    └──────┬───────┘           │   │
│  │         │                   │                    │   │
│  │         ▼                   ▼                    │   │
│  │  ┌──────────────┐    ┌──────────────┐           │   │
│  │  │  Supabase    │    │   Upstash    │           │   │
│  │  │  PostgreSQL  │    │   Redis      │           │   │
│  │  │  (Managed)   │    │ (Serverless) │           │   │
│  │  └──────────────┘    └──────────────┘           │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  S3 Bucket (documents)                           │   │
│  │  CloudWatch (logs + metrics)                     │   │
│  │  Sentry (error tracking)                         │   │
│  │  ECR (container registry)                        │   │
│  │  Secrets Manager (credentials)                   │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### ECS Task Definition (API)

The ECS task definition uses family `leadflow-api` with 1024 CPU units and 2048 MB memory in `awsvpc` network mode. The container image is pulled from ECR. Port 3000 is mapped via TCP. Non-secret environment variables (`NODE_ENV`, `PORT`) are set directly. Sensitive values (`DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `JWT_SECRET`, `S3_BUCKET`) are injected from AWS Secrets Manager. Logs are shipped to CloudWatch using the `awslogs` driver under the `/ecs/leadflow-api` log group in `ap-south-1`. A health check runs `curl -f http://localhost:3000/health` every 30 seconds with a 5-second timeout and 3 retries.

### Dockerfile (Multi-Stage)

The Dockerfile uses a multi-stage build. The builder stage starts from `node:20-alpine`, copies `package*.json` and `prisma/`, runs `npm ci`, copies the source, runs `npx prisma generate`, and runs the build. The production stage starts from a fresh `node:20-alpine`, creates a non-root `leadflow` user, copies only the built `dist/`, `node_modules/`, `prisma/`, and `package.json` from the builder stage, switches to the non-root user, exposes port 3000, and starts with `node dist/server.js`.

### CI/CD Pipeline (GitHub Actions)

The GitHub Actions pipeline triggers on pushes to the `main` branch. The test job runs on `ubuntu-latest` with a PostgreSQL 16 service container and a Redis service container. It runs `npm ci`, `npx prisma migrate deploy`, and `npm test`. The deploy job runs after tests pass, configures AWS credentials using OIDC role assumption, logs into ECR, builds and tags the Docker image with the Git SHA, pushes to ECR, and forces a new ECS deployment on the `leadflow-prod` cluster.

### Environment Configuration

All environment variables are stored in ENV and never committed to the repository. Key variables include: `NODE_ENV`, `PORT`, `APP_VERSION`, `DATABASE_URL` (Supabase connection string), `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `JWT_SECRET`, `JWT_EXPIRY`, `AWS_REGION`, `S3_BUCKET`, `S3_REGION`, etc as per the requirements 

---

## 16. Security Hardening

### API Security

| Measure | Implementation |
|---|---|
| **HTTPS Only** | ALB SSL termination with ACM certificate |
| **CORS** | Whitelist specific frontend domains only |
| **Rate Limiting** | 100 req/min per organization, 20 req/min per user (adjustable) |
| **Input Validation** | Validation schemas on every endpoint |
| **SQL Injection** | Prisma parameterized queries (never raw SQL with user input) |
| **XSS** | Express Helmet headers |
| **CSRF** | Not applicable (JWT-based, no cookies) |
| **JWT Verification** | Custom JWKS rotation, audience + issuer check |
| **Secrets** |  env files never in code |
| **Container** | Non-root user, read-only filesystem, minimal base image |
| **WAF** | AWS WAF on ALB (OWASP top 10 rules) |

### Data Security

| Measure | Implementation |
|---|---|
| **Encryption at Rest** | Supabase PostgreSQL: AES-256 (managed), S3: SSE-S3 |
| **Encryption in Transit** | TLS 1.2+ everywhere |
| **PII Handling** | PAN, Aadhaar stored encrypted at application level (AES-256-GCM) |
| **Access Logging** | S3 access logs, Supabase audit logs, CloudTrail |
| **Backup** | Supabase automated backups, S3 versioning |
| **Multi-Organization** | PostgreSQL RLS (defense-in-depth beyond app-level checks) |

### PII Encryption Service

PII encryption is implemented in `shared/encryption.js` using Node.js's built-in `crypto` module with the `aes-256-gcm` algorithm. The `encryptPII` function generates a random 16-byte IV, encrypts the plaintext, and returns a colon-delimited string of hex-encoded IV, authentication tag, and ciphertext. The `decryptPII` function reverses this process. The 32-byte key is loaded from the `PII_ENCRYPTION_KEY` environment variable. PAN and Aadhaar are encrypted before storage. A separately maintained hashed index is used for searchable lookups without decrypting.

---

## 17. Performance & Scaling

### Database Optimization

| Strategy | Detail |
|---|---|
| **Connection Pooling** | Prisma connection pool: min 5, max 20 per Fargate task |
| **Read Replicas** | Supabase read replica for analytics queries |
| **Indexing** | Composite indexes on (organization_id + frequently filtered column) |
| **Partitioning** | Audit logs partitioned by month (range partitioning on created_at) |
| **Query Optimization** | Prisma `select` to fetch only needed fields; avoid `include` chains |
| **JSONB Indexing** | GIN indexes on JSONB columns used in WHERE clauses |

### Caching Strategy (Upstash Redis)

| Cache | TTL | Purpose |
|---|---|---|
| `org:{id}:settings` | 5 min | Organization configuration |
| `project:{id}:stats` | 1 min | Inventory stats (available/blocked/sold counts) |
| `sp:{id}:active_blocks` | 30 sec | Sales person active block count |
| `unit:{id}:status` | 30 sec | Unit current status (hot path) |
| `analytics:dashboard:{orgId}` | 5 min | Dashboard KPIs |

### Auto-Scaling

```
ECS API Service:
  Min: 2 tasks
  Max: 8 tasks
  Scale-out: CPU > 70% for 2 minutes
  Scale-in:  CPU < 30% for 5 minutes

ECS Worker Service:
  Min: 1 task
  Max: 4 tasks
  Scale-out: Queue depth > 100
  Scale-in:  Queue depth < 10

Supabase PostgreSQL:
  Managed scaling via Supabase dashboard
  Storage auto-scaling enabled
  Connection pooling via PgBouncer (built-in)
```

### Expected Load Profile

| Metric | Estimate |
|---|---|
| Concurrent Users | 50-200 per organization |
| API Requests/sec | 50-200 (peak hours) |
| Database Size | ~5GB per organization per year |
| Document Storage | ~50GB per organization per year |
| Audit Log Growth | ~1M rows per organization per year |

---

## 18. Migration Strategy

### Phase 1: Foundation (Weeks 1-3)
- Prisma schema setup + initial migration against Supabase PostgreSQL
- Express server bootstrap with middleware chain
- Custom authentication implementation + RBAC
- Organization management + RLS setup
- Core tables: organizations, users, projects, towers, units

### Phase 2: Core Modules (Weeks 4-7)
- Unit generator (project creation cascade)
- Live inventory API (block, release, token, book)
- Cascade engine: booking creation cascade
- Sales persons + agents CRUD
- Customer CRUD
- Booking CRUD with full validation

### Phase 3: Pre-Sales + Sales Engine (Weeks 8-9)
- Leads CRUD + pipeline
- Site visits + follow-ups
- Commission engine
- BullMQ setup with Upstash Redis: block expiry job

### Phase 4: Post-Sales (Weeks 10-12)
- Payment recording + bounce cascade
- Demand letters + overdue job
- Cancellation + refund calculator + approval workflow
- Transfer workflow
- Possession + snag management
- Complaints with SLA

### Phase 5: Customer 360 + Analytics (Weeks 13-14)
- Customer 360 aggregation endpoints
- Document vault (AWS S3 integration)
- Communication logging
- Loan tracking
- Analytics endpoints (sales, inventory, financial, channel)

### Phase 6: Production Hardening (Weeks 15-16)
- Audit log system finalization
- PII encryption implementation
- Performance testing + query optimization
- Security audit
- CI/CD pipeline completion
- Staging → Production deployment
- Monitoring + alerting setup

---

## Appendix A: Unit Status State Machine

```
                    ┌──────────────┐
                    │  AVAILABLE   │ ◄──── Block Expired (cron)
                    └──────┬───────┘ ◄──── Released (manual)
                           │
                     Block Unit
                           │
                    ┌──────▼───────┐
                    │   BLOCKED    │──── 48h timer starts
                    └──────┬───────┘
                           │
                   Collect Token
                           │
                    ┌──────▼───────┐
                    │TOKEN RECEIVED│
                    └──────┬───────┘
                           │
                    Create Booking
                           │
                    ┌──────▼───────┐
                    │    BOOKED    │
                    └──────┬───────┘
                           │
                  Execute Agreement
                           │
                    ┌──────▼───────┐
                    │AGREEMENT DONE│
                    └──────┬───────┘
                           │
                   Mark Registered
                           │
                    ┌──────▼───────┐
                    │  REGISTERED  │
                    └──────┬───────┘
                           │
                  Hand Over Possession
                           │
                    ┌──────▼───────┐
                    │  POSSESSION  │  ← CLOSED (no further actions)
                    │   HANDED     │
                    └──────────────┘

    At ANY stage (except Possession Handed):
                           │
                    Cancel (→ Approval)
                           │
                    ┌──────▼───────┐
                    │  CANCELLED   │  ← Cascade: refund, commission, payments
                    └──────────────┘
```

## Appendix B: Commission Status Machine

```
  PENDING ──────► SALE_COMPLETED ──────► APPROVED ──────► PARTIALLY_PAID ──────► PAID
     │                  │                                        │
     │                  │                                        │
     └───── CANCELLED ◄─┘                                       │
            (if unit cancelled before sale completion)           │
                                                                 │
            CANCELLED ◄──────────────────────────────────────────┘
            (clawback if unit cancelled after sale completion)
```

**Rule**: Commission status moves to `SALE_COMPLETED` only when unit reaches `REGISTERED` or `POSSESSION_HANDED`. Before that, cancellation simply voids the pending commission. After `SALE_COMPLETED`, cancellation triggers a clawback (financial recovery from agent).

---

*End of Document*
