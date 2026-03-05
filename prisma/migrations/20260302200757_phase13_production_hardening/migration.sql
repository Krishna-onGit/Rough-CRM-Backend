-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'sales_manager', 'sales_executive', 'finance', 'operations');

-- CreateEnum
CREATE TYPE "OrgPlan" AS ENUM ('standard', 'premium', 'enterprise');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('Residential', 'Commercial', 'Mixed');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('active', 'pre_launch', 'completed');

-- CreateEnum
CREATE TYPE "UnitConfig" AS ENUM ('BHK_1', 'BHK_2', 'BHK_3', 'BHK_4', 'Penthouse');

-- CreateEnum
CREATE TYPE "UnitFacing" AS ENUM ('N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW');

-- CreateEnum
CREATE TYPE "ViewType" AS ENUM ('Sea', 'Garden', 'Pool', 'Road', 'City');

-- CreateEnum
CREATE TYPE "ParkingType" AS ENUM ('Covered', 'Open', 'Stack', 'None');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('available', 'blocked', 'token_received', 'booked', 'agreement_done', 'registered', 'possession_handed', 'cancelled');

-- CreateEnum
CREATE TYPE "Designation" AS ENUM ('VP_Sales', 'Manager', 'Executive', 'Trainee');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('whatsapp', 'website', 'referral', 'walk_in');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('new', 'contacted', 'site_visit_scheduled', 'site_visit_done', 'interested', 'negotiation', 'won', 'lost', 'junk');

-- CreateEnum
CREATE TYPE "VisitType" AS ENUM ('first_visit', 'revisit', 'family_visit', 'loan_agent_visit');

