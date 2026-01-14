CREATE TYPE "public"."ai_sales_task_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."ai_sales_task_status" AS ENUM('pending', 'in_progress', 'completed', 'dismissed', 'snoozed');--> statement-breakpoint
CREATE TYPE "public"."ai_sales_task_type" AS ENUM('follow_up_lead', 'follow_up_quote', 'follow_up_customer', 'payment_reminder', 'at_risk_customer', 'hot_lead', 'quote_expiring', 'reactivate_customer', 'upsell_opportunity', 'churn_prevention');--> statement-breakpoint
CREATE TABLE "ai_sales_scan_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"scan_id" text NOT NULL,
	"trigger_type" text NOT NULL,
	"tasks_created" integer DEFAULT 0 NOT NULL,
	"tasks_updated" integer DEFAULT 0 NOT NULL,
	"tasks_closed" integer DEFAULT 0 NOT NULL,
	"entities_scanned" jsonb DEFAULT '{"customers":0,"leads":0,"quotes":0,"invoices":0}'::jsonb,
	"status" text DEFAULT 'running' NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_sales_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"task_type" "ai_sales_task_type" NOT NULL,
	"priority" "ai_sales_task_priority" DEFAULT 'medium' NOT NULL,
	"status" "ai_sales_task_status" DEFAULT 'pending' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"ai_rationale" text,
	"customer_id" uuid,
	"lead_id" uuid,
	"sales_doc_id" uuid,
	"person_id" uuid,
	"suggested_actions" jsonb DEFAULT '[]'::jsonb,
	"potential_value" numeric(15, 2),
	"risk_level" "risk_level",
	"due_date" date,
	"snoozed_until" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"completed_by_actor_id" uuid,
	"completion_note" text,
	"last_scan_id" text,
	"scan_score" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_sales_scan_logs" ADD CONSTRAINT "ai_sales_scan_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_sales_tasks" ADD CONSTRAINT "ai_sales_tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_sales_tasks" ADD CONSTRAINT "ai_sales_tasks_customer_id_parties_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_sales_tasks" ADD CONSTRAINT "ai_sales_tasks_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_sales_tasks" ADD CONSTRAINT "ai_sales_tasks_sales_doc_id_sales_docs_id_fk" FOREIGN KEY ("sales_doc_id") REFERENCES "public"."sales_docs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_sales_tasks" ADD CONSTRAINT "ai_sales_tasks_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_sales_tasks" ADD CONSTRAINT "ai_sales_tasks_completed_by_actor_id_actors_id_fk" FOREIGN KEY ("completed_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_sales_scan_logs_tenant_idx" ON "ai_sales_scan_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_sales_scan_logs_scan_id_uniq" ON "ai_sales_scan_logs" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX "ai_sales_tasks_tenant_idx" ON "ai_sales_tasks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "ai_sales_tasks_status_idx" ON "ai_sales_tasks" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "ai_sales_tasks_priority_idx" ON "ai_sales_tasks" USING btree ("tenant_id","priority");--> statement-breakpoint
CREATE INDEX "ai_sales_tasks_type_idx" ON "ai_sales_tasks" USING btree ("tenant_id","task_type");--> statement-breakpoint
CREATE INDEX "ai_sales_tasks_customer_idx" ON "ai_sales_tasks" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "ai_sales_tasks_lead_idx" ON "ai_sales_tasks" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "ai_sales_tasks_sales_doc_idx" ON "ai_sales_tasks" USING btree ("sales_doc_id");--> statement-breakpoint
CREATE INDEX "ai_sales_tasks_due_date_idx" ON "ai_sales_tasks" USING btree ("tenant_id","due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_sales_tasks_entity_uniq" ON "ai_sales_tasks" USING btree ("tenant_id","task_type","customer_id","lead_id","sales_doc_id");