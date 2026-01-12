CREATE TYPE "public"."ai_outcome_category" AS ENUM('outstanding_contribution', 'strong_performance', 'solid_on_track', 'below_expectations', 'critical_concerns');--> statement-breakpoint
CREATE TYPE "public"."hr_document_access_scope" AS ENUM('employee_self', 'manager', 'hr_only', 'public');--> statement-breakpoint
CREATE TYPE "public"."hr_document_category" AS ENUM('contract', 'id_proof', 'qualification', 'certification', 'visa_work_permit', 'insurance', 'tax_form', 'bank_details', 'other');--> statement-breakpoint
CREATE TYPE "public"."payroll_run_status_v2" AS ENUM('draft', 'posted', 'voided');--> statement-breakpoint
CREATE TYPE "public"."review_visibility" AS ENUM('visible_to_employee', 'manager_only', 'hr_only');--> statement-breakpoint
CREATE TABLE "hr_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"actor_id" uuid,
	"actor_name" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"before_snapshot" jsonb,
	"after_snapshot" jsonb,
	"ai_outcome_snapshot" jsonb,
	"ip_address" text,
	"user_agent" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "hr_document_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"access_scope" "hr_document_access_scope" DEFAULT 'hr_only',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid
);
--> statement-breakpoint
CREATE TABLE "hr_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"checksum" text,
	"category" "hr_document_category",
	"expiry_date" date,
	"verification_status" "document_verification_status" DEFAULT 'pending',
	"description" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"uploaded_by_actor_id" uuid NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_by_user_id" uuid,
	"verified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payroll_run_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"payroll_run_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"is_included" boolean DEFAULT true,
	"exclude_reason" text,
	"person_name" text NOT NULL,
	"person_type" text,
	"jurisdiction" text,
	"base_pay" numeric(15, 2) DEFAULT '0',
	"base_pay_type" text,
	"allowances" jsonb DEFAULT '[]'::jsonb,
	"other_earnings" jsonb DEFAULT '[]'::jsonb,
	"employee_taxes" jsonb DEFAULT '[]'::jsonb,
	"employee_deductions" jsonb DEFAULT '[]'::jsonb,
	"employer_contributions" jsonb DEFAULT '[]'::jsonb,
	"gross_pay" numeric(15, 2) DEFAULT '0',
	"total_deductions" numeric(15, 2) DEFAULT '0',
	"total_taxes" numeric(15, 2) DEFAULT '0',
	"net_pay" numeric(15, 2) DEFAULT '0',
	"total_employer_cost" numeric(15, 2) DEFAULT '0',
	"row_notes" text,
	"flags" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_runs_v2" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"pay_date" date NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" "payroll_run_status_v2" DEFAULT 'draft' NOT NULL,
	"preload_option" text,
	"journal_entry_id" uuid,
	"posted_at" timestamp with time zone,
	"posted_by_actor_id" uuid,
	"voided_at" timestamp with time zone,
	"voided_by_actor_id" uuid,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid,
	"updated_by_actor_id" uuid
);
--> statement-breakpoint
CREATE TABLE "people_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"address_type" text DEFAULT 'primary' NOT NULL,
	"country" text,
	"region" text,
	"city" text,
	"address_line_1" text,
	"address_line_2" text,
	"postal_code" text,
	"is_current" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid,
	"updated_by_actor_id" uuid
);
--> statement-breakpoint
CREATE TABLE "performance_reviews_v2" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"reviewer_id" uuid,
	"period_type" text,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"strengths" text,
	"strengths_examples" text,
	"improvements" text,
	"improvements_examples" text,
	"fairness_constraints" text,
	"fairness_support" text,
	"fairness_outside_control" text,
	"goals" text,
	"goals_support_plan" text,
	"follow_up_date" date,
	"visibility" "review_visibility" DEFAULT 'visible_to_employee',
	"employee_acknowledged_at" timestamp with time zone,
	"private_notes" text,
	"ai_outcome_category" "ai_outcome_category",
	"ai_outcome_reasons" text,
	"ai_outcome_next_step" text,
	"ai_outcome_generated_at" timestamp with time zone,
	"ai_outcome_input_hash" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid,
	"updated_by_actor_id" uuid
);
--> statement-breakpoint
ALTER TABLE "hr_audit_log" ADD CONSTRAINT "hr_audit_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_audit_log" ADD CONSTRAINT "hr_audit_log_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_document_links" ADD CONSTRAINT "hr_document_links_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_document_links" ADD CONSTRAINT "hr_document_links_document_id_hr_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."hr_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_document_links" ADD CONSTRAINT "hr_document_links_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_documents" ADD CONSTRAINT "hr_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_documents" ADD CONSTRAINT "hr_documents_uploaded_by_actor_id_actors_id_fk" FOREIGN KEY ("uploaded_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_documents" ADD CONSTRAINT "hr_documents_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_payroll_run_id_payroll_runs_v2_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs_v2"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs_v2" ADD CONSTRAINT "payroll_runs_v2_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs_v2" ADD CONSTRAINT "payroll_runs_v2_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs_v2" ADD CONSTRAINT "payroll_runs_v2_posted_by_actor_id_actors_id_fk" FOREIGN KEY ("posted_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs_v2" ADD CONSTRAINT "payroll_runs_v2_voided_by_actor_id_actors_id_fk" FOREIGN KEY ("voided_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs_v2" ADD CONSTRAINT "payroll_runs_v2_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs_v2" ADD CONSTRAINT "payroll_runs_v2_updated_by_actor_id_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_addresses" ADD CONSTRAINT "people_addresses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_addresses" ADD CONSTRAINT "people_addresses_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_addresses" ADD CONSTRAINT "people_addresses_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_addresses" ADD CONSTRAINT "people_addresses_updated_by_actor_id_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_reviews_v2" ADD CONSTRAINT "performance_reviews_v2_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_reviews_v2" ADD CONSTRAINT "performance_reviews_v2_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_reviews_v2" ADD CONSTRAINT "performance_reviews_v2_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_reviews_v2" ADD CONSTRAINT "performance_reviews_v2_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_reviews_v2" ADD CONSTRAINT "performance_reviews_v2_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_reviews_v2" ADD CONSTRAINT "performance_reviews_v2_updated_by_actor_id_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hr_audit_log_tenant_idx" ON "hr_audit_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "hr_audit_log_entity_idx" ON "hr_audit_log" USING btree ("tenant_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "hr_audit_log_occurred_idx" ON "hr_audit_log" USING btree ("tenant_id","occurred_at");--> statement-breakpoint
CREATE INDEX "hr_document_links_tenant_idx" ON "hr_document_links" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "hr_document_links_document_idx" ON "hr_document_links" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "hr_document_links_entity_idx" ON "hr_document_links" USING btree ("tenant_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "hr_documents_tenant_idx" ON "hr_documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "hr_documents_category_idx" ON "hr_documents" USING btree ("tenant_id","category");--> statement-breakpoint
CREATE INDEX "hr_documents_expiry_idx" ON "hr_documents" USING btree ("tenant_id","expiry_date");--> statement-breakpoint
CREATE UNIQUE INDEX "hr_documents_storage_key_uniq" ON "hr_documents" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "payroll_run_lines_tenant_idx" ON "payroll_run_lines" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "payroll_run_lines_run_idx" ON "payroll_run_lines" USING btree ("payroll_run_id");--> statement-breakpoint
CREATE INDEX "payroll_run_lines_employee_idx" ON "payroll_run_lines" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "payroll_runs_v2_tenant_idx" ON "payroll_runs_v2" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "payroll_runs_v2_period_idx" ON "payroll_runs_v2" USING btree ("tenant_id","period_start","period_end");--> statement-breakpoint
CREATE INDEX "payroll_runs_v2_status_idx" ON "payroll_runs_v2" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "people_addresses_tenant_idx" ON "people_addresses" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "people_addresses_person_idx" ON "people_addresses" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "performance_reviews_v2_tenant_idx" ON "performance_reviews_v2" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "performance_reviews_v2_employee_idx" ON "performance_reviews_v2" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "performance_reviews_v2_period_idx" ON "performance_reviews_v2" USING btree ("tenant_id","period_start","period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "performance_reviews_v2_uniq" ON "performance_reviews_v2" USING btree ("tenant_id","employee_id","period_start","period_end");