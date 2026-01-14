CREATE TYPE "public"."activity_outcome" AS ENUM('connected_successful', 'connected_needs_followup', 'voicemail', 'no_answer', 'wrong_number', 'very_positive', 'positive', 'neutral', 'negative', 'resolved', 'escalated', 'investigating', 'pending_followup');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."sales_activity_type" AS ENUM('phone_call', 'email_sent', 'email_received', 'meeting', 'site_visit', 'quote_sent', 'quote_followed_up', 'order_received', 'order_confirmed', 'delivery_scheduled', 'delivery_completed', 'payment_reminder_sent', 'customer_issue', 'deal_won', 'deal_lost', 'note');--> statement-breakpoint
CREATE TYPE "public"."score_trend" AS ENUM('improving', 'stable', 'declining');--> statement-breakpoint
CREATE TABLE "customer_health_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"payment_score" integer DEFAULT 50,
	"engagement_score" integer DEFAULT 50,
	"order_frequency_score" integer DEFAULT 50,
	"growth_score" integer DEFAULT 50,
	"issue_score" integer DEFAULT 100,
	"overall_score" integer DEFAULT 50,
	"score_trend" "score_trend" DEFAULT 'stable',
	"risk_level" "risk_level" DEFAULT 'low',
	"risk_factors" jsonb DEFAULT '[]'::jsonb,
	"total_orders" integer DEFAULT 0,
	"total_revenue" numeric(15, 2) DEFAULT '0',
	"average_order_value" numeric(15, 2) DEFAULT '0',
	"days_since_last_order" integer,
	"payment_delay_days_avg" integer DEFAULT 0,
	"issue_count_30d" integer DEFAULT 0,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"activity_type" "sales_activity_type" NOT NULL,
	"activity_date" timestamp with time zone DEFAULT now() NOT NULL,
	"person_id" uuid,
	"customer_id" uuid,
	"lead_id" uuid,
	"sales_doc_id" uuid,
	"outcome" "activity_outcome",
	"duration_minutes" integer,
	"discussion_points" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"internal_notes" text,
	"our_commitments" jsonb DEFAULT '[]'::jsonb,
	"their_commitments" jsonb DEFAULT '[]'::jsonb,
	"next_action" text,
	"follow_up_date" date,
	"follow_up_note" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"performed_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "person_id" uuid;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "last_activity_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "activity_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "customer_health_score" integer;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "converted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "lost_reason" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "lost_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "person_id" uuid;--> statement-breakpoint
ALTER TABLE "sales_docs" ADD COLUMN "allocated_amount" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "sales_docs" ADD COLUMN "remaining_amount" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "sales_docs" ADD COLUMN "payment_status" text;--> statement-breakpoint
ALTER TABLE "sales_docs" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sales_docs" ADD COLUMN "sent_method" text;--> statement-breakpoint
ALTER TABLE "sales_docs" ADD COLUMN "last_reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sales_docs" ADD COLUMN "reminder_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "sales_docs" ADD COLUMN "has_issues" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "sales_docs" ADD COLUMN "issue_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "customer_health_scores" ADD CONSTRAINT "customer_health_scores_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_health_scores" ADD CONSTRAINT "customer_health_scores_customer_id_parties_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_activities" ADD CONSTRAINT "sales_activities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_activities" ADD CONSTRAINT "sales_activities_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_activities" ADD CONSTRAINT "sales_activities_customer_id_parties_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_activities" ADD CONSTRAINT "sales_activities_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_activities" ADD CONSTRAINT "sales_activities_sales_doc_id_sales_docs_id_fk" FOREIGN KEY ("sales_doc_id") REFERENCES "public"."sales_docs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_activities" ADD CONSTRAINT "sales_activities_performed_by_actor_id_actors_id_fk" FOREIGN KEY ("performed_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_health_scores_tenant_customer_uniq" ON "customer_health_scores" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "customer_health_scores_tenant_idx" ON "customer_health_scores" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "customer_health_scores_score_idx" ON "customer_health_scores" USING btree ("tenant_id","overall_score");--> statement-breakpoint
CREATE INDEX "customer_health_scores_risk_idx" ON "customer_health_scores" USING btree ("tenant_id","risk_level");--> statement-breakpoint
CREATE INDEX "sales_activities_tenant_idx" ON "sales_activities" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sales_activities_type_idx" ON "sales_activities" USING btree ("tenant_id","activity_type");--> statement-breakpoint
CREATE INDEX "sales_activities_person_idx" ON "sales_activities" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "sales_activities_customer_idx" ON "sales_activities" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "sales_activities_lead_idx" ON "sales_activities" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "sales_activities_sales_doc_idx" ON "sales_activities" USING btree ("sales_doc_id");--> statement-breakpoint
CREATE INDEX "sales_activities_date_idx" ON "sales_activities" USING btree ("tenant_id","activity_date");--> statement-breakpoint
CREATE INDEX "sales_activities_follow_up_idx" ON "sales_activities" USING btree ("tenant_id","follow_up_date");--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leads_tenant_person_idx" ON "leads" USING btree ("tenant_id","person_id");--> statement-breakpoint
CREATE INDEX "leads_tenant_last_activity_idx" ON "leads" USING btree ("tenant_id","last_activity_date");--> statement-breakpoint
CREATE INDEX "leads_tenant_health_idx" ON "leads" USING btree ("tenant_id","customer_health_score");--> statement-breakpoint
CREATE INDEX "parties_tenant_person_idx" ON "parties" USING btree ("tenant_id","person_id");--> statement-breakpoint
CREATE INDEX "sales_docs_tenant_payment_status_idx" ON "sales_docs" USING btree ("tenant_id","payment_status");