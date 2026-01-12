CREATE TABLE "hr_payroll_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"payroll_run_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"person_name" text NOT NULL,
	"employment_type" text NOT NULL,
	"gross_salary" numeric(15, 2) DEFAULT '0',
	"overtime" numeric(15, 2) DEFAULT '0',
	"bonus" numeric(15, 2) DEFAULT '0',
	"allowances" numeric(15, 2) DEFAULT '0',
	"income_tax" numeric(15, 2) DEFAULT '0',
	"social_security" numeric(15, 2) DEFAULT '0',
	"pension" numeric(15, 2) DEFAULT '0',
	"health_insurance" numeric(15, 2) DEFAULT '0',
	"other_deductions" numeric(15, 2) DEFAULT '0',
	"total_gross" numeric(15, 2) DEFAULT '0',
	"total_deductions" numeric(15, 2) DEFAULT '0',
	"net_pay" numeric(15, 2) DEFAULT '0',
	"ai_analyzed" boolean DEFAULT false,
	"ai_suggestions" jsonb,
	"compliance_issues" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_payroll_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"pay_date" date NOT NULL,
	"employment_types" text[],
	"status" text DEFAULT 'draft',
	"journal_entry_id" uuid,
	"posted_at" timestamp with time zone,
	"posted_by" uuid,
	"currency" text DEFAULT 'USD',
	"total_gross" numeric(15, 2) DEFAULT '0',
	"total_net" numeric(15, 2) DEFAULT '0',
	"total_tax" numeric(15, 2) DEFAULT '0',
	"total_deductions" numeric(15, 2) DEFAULT '0',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "hr_performance_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"person_name" text NOT NULL,
	"reviewer_id" uuid,
	"reviewer_name" text,
	"review_period_start" date NOT NULL,
	"review_period_end" date NOT NULL,
	"review_date" date DEFAULT CURRENT_DATE,
	"strengths" text,
	"areas_for_improvement" text,
	"goals_set" text,
	"overall_rating" text,
	"reviewer_comments" text,
	"employee_comments" text,
	"status" text DEFAULT 'draft',
	"reviewer_accepted" boolean DEFAULT false,
	"reviewer_accepted_at" timestamp with time zone,
	"employee_accepted" boolean DEFAULT false,
	"employee_accepted_at" timestamp with time zone,
	"private_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "hr_persons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"preferred_name" text,
	"email" text,
	"phone" text,
	"employment_type" text,
	"job_title" text,
	"department" text,
	"manager_id" uuid,
	"hire_date" date,
	"end_date" date,
	"date_of_birth" date,
	"nationality" text,
	"gender" text,
	"address_line_1" text,
	"address_line_2" text,
	"city" text,
	"region" text,
	"country" text,
	"postal_code" text,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"emergency_contact_relationship" text,
	"bank_name" text,
	"bank_account_number" text,
	"bank_routing_number" text,
	"tax_id" text,
	"social_security_number" text,
	"work_permit_number" text,
	"work_permit_expiry" date,
	"gross_salary" numeric(15, 2),
	"pay_frequency" text,
	"currency" text DEFAULT 'USD',
	"health_insurance" boolean DEFAULT false,
	"pension_contribution_percent" numeric(5, 2),
	"other_deductions" jsonb DEFAULT '[]'::jsonb,
	"platform_user_id" uuid,
	"can_access_platform" boolean DEFAULT false,
	"platform_role" text,
	"status" text DEFAULT 'active',
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "hr_payroll_lines" ADD CONSTRAINT "hr_payroll_lines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_payroll_lines" ADD CONSTRAINT "hr_payroll_lines_payroll_run_id_hr_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."hr_payroll_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_payroll_lines" ADD CONSTRAINT "hr_payroll_lines_person_id_hr_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."hr_persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_payroll_runs" ADD CONSTRAINT "hr_payroll_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_payroll_runs" ADD CONSTRAINT "hr_payroll_runs_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_payroll_runs" ADD CONSTRAINT "hr_payroll_runs_posted_by_actors_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_payroll_runs" ADD CONSTRAINT "hr_payroll_runs_created_by_actors_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_payroll_runs" ADD CONSTRAINT "hr_payroll_runs_updated_by_actors_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_performance_reviews" ADD CONSTRAINT "hr_performance_reviews_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_performance_reviews" ADD CONSTRAINT "hr_performance_reviews_person_id_hr_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."hr_persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_performance_reviews" ADD CONSTRAINT "hr_performance_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_performance_reviews" ADD CONSTRAINT "hr_performance_reviews_created_by_actors_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_performance_reviews" ADD CONSTRAINT "hr_performance_reviews_updated_by_actors_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_persons" ADD CONSTRAINT "hr_persons_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_persons" ADD CONSTRAINT "hr_persons_manager_id_hr_persons_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."hr_persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_persons" ADD CONSTRAINT "hr_persons_platform_user_id_users_id_fk" FOREIGN KEY ("platform_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_persons" ADD CONSTRAINT "hr_persons_created_by_actors_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_persons" ADD CONSTRAINT "hr_persons_updated_by_actors_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hr_payroll_lines_tenant_idx" ON "hr_payroll_lines" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "hr_payroll_lines_run_idx" ON "hr_payroll_lines" USING btree ("payroll_run_id");--> statement-breakpoint
CREATE INDEX "hr_payroll_lines_person_idx" ON "hr_payroll_lines" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "hr_payroll_runs_tenant_idx" ON "hr_payroll_runs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "hr_payroll_runs_period_idx" ON "hr_payroll_runs" USING btree ("tenant_id","period_start","period_end");--> statement-breakpoint
CREATE INDEX "hr_payroll_runs_status_idx" ON "hr_payroll_runs" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "hr_performance_reviews_tenant_idx" ON "hr_performance_reviews" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "hr_performance_reviews_person_idx" ON "hr_performance_reviews" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "hr_performance_reviews_status_idx" ON "hr_performance_reviews" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "hr_persons_tenant_idx" ON "hr_persons" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "hr_persons_status_idx" ON "hr_persons" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "hr_persons_type_idx" ON "hr_persons" USING btree ("tenant_id","employment_type");--> statement-breakpoint
CREATE INDEX "hr_persons_manager_idx" ON "hr_persons" USING btree ("manager_id");