-- CreateEnum
CREATE TYPE "VisitFeedback" AS ENUM ('interested', 'thinking', 'not_interested', 'price_concern', 'location_concern');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('call', 'whatsapp', 'email', 'meeting', 'site_visit');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'completed', 'missed', 'rescheduled');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('booked', 'agreement_done', 'registered', 'possession_handed', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('cheque', 'neft', 'rtgs', 'upi', 'dd', 'cash');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('pending', 'sale_completed', 'approved', 'partially_paid', 'paid', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('cleared', 'bounced', 'under_process', 'refund_pending', 'refunded');

-- CreateEnum
CREATE TYPE "DemandLetterStatus" AS ENUM ('pending', 'partially_paid', 'paid', 'overdue', 'cancelled');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('upcoming', 'due', 'paid', 'overdue', 'cancelled');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('pending', 'approved', 'processed', 'paid');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('pending_approval', 'approved', 'executed', 'rejected');

-- CreateEnum
CREATE TYPE "PossessionStatus" AS ENUM ('pending', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "SnagCategory" AS ENUM ('plumbing', 'electrical', 'civil', 'painting');

-- CreateEnum
CREATE TYPE "SnagStatus" AS ENUM ('open', 'in_progress', 'resolved');

-- CreateEnum
CREATE TYPE "ComplaintCategory" AS ENUM ('payment', 'construction', 'documentation', 'general');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('open', 'in_progress', 'resolved', 'closed', 'escalated');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('pan_card', 'aadhaar', 'photo', 'address_proof', 'income_proof', 'bank_statement', 'agreement', 'registration', 'noc', 'allotment_letter', 'possession_letter', 'other');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('uploaded', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('call', 'email', 'whatsapp', 'sms', 'in_person');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('inbound', 'outbound');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('applied', 'sanctioned', 'disbursing', 'fully_disbursed', 'rejected');

-- CreateEnum
CREATE TYPE "ApprovalRequestType" AS ENUM ('cancellation', 'refund', 'transfer', 'discount');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('create', 'update', 'delete', 'status_change', 'approve', 'reject');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "auth_org_id" TEXT,
    "plan" "OrgPlan" NOT NULL DEFAULT 'standard',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "auth_user_id" TEXT,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobile" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'sales_executive',
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "location" TEXT,
    "project_type" "ProjectType" NOT NULL DEFAULT 'Residential',
    "status" "ProjectStatus" NOT NULL DEFAULT 'active',
    "base_rate" BIGINT NOT NULL DEFAULT 0,
    "completion_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "rera_number" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "towers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floors" INTEGER NOT NULL,
    "units_per_floor" INTEGER NOT NULL,
    "total_units" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "towers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "tower_id" TEXT NOT NULL,
    "unit_number" TEXT NOT NULL,
    "unit_code" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "config" "UnitConfig" NOT NULL,
    "facing" "UnitFacing",
    "view_type" "ViewType",
    "parking" "ParkingType" NOT NULL DEFAULT 'None',
    "carpet_area" BIGINT NOT NULL DEFAULT 0,
    "built_up_area" BIGINT NOT NULL DEFAULT 0,
    "super_built_up_area" BIGINT NOT NULL DEFAULT 0,
    "base_rate" BIGINT NOT NULL DEFAULT 0,
    "base_price" BIGINT NOT NULL DEFAULT 0,
    "floor_rise" BIGINT NOT NULL DEFAULT 0,
    "plc" BIGINT NOT NULL DEFAULT 0,
    "amenity_charge" BIGINT NOT NULL DEFAULT 0,
    "agreement_value" BIGINT NOT NULL DEFAULT 0,
    "gst_amount" BIGINT NOT NULL DEFAULT 0,
    "stamp_duty" BIGINT NOT NULL DEFAULT 0,
    "registration" BIGINT NOT NULL DEFAULT 0,
    "total_price" BIGINT NOT NULL DEFAULT 0,
    "status" "UnitStatus" NOT NULL DEFAULT 'available',
    "blocked_by" TEXT,
    "blocked_at" TIMESTAMP(3),
    "block_expires_at" TIMESTAMP(3),
    "block_agent_id" TEXT,
    "sales_person_id" TEXT,
    "agent_id" TEXT,
    "customer_id" TEXT,
    "booking_id" TEXT,
    "sale_date" TIMESTAMP(3),
    "final_sale_value" BIGINT,
    "discount_amount" BIGINT,
    "discount_approved_by" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_persons" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT,
    "sp_code" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "team" TEXT,
    "designation" "Designation" NOT NULL DEFAULT 'Executive',
    "reporting_to" TEXT,
    "monthly_target" BIGINT NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "agent_code" TEXT NOT NULL,
    "firm_name" TEXT,
    "contact_person" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "rera_number" TEXT NOT NULL,
    "pan" TEXT,
    "gst_number" TEXT,
    "commission_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "rating" DECIMAL(2,1) NOT NULL DEFAULT 0,
    "total_commission" BIGINT NOT NULL DEFAULT 0,
    "pending_commission" BIGINT NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "customer_code" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "father_spouse" TEXT,
    "date_of_birth" TIMESTAMP(3),
    "pan_number" TEXT,
    "pan_hash" TEXT,
    "aadhaar_number" TEXT,
    "mobile_primary" TEXT NOT NULL,
    "mobile_alternate" TEXT,
    "email" TEXT,
    "current_address" TEXT,
    "occupation" TEXT,
    "company_name" TEXT,
    "annual_income" BIGINT,
    "payment_mode" TEXT,
    "preferred_bank" TEXT,
    "loan_amount" BIGINT,
    "co_applicant_name" TEXT,
    "co_applicant_pan" TEXT,
    "co_applicant_rel" TEXT,
    "kyc_documents" JSONB NOT NULL DEFAULT '[]',
    "kyc_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "lead_code" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "source" "LeadSource" NOT NULL DEFAULT 'walk_in',
    "status" "LeadStatus" NOT NULL DEFAULT 'new',
    "score" INTEGER NOT NULL DEFAULT 0,
    "interested_project" TEXT,
    "interested_config" "UnitConfig",
    "budget_min" BIGINT,
    "budget_max" BIGINT,
    "assigned_to" TEXT,
    "assigned_at" TIMESTAMP(3),
    "converted_booking_id" TEXT,
    "remarks" TEXT,
    "lost_reason" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_visits" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "sales_person_id" TEXT,
    "visit_date" TIMESTAMP(3) NOT NULL,
    "visit_type" "VisitType" NOT NULL DEFAULT 'first_visit',
    "visitor_count" INTEGER NOT NULL DEFAULT 1,
    "check_in_at" TIMESTAMP(3),
    "check_out_at" TIMESTAMP(3),
    "feedback" "VisitFeedback",
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_up_tasks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "assigned_to" TEXT,
    "task_type" "TaskType" NOT NULL DEFAULT 'call',
    "priority" "Priority" NOT NULL DEFAULT 'medium',
    "status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "outcome" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_up_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "booking_code" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "sales_person_id" TEXT NOT NULL,
    "agent_id" TEXT,
    "agreement_value" BIGINT NOT NULL DEFAULT 0,
    "final_value" BIGINT NOT NULL DEFAULT 0,
    "discount_amount" BIGINT NOT NULL DEFAULT 0,
    "token_amount" BIGINT NOT NULL DEFAULT 0,
    "payment_mode" "PaymentMode" NOT NULL DEFAULT 'cheque',
    "status" "BookingStatus" NOT NULL DEFAULT 'booked',
    "booking_date" TIMESTAMP(3) NOT NULL,
    "agreement_date" TIMESTAMP(3),
    "registration_date" TIMESTAMP(3),
    "source_lead_id" TEXT,
    "remarks" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commissions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "agreement_value" BIGINT NOT NULL DEFAULT 0,
    "commission_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "gross_commission" BIGINT NOT NULL DEFAULT 0,
    "gst_amount" BIGINT NOT NULL DEFAULT 0,
    "tds_amount" BIGINT NOT NULL DEFAULT 0,
    "net_payable" BIGINT NOT NULL DEFAULT 0,
    "status" "CommissionStatus" NOT NULL DEFAULT 'pending',
    "milestones" JSONB NOT NULL DEFAULT '[]',
    "paid_amount" BIGINT NOT NULL DEFAULT 0,
    "pending_amount" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "customer_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "demand_letter_id" TEXT,
    "receipt_number" TEXT NOT NULL,
    "amount" BIGINT NOT NULL DEFAULT 0,
    "payment_mode" "PaymentMode" NOT NULL DEFAULT 'cheque',
    "transaction_ref" TEXT,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'under_process',
    "bounce_reason" TEXT,
    "bounce_date" TIMESTAMP(3),
    "remarks" TEXT,
    "recorded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demand_letters" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "letter_code" TEXT NOT NULL,
    "milestone_name" TEXT NOT NULL,
    "milestone_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "demand_amount" BIGINT NOT NULL DEFAULT 0,
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" "DemandLetterStatus" NOT NULL DEFAULT 'pending',
    "paid_amount" BIGINT NOT NULL DEFAULT 0,
    "remaining" BIGINT NOT NULL DEFAULT 0,
    "reminder_count" INTEGER NOT NULL DEFAULT 0,
    "last_reminder" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demand_letters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_schedules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "milestone_order" INTEGER NOT NULL,
    "milestone_name" TEXT NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "amount" BIGINT NOT NULL DEFAULT 0,
    "due_date" TIMESTAMP(3),
    "status" "ScheduleStatus" NOT NULL DEFAULT 'upcoming',
    "linked_demand_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cancellation_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "cancel_code" TEXT NOT NULL,
    "cancellation_date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "requested_by" TEXT,
    "approved_by" TEXT,
    "total_received" BIGINT NOT NULL DEFAULT 0,
    "forfeiture_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "forfeiture_amt" BIGINT NOT NULL DEFAULT 0,
    "gst_deduction" BIGINT NOT NULL DEFAULT 0,
    "tds_deduction" BIGINT NOT NULL DEFAULT 0,
    "brokerage_recovery" BIGINT NOT NULL DEFAULT 0,
    "admin_fee" BIGINT NOT NULL DEFAULT 0,
    "net_refund" BIGINT NOT NULL DEFAULT 0,
    "refund_status" "RefundStatus" NOT NULL DEFAULT 'pending',
    "refund_date" TIMESTAMP(3),
    "refund_ref" TEXT,
    "approval_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cancellation_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "transfer_code" TEXT NOT NULL,
    "transfer_date" TIMESTAMP(3),
    "from_customer_id" TEXT NOT NULL,
    "to_customer_id" TEXT NOT NULL,
    "transfer_fee" BIGINT NOT NULL DEFAULT 0,
    "noc_document_id" TEXT,
    "status" "TransferStatus" NOT NULL DEFAULT 'pending_approval',
    "requested_by" TEXT,
    "approved_by" TEXT,
    "approval_id" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transfer_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "possession_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "possession_date" TIMESTAMP(3),
    "status" "PossessionStatus" NOT NULL DEFAULT 'pending',
    "checklist" JSONB NOT NULL DEFAULT '{}',
    "handover_by" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "possession_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snag_items" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "possession_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "SnagCategory" NOT NULL DEFAULT 'civil',
    "priority" "Priority" NOT NULL DEFAULT 'medium',
    "status" "SnagStatus" NOT NULL DEFAULT 'open',
    "reported_date" TIMESTAMP(3) NOT NULL,
    "resolved_date" TIMESTAMP(3),
    "resolved_by" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "snag_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaints" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "complaint_code" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "unit_id" TEXT,
    "booking_id" TEXT,
    "category" "ComplaintCategory" NOT NULL DEFAULT 'general',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'medium',
    "status" "ComplaintStatus" NOT NULL DEFAULT 'open',
    "assigned_to" TEXT,
    "sla_hours" INTEGER NOT NULL DEFAULT 48,
    "sla_deadline" TIMESTAMP(3),
    "sla_breached" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMP(3),
    "resolution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_documents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "booking_id" TEXT,
    "category" "DocumentCategory" NOT NULL DEFAULT 'other',
    "file_name" TEXT NOT NULL,
    "file_key" TEXT NOT NULL,
    "file_size" BIGINT NOT NULL DEFAULT 0,
    "mime_type" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'uploaded',
    "verified_by" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "lead_id" TEXT,
    "channel" "Channel" NOT NULL DEFAULT 'call',
    "direction" "Direction" NOT NULL DEFAULT 'outbound',
    "subject" TEXT,
    "content" TEXT,
    "initiated_by" TEXT,
    "duration_seconds" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "loan_amount" BIGINT NOT NULL DEFAULT 0,
    "sanctioned_amount" BIGINT NOT NULL DEFAULT 0,
    "interest_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tenure_months" INTEGER NOT NULL DEFAULT 0,
    "status" "LoanStatus" NOT NULL DEFAULT 'applied',
    "disbursements" JSONB NOT NULL DEFAULT '[]',
    "sanction_date" TIMESTAMP(3),
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreement_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "agreement_date" TIMESTAMP(3) NOT NULL,
    "agreement_value" BIGINT NOT NULL DEFAULT 0,
    "stamp_duty_paid" BIGINT NOT NULL DEFAULT 0,
    "document_id" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agreement_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "registration_date" TIMESTAMP(3) NOT NULL,
    "registration_number" TEXT NOT NULL,
    "sub_registrar" TEXT,
    "registration_fee" BIGINT NOT NULL DEFAULT 0,
    "document_id" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registration_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "request_type" "ApprovalRequestType" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "requested_by" TEXT,
    "request_data" JSONB NOT NULL DEFAULT '{}',
    "justification" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_role" TEXT,
    "action" "AuditAction" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "entity_code" TEXT,
    "before_state" JSONB,
    "after_state" JSONB,
    "changes" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_user_id_key" ON "users"("auth_user_id");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE INDEX "users_auth_user_id_idx" ON "users"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_organization_id_email_key" ON "users"("organization_id", "email");

-- CreateIndex
CREATE INDEX "projects_organization_id_idx" ON "projects"("organization_id");

-- CreateIndex
CREATE INDEX "projects_organization_id_status_idx" ON "projects"("organization_id", "status");

-- CreateIndex
CREATE INDEX "projects_organization_id_city_idx" ON "projects"("organization_id", "city");

-- CreateIndex
CREATE UNIQUE INDEX "projects_organization_id_project_code_key" ON "projects"("organization_id", "project_code");

-- CreateIndex
CREATE INDEX "towers_organization_id_project_id_idx" ON "towers"("organization_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "towers_organization_id_project_id_name_key" ON "towers"("organization_id", "project_id", "name");

-- CreateIndex
CREATE INDEX "units_organization_id_project_id_idx" ON "units"("organization_id", "project_id");

-- CreateIndex
CREATE INDEX "units_organization_id_tower_id_idx" ON "units"("organization_id", "tower_id");

-- CreateIndex
CREATE INDEX "units_organization_id_status_idx" ON "units"("organization_id", "status");

-- CreateIndex
CREATE INDEX "units_organization_id_config_idx" ON "units"("organization_id", "config");

-- CreateIndex
CREATE INDEX "units_organization_id_customer_id_idx" ON "units"("organization_id", "customer_id");

-- CreateIndex
CREATE INDEX "units_organization_id_sales_person_id_idx" ON "units"("organization_id", "sales_person_id");

-- CreateIndex
CREATE UNIQUE INDEX "units_organization_id_project_id_unit_number_key" ON "units"("organization_id", "project_id", "unit_number");

-- CreateIndex
CREATE INDEX "sales_persons_organization_id_idx" ON "sales_persons"("organization_id");

-- CreateIndex
CREATE INDEX "sales_persons_organization_id_team_idx" ON "sales_persons"("organization_id", "team");

-- CreateIndex
CREATE INDEX "sales_persons_organization_id_is_active_idx" ON "sales_persons"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "sales_persons_organization_id_sp_code_key" ON "sales_persons"("organization_id", "sp_code");

-- CreateIndex
CREATE UNIQUE INDEX "sales_persons_organization_id_mobile_key" ON "sales_persons"("organization_id", "mobile");

-- CreateIndex
CREATE INDEX "agents_organization_id_idx" ON "agents"("organization_id");

-- CreateIndex
CREATE INDEX "agents_organization_id_is_active_idx" ON "agents"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "agents_organization_id_agent_code_key" ON "agents"("organization_id", "agent_code");

-- CreateIndex
CREATE UNIQUE INDEX "agents_organization_id_rera_number_key" ON "agents"("organization_id", "rera_number");

-- CreateIndex
CREATE UNIQUE INDEX "customers_pan_hash_key" ON "customers"("pan_hash");

-- CreateIndex
CREATE INDEX "customers_organization_id_idx" ON "customers"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_organization_id_customer_code_key" ON "customers"("organization_id", "customer_code");

-- CreateIndex
CREATE UNIQUE INDEX "customers_organization_id_pan_number_key" ON "customers"("organization_id", "pan_number");

-- CreateIndex
CREATE INDEX "leads_organization_id_idx" ON "leads"("organization_id");

-- CreateIndex
CREATE INDEX "leads_organization_id_status_idx" ON "leads"("organization_id", "status");

-- CreateIndex
CREATE INDEX "leads_organization_id_assigned_to_idx" ON "leads"("organization_id", "assigned_to");

-- CreateIndex
CREATE INDEX "leads_organization_id_source_idx" ON "leads"("organization_id", "source");

-- CreateIndex
CREATE UNIQUE INDEX "leads_organization_id_lead_code_key" ON "leads"("organization_id", "lead_code");

-- CreateIndex
CREATE INDEX "site_visits_organization_id_idx" ON "site_visits"("organization_id");

-- CreateIndex
CREATE INDEX "site_visits_organization_id_lead_id_idx" ON "site_visits"("organization_id", "lead_id");

-- CreateIndex
CREATE INDEX "site_visits_organization_id_visit_date_idx" ON "site_visits"("organization_id", "visit_date");

-- CreateIndex
CREATE INDEX "follow_up_tasks_organization_id_idx" ON "follow_up_tasks"("organization_id");

-- CreateIndex
CREATE INDEX "follow_up_tasks_organization_id_assigned_to_status_idx" ON "follow_up_tasks"("organization_id", "assigned_to", "status");

-- CreateIndex
CREATE INDEX "follow_up_tasks_organization_id_scheduled_at_idx" ON "follow_up_tasks"("organization_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "bookings_organization_id_idx" ON "bookings"("organization_id");

-- CreateIndex
CREATE INDEX "bookings_organization_id_customer_id_idx" ON "bookings"("organization_id", "customer_id");

-- CreateIndex
CREATE INDEX "bookings_organization_id_status_idx" ON "bookings"("organization_id", "status");

-- CreateIndex
CREATE INDEX "bookings_organization_id_project_id_idx" ON "bookings"("organization_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_organization_id_booking_code_key" ON "bookings"("organization_id", "booking_code");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_organization_id_unit_id_key" ON "bookings"("organization_id", "unit_id");

-- CreateIndex
CREATE INDEX "commissions_organization_id_idx" ON "commissions"("organization_id");

-- CreateIndex
CREATE INDEX "commissions_organization_id_agent_id_idx" ON "commissions"("organization_id", "agent_id");

-- CreateIndex
CREATE INDEX "commissions_organization_id_booking_id_idx" ON "commissions"("organization_id", "booking_id");

-- CreateIndex
CREATE INDEX "commissions_organization_id_status_idx" ON "commissions"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_organization_id_idx" ON "payments"("organization_id");

-- CreateIndex
CREATE INDEX "payments_organization_id_booking_id_idx" ON "payments"("organization_id", "booking_id");

-- CreateIndex
CREATE INDEX "payments_organization_id_customer_id_idx" ON "payments"("organization_id", "customer_id");

-- CreateIndex
CREATE INDEX "payments_organization_id_status_idx" ON "payments"("organization_id", "status");

-- CreateIndex
CREATE INDEX "payments_organization_id_payment_date_idx" ON "payments"("organization_id", "payment_date");

-- CreateIndex
CREATE UNIQUE INDEX "payments_organization_id_receipt_number_key" ON "payments"("organization_id", "receipt_number");

-- CreateIndex
CREATE INDEX "demand_letters_organization_id_idx" ON "demand_letters"("organization_id");

-- CreateIndex
CREATE INDEX "demand_letters_organization_id_booking_id_idx" ON "demand_letters"("organization_id", "booking_id");

-- CreateIndex
CREATE INDEX "demand_letters_organization_id_status_idx" ON "demand_letters"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "demand_letters_organization_id_letter_code_key" ON "demand_letters"("organization_id", "letter_code");

-- CreateIndex
CREATE INDEX "payment_schedules_organization_id_booking_id_idx" ON "payment_schedules"("organization_id", "booking_id");

-- CreateIndex
CREATE INDEX "cancellation_records_organization_id_idx" ON "cancellation_records"("organization_id");

-- CreateIndex
CREATE INDEX "cancellation_records_organization_id_booking_id_idx" ON "cancellation_records"("organization_id", "booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "cancellation_records_organization_id_cancel_code_key" ON "cancellation_records"("organization_id", "cancel_code");

-- CreateIndex
CREATE INDEX "transfer_records_organization_id_idx" ON "transfer_records"("organization_id");

-- CreateIndex
CREATE INDEX "transfer_records_organization_id_unit_id_idx" ON "transfer_records"("organization_id", "unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_records_organization_id_transfer_code_key" ON "transfer_records"("organization_id", "transfer_code");

-- CreateIndex
CREATE INDEX "possession_records_organization_id_idx" ON "possession_records"("organization_id");

-- CreateIndex
CREATE INDEX "possession_records_organization_id_unit_id_idx" ON "possession_records"("organization_id", "unit_id");

-- CreateIndex
CREATE INDEX "snag_items_organization_id_possession_id_idx" ON "snag_items"("organization_id", "possession_id");

-- CreateIndex
CREATE INDEX "snag_items_organization_id_status_idx" ON "snag_items"("organization_id", "status");

-- CreateIndex
CREATE INDEX "complaints_organization_id_idx" ON "complaints"("organization_id");

-- CreateIndex
CREATE INDEX "complaints_organization_id_customer_id_idx" ON "complaints"("organization_id", "customer_id");

-- CreateIndex
CREATE INDEX "complaints_organization_id_status_idx" ON "complaints"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "complaints_organization_id_complaint_code_key" ON "complaints"("organization_id", "complaint_code");

-- CreateIndex
CREATE INDEX "customer_documents_organization_id_customer_id_idx" ON "customer_documents"("organization_id", "customer_id");

-- CreateIndex
CREATE INDEX "customer_documents_organization_id_category_idx" ON "customer_documents"("organization_id", "category");

-- CreateIndex
CREATE INDEX "communication_logs_organization_id_customer_id_idx" ON "communication_logs"("organization_id", "customer_id");

-- CreateIndex
CREATE INDEX "communication_logs_organization_id_lead_id_idx" ON "communication_logs"("organization_id", "lead_id");

-- CreateIndex
CREATE INDEX "loan_records_organization_id_customer_id_idx" ON "loan_records"("organization_id", "customer_id");

-- CreateIndex
CREATE INDEX "loan_records_organization_id_booking_id_idx" ON "loan_records"("organization_id", "booking_id");

-- CreateIndex
CREATE INDEX "agreement_records_organization_id_booking_id_idx" ON "agreement_records"("organization_id", "booking_id");

-- CreateIndex
CREATE INDEX "registration_records_organization_id_booking_id_idx" ON "registration_records"("organization_id", "booking_id");

-- CreateIndex
CREATE INDEX "approval_requests_organization_id_idx" ON "approval_requests"("organization_id");

-- CreateIndex
CREATE INDEX "approval_requests_organization_id_status_idx" ON "approval_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "approval_requests_organization_id_request_type_idx" ON "approval_requests"("organization_id", "request_type");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_idx" ON "audit_logs"("organization_id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_entity_type_entity_id_idx" ON "audit_logs"("organization_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_actor_id_idx" ON "audit_logs"("organization_id", "actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_action_idx" ON "audit_logs"("organization_id", "action");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "towers" ADD CONSTRAINT "towers_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_tower_id_fkey" FOREIGN KEY ("tower_id") REFERENCES "towers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_letters" ADD CONSTRAINT "demand_letters_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_linked_demand_id_fkey" FOREIGN KEY ("linked_demand_id") REFERENCES "demand_letters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cancellation_records" ADD CONSTRAINT "cancellation_records_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_records" ADD CONSTRAINT "transfer_records_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "possession_records" ADD CONSTRAINT "possession_records_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snag_items" ADD CONSTRAINT "snag_items_possession_id_fkey" FOREIGN KEY ("possession_id") REFERENCES "possession_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_records" ADD CONSTRAINT "loan_records_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_records" ADD CONSTRAINT "agreement_records_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_records" ADD CONSTRAINT "registration_records_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
