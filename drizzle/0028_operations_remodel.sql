CREATE TYPE "public"."asset_condition" AS ENUM('excellent', 'good', 'fair', 'poor', 'needs_repair');--> statement-breakpoint
CREATE TYPE "public"."asset_transfer_type" AS ENUM('location_change', 'assignment_change', 'location_and_assignment');--> statement-breakpoint
CREATE TYPE "public"."maintenance_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."maintenance_status" AS ENUM('scheduled', 'in_progress', 'completed', 'cancelled', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."maintenance_type" AS ENUM('preventive', 'corrective', 'emergency', 'inspection');--> statement-breakpoint
CREATE TYPE "public"."office_status" AS ENUM('active', 'inactive', 'closed');--> statement-breakpoint
CREATE TYPE "public"."office_type" AS ENUM('physical', 'virtual', 'hybrid');--> statement-breakpoint
CREATE TABLE "asset_maintenance_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"maintenance_type" "maintenance_type" NOT NULL,
	"priority" "maintenance_priority" DEFAULT 'medium' NOT NULL,
	"status" "maintenance_status" DEFAULT 'scheduled' NOT NULL,
	"scheduled_date" date NOT NULL,
	"completed_date" date,
	"estimated_duration" integer,
	"actual_duration" integer,
	"assigned_to_id" uuid,
	"description" text NOT NULL,
	"work_performed" text,
	"notes" text,
	"required_parts" jsonb DEFAULT '[]'::jsonb,
	"estimated_cost" numeric(15, 2),
	"actual_cost" numeric(15, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "asset_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"transfer_type" "asset_transfer_type" NOT NULL,
	"from_location_type" text,
	"from_location_id" uuid,
	"from_assignee_id" uuid,
	"to_location_type" text,
	"to_location_id" uuid,
	"to_assignee_id" uuid,
	"transfer_date" date DEFAULT CURRENT_DATE NOT NULL,
	"transfer_reason" text,
	"condition" "asset_condition",
	"approved_by" uuid NOT NULL,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "office_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"office_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"assigned_date" date DEFAULT CURRENT_DATE NOT NULL,
	"removed_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "offices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" "office_type" DEFAULT 'physical' NOT NULL,
	"status" "office_status" DEFAULT 'active' NOT NULL,
	"address" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"country" text,
	"capacity" integer,
	"current_occupancy" integer DEFAULT 0,
	"manager_id" uuid,
	"monthly_cost" numeric(15, 2),
	"currency" text DEFAULT 'USD',
	"lease_start_date" date,
	"lease_end_date" date,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "asset_maintenance_schedules" ADD CONSTRAINT "asset_maintenance_schedules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_maintenance_schedules" ADD CONSTRAINT "asset_maintenance_schedules_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_maintenance_schedules" ADD CONSTRAINT "asset_maintenance_schedules_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_maintenance_schedules" ADD CONSTRAINT "asset_maintenance_schedules_created_by_actors_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_from_assignee_id_users_id_fk" FOREIGN KEY ("from_assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_to_assignee_id_users_id_fk" FOREIGN KEY ("to_assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_created_by_actors_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_assets" ADD CONSTRAINT "office_assets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_assets" ADD CONSTRAINT "office_assets_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_assets" ADD CONSTRAINT "office_assets_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_assets" ADD CONSTRAINT "office_assets_created_by_actors_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offices" ADD CONSTRAINT "offices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offices" ADD CONSTRAINT "offices_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offices" ADD CONSTRAINT "offices_created_by_actors_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_maintenance_tenant_idx" ON "asset_maintenance_schedules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "asset_maintenance_item_idx" ON "asset_maintenance_schedules" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "asset_maintenance_status_idx" ON "asset_maintenance_schedules" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "asset_maintenance_scheduled_idx" ON "asset_maintenance_schedules" USING btree ("tenant_id","scheduled_date");--> statement-breakpoint
CREATE INDEX "asset_transfers_tenant_idx" ON "asset_transfers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "asset_transfers_item_idx" ON "asset_transfers" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "asset_transfers_date_idx" ON "asset_transfers" USING btree ("tenant_id","transfer_date");--> statement-breakpoint
CREATE INDEX "office_assets_tenant_idx" ON "office_assets" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "office_assets_office_idx" ON "office_assets" USING btree ("office_id");--> statement-breakpoint
CREATE INDEX "office_assets_item_idx" ON "office_assets" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "offices_tenant_idx" ON "offices" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "offices_status_idx" ON "offices" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "offices_tenant_code_uniq" ON "offices" USING btree ("tenant_id","code");