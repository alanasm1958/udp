CREATE TYPE "public"."analytics_card_render_type" AS ENUM('kpi', 'trend', 'funnel', 'breakdown', 'insight');--> statement-breakpoint
CREATE TYPE "public"."analytics_card_scope_type" AS ENUM('global', 'channel', 'multi_channel', 'product', 'service', 'campaign', 'segment');--> statement-breakpoint
CREATE TYPE "public"."attribution_model" AS ENUM('simple', 'last_touch', 'first_touch');--> statement-breakpoint
CREATE TYPE "public"."connector_connection_type" AS ENUM('oauth', 'api_key', 'credentials', 'csv_upload', 'manual_entry');--> statement-breakpoint
CREATE TYPE "public"."connector_sync_mode" AS ENUM('realtime', 'scheduled', 'manual');--> statement-breakpoint
CREATE TYPE "public"."marketing_campaign_status" AS ENUM('active', 'paused', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."marketing_channel_status" AS ENUM('connected', 'disconnected', 'partial', 'error', 'manual');--> statement-breakpoint
CREATE TYPE "public"."marketing_channel_type" AS ENUM('social', 'email', 'messaging', 'ads', 'website_analytics', 'sms', 'offline', 'agency', 'influencer');--> statement-breakpoint
CREATE TYPE "public"."marketing_objective_type" AS ENUM('revenue', 'units_sold', 'leads', 'awareness', 'launch', 'clear_inventory', 'market_entry');--> statement-breakpoint
CREATE TYPE "public"."marketing_plan_status" AS ENUM('draft', 'recommended', 'edited', 'approved', 'implemented', 'archived');--> statement-breakpoint
CREATE TYPE "public"."what_if_scenario_type" AS ENUM('budget_change', 'channel_remove', 'channel_add', 'pricing_change', 'time_horizon_change');--> statement-breakpoint
CREATE TABLE "marketing_analytics_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" text NOT NULL,
	"scope_type" "analytics_card_scope_type" DEFAULT 'global' NOT NULL,
	"scope_refs" jsonb DEFAULT '[]'::jsonb,
	"metrics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb,
	"time_range" jsonb DEFAULT '{"preset":"last_7_days"}'::jsonb,
	"comparison_mode" text,
	"attribution_model" "attribution_model" DEFAULT 'simple' NOT NULL,
	"render_type" "analytics_card_render_type" DEFAULT 'kpi' NOT NULL,
	"is_ai_suggested" boolean DEFAULT false NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"layout_order" integer DEFAULT 0 NOT NULL,
	"help_copy_id" text,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "marketing_campaign_status" DEFAULT 'active' NOT NULL,
	"plan_id" uuid,
	"goal_refs" jsonb DEFAULT '[]'::jsonb,
	"channel_refs" jsonb DEFAULT '[]'::jsonb,
	"budget" numeric(18, 6),
	"spent_to_date" numeric(18, 6) DEFAULT '0',
	"start_date" date,
	"end_date" date,
	"analytics_scope" jsonb DEFAULT '{}'::jsonb,
	"attribution_assumptions" jsonb DEFAULT '{"model":"simple"}'::jsonb,
	"performance_snapshot" jsonb DEFAULT '{}'::jsonb,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "marketing_channel_type" NOT NULL,
	"status" "marketing_channel_status" DEFAULT 'manual' NOT NULL,
	"integration_provider" text,
	"auth_method" text,
	"data_freshness_policy" jsonb DEFAULT '{"maxAgeHours":24}'::jsonb,
	"permissions" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_connectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"connection_type" "connector_connection_type" NOT NULL,
	"requirements_schema" jsonb DEFAULT '{}'::jsonb,
	"auth_state" jsonb DEFAULT '{}'::jsonb,
	"sync_mode" "connector_sync_mode" DEFAULT 'manual' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"sync_errors" jsonb DEFAULT '[]'::jsonb,
	"data_sources" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"insight_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"channel_id" uuid,
	"campaign_id" uuid,
	"plan_id" uuid,
	"reasoning" text,
	"suggested_action" text,
	"status" text DEFAULT 'active' NOT NULL,
	"acknowledged_by_actor_id" uuid,
	"acknowledged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "marketing_manual_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"channel_id" uuid,
	"campaign_id" uuid,
	"entry_date" date NOT NULL,
	"spend" numeric(18, 6),
	"impressions" integer,
	"clicks" integer,
	"conversions" integer,
	"revenue" numeric(18, 6),
	"leads" integer,
	"custom_metrics" jsonb DEFAULT '{}'::jsonb,
	"notes" text,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_objectives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"objective_type" "marketing_objective_type" NOT NULL,
	"target_value" numeric(18, 6),
	"time_horizon" text,
	"priority" integer DEFAULT 1 NOT NULL,
	"product_or_service_refs" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "marketing_plan_status" DEFAULT 'draft' NOT NULL,
	"inputs_snapshot" jsonb DEFAULT '{}'::jsonb,
	"recommendations" jsonb DEFAULT '{}'::jsonb,
	"budget_total" numeric(18, 6),
	"budget_allocations" jsonb DEFAULT '[]'::jsonb,
	"pacing_schedule" jsonb DEFAULT '[]'::jsonb,
	"channel_priorities" jsonb DEFAULT '[]'::jsonb,
	"excluded_channels" jsonb DEFAULT '[]'::jsonb,
	"tactics" jsonb DEFAULT '[]'::jsonb,
	"messaging" jsonb DEFAULT '[]'::jsonb,
	"tools_and_services" jsonb DEFAULT '[]'::jsonb,
	"risks_and_assumptions" jsonb DEFAULT '[]'::jsonb,
	"early_warning_signals" jsonb DEFAULT '[]'::jsonb,
	"explanations" jsonb DEFAULT '{}'::jsonb,
	"linked_card_ids" jsonb DEFAULT '[]'::jsonb,
	"created_campaign_ids" jsonb DEFAULT '[]'::jsonb,
	"approved_by_actor_id" uuid,
	"approved_at" timestamp with time zone,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_what_if_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"name" text NOT NULL,
	"scenario_type" "what_if_scenario_type" NOT NULL,
	"parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result_snapshot" jsonb DEFAULT '{}'::jsonb,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "marketing_analytics_cards" ADD CONSTRAINT "marketing_analytics_cards_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_analytics_cards" ADD CONSTRAINT "marketing_analytics_cards_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_plan_id_marketing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."marketing_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_channels" ADD CONSTRAINT "marketing_channels_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_channels" ADD CONSTRAINT "marketing_channels_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_connectors" ADD CONSTRAINT "marketing_connectors_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_connectors" ADD CONSTRAINT "marketing_connectors_channel_id_marketing_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."marketing_channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_connectors" ADD CONSTRAINT "marketing_connectors_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_insights" ADD CONSTRAINT "marketing_insights_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_insights" ADD CONSTRAINT "marketing_insights_channel_id_marketing_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."marketing_channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_insights" ADD CONSTRAINT "marketing_insights_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_insights" ADD CONSTRAINT "marketing_insights_plan_id_marketing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."marketing_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_insights" ADD CONSTRAINT "marketing_insights_acknowledged_by_actor_id_actors_id_fk" FOREIGN KEY ("acknowledged_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_manual_entries" ADD CONSTRAINT "marketing_manual_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_manual_entries" ADD CONSTRAINT "marketing_manual_entries_channel_id_marketing_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."marketing_channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_manual_entries" ADD CONSTRAINT "marketing_manual_entries_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_manual_entries" ADD CONSTRAINT "marketing_manual_entries_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_objectives" ADD CONSTRAINT "marketing_objectives_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_objectives" ADD CONSTRAINT "marketing_objectives_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_plans" ADD CONSTRAINT "marketing_plans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_plans" ADD CONSTRAINT "marketing_plans_approved_by_actor_id_actors_id_fk" FOREIGN KEY ("approved_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_plans" ADD CONSTRAINT "marketing_plans_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_what_if_scenarios" ADD CONSTRAINT "marketing_what_if_scenarios_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_what_if_scenarios" ADD CONSTRAINT "marketing_what_if_scenarios_plan_id_marketing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."marketing_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_what_if_scenarios" ADD CONSTRAINT "marketing_what_if_scenarios_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "marketing_analytics_cards_tenant_scope_idx" ON "marketing_analytics_cards" USING btree ("tenant_id","scope_type");--> statement-breakpoint
CREATE INDEX "marketing_analytics_cards_tenant_pinned_idx" ON "marketing_analytics_cards" USING btree ("tenant_id","is_pinned");--> statement-breakpoint
CREATE INDEX "marketing_campaigns_tenant_status_idx" ON "marketing_campaigns" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "marketing_campaigns_tenant_plan_idx" ON "marketing_campaigns" USING btree ("tenant_id","plan_id");--> statement-breakpoint
CREATE INDEX "marketing_campaigns_tenant_dates_idx" ON "marketing_campaigns" USING btree ("tenant_id","start_date","end_date");--> statement-breakpoint
CREATE INDEX "marketing_channels_tenant_type_idx" ON "marketing_channels" USING btree ("tenant_id","type");--> statement-breakpoint
CREATE INDEX "marketing_channels_tenant_status_idx" ON "marketing_channels" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "marketing_connectors_tenant_channel_idx" ON "marketing_connectors" USING btree ("tenant_id","channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_connectors_tenant_channel_uniq" ON "marketing_connectors" USING btree ("tenant_id","channel_id");--> statement-breakpoint
CREATE INDEX "marketing_insights_tenant_type_idx" ON "marketing_insights" USING btree ("tenant_id","insight_type");--> statement-breakpoint
CREATE INDEX "marketing_insights_tenant_status_idx" ON "marketing_insights" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "marketing_insights_tenant_severity_idx" ON "marketing_insights" USING btree ("tenant_id","severity");--> statement-breakpoint
CREATE INDEX "marketing_manual_entries_tenant_channel_idx" ON "marketing_manual_entries" USING btree ("tenant_id","channel_id");--> statement-breakpoint
CREATE INDEX "marketing_manual_entries_tenant_campaign_idx" ON "marketing_manual_entries" USING btree ("tenant_id","campaign_id");--> statement-breakpoint
CREATE INDEX "marketing_manual_entries_tenant_date_idx" ON "marketing_manual_entries" USING btree ("tenant_id","entry_date");--> statement-breakpoint
CREATE INDEX "marketing_objectives_tenant_type_idx" ON "marketing_objectives" USING btree ("tenant_id","objective_type");--> statement-breakpoint
CREATE INDEX "marketing_objectives_tenant_active_idx" ON "marketing_objectives" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "marketing_plans_tenant_status_idx" ON "marketing_plans" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "marketing_plans_tenant_created_idx" ON "marketing_plans" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "marketing_what_if_scenarios_tenant_plan_idx" ON "marketing_what_if_scenarios" USING btree ("tenant_id","plan_id");