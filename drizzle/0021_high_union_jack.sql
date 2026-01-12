CREATE TYPE "public"."marketing_task_status" AS ENUM('pending', 'in_progress', 'completed', 'cancelled', 'auto_resolved');--> statement-breakpoint
CREATE TYPE "public"."marketing_task_type" AS ENUM('plan_approval', 'connector_error', 'stale_data', 'campaign_launch', 'campaign_underperforming', 'onboarding_incomplete', 'budget_review', 'channel_setup');--> statement-breakpoint
CREATE TABLE "marketing_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"task_type" "marketing_task_type" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" "marketing_task_status" DEFAULT 'pending' NOT NULL,
	"assigned_to_actor_id" uuid,
	"assignment_rule" text DEFAULT 'auto' NOT NULL,
	"plan_id" uuid,
	"campaign_id" uuid,
	"channel_id" uuid,
	"why_this" text,
	"expected_outcome" text,
	"confidence_level" text,
	"missing_data" jsonb DEFAULT '[]'::jsonb,
	"next_action" text,
	"action_url" text,
	"priority" integer DEFAULT 2 NOT NULL,
	"due_at" timestamp with time zone,
	"trigger_hash" text,
	"last_triggered_at" timestamp with time zone,
	"trigger_count" integer DEFAULT 1 NOT NULL,
	"resolved_by_actor_id" uuid,
	"resolved_at" timestamp with time zone,
	"resolution_notes" text,
	"auto_resolved" boolean DEFAULT false NOT NULL,
	"created_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"view_mode" text DEFAULT 'simple' NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"onboarding_skipped_at" timestamp with time zone,
	"dismissed_tips" jsonb DEFAULT '[]'::jsonb,
	"preferred_channels" jsonb DEFAULT '[]'::jsonb,
	"excluded_channels" jsonb DEFAULT '[]'::jsonb,
	"pinned_card_ids" jsonb DEFAULT '[]'::jsonb,
	"hidden_sections" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ALTER COLUMN "analytics_scope" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "marketing_plans" ALTER COLUMN "recommendations" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "marketing_tasks" ADD CONSTRAINT "marketing_tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_tasks" ADD CONSTRAINT "marketing_tasks_assigned_to_actor_id_actors_id_fk" FOREIGN KEY ("assigned_to_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_tasks" ADD CONSTRAINT "marketing_tasks_plan_id_marketing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."marketing_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_tasks" ADD CONSTRAINT "marketing_tasks_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_tasks" ADD CONSTRAINT "marketing_tasks_channel_id_marketing_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."marketing_channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_tasks" ADD CONSTRAINT "marketing_tasks_resolved_by_actor_id_actors_id_fk" FOREIGN KEY ("resolved_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_tasks" ADD CONSTRAINT "marketing_tasks_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_user_preferences" ADD CONSTRAINT "marketing_user_preferences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_user_preferences" ADD CONSTRAINT "marketing_user_preferences_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "marketing_tasks_tenant_status_idx" ON "marketing_tasks" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "marketing_tasks_tenant_assigned_idx" ON "marketing_tasks" USING btree ("tenant_id","assigned_to_actor_id");--> statement-breakpoint
CREATE INDEX "marketing_tasks_tenant_type_idx" ON "marketing_tasks" USING btree ("tenant_id","task_type");--> statement-breakpoint
CREATE INDEX "marketing_tasks_trigger_hash_idx" ON "marketing_tasks" USING btree ("tenant_id","trigger_hash");--> statement-breakpoint
CREATE INDEX "marketing_tasks_tenant_priority_idx" ON "marketing_tasks" USING btree ("tenant_id","priority","status");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_user_prefs_tenant_actor_uniq" ON "marketing_user_preferences" USING btree ("tenant_id","actor_id");