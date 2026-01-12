CREATE TYPE "public"."amortization_frequency" AS ENUM('monthly', 'quarterly');--> statement-breakpoint
CREATE TYPE "public"."amortization_status" AS ENUM('scheduled', 'posted', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."bank_account_type" AS ENUM('checking', 'savings');--> statement-breakpoint
CREATE TYPE "public"."compensation_change_reason" AS ENUM('hire', 'promotion', 'annual_review', 'adjustment', 'demotion', 'transfer');--> statement-breakpoint
CREATE TYPE "public"."deduction_calc_method" AS ENUM('fixed', 'percent_gross', 'percent_net');--> statement-breakpoint
CREATE TYPE "public"."deferred_revenue_status" AS ENUM('pending', 'partially_recognized', 'recognized', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."deposit_type" AS ENUM('percent', 'fixed', 'remainder');--> statement-breakpoint
CREATE TYPE "public"."depreciation_entry_status" AS ENUM('scheduled', 'posted', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."depreciation_method" AS ENUM('straight_line', 'none');--> statement-breakpoint
CREATE TYPE "public"."document_category" AS ENUM('id', 'contract', 'certificate', 'visa', 'license', 'policy', 'tax', 'other');--> statement-breakpoint
CREATE TYPE "public"."document_verification_status" AS ENUM('pending', 'verified', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."employment_status" AS ENUM('active', 'on_leave', 'suspended', 'terminated', 'retired');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('full_time', 'part_time', 'contractor', 'temp', 'intern');--> statement-breakpoint
CREATE TYPE "public"."expense_accrual_status" AS ENUM('accrued', 'paid', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."filing_frequency" AS ENUM('monthly', 'quarterly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."fixed_asset_status" AS ENUM('active', 'fully_depreciated', 'disposed');--> statement-breakpoint
CREATE TYPE "public"."flsa_status" AS ENUM('exempt', 'non_exempt');--> statement-breakpoint
CREATE TYPE "public"."follow_up_escalation_level" AS ENUM('reminder', 'first_notice', 'second_notice', 'final_notice', 'collections');--> statement-breakpoint
CREATE TYPE "public"."follow_up_status" AS ENUM('pending', 'in_progress', 'contacted', 'promised', 'completed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."grc_alert_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."grc_alert_status" AS ENUM('active', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."grc_control_category" AS ENUM('preventive', 'detective', 'corrective', 'directive');--> statement-breakpoint
CREATE TYPE "public"."grc_control_status" AS ENUM('active', 'inactive', 'draft', 'under_review', 'deprecated');--> statement-breakpoint
CREATE TYPE "public"."grc_control_test_result" AS ENUM('passed', 'failed', 'partial', 'not_tested');--> statement-breakpoint
CREATE TYPE "public"."grc_incident_category" AS ENUM('security', 'data', 'fraud', 'system', 'physical', 'compliance', 'safety', 'other');--> statement-breakpoint
CREATE TYPE "public"."grc_incident_severity" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."grc_incident_status" AS ENUM('reported', 'investigating', 'contained', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."grc_license_status" AS ENUM('active', 'expired', 'suspended', 'pending_renewal', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."grc_requirement_category" AS ENUM('tax', 'labor', 'licensing', 'environmental', 'data_privacy', 'financial', 'health_safety', 'insurance', 'corporate_governance');--> statement-breakpoint
CREATE TYPE "public"."grc_requirement_risk_level" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."grc_requirement_status" AS ENUM('satisfied', 'unsatisfied', 'at_risk', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."grc_risk_category" AS ENUM('operational', 'financial', 'compliance', 'strategic', 'reputational', 'technology', 'fraud');--> statement-breakpoint
CREATE TYPE "public"."grc_risk_severity" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."grc_risk_status" AS ENUM('open', 'mitigating', 'monitoring', 'closed', 'escalated');--> statement-breakpoint
CREATE TYPE "public"."grc_task_status" AS ENUM('open', 'blocked', 'completed');--> statement-breakpoint
CREATE TYPE "public"."grc_tax_filing_status" AS ENUM('pending', 'filed', 'paid', 'overdue', 'amended');--> statement-breakpoint
CREATE TYPE "public"."jurisdiction_type" AS ENUM('country', 'state', 'province', 'territory', 'local');--> statement-breakpoint
CREATE TYPE "public"."leave_accrual_type" AS ENUM('manual', 'monthly', 'annual', 'per_period');--> statement-breakpoint
CREATE TYPE "public"."leave_request_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled', 'taken');--> statement-breakpoint
CREATE TYPE "public"."pay_frequency" AS ENUM('weekly', 'biweekly', 'semimonthly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."pay_type" AS ENUM('salary', 'hourly', 'commission');--> statement-breakpoint
CREATE TYPE "public"."payroll_run_status" AS ENUM('draft', 'calculating', 'calculated', 'reviewing', 'approved', 'posting', 'posted', 'paid', 'void');--> statement-breakpoint
CREATE TYPE "public"."payroll_run_type" AS ENUM('regular', 'bonus', 'correction', 'final');--> statement-breakpoint
CREATE TYPE "public"."performance_cycle_frequency" AS ENUM('quarterly', 'semi_annual', 'annual', 'custom');--> statement-breakpoint
CREATE TYPE "public"."performance_cycle_status" AS ENUM('planned', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."performance_goal_status" AS ENUM('not_started', 'in_progress', 'completed', 'deferred', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."performance_review_status" AS ENUM('not_started', 'in_progress', 'submitted', 'approved', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."period_status" AS ENUM('open', 'soft_closed', 'hard_closed');--> statement-breakpoint
CREATE TYPE "public"."playbook_category" AS ENUM('market_expansion', 'product_launch', 'cost_optimization', 'digital_transformation', 'customer_acquisition', 'revenue_growth', 'operational_efficiency', 'talent_development');--> statement-breakpoint
CREATE TYPE "public"."playbook_difficulty" AS ENUM('easy', 'medium', 'hard', 'expert');--> statement-breakpoint
CREATE TYPE "public"."playbook_initiation_status" AS ENUM('in_progress', 'completed', 'abandoned', 'paused');--> statement-breakpoint
CREATE TYPE "public"."playbook_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."prepaid_expense_status" AS ENUM('active', 'fully_amortized', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."recognition_trigger" AS ENUM('manual', 'completion', 'schedule');--> statement-breakpoint
CREATE TYPE "public"."reconciliation_status" AS ENUM('in_progress', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."recurring_frequency" AS ENUM('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."recurring_transaction_status" AS ENUM('active', 'paused', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."recurring_transaction_type" AS ENUM('expense', 'transfer', 'payment');--> statement-breakpoint
CREATE TYPE "public"."statement_line_status" AS ENUM('unmatched', 'matched', 'excluded');--> statement-breakpoint
CREATE TYPE "public"."tax_calc_method" AS ENUM('bracket', 'flat_rate', 'wage_base', 'formula');--> statement-breakpoint
CREATE TYPE "public"."tax_deposit_status" AS ENUM('pending', 'submitted', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."tax_filing_status" AS ENUM('pending', 'in_progress', 'submitted', 'accepted', 'rejected', 'amended');--> statement-breakpoint
CREATE TYPE "public"."tax_registration_status" AS ENUM('pending', 'active', 'suspended', 'closed');--> statement-breakpoint
ALTER TYPE "public"."ai_task_type" ADD VALUE 'complete_performance_review';--> statement-breakpoint
ALTER TYPE "public"."ai_task_type" ADD VALUE 'document_expiry_alert';--> statement-breakpoint
ALTER TYPE "public"."ai_task_type" ADD VALUE 'verify_document';--> statement-breakpoint
ALTER TYPE "public"."ai_task_type" ADD VALUE 'approve_leave_request';--> statement-breakpoint
CREATE TABLE "accounting_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"period_label" text NOT NULL,
	"status" "period_status" DEFAULT 'open' NOT NULL,
	"soft_closed_at" timestamp with time zone,
	"soft_closed_by_actor_id" uuid,
	"hard_closed_at" timestamp with time zone,
	"hard_closed_by_actor_id" uuid,
	"reopened_at" timestamp with time zone,
	"reopened_by_actor_id" uuid,
	"reopen_reason" text,
	"checklist_snapshot" jsonb,
	"period_totals" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_reconciliation_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"account_code" text NOT NULL,
	"statement_date" date NOT NULL,
	"statement_ending_balance" numeric(18, 6) NOT NULL,
	"book_balance" numeric(18, 6) NOT NULL,
	"status" "reconciliation_status" DEFAULT 'in_progress' NOT NULL,
	"difference" numeric(18, 6),
	"completed_at" timestamp with time zone,
	"completed_by_actor_id" uuid,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_statement_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"reconciliation_session_id" uuid NOT NULL,
	"transaction_date" date NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(18, 6) NOT NULL,
	"reference" text,
	"transaction_type" text,
	"status" "statement_line_status" DEFAULT 'unmatched' NOT NULL,
	"matched_payment_id" uuid,
	"matched_journal_entry_id" uuid,
	"match_confidence" numeric(5, 2),
	"matched_by_actor_id" uuid,
	"matched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"legal_name" text NOT NULL,
	"trade_name" text,
	"legal_structure" text,
	"incorporation_date" date,
	"jurisdiction" text,
	"tax_id" text,
	"primary_industry" text,
	"naics_codes" jsonb DEFAULT '[]'::jsonb,
	"business_description" text,
	"annual_revenue" numeric(15, 2),
	"employee_count" integer,
	"headquarters_address" jsonb,
	"operating_locations" jsonb DEFAULT '[]'::jsonb,
	"business_activities" jsonb DEFAULT '[]'::jsonb,
	"licenses_held" jsonb DEFAULT '[]'::jsonb,
	"regulated_activities" jsonb DEFAULT '[]'::jsonb,
	"ai_analysis" jsonb,
	"confidence_score" numeric(3, 2),
	"last_analyzed_at" timestamp with time zone,
	"created_by_actor_id" uuid,
	"updated_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compensation_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"pay_type" "pay_type" NOT NULL,
	"pay_rate" numeric(12, 4) NOT NULL,
	"pay_frequency" "pay_frequency" NOT NULL,
	"commission_rate" numeric(6, 4),
	"commission_basis" text,
	"standard_hours_per_week" numeric(5, 2) DEFAULT '40.00',
	"change_reason" "compensation_change_reason",
	"change_notes" text,
	"approved_by_actor_id" uuid,
	"approved_at" timestamp with time zone,
	"created_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_rule_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"version" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"min_pay_frequency" "pay_frequency",
	"max_days_to_pay" integer,
	"overtime_threshold_daily" numeric(4, 2),
	"overtime_threshold_weekly" numeric(5, 2),
	"overtime_multiplier" numeric(3, 2) DEFAULT '1.50',
	"double_time_threshold" numeric(4, 2),
	"double_time_multiplier" numeric(3, 2) DEFAULT '2.00',
	"minimum_wage_hourly" numeric(10, 4),
	"minimum_wage_salary_annual" numeric(12, 2),
	"minimum_wage_exempt_threshold" numeric(12, 2),
	"min_annual_leave_days" integer,
	"min_sick_leave_days" integer,
	"parental_leave_weeks" integer,
	"record_retention_years" integer DEFAULT 7,
	"filing_frequency" "filing_frequency",
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deduction_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"is_pretax_federal" boolean DEFAULT false,
	"is_pretax_state" boolean DEFAULT false,
	"is_pretax_fica" boolean DEFAULT false,
	"annual_limit_employee" numeric(12, 2),
	"annual_limit_employer" numeric(12, 2),
	"catch_up_age" integer,
	"catch_up_limit" numeric(12, 2),
	"default_calc_method" "deduction_calc_method",
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deferred_revenue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid,
	"customer_name" text,
	"description" text NOT NULL,
	"service_type" text,
	"original_amount" numeric(18, 6) NOT NULL,
	"remaining_amount" numeric(18, 6) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"received_date" date NOT NULL,
	"expected_completion_date" date,
	"deferred_revenue_liability_account_code" text DEFAULT '2400' NOT NULL,
	"revenue_account_code" text DEFAULT '4000' NOT NULL,
	"source_payment_id" uuid,
	"status" "deferred_revenue_status" DEFAULT 'pending' NOT NULL,
	"completion_task_id" uuid,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deferred_revenue_recognition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"deferred_revenue_id" uuid NOT NULL,
	"recognition_date" date NOT NULL,
	"amount" numeric(18, 6) NOT NULL,
	"trigger" "recognition_trigger" DEFAULT 'manual' NOT NULL,
	"notes" text,
	"journal_entry_id" uuid,
	"posted_at" timestamp with time zone,
	"posted_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "depreciation_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"fixed_asset_id" uuid NOT NULL,
	"period_date" date NOT NULL,
	"period_end_date" date NOT NULL,
	"amount" numeric(18, 6) NOT NULL,
	"status" "depreciation_entry_status" DEFAULT 'scheduled' NOT NULL,
	"journal_entry_id" uuid,
	"posted_at" timestamp with time zone,
	"posted_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "earning_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"is_taxable_federal" boolean DEFAULT true,
	"is_taxable_state" boolean DEFAULT true,
	"is_taxable_fica" boolean DEFAULT true,
	"multiplier" numeric(4, 2) DEFAULT '1.00',
	"default_expense_account_code" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"account_type" "bank_account_type" NOT NULL,
	"routing_number" text NOT NULL,
	"account_number_encrypted" text NOT NULL,
	"account_number_last4" text NOT NULL,
	"bank_name" text,
	"deposit_type" "deposit_type" NOT NULL,
	"deposit_amount" numeric(10, 2),
	"priority" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_prenote_sent" boolean DEFAULT false,
	"prenote_date" date,
	"created_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_deductions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"deduction_type_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"calc_method" "deduction_calc_method" NOT NULL,
	"amount" numeric(10, 4) NOT NULL,
	"per_period_limit" numeric(10, 2),
	"annual_limit" numeric(12, 2),
	"ytd_amount" numeric(12, 2) DEFAULT '0',
	"case_number" text,
	"garnishment_type" text,
	"garnishment_priority" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_leave_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type" text NOT NULL,
	"accrual_rate" numeric(8, 4),
	"accrual_frequency" text,
	"accrual_cap" numeric(8, 2),
	"balance_hours" numeric(8, 2) DEFAULT '0' NOT NULL,
	"used_ytd" numeric(8, 2) DEFAULT '0' NOT NULL,
	"accrued_ytd" numeric(8, 2) DEFAULT '0' NOT NULL,
	"carryover_limit" numeric(8, 2),
	"carryover_expiry_date" date,
	"as_of_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"employee_number" text NOT NULL,
	"hire_date" date NOT NULL,
	"termination_date" date,
	"employment_status" "employment_status" DEFAULT 'active' NOT NULL,
	"employment_type" "employment_type" NOT NULL,
	"flsa_status" "flsa_status" DEFAULT 'non_exempt' NOT NULL,
	"worker_comp_class" text,
	"work_jurisdiction_id" uuid,
	"work_location" text,
	"is_remote" boolean DEFAULT false,
	"federal_filing_status" text DEFAULT 'single',
	"state_filing_status" text,
	"federal_allowances" integer DEFAULT 0,
	"state_allowances" integer DEFAULT 0,
	"additional_federal_withholding" numeric(10, 2) DEFAULT '0',
	"additional_state_withholding" numeric(10, 2) DEFAULT '0',
	"is_exempt_from_federal" boolean DEFAULT false,
	"is_exempt_from_state" boolean DEFAULT false,
	"is_exempt_from_fica" boolean DEFAULT false,
	"w4_step2_checkbox" boolean DEFAULT false,
	"w4_dependents_amount" numeric(10, 2) DEFAULT '0',
	"w4_other_income" numeric(10, 2) DEFAULT '0',
	"w4_deductions" numeric(10, 2) DEFAULT '0',
	"payment_method" text DEFAULT 'check',
	"manager_employee_id" uuid,
	"created_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_accruals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"description" text NOT NULL,
	"category" text,
	"vendor_id" uuid,
	"vendor_name" text,
	"amount" numeric(18, 6) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"expense_period" date NOT NULL,
	"payment_date" date NOT NULL,
	"expense_account_code" text NOT NULL,
	"cash_account_code" text NOT NULL,
	"accrual_journal_entry_id" uuid,
	"payment_journal_entry_id" uuid,
	"status" "expense_accrual_status" DEFAULT 'accrued' NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fixed_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"purchase_date" date NOT NULL,
	"purchase_price" numeric(18, 6) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"vendor_id" uuid,
	"vendor_name" text,
	"depreciation_method" "depreciation_method" DEFAULT 'straight_line' NOT NULL,
	"useful_life_months" integer NOT NULL,
	"salvage_value" numeric(18, 6) DEFAULT '0' NOT NULL,
	"total_depreciation" numeric(18, 6) DEFAULT '0' NOT NULL,
	"book_value" numeric(18, 6) NOT NULL,
	"asset_account_code" text DEFAULT '1500' NOT NULL,
	"accumulated_depreciation_account_code" text DEFAULT '1510' NOT NULL,
	"depreciation_expense_account_code" text DEFAULT '6300' NOT NULL,
	"source_expense_id" uuid,
	"source_journal_entry_id" uuid,
	"status" "fixed_asset_status" DEFAULT 'active' NOT NULL,
	"disposal_date" date,
	"disposal_amount" numeric(18, 6),
	"disposal_journal_entry_id" uuid,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grc_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"requirement_id" uuid,
	"title" text NOT NULL,
	"message" text,
	"alert_type" text,
	"severity" "grc_alert_severity" NOT NULL,
	"status" "grc_alert_status" DEFAULT 'active' NOT NULL,
	"resolved_at" timestamp with time zone,
	"auto_resolved" boolean DEFAULT false,
	"resolution_reason" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grc_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"actor_id" uuid,
	"actor_type" text,
	"reason" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "grc_compliance_calendar" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"requirement_id" uuid,
	"event_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"due_date" date NOT NULL,
	"reminder_date" date,
	"completed_date" date,
	"is_recurring" boolean DEFAULT false,
	"recurrence_pattern" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grc_control_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"control_id" uuid NOT NULL,
	"test_date" date NOT NULL,
	"result" "grc_control_test_result" NOT NULL,
	"tester_id" uuid,
	"tester_name" text,
	"findings" text,
	"recommendations" text,
	"evidence_links" jsonb DEFAULT '[]'::jsonb,
	"remediation_required" boolean DEFAULT false,
	"remediation_due_date" date,
	"remediation_completed_at" timestamp with time zone,
	"created_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grc_controls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" "grc_control_category" NOT NULL,
	"status" "grc_control_status" DEFAULT 'draft' NOT NULL,
	"owner_id" uuid,
	"owner_name" text,
	"testing_frequency" text,
	"last_tested_at" timestamp with time zone,
	"last_test_result" "grc_control_test_result" DEFAULT 'not_tested',
	"next_test_due" date,
	"compliance_frameworks" jsonb DEFAULT '[]'::jsonb,
	"linked_risk_ids" jsonb DEFAULT '[]'::jsonb,
	"effectiveness_score" numeric(5, 2),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grc_document_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"requirement_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"document_type" text,
	"validity_start" date,
	"validity_end" date,
	"ai_extracted_data" jsonb,
	"ai_confidence" numeric(3, 2),
	"uploaded_by_actor_id" uuid,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grc_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" "grc_incident_category" NOT NULL,
	"severity" "grc_incident_severity" NOT NULL,
	"status" "grc_incident_status" DEFAULT 'reported' NOT NULL,
	"occurred_at" timestamp with time zone,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"reporter_id" uuid,
	"reporter_name" text,
	"owner_id" uuid,
	"owner_name" text,
	"root_cause" text,
	"immediate_actions" text,
	"corrective_actions" text,
	"affected_systems" jsonb DEFAULT '[]'::jsonb,
	"affected_people" integer,
	"financial_impact" numeric(12, 2),
	"regulatory_report_required" boolean DEFAULT false,
	"regulatory_report_filed" boolean DEFAULT false,
	"regulatory_report_date" date,
	"linked_risk_ids" jsonb DEFAULT '[]'::jsonb,
	"linked_control_ids" jsonb DEFAULT '[]'::jsonb,
	"evidence_links" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grc_licenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"requirement_id" uuid,
	"license_type" text NOT NULL,
	"license_number" text,
	"issuing_authority" text NOT NULL,
	"jurisdiction" text,
	"issue_date" date NOT NULL,
	"expiration_date" date,
	"renewal_frequency" text,
	"status" "grc_license_status" NOT NULL,
	"license_documents" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grc_requirement_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"requirement_id" uuid NOT NULL,
	"triggered_by" text,
	"trigger_source_id" uuid,
	"business_profile_snapshot" jsonb,
	"evidence_snapshot" jsonb,
	"ai_findings" jsonb,
	"ai_explanation" text,
	"ai_confidence" numeric(3, 2),
	"previous_status" text,
	"new_status" text,
	"previous_risk_level" text,
	"new_risk_level" text,
	"closure_check_passed" boolean,
	"closure_check_details" jsonb,
	"evaluated_by_actor_id" uuid,
	"evaluated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grc_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"requirement_code" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" "grc_requirement_category" NOT NULL,
	"applies_to_jurisdictions" jsonb DEFAULT '[]'::jsonb,
	"applies_to_industries" jsonb DEFAULT '[]'::jsonb,
	"applies_to_activities" jsonb DEFAULT '[]'::jsonb,
	"applies_to_structure" jsonb DEFAULT '[]'::jsonb,
	"threshold_rules" jsonb,
	"status" "grc_requirement_status" DEFAULT 'unknown' NOT NULL,
	"risk_level" "grc_requirement_risk_level" DEFAULT 'medium' NOT NULL,
	"priority" integer DEFAULT 5,
	"closure_criteria" jsonb NOT NULL,
	"evidence_documents" jsonb DEFAULT '[]'::jsonb,
	"evidence_data" jsonb,
	"evidence_updated_at" timestamp with time zone,
	"ai_explanation" text,
	"ai_interpretation" jsonb,
	"ai_confidence" numeric(3, 2),
	"satisfied_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"next_action_due" date,
	"is_active" boolean DEFAULT true,
	"created_by_actor_id" uuid,
	"updated_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grc_risks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" "grc_risk_category" NOT NULL,
	"severity" "grc_risk_severity" NOT NULL,
	"status" "grc_risk_status" DEFAULT 'open' NOT NULL,
	"likelihood" integer,
	"impact" integer,
	"risk_score" numeric(5, 2),
	"owner_id" uuid,
	"owner_name" text,
	"mitigation_plan" text,
	"mitigation_due_date" date,
	"residual_risk_level" "grc_risk_severity",
	"linked_control_ids" jsonb DEFAULT '[]'::jsonb,
	"linked_incident_ids" jsonb DEFAULT '[]'::jsonb,
	"last_reviewed_at" timestamp with time zone,
	"next_review_date" date,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grc_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"requirement_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"action_type" text,
	"status" "grc_task_status" DEFAULT 'open' NOT NULL,
	"blocked_reason" text,
	"assigned_to" uuid,
	"due_date" date,
	"completion_evidence" jsonb,
	"uploaded_documents" jsonb DEFAULT '[]'::jsonb,
	"user_feedback" text,
	"completed_at" timestamp with time zone,
	"completed_by_actor_id" uuid,
	"auto_closed" boolean DEFAULT false,
	"created_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grc_tax_filings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"requirement_id" uuid,
	"filing_type" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"tax_year" integer,
	"tax_period" text,
	"tax_liability" numeric(15, 2),
	"tax_paid" numeric(15, 2),
	"penalties" numeric(15, 2),
	"interest" numeric(15, 2),
	"due_date" date NOT NULL,
	"filed_date" date,
	"paid_date" date,
	"status" "grc_tax_filing_status" NOT NULL,
	"filing_documents" jsonb DEFAULT '[]'::jsonb,
	"payment_reference" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "growth_playbooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" "playbook_category" NOT NULL,
	"difficulty" "playbook_difficulty" DEFAULT 'medium' NOT NULL,
	"status" "playbook_status" DEFAULT 'draft' NOT NULL,
	"estimated_duration_days" integer,
	"expected_outcome" text,
	"target_horizon" text,
	"times_launched" integer DEFAULT 0 NOT NULL,
	"times_completed" integer DEFAULT 0 NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_follow_up_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"follow_up_id" uuid NOT NULL,
	"activity_type" text NOT NULL,
	"description" text NOT NULL,
	"contact_method" text,
	"contact_person" text,
	"contact_details" text,
	"outcome" text,
	"promised_date" date,
	"promised_amount" numeric(18, 6),
	"performed_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_follow_ups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sales_doc_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"escalation_level" "follow_up_escalation_level" DEFAULT 'reminder' NOT NULL,
	"status" "follow_up_status" DEFAULT 'pending' NOT NULL,
	"invoice_amount" numeric(18, 6) NOT NULL,
	"amount_paid" numeric(18, 6) DEFAULT '0' NOT NULL,
	"amount_due" numeric(18, 6) NOT NULL,
	"days_overdue" integer NOT NULL,
	"original_due_date" date NOT NULL,
	"next_escalation_date" date,
	"last_contacted_at" timestamp with time zone,
	"last_contact_method" text,
	"contact_attempts" integer DEFAULT 0 NOT NULL,
	"promised_payment_date" date,
	"promised_amount" numeric(18, 6),
	"notes" text,
	"resolved_at" timestamp with time zone,
	"resolved_by_actor_id" uuid,
	"resolution_reason" text,
	"task_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jurisdictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"country_code" text NOT NULL,
	"subdivision_code" text,
	"jurisdiction_type" "jurisdiction_type" NOT NULL,
	"parent_jurisdiction_id" uuid,
	"currency_code" text DEFAULT 'USD' NOT NULL,
	"timezone" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jurisdictions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "leave_balance_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"adjustment_date" date NOT NULL,
	"days_adjusted" numeric(6, 2) NOT NULL,
	"reason" text NOT NULL,
	"adjusted_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"days_requested" numeric(5, 2) NOT NULL,
	"half_day_start" boolean DEFAULT false,
	"half_day_end" boolean DEFAULT false,
	"reason" text,
	"status" "leave_request_status" DEFAULT 'pending' NOT NULL,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"rejection_reason" text,
	"affects_payroll" boolean DEFAULT true,
	"notes" text,
	"created_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"accrual_type" "leave_accrual_type" DEFAULT 'manual' NOT NULL,
	"default_annual_allowance" numeric(6, 2),
	"max_carryover_days" numeric(6, 2),
	"requires_approval" boolean DEFAULT true NOT NULL,
	"is_paid" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pay_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pay_schedule_id" uuid NOT NULL,
	"period_number" integer NOT NULL,
	"year" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"pay_date" date NOT NULL,
	"timesheet_cutoff" date,
	"processing_date" date,
	"status" text DEFAULT 'upcoming' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pay_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"frequency" "pay_frequency" NOT NULL,
	"anchor_date" date,
	"first_pay_day" integer,
	"second_pay_day" integer,
	"pay_day_of_month" integer,
	"days_before_pay_to_process" integer DEFAULT 3,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_deductions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"payroll_run_employee_id" uuid NOT NULL,
	"employee_deduction_id" uuid,
	"deduction_type_id" uuid NOT NULL,
	"employee_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"employer_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"ytd_employee_amount" numeric(14, 2),
	"ytd_employer_amount" numeric(14, 2),
	"annual_limit_remaining" numeric(14, 2),
	"calculation_details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_earnings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"payroll_run_employee_id" uuid NOT NULL,
	"earning_type_id" uuid NOT NULL,
	"hours" numeric(8, 2),
	"rate" numeric(12, 4),
	"amount" numeric(12, 2) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_gl_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"mapping_type" text NOT NULL,
	"department_id" uuid,
	"earning_type_id" uuid,
	"deduction_type_id" uuid,
	"tax_type" text,
	"debit_account_id" uuid,
	"credit_account_id" uuid,
	"priority" integer DEFAULT 100,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_run_employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"payroll_run_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"pay_type" "pay_type" NOT NULL,
	"pay_rate" numeric(12, 4) NOT NULL,
	"gross_pay" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_taxes" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_deductions" numeric(12, 2) DEFAULT '0' NOT NULL,
	"net_pay" numeric(12, 2) DEFAULT '0' NOT NULL,
	"employer_taxes" numeric(12, 2) DEFAULT '0' NOT NULL,
	"employer_contributions" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_employer_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"ytd_gross" numeric(14, 2) DEFAULT '0' NOT NULL,
	"ytd_federal_tax" numeric(14, 2) DEFAULT '0' NOT NULL,
	"ytd_state_tax" numeric(14, 2) DEFAULT '0' NOT NULL,
	"ytd_social_security" numeric(14, 2) DEFAULT '0' NOT NULL,
	"ytd_medicare" numeric(14, 2) DEFAULT '0' NOT NULL,
	"payment_method" text,
	"check_number" text,
	"check_date" date,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pay_period_id" uuid NOT NULL,
	"run_number" integer DEFAULT 1 NOT NULL,
	"run_type" "payroll_run_type" DEFAULT 'regular' NOT NULL,
	"status" "payroll_run_status" DEFAULT 'draft' NOT NULL,
	"total_gross_pay" numeric(14, 2),
	"total_employee_taxes" numeric(14, 2),
	"total_employee_deductions" numeric(14, 2),
	"total_net_pay" numeric(14, 2),
	"total_employer_taxes" numeric(14, 2),
	"total_employer_contributions" numeric(14, 2),
	"employee_count" integer,
	"calculated_at" timestamp with time zone,
	"calculated_by_actor_id" uuid,
	"approved_at" timestamp with time zone,
	"approved_by_actor_id" uuid,
	"posted_at" timestamp with time zone,
	"posted_by_actor_id" uuid,
	"journal_entry_id" uuid,
	"voided_at" timestamp with time zone,
	"voided_by_actor_id" uuid,
	"void_reason" text,
	"notes" text,
	"created_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_taxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"payroll_run_employee_id" uuid NOT NULL,
	"tax_table_id" uuid,
	"jurisdiction_id" uuid,
	"tax_type" text NOT NULL,
	"taxable_wages" numeric(12, 2) NOT NULL,
	"tax_rate" numeric(8, 6),
	"employee_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"employer_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"ytd_taxable_wages" numeric(14, 2),
	"wage_base_remaining" numeric(14, 2),
	"calculation_details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"frequency" "performance_cycle_frequency" NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"due_date" date NOT NULL,
	"assigned_to_role" text,
	"status" "performance_cycle_status" DEFAULT 'planned' NOT NULL,
	"notes" text,
	"created_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"cycle_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"target_date" date,
	"status" "performance_goal_status" DEFAULT 'not_started' NOT NULL,
	"progress_percent" integer DEFAULT 0,
	"completed_at" timestamp with time zone,
	"created_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_review_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"review_id" uuid NOT NULL,
	"category" text NOT NULL,
	"category_label" text NOT NULL,
	"rating" integer,
	"weight" numeric(5, 2) DEFAULT '1.0',
	"comments" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"reviewer_employee_id" uuid,
	"status" "performance_review_status" DEFAULT 'not_started' NOT NULL,
	"overall_rating" integer,
	"strengths" text,
	"areas_for_improvement" text,
	"goals_for_next_period" text,
	"manager_comments" text,
	"employee_comments" text,
	"completed_at" timestamp with time zone,
	"approved_by_actor_id" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playbook_initiations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"playbook_id" uuid NOT NULL,
	"status" "playbook_initiation_status" DEFAULT 'in_progress' NOT NULL,
	"current_step_no" integer DEFAULT 1 NOT NULL,
	"initiated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"target_completion_date" date,
	"notes" text,
	"planner_initiative_id" uuid,
	"initiated_by_actor_id" uuid
);
--> statement-breakpoint
CREATE TABLE "playbook_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"playbook_id" uuid NOT NULL,
	"sequence_no" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"estimated_days" integer,
	"action_items" jsonb DEFAULT '[]'::jsonb,
	"resources" jsonb DEFAULT '[]'::jsonb,
	"created_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prepaid_amortization_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"prepaid_expense_id" uuid NOT NULL,
	"period_date" date NOT NULL,
	"period_end_date" date NOT NULL,
	"amount" numeric(18, 6) NOT NULL,
	"status" "amortization_status" DEFAULT 'scheduled' NOT NULL,
	"journal_entry_id" uuid,
	"posted_at" timestamp with time zone,
	"posted_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prepaid_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"description" text NOT NULL,
	"category" text,
	"vendor_id" uuid,
	"vendor_name" text,
	"original_amount" numeric(18, 6) NOT NULL,
	"remaining_amount" numeric(18, 6) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"amortization_frequency" "amortization_frequency" DEFAULT 'monthly' NOT NULL,
	"prepaid_asset_account_code" text DEFAULT '1400' NOT NULL,
	"expense_account_code" text NOT NULL,
	"source_expense_id" uuid,
	"source_payment_id" uuid,
	"status" "prepaid_expense_status" DEFAULT 'active' NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_transaction_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"recurring_transaction_id" uuid NOT NULL,
	"scheduled_date" date NOT NULL,
	"amount" numeric(18, 6) NOT NULL,
	"expense_journal_entry_id" uuid,
	"payment_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "recurring_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "recurring_transaction_type" NOT NULL,
	"frequency" "recurring_frequency" NOT NULL,
	"day_of_month" integer,
	"day_of_week" integer,
	"month_of_year" integer,
	"start_date" date NOT NULL,
	"end_date" date,
	"next_due_date" date NOT NULL,
	"last_processed_date" date,
	"occurrences_completed" integer DEFAULT 0 NOT NULL,
	"max_occurrences" integer,
	"amount" numeric(18, 6) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"category" text,
	"expense_account_code" text,
	"vendor_id" uuid,
	"vendor_name" text,
	"from_account_code" text,
	"to_account_code" text,
	"party_id" uuid,
	"party_name" text,
	"method" "payment_method" DEFAULT 'bank' NOT NULL,
	"auto_create" boolean DEFAULT true NOT NULL,
	"reminder_days_before" integer DEFAULT 3,
	"status" "recurring_transaction_status" DEFAULT 'active' NOT NULL,
	"paused_at" timestamp with time zone,
	"paused_reason" text,
	"cancelled_at" timestamp with time zone,
	"cancelled_reason" text,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_brackets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tax_table_id" uuid NOT NULL,
	"filing_status" text NOT NULL,
	"bracket_order" integer NOT NULL,
	"min_amount" numeric(12, 2) NOT NULL,
	"max_amount" numeric(12, 2),
	"rate" numeric(8, 6) NOT NULL,
	"base_tax" numeric(12, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_deposits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"tax_type" text NOT NULL,
	"deposit_date" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"payment_method" text,
	"confirmation_number" text,
	"payroll_run_ids" jsonb DEFAULT '[]'::jsonb,
	"status" "tax_deposit_status" DEFAULT 'pending' NOT NULL,
	"created_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_filing_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"filing_type" text NOT NULL,
	"frequency" "filing_frequency" NOT NULL,
	"due_day_of_month" integer,
	"due_days_after_quarter" integer,
	"due_date_annual" date,
	"deposit_frequency" text,
	"deposit_threshold" numeric(14, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_filings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"filing_schedule_id" uuid,
	"filing_type" text NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"due_date" date NOT NULL,
	"wages_reported" numeric(14, 2),
	"tax_withheld" numeric(14, 2),
	"employer_tax" numeric(14, 2),
	"total_liability" numeric(14, 2),
	"amount_deposited" numeric(14, 2),
	"balance_due" numeric(14, 2),
	"status" "tax_filing_status" DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp with time zone,
	"submitted_by_actor_id" uuid,
	"confirmation_number" text,
	"form_data" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"tax_type" text NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"version" text NOT NULL,
	"name" text NOT NULL,
	"calculation_method" "tax_calc_method" NOT NULL,
	"flat_rate" numeric(8, 6),
	"wage_base_limit" numeric(12, 2),
	"employer_rate" numeric(8, 6),
	"employer_wage_base" numeric(12, 2),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_compliance_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"legal_name" text NOT NULL,
	"registration_number" text,
	"federal_tax_id" text,
	"state_tax_id" text,
	"local_tax_id" text,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state_province" text,
	"postal_code" text,
	"country_code" text NOT NULL,
	"primary_jurisdiction_id" uuid NOT NULL,
	"state_jurisdiction_id" uuid,
	"local_jurisdiction_id" uuid,
	"entity_type" text,
	"industry_code" text,
	"employee_count_tier" text,
	"compliance_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ai_generated_at" timestamp with time zone,
	"ai_model_version" text,
	"last_reviewed_at" timestamp with time zone,
	"reviewed_by_actor_id" uuid,
	"created_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_compliance_profiles_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "tenant_deduction_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"deduction_type_id" uuid NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"employer_match_rate" numeric(6, 4),
	"employer_match_limit" numeric(12, 2),
	"liability_account_id" uuid,
	"expense_account_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_tax_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"tax_type" text NOT NULL,
	"registration_number" text,
	"registration_date" date,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"employer_rate_override" numeric(8, 6),
	"status" "tax_registration_status" DEFAULT 'pending' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_reconciliation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"payment_id" uuid,
	"journal_entry_id" uuid,
	"reconciliation_session_id" uuid NOT NULL,
	"bank_statement_line_id" uuid,
	"reconciled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reconciled_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "expiry_date" date;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "expiry_alert_days" integer DEFAULT 30;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "document_category" "document_category";--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "verification_status" "document_verification_status" DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "verified_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "purchase_docs" ADD COLUMN "scheduled_payment_date" date;--> statement-breakpoint
ALTER TABLE "purchase_docs" ADD COLUMN "scheduled_payment_amount" numeric(18, 6);--> statement-breakpoint
ALTER TABLE "purchase_docs" ADD COLUMN "payment_priority" text;--> statement-breakpoint
ALTER TABLE "purchase_docs" ADD COLUMN "payment_notes" text;--> statement-breakpoint
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_soft_closed_by_actor_id_actors_id_fk" FOREIGN KEY ("soft_closed_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_hard_closed_by_actor_id_actors_id_fk" FOREIGN KEY ("hard_closed_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_reopened_by_actor_id_actors_id_fk" FOREIGN KEY ("reopened_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_reconciliation_sessions" ADD CONSTRAINT "bank_reconciliation_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_reconciliation_sessions" ADD CONSTRAINT "bank_reconciliation_sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_reconciliation_sessions" ADD CONSTRAINT "bank_reconciliation_sessions_completed_by_actor_id_actors_id_fk" FOREIGN KEY ("completed_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_reconciliation_sessions" ADD CONSTRAINT "bank_reconciliation_sessions_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_reconciliation_session_id_bank_reconciliation_sessions_id_fk" FOREIGN KEY ("reconciliation_session_id") REFERENCES "public"."bank_reconciliation_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_matched_payment_id_payments_id_fk" FOREIGN KEY ("matched_payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_matched_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("matched_journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_matched_by_actor_id_actors_id_fk" FOREIGN KEY ("matched_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_profiles" ADD CONSTRAINT "business_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_profiles" ADD CONSTRAINT "business_profiles_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_profiles" ADD CONSTRAINT "business_profiles_updated_by_actor_id_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compensation_records" ADD CONSTRAINT "compensation_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compensation_records" ADD CONSTRAINT "compensation_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compensation_records" ADD CONSTRAINT "compensation_records_approved_by_actor_id_actors_id_fk" FOREIGN KEY ("approved_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compensation_records" ADD CONSTRAINT "compensation_records_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_rule_sets" ADD CONSTRAINT "compliance_rule_sets_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deduction_types" ADD CONSTRAINT "deduction_types_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deferred_revenue" ADD CONSTRAINT "deferred_revenue_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deferred_revenue" ADD CONSTRAINT "deferred_revenue_customer_id_parties_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deferred_revenue" ADD CONSTRAINT "deferred_revenue_source_payment_id_payments_id_fk" FOREIGN KEY ("source_payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deferred_revenue" ADD CONSTRAINT "deferred_revenue_completion_task_id_tasks_id_fk" FOREIGN KEY ("completion_task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deferred_revenue" ADD CONSTRAINT "deferred_revenue_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deferred_revenue_recognition" ADD CONSTRAINT "deferred_revenue_recognition_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deferred_revenue_recognition" ADD CONSTRAINT "deferred_revenue_recognition_deferred_revenue_id_deferred_revenue_id_fk" FOREIGN KEY ("deferred_revenue_id") REFERENCES "public"."deferred_revenue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deferred_revenue_recognition" ADD CONSTRAINT "deferred_revenue_recognition_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deferred_revenue_recognition" ADD CONSTRAINT "deferred_revenue_recognition_posted_by_actor_id_actors_id_fk" FOREIGN KEY ("posted_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depreciation_schedule" ADD CONSTRAINT "depreciation_schedule_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depreciation_schedule" ADD CONSTRAINT "depreciation_schedule_fixed_asset_id_fixed_assets_id_fk" FOREIGN KEY ("fixed_asset_id") REFERENCES "public"."fixed_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depreciation_schedule" ADD CONSTRAINT "depreciation_schedule_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depreciation_schedule" ADD CONSTRAINT "depreciation_schedule_posted_by_actor_id_actors_id_fk" FOREIGN KEY ("posted_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earning_types" ADD CONSTRAINT "earning_types_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_bank_accounts" ADD CONSTRAINT "employee_bank_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_bank_accounts" ADD CONSTRAINT "employee_bank_accounts_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_bank_accounts" ADD CONSTRAINT "employee_bank_accounts_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_deductions" ADD CONSTRAINT "employee_deductions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_deductions" ADD CONSTRAINT "employee_deductions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_deductions" ADD CONSTRAINT "employee_deductions_deduction_type_id_deduction_types_id_fk" FOREIGN KEY ("deduction_type_id") REFERENCES "public"."deduction_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_deductions" ADD CONSTRAINT "employee_deductions_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_leave_balances" ADD CONSTRAINT "employee_leave_balances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_leave_balances" ADD CONSTRAINT "employee_leave_balances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_work_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("work_jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_manager_employee_id_employees_id_fk" FOREIGN KEY ("manager_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_accruals" ADD CONSTRAINT "expense_accruals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_accruals" ADD CONSTRAINT "expense_accruals_vendor_id_parties_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_accruals" ADD CONSTRAINT "expense_accruals_accrual_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("accrual_journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_accruals" ADD CONSTRAINT "expense_accruals_payment_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("payment_journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_accruals" ADD CONSTRAINT "expense_accruals_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_vendor_id_parties_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_source_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("source_journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_disposal_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("disposal_journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_alerts" ADD CONSTRAINT "grc_alerts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_alerts" ADD CONSTRAINT "grc_alerts_requirement_id_grc_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."grc_requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_audit_log" ADD CONSTRAINT "grc_audit_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_audit_log" ADD CONSTRAINT "grc_audit_log_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_compliance_calendar" ADD CONSTRAINT "grc_compliance_calendar_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_compliance_calendar" ADD CONSTRAINT "grc_compliance_calendar_requirement_id_grc_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."grc_requirements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_control_tests" ADD CONSTRAINT "grc_control_tests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_control_tests" ADD CONSTRAINT "grc_control_tests_control_id_grc_controls_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."grc_controls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_control_tests" ADD CONSTRAINT "grc_control_tests_tester_id_users_id_fk" FOREIGN KEY ("tester_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_control_tests" ADD CONSTRAINT "grc_control_tests_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_controls" ADD CONSTRAINT "grc_controls_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_controls" ADD CONSTRAINT "grc_controls_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_controls" ADD CONSTRAINT "grc_controls_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_document_links" ADD CONSTRAINT "grc_document_links_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_document_links" ADD CONSTRAINT "grc_document_links_requirement_id_grc_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."grc_requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_document_links" ADD CONSTRAINT "grc_document_links_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_document_links" ADD CONSTRAINT "grc_document_links_uploaded_by_actor_id_actors_id_fk" FOREIGN KEY ("uploaded_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_incidents" ADD CONSTRAINT "grc_incidents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_incidents" ADD CONSTRAINT "grc_incidents_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_incidents" ADD CONSTRAINT "grc_incidents_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_incidents" ADD CONSTRAINT "grc_incidents_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_licenses" ADD CONSTRAINT "grc_licenses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_licenses" ADD CONSTRAINT "grc_licenses_requirement_id_grc_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."grc_requirements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_requirement_evaluations" ADD CONSTRAINT "grc_requirement_evaluations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_requirement_evaluations" ADD CONSTRAINT "grc_requirement_evaluations_requirement_id_grc_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."grc_requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_requirement_evaluations" ADD CONSTRAINT "grc_requirement_evaluations_evaluated_by_actor_id_actors_id_fk" FOREIGN KEY ("evaluated_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_requirements" ADD CONSTRAINT "grc_requirements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_requirements" ADD CONSTRAINT "grc_requirements_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_requirements" ADD CONSTRAINT "grc_requirements_updated_by_actor_id_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_risks" ADD CONSTRAINT "grc_risks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_risks" ADD CONSTRAINT "grc_risks_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_risks" ADD CONSTRAINT "grc_risks_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_tasks" ADD CONSTRAINT "grc_tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_tasks" ADD CONSTRAINT "grc_tasks_requirement_id_grc_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."grc_requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_tasks" ADD CONSTRAINT "grc_tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_tasks" ADD CONSTRAINT "grc_tasks_completed_by_actor_id_actors_id_fk" FOREIGN KEY ("completed_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_tasks" ADD CONSTRAINT "grc_tasks_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_tax_filings" ADD CONSTRAINT "grc_tax_filings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grc_tax_filings" ADD CONSTRAINT "grc_tax_filings_requirement_id_grc_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."grc_requirements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_playbooks" ADD CONSTRAINT "growth_playbooks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_playbooks" ADD CONSTRAINT "growth_playbooks_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_follow_up_activities" ADD CONSTRAINT "invoice_follow_up_activities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_follow_up_activities" ADD CONSTRAINT "invoice_follow_up_activities_follow_up_id_invoice_follow_ups_id_fk" FOREIGN KEY ("follow_up_id") REFERENCES "public"."invoice_follow_ups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_follow_up_activities" ADD CONSTRAINT "invoice_follow_up_activities_performed_by_actor_id_actors_id_fk" FOREIGN KEY ("performed_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_follow_ups" ADD CONSTRAINT "invoice_follow_ups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_follow_ups" ADD CONSTRAINT "invoice_follow_ups_sales_doc_id_sales_docs_id_fk" FOREIGN KEY ("sales_doc_id") REFERENCES "public"."sales_docs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_follow_ups" ADD CONSTRAINT "invoice_follow_ups_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_follow_ups" ADD CONSTRAINT "invoice_follow_ups_resolved_by_actor_id_actors_id_fk" FOREIGN KEY ("resolved_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_follow_ups" ADD CONSTRAINT "invoice_follow_ups_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jurisdictions" ADD CONSTRAINT "jurisdictions_parent_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("parent_jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balance_adjustments" ADD CONSTRAINT "leave_balance_adjustments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balance_adjustments" ADD CONSTRAINT "leave_balance_adjustments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balance_adjustments" ADD CONSTRAINT "leave_balance_adjustments_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balance_adjustments" ADD CONSTRAINT "leave_balance_adjustments_adjusted_by_actor_id_actors_id_fk" FOREIGN KEY ("adjusted_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_periods" ADD CONSTRAINT "pay_periods_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_periods" ADD CONSTRAINT "pay_periods_pay_schedule_id_pay_schedules_id_fk" FOREIGN KEY ("pay_schedule_id") REFERENCES "public"."pay_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_schedules" ADD CONSTRAINT "pay_schedules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_schedules" ADD CONSTRAINT "pay_schedules_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_deductions" ADD CONSTRAINT "payroll_deductions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_deductions" ADD CONSTRAINT "payroll_deductions_payroll_run_employee_id_payroll_run_employees_id_fk" FOREIGN KEY ("payroll_run_employee_id") REFERENCES "public"."payroll_run_employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_deductions" ADD CONSTRAINT "payroll_deductions_employee_deduction_id_employee_deductions_id_fk" FOREIGN KEY ("employee_deduction_id") REFERENCES "public"."employee_deductions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_deductions" ADD CONSTRAINT "payroll_deductions_deduction_type_id_deduction_types_id_fk" FOREIGN KEY ("deduction_type_id") REFERENCES "public"."deduction_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_earnings" ADD CONSTRAINT "payroll_earnings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_earnings" ADD CONSTRAINT "payroll_earnings_payroll_run_employee_id_payroll_run_employees_id_fk" FOREIGN KEY ("payroll_run_employee_id") REFERENCES "public"."payroll_run_employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_earnings" ADD CONSTRAINT "payroll_earnings_earning_type_id_earning_types_id_fk" FOREIGN KEY ("earning_type_id") REFERENCES "public"."earning_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_gl_mappings" ADD CONSTRAINT "payroll_gl_mappings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_gl_mappings" ADD CONSTRAINT "payroll_gl_mappings_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_gl_mappings" ADD CONSTRAINT "payroll_gl_mappings_earning_type_id_earning_types_id_fk" FOREIGN KEY ("earning_type_id") REFERENCES "public"."earning_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_gl_mappings" ADD CONSTRAINT "payroll_gl_mappings_deduction_type_id_deduction_types_id_fk" FOREIGN KEY ("deduction_type_id") REFERENCES "public"."deduction_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_gl_mappings" ADD CONSTRAINT "payroll_gl_mappings_debit_account_id_accounts_id_fk" FOREIGN KEY ("debit_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_gl_mappings" ADD CONSTRAINT "payroll_gl_mappings_credit_account_id_accounts_id_fk" FOREIGN KEY ("credit_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_gl_mappings" ADD CONSTRAINT "payroll_gl_mappings_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_run_employees" ADD CONSTRAINT "payroll_run_employees_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_run_employees" ADD CONSTRAINT "payroll_run_employees_payroll_run_id_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_run_employees" ADD CONSTRAINT "payroll_run_employees_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_pay_period_id_pay_periods_id_fk" FOREIGN KEY ("pay_period_id") REFERENCES "public"."pay_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_calculated_by_actor_id_actors_id_fk" FOREIGN KEY ("calculated_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_approved_by_actor_id_actors_id_fk" FOREIGN KEY ("approved_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_posted_by_actor_id_actors_id_fk" FOREIGN KEY ("posted_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_voided_by_actor_id_actors_id_fk" FOREIGN KEY ("voided_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_taxes" ADD CONSTRAINT "payroll_taxes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_taxes" ADD CONSTRAINT "payroll_taxes_payroll_run_employee_id_payroll_run_employees_id_fk" FOREIGN KEY ("payroll_run_employee_id") REFERENCES "public"."payroll_run_employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_taxes" ADD CONSTRAINT "payroll_taxes_tax_table_id_tax_tables_id_fk" FOREIGN KEY ("tax_table_id") REFERENCES "public"."tax_tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_taxes" ADD CONSTRAINT "payroll_taxes_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_cycles" ADD CONSTRAINT "performance_cycles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_cycles" ADD CONSTRAINT "performance_cycles_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_cycle_id_performance_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."performance_cycles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_review_ratings" ADD CONSTRAINT "performance_review_ratings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_review_ratings" ADD CONSTRAINT "performance_review_ratings_review_id_performance_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."performance_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_cycle_id_performance_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."performance_cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_reviewer_employee_id_employees_id_fk" FOREIGN KEY ("reviewer_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_approved_by_actor_id_actors_id_fk" FOREIGN KEY ("approved_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playbook_initiations" ADD CONSTRAINT "playbook_initiations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playbook_initiations" ADD CONSTRAINT "playbook_initiations_playbook_id_growth_playbooks_id_fk" FOREIGN KEY ("playbook_id") REFERENCES "public"."growth_playbooks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playbook_initiations" ADD CONSTRAINT "playbook_initiations_initiated_by_actor_id_actors_id_fk" FOREIGN KEY ("initiated_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playbook_steps" ADD CONSTRAINT "playbook_steps_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playbook_steps" ADD CONSTRAINT "playbook_steps_playbook_id_growth_playbooks_id_fk" FOREIGN KEY ("playbook_id") REFERENCES "public"."growth_playbooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playbook_steps" ADD CONSTRAINT "playbook_steps_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prepaid_amortization_schedule" ADD CONSTRAINT "prepaid_amortization_schedule_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prepaid_amortization_schedule" ADD CONSTRAINT "prepaid_amortization_schedule_prepaid_expense_id_prepaid_expenses_id_fk" FOREIGN KEY ("prepaid_expense_id") REFERENCES "public"."prepaid_expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prepaid_amortization_schedule" ADD CONSTRAINT "prepaid_amortization_schedule_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prepaid_amortization_schedule" ADD CONSTRAINT "prepaid_amortization_schedule_posted_by_actor_id_actors_id_fk" FOREIGN KEY ("posted_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prepaid_expenses" ADD CONSTRAINT "prepaid_expenses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prepaid_expenses" ADD CONSTRAINT "prepaid_expenses_vendor_id_parties_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prepaid_expenses" ADD CONSTRAINT "prepaid_expenses_source_payment_id_payments_id_fk" FOREIGN KEY ("source_payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prepaid_expenses" ADD CONSTRAINT "prepaid_expenses_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_instances" ADD CONSTRAINT "recurring_transaction_instances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_instances" ADD CONSTRAINT "recurring_transaction_instances_recurring_transaction_id_recurring_transactions_id_fk" FOREIGN KEY ("recurring_transaction_id") REFERENCES "public"."recurring_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_instances" ADD CONSTRAINT "recurring_transaction_instances_expense_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("expense_journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_instances" ADD CONSTRAINT "recurring_transaction_instances_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_vendor_id_parties_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_brackets" ADD CONSTRAINT "tax_brackets_tax_table_id_tax_tables_id_fk" FOREIGN KEY ("tax_table_id") REFERENCES "public"."tax_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_deposits" ADD CONSTRAINT "tax_deposits_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_deposits" ADD CONSTRAINT "tax_deposits_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_deposits" ADD CONSTRAINT "tax_deposits_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_filing_schedules" ADD CONSTRAINT "tax_filing_schedules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_filing_schedules" ADD CONSTRAINT "tax_filing_schedules_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_filings" ADD CONSTRAINT "tax_filings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_filings" ADD CONSTRAINT "tax_filings_filing_schedule_id_tax_filing_schedules_id_fk" FOREIGN KEY ("filing_schedule_id") REFERENCES "public"."tax_filing_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_filings" ADD CONSTRAINT "tax_filings_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_filings" ADD CONSTRAINT "tax_filings_submitted_by_actor_id_actors_id_fk" FOREIGN KEY ("submitted_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_tables" ADD CONSTRAINT "tax_tables_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_compliance_profiles" ADD CONSTRAINT "tenant_compliance_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_compliance_profiles" ADD CONSTRAINT "tenant_compliance_profiles_primary_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("primary_jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_compliance_profiles" ADD CONSTRAINT "tenant_compliance_profiles_state_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("state_jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_compliance_profiles" ADD CONSTRAINT "tenant_compliance_profiles_local_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("local_jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_compliance_profiles" ADD CONSTRAINT "tenant_compliance_profiles_reviewed_by_actor_id_actors_id_fk" FOREIGN KEY ("reviewed_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_compliance_profiles" ADD CONSTRAINT "tenant_compliance_profiles_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_deduction_configs" ADD CONSTRAINT "tenant_deduction_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_deduction_configs" ADD CONSTRAINT "tenant_deduction_configs_deduction_type_id_deduction_types_id_fk" FOREIGN KEY ("deduction_type_id") REFERENCES "public"."deduction_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_deduction_configs" ADD CONSTRAINT "tenant_deduction_configs_liability_account_id_accounts_id_fk" FOREIGN KEY ("liability_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_deduction_configs" ADD CONSTRAINT "tenant_deduction_configs_expense_account_id_accounts_id_fk" FOREIGN KEY ("expense_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_deduction_configs" ADD CONSTRAINT "tenant_deduction_configs_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_tax_registrations" ADD CONSTRAINT "tenant_tax_registrations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_tax_registrations" ADD CONSTRAINT "tenant_tax_registrations_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_tax_registrations" ADD CONSTRAINT "tenant_tax_registrations_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_reconciliation" ADD CONSTRAINT "transaction_reconciliation_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_reconciliation" ADD CONSTRAINT "transaction_reconciliation_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_reconciliation" ADD CONSTRAINT "transaction_reconciliation_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_reconciliation" ADD CONSTRAINT "transaction_reconciliation_reconciliation_session_id_bank_reconciliation_sessions_id_fk" FOREIGN KEY ("reconciliation_session_id") REFERENCES "public"."bank_reconciliation_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_reconciliation" ADD CONSTRAINT "transaction_reconciliation_bank_statement_line_id_bank_statement_lines_id_fk" FOREIGN KEY ("bank_statement_line_id") REFERENCES "public"."bank_statement_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_reconciliation" ADD CONSTRAINT "transaction_reconciliation_reconciled_by_actor_id_actors_id_fk" FOREIGN KEY ("reconciled_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_periods_tenant_period_uniq" ON "accounting_periods" USING btree ("tenant_id","period_start");--> statement-breakpoint
CREATE INDEX "accounting_periods_tenant_status_idx" ON "accounting_periods" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "bank_rec_sessions_tenant_account_idx" ON "bank_reconciliation_sessions" USING btree ("tenant_id","account_id");--> statement-breakpoint
CREATE INDEX "bank_rec_sessions_tenant_date_idx" ON "bank_reconciliation_sessions" USING btree ("tenant_id","statement_date");--> statement-breakpoint
CREATE INDEX "bank_statement_lines_session_idx" ON "bank_statement_lines" USING btree ("reconciliation_session_id");--> statement-breakpoint
CREATE INDEX "bank_statement_lines_tenant_date_idx" ON "bank_statement_lines" USING btree ("tenant_id","transaction_date");--> statement-breakpoint
CREATE INDEX "bank_statement_lines_status_idx" ON "bank_statement_lines" USING btree ("reconciliation_session_id","status");--> statement-breakpoint
CREATE INDEX "business_profiles_tenant_idx" ON "business_profiles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_compensation_employee" ON "compensation_records" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_compensation_effective" ON "compensation_records" USING btree ("effective_from","effective_to");--> statement-breakpoint
CREATE INDEX "idx_compliance_rules_jurisdiction" ON "compliance_rule_sets" USING btree ("jurisdiction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_rule_sets_jurisdiction_effective_uniq" ON "compliance_rule_sets" USING btree ("jurisdiction_id","effective_from");--> statement-breakpoint
CREATE INDEX "idx_deduction_types_code" ON "deduction_types" USING btree ("code");--> statement-breakpoint
CREATE INDEX "deferred_revenue_tenant_idx" ON "deferred_revenue" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "deferred_revenue_tenant_status_idx" ON "deferred_revenue" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "deferred_revenue_tenant_customer_idx" ON "deferred_revenue" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "deferred_revenue_tenant_completion_idx" ON "deferred_revenue" USING btree ("tenant_id","expected_completion_date");--> statement-breakpoint
CREATE INDEX "deferred_rev_recognition_deferred_idx" ON "deferred_revenue_recognition" USING btree ("deferred_revenue_id");--> statement-breakpoint
CREATE INDEX "deferred_rev_recognition_tenant_date_idx" ON "deferred_revenue_recognition" USING btree ("tenant_id","recognition_date");--> statement-breakpoint
CREATE UNIQUE INDEX "depreciation_schedule_uniq" ON "depreciation_schedule" USING btree ("tenant_id","fixed_asset_id","period_date");--> statement-breakpoint
CREATE INDEX "depreciation_schedule_asset_idx" ON "depreciation_schedule" USING btree ("fixed_asset_id");--> statement-breakpoint
CREATE INDEX "depreciation_schedule_tenant_status_idx" ON "depreciation_schedule" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "depreciation_schedule_tenant_period_idx" ON "depreciation_schedule" USING btree ("tenant_id","period_date");--> statement-breakpoint
CREATE INDEX "idx_earning_types_code" ON "earning_types" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_employee_bank_accounts" ON "employee_bank_accounts" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_employee_deductions" ON "employee_deductions" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_leave_balances_employee_type_uniq" ON "employee_leave_balances" USING btree ("tenant_id","employee_id","leave_type");--> statement-breakpoint
CREATE INDEX "idx_employees_tenant" ON "employees" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_employees_person" ON "employees" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_employees_status" ON "employees" USING btree ("tenant_id","employment_status");--> statement-breakpoint
CREATE UNIQUE INDEX "employees_tenant_employee_number_uniq" ON "employees" USING btree ("tenant_id","employee_number");--> statement-breakpoint
CREATE UNIQUE INDEX "employees_tenant_person_uniq" ON "employees" USING btree ("tenant_id","person_id");--> statement-breakpoint
CREATE INDEX "expense_accruals_tenant_idx" ON "expense_accruals" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "expense_accruals_tenant_period_idx" ON "expense_accruals" USING btree ("tenant_id","expense_period");--> statement-breakpoint
CREATE INDEX "expense_accruals_tenant_status_idx" ON "expense_accruals" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "fixed_assets_tenant_idx" ON "fixed_assets" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "fixed_assets_tenant_status_idx" ON "fixed_assets" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "fixed_assets_tenant_category_idx" ON "fixed_assets" USING btree ("tenant_id","category");--> statement-breakpoint
CREATE INDEX "grc_alerts_tenant_idx" ON "grc_alerts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "grc_alerts_requirement_idx" ON "grc_alerts" USING btree ("requirement_id");--> statement-breakpoint
CREATE INDEX "grc_alerts_tenant_status_idx" ON "grc_alerts" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "grc_alerts_tenant_severity_idx" ON "grc_alerts" USING btree ("tenant_id","severity");--> statement-breakpoint
CREATE INDEX "grc_audit_log_tenant_idx" ON "grc_audit_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "grc_audit_log_entity_idx" ON "grc_audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "grc_audit_log_occurred_idx" ON "grc_audit_log" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "grc_calendar_tenant_idx" ON "grc_compliance_calendar" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "grc_calendar_due_idx" ON "grc_compliance_calendar" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "grc_control_tests_tenant_control_idx" ON "grc_control_tests" USING btree ("tenant_id","control_id");--> statement-breakpoint
CREATE INDEX "grc_control_tests_tenant_date_idx" ON "grc_control_tests" USING btree ("tenant_id","test_date");--> statement-breakpoint
CREATE INDEX "grc_controls_tenant_status_idx" ON "grc_controls" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "grc_controls_tenant_category_idx" ON "grc_controls" USING btree ("tenant_id","category");--> statement-breakpoint
CREATE INDEX "grc_controls_tenant_owner_idx" ON "grc_controls" USING btree ("tenant_id","owner_id");--> statement-breakpoint
CREATE INDEX "grc_controls_tenant_next_test_idx" ON "grc_controls" USING btree ("tenant_id","next_test_due");--> statement-breakpoint
CREATE INDEX "grc_doc_links_requirement_idx" ON "grc_document_links" USING btree ("requirement_id");--> statement-breakpoint
CREATE INDEX "grc_doc_links_tenant_idx" ON "grc_document_links" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "grc_doc_links_req_doc_uniq" ON "grc_document_links" USING btree ("requirement_id","document_id");--> statement-breakpoint
CREATE INDEX "grc_incidents_tenant_status_idx" ON "grc_incidents" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "grc_incidents_tenant_category_idx" ON "grc_incidents" USING btree ("tenant_id","category");--> statement-breakpoint
CREATE INDEX "grc_incidents_tenant_severity_idx" ON "grc_incidents" USING btree ("tenant_id","severity");--> statement-breakpoint
CREATE INDEX "grc_incidents_tenant_reported_idx" ON "grc_incidents" USING btree ("tenant_id","reported_at");--> statement-breakpoint
CREATE INDEX "grc_licenses_tenant_idx" ON "grc_licenses" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "grc_licenses_requirement_idx" ON "grc_licenses" USING btree ("requirement_id");--> statement-breakpoint
CREATE INDEX "grc_licenses_tenant_status_idx" ON "grc_licenses" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "grc_req_evaluations_requirement_idx" ON "grc_requirement_evaluations" USING btree ("requirement_id");--> statement-breakpoint
CREATE INDEX "grc_req_evaluations_tenant_idx" ON "grc_requirement_evaluations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "grc_requirements_tenant_idx" ON "grc_requirements" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "grc_requirements_tenant_status_idx" ON "grc_requirements" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "grc_requirements_tenant_risk_idx" ON "grc_requirements" USING btree ("tenant_id","risk_level");--> statement-breakpoint
CREATE INDEX "grc_requirements_tenant_category_idx" ON "grc_requirements" USING btree ("tenant_id","category");--> statement-breakpoint
CREATE UNIQUE INDEX "grc_requirements_tenant_code_uniq" ON "grc_requirements" USING btree ("tenant_id","requirement_code");--> statement-breakpoint
CREATE INDEX "grc_risks_tenant_status_idx" ON "grc_risks" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "grc_risks_tenant_category_idx" ON "grc_risks" USING btree ("tenant_id","category");--> statement-breakpoint
CREATE INDEX "grc_risks_tenant_severity_idx" ON "grc_risks" USING btree ("tenant_id","severity");--> statement-breakpoint
CREATE INDEX "grc_risks_tenant_owner_idx" ON "grc_risks" USING btree ("tenant_id","owner_id");--> statement-breakpoint
CREATE INDEX "grc_tasks_tenant_idx" ON "grc_tasks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "grc_tasks_requirement_idx" ON "grc_tasks" USING btree ("requirement_id");--> statement-breakpoint
CREATE INDEX "grc_tasks_tenant_status_idx" ON "grc_tasks" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "grc_tasks_assigned_idx" ON "grc_tasks" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "grc_tax_filings_tenant_idx" ON "grc_tax_filings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "grc_tax_filings_requirement_idx" ON "grc_tax_filings" USING btree ("requirement_id");--> statement-breakpoint
CREATE INDEX "grc_tax_filings_tenant_type_idx" ON "grc_tax_filings" USING btree ("tenant_id","filing_type");--> statement-breakpoint
CREATE INDEX "grc_tax_filings_tenant_status_idx" ON "grc_tax_filings" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "growth_playbooks_tenant_code_uniq" ON "growth_playbooks" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "growth_playbooks_tenant_category_idx" ON "growth_playbooks" USING btree ("tenant_id","category");--> statement-breakpoint
CREATE INDEX "growth_playbooks_tenant_status_idx" ON "growth_playbooks" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "follow_up_activities_follow_up_idx" ON "invoice_follow_up_activities" USING btree ("follow_up_id");--> statement-breakpoint
CREATE INDEX "follow_up_activities_tenant_created_idx" ON "invoice_follow_up_activities" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "invoice_follow_ups_tenant_idx" ON "invoice_follow_ups" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "invoice_follow_ups_tenant_status_idx" ON "invoice_follow_ups" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "invoice_follow_ups_tenant_escalation_idx" ON "invoice_follow_ups" USING btree ("tenant_id","escalation_level");--> statement-breakpoint
CREATE INDEX "invoice_follow_ups_sales_doc_idx" ON "invoice_follow_ups" USING btree ("sales_doc_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_follow_ups_sales_doc_uniq" ON "invoice_follow_ups" USING btree ("sales_doc_id");--> statement-breakpoint
CREATE INDEX "idx_jurisdictions_country" ON "jurisdictions" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "idx_jurisdictions_parent" ON "jurisdictions" USING btree ("parent_jurisdiction_id");--> statement-breakpoint
CREATE INDEX "idx_leave_adjustments_employee" ON "leave_balance_adjustments" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_leave_adjustments_type" ON "leave_balance_adjustments" USING btree ("leave_type_id");--> statement-breakpoint
CREATE INDEX "idx_leave_requests_employee" ON "leave_requests" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_leave_requests_status" ON "leave_requests" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_leave_requests_dates" ON "leave_requests" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE UNIQUE INDEX "leave_types_tenant_code_uniq" ON "leave_types" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "idx_leave_types_active" ON "leave_types" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_pay_periods_schedule" ON "pay_periods" USING btree ("pay_schedule_id");--> statement-breakpoint
CREATE INDEX "idx_pay_periods_dates" ON "pay_periods" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE UNIQUE INDEX "pay_periods_schedule_year_period_uniq" ON "pay_periods" USING btree ("tenant_id","pay_schedule_id","year","period_number");--> statement-breakpoint
CREATE UNIQUE INDEX "pay_schedules_tenant_name_uniq" ON "pay_schedules" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "idx_payroll_deductions" ON "payroll_deductions" USING btree ("payroll_run_employee_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_earnings" ON "payroll_earnings" USING btree ("payroll_run_employee_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_gl_mappings" ON "payroll_gl_mappings" USING btree ("tenant_id","mapping_type");--> statement-breakpoint
CREATE INDEX "idx_payroll_run_employees" ON "payroll_run_employees" USING btree ("payroll_run_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_run_employees_emp" ON "payroll_run_employees" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_run_employees_run_emp_uniq" ON "payroll_run_employees" USING btree ("payroll_run_id","employee_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_runs_tenant" ON "payroll_runs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_runs_period" ON "payroll_runs" USING btree ("pay_period_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_runs_status" ON "payroll_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payroll_taxes" ON "payroll_taxes" USING btree ("payroll_run_employee_id");--> statement-breakpoint
CREATE INDEX "idx_perf_cycles_tenant" ON "performance_cycles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_perf_cycles_status" ON "performance_cycles" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_perf_cycles_dates" ON "performance_cycles" USING btree ("tenant_id","period_start","period_end");--> statement-breakpoint
CREATE INDEX "idx_perf_goals_employee" ON "performance_goals" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_perf_goals_cycle" ON "performance_goals" USING btree ("cycle_id");--> statement-breakpoint
CREATE INDEX "idx_perf_goals_status" ON "performance_goals" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_perf_ratings_review" ON "performance_review_ratings" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "idx_perf_reviews_cycle" ON "performance_reviews" USING btree ("cycle_id");--> statement-breakpoint
CREATE INDEX "idx_perf_reviews_employee" ON "performance_reviews" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_perf_reviews_reviewer" ON "performance_reviews" USING btree ("reviewer_employee_id");--> statement-breakpoint
CREATE INDEX "idx_perf_reviews_status" ON "performance_reviews" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "perf_reviews_cycle_employee_uniq" ON "performance_reviews" USING btree ("cycle_id","employee_id");--> statement-breakpoint
CREATE INDEX "playbook_initiations_playbook_status_idx" ON "playbook_initiations" USING btree ("playbook_id","status");--> statement-breakpoint
CREATE INDEX "playbook_initiations_tenant_status_idx" ON "playbook_initiations" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "playbook_steps_playbook_seq_idx" ON "playbook_steps" USING btree ("playbook_id","sequence_no");--> statement-breakpoint
CREATE UNIQUE INDEX "prepaid_amort_schedule_uniq" ON "prepaid_amortization_schedule" USING btree ("tenant_id","prepaid_expense_id","period_date");--> statement-breakpoint
CREATE INDEX "prepaid_amort_schedule_prepaid_idx" ON "prepaid_amortization_schedule" USING btree ("prepaid_expense_id");--> statement-breakpoint
CREATE INDEX "prepaid_amort_schedule_tenant_status_idx" ON "prepaid_amortization_schedule" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "prepaid_amort_schedule_tenant_period_idx" ON "prepaid_amortization_schedule" USING btree ("tenant_id","period_date");--> statement-breakpoint
CREATE INDEX "prepaid_expenses_tenant_idx" ON "prepaid_expenses" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "prepaid_expenses_tenant_status_idx" ON "prepaid_expenses" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "prepaid_expenses_tenant_end_date_idx" ON "prepaid_expenses" USING btree ("tenant_id","end_date");--> statement-breakpoint
CREATE INDEX "recurring_instances_recurring_idx" ON "recurring_transaction_instances" USING btree ("recurring_transaction_id");--> statement-breakpoint
CREATE INDEX "recurring_instances_tenant_scheduled_idx" ON "recurring_transaction_instances" USING btree ("tenant_id","scheduled_date");--> statement-breakpoint
CREATE INDEX "recurring_transactions_tenant_idx" ON "recurring_transactions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "recurring_transactions_tenant_status_idx" ON "recurring_transactions" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "recurring_transactions_tenant_next_due_idx" ON "recurring_transactions" USING btree ("tenant_id","next_due_date");--> statement-breakpoint
CREATE INDEX "recurring_transactions_tenant_type_idx" ON "recurring_transactions" USING btree ("tenant_id","type");--> statement-breakpoint
CREATE INDEX "idx_tax_brackets_table" ON "tax_brackets" USING btree ("tax_table_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_brackets_table_status_order_uniq" ON "tax_brackets" USING btree ("tax_table_id","filing_status","bracket_order");--> statement-breakpoint
CREATE INDEX "idx_tax_deposits_tenant" ON "tax_deposits" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_tax_deposits_date" ON "tax_deposits" USING btree ("deposit_date");--> statement-breakpoint
CREATE INDEX "idx_tax_filing_schedules" ON "tax_filing_schedules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_tax_filings_tenant" ON "tax_filings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_tax_filings_period" ON "tax_filings" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "idx_tax_filings_due" ON "tax_filings" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_tax_tables_jurisdiction" ON "tax_tables" USING btree ("jurisdiction_id");--> statement-breakpoint
CREATE INDEX "idx_tax_tables_type" ON "tax_tables" USING btree ("tax_type");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_tables_jurisdiction_type_effective_uniq" ON "tax_tables" USING btree ("jurisdiction_id","tax_type","effective_from");--> statement-breakpoint
CREATE INDEX "idx_tenant_compliance_tenant" ON "tenant_compliance_profiles" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_deduction_config_tenant_type_uniq" ON "tenant_deduction_configs" USING btree ("tenant_id","deduction_type_id");--> statement-breakpoint
CREATE INDEX "idx_tenant_tax_reg_tenant" ON "tenant_tax_registrations" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_tax_reg_tenant_jurisdiction_type_uniq" ON "tenant_tax_registrations" USING btree ("tenant_id","jurisdiction_id","tax_type");--> statement-breakpoint
CREATE INDEX "transaction_rec_payment_idx" ON "transaction_reconciliation" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "transaction_rec_journal_entry_idx" ON "transaction_reconciliation" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "transaction_rec_session_idx" ON "transaction_reconciliation" USING btree ("reconciliation_session_id");--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;