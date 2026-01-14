CREATE TABLE "marketing_channel_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"insight_type" text NOT NULL,
	"title" text,
	"content" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"metadata" jsonb,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"ai_model" text,
	"raw_context" jsonb
);
--> statement-breakpoint
CREATE TABLE "marketing_channel_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"metric_type" text NOT NULL,
	"value" numeric(18, 4) NOT NULL,
	"previous_value" numeric(18, 4),
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"raw_data" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_channel_metrics_channel_metric_period_uniq" UNIQUE("channel_id","metric_type","period_start")
);
--> statement-breakpoint
ALTER TABLE "marketing_channel_insights" ADD CONSTRAINT "marketing_channel_insights_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_channel_insights" ADD CONSTRAINT "marketing_channel_insights_channel_id_marketing_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."marketing_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_channel_metrics" ADD CONSTRAINT "marketing_channel_metrics_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_channel_metrics" ADD CONSTRAINT "marketing_channel_metrics_channel_id_marketing_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."marketing_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "marketing_channel_insights_tenant_channel_idx" ON "marketing_channel_insights" USING btree ("tenant_id","channel_id");--> statement-breakpoint
CREATE INDEX "marketing_channel_insights_channel_type_idx" ON "marketing_channel_insights" USING btree ("channel_id","insight_type");--> statement-breakpoint
CREATE INDEX "marketing_channel_insights_tenant_priority_idx" ON "marketing_channel_insights" USING btree ("tenant_id","priority");--> statement-breakpoint
CREATE INDEX "marketing_channel_metrics_tenant_channel_idx" ON "marketing_channel_metrics" USING btree ("tenant_id","channel_id");--> statement-breakpoint
CREATE INDEX "marketing_channel_metrics_channel_metric_period_idx" ON "marketing_channel_metrics" USING btree ("channel_id","metric_type","period_start");