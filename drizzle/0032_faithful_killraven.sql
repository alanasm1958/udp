CREATE TYPE "public"."master_alert_category" AS ENUM('standard', 'compliance');--> statement-breakpoint
CREATE TYPE "public"."master_alert_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."master_alert_source" AS ENUM('system', 'ai', 'connector', 'user');--> statement-breakpoint
CREATE TYPE "public"."master_alert_status" AS ENUM('active', 'acknowledged', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."master_task_category" AS ENUM('standard', 'compliance', 'marketing', 'ai_suggestion');--> statement-breakpoint
CREATE TYPE "public"."master_task_priority" AS ENUM('low', 'normal', 'high', 'urgent', 'critical');--> statement-breakpoint
CREATE TYPE "public"."master_task_status" AS ENUM('open', 'in_progress', 'blocked', 'in_review', 'completed', 'cancelled', 'auto_resolved', 'approved', 'rejected', 'expired');--> statement-breakpoint
CREATE TABLE "master_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"category" "master_alert_category" NOT NULL,
	"domain" text NOT NULL,
	"alert_type" text NOT NULL,
	"title" text NOT NULL,
	"message" text,
	"severity" "master_alert_severity" NOT NULL,
	"status" "master_alert_status" DEFAULT 'active' NOT NULL,
	"source" "master_alert_source" DEFAULT 'system' NOT NULL,
	"related_entity_type" text,
	"related_entity_id" uuid,
	"requirement_id" uuid,
	"resolved_at" timestamp with time zone,
	"auto_resolved" boolean DEFAULT false,
	"resolution_reason" text,
	"expires_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "master_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"category" "master_task_category" NOT NULL,
	"domain" text NOT NULL,
	"task_type" text,
	"title" text NOT NULL,
	"description" text,
	"status" "master_task_status" DEFAULT 'open' NOT NULL,
	"priority" "master_task_priority" DEFAULT 'normal' NOT NULL,
	"assignee_user_id" uuid,
	"assignee_actor_id" uuid,
	"assigned_to_role" text,
	"due_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"related_entity_type" text,
	"related_entity_id" uuid,
	"secondary_entity_type" text,
	"secondary_entity_id" uuid,
	"confidence_score" numeric(5, 4),
	"reasoning" text,
	"suggested_action" jsonb,
	"action_url" text,
	"why_this" text,
	"expected_outcome" text,
	"requirement_id" uuid,
	"action_type" text,
	"blocked_reason" text,
	"completion_evidence" jsonb,
	"trigger_hash" text,
	"trigger_count" integer DEFAULT 1,
	"last_triggered_at" timestamp with time zone,
	"resolved_by_actor_id" uuid,
	"resolved_at" timestamp with time zone,
	"resolution_action" text,
	"resolution_notes" text,
	"auto_resolved" boolean DEFAULT false,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "master_alerts" ADD CONSTRAINT "master_alerts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_tasks" ADD CONSTRAINT "master_tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_tasks" ADD CONSTRAINT "master_tasks_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_tasks" ADD CONSTRAINT "master_tasks_assignee_actor_id_actors_id_fk" FOREIGN KEY ("assignee_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_tasks" ADD CONSTRAINT "master_tasks_resolved_by_actor_id_actors_id_fk" FOREIGN KEY ("resolved_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_tasks" ADD CONSTRAINT "master_tasks_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "master_alerts_tenant_domain_idx" ON "master_alerts" USING btree ("tenant_id","domain");--> statement-breakpoint
CREATE INDEX "master_alerts_tenant_status_idx" ON "master_alerts" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "master_alerts_tenant_severity_idx" ON "master_alerts" USING btree ("tenant_id","severity");--> statement-breakpoint
CREATE INDEX "master_alerts_requirement_idx" ON "master_alerts" USING btree ("requirement_id");--> statement-breakpoint
CREATE INDEX "master_tasks_tenant_domain_idx" ON "master_tasks" USING btree ("tenant_id","domain");--> statement-breakpoint
CREATE INDEX "master_tasks_tenant_status_idx" ON "master_tasks" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "master_tasks_tenant_category_idx" ON "master_tasks" USING btree ("tenant_id","category");--> statement-breakpoint
CREATE INDEX "master_tasks_tenant_priority_idx" ON "master_tasks" USING btree ("tenant_id","priority","status");--> statement-breakpoint
CREATE INDEX "master_tasks_trigger_hash_idx" ON "master_tasks" USING btree ("tenant_id","trigger_hash");--> statement-breakpoint
CREATE INDEX "master_tasks_assignee_idx" ON "master_tasks" USING btree ("assignee_user_id");--> statement-breakpoint
CREATE INDEX "master_tasks_requirement_idx" ON "master_tasks" USING btree ("requirement_id");