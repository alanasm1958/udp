-- Migration: Tenant Management & Granular RBAC
-- Phase 3.1: Add platform owner support and page/action access control

-- ============================================
-- 1. Modify tenants table
-- ============================================
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "is_platform_owner" boolean NOT NULL DEFAULT false;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'active';
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "suspended_at" timestamp with time zone;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "suspended_reason" text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "last_activity_at" timestamp with time zone;

-- ============================================
-- 2. Pages reference table (global)
-- ============================================
CREATE TABLE IF NOT EXISTS "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"route" text NOT NULL,
	"module" text NOT NULL,
	"description" text,
	"icon" text,
	"is_always_accessible" boolean NOT NULL DEFAULT false,
	"display_order" integer NOT NULL DEFAULT 0,
	"parent_page_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pages_code_unique" UNIQUE("code")
);

CREATE INDEX IF NOT EXISTS "idx_pages_module" ON "pages" USING btree ("module");
CREATE INDEX IF NOT EXISTS "idx_pages_parent" ON "pages" USING btree ("parent_page_code");

-- ============================================
-- 3. Page actions reference table (global)
-- ============================================
CREATE TABLE IF NOT EXISTS "page_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"action_type" text NOT NULL DEFAULT 'button',
	"requires_permission" text,
	"display_order" integer NOT NULL DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "page_actions" ADD CONSTRAINT "page_actions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX IF NOT EXISTS "page_actions_page_code_uniq" ON "page_actions" USING btree ("page_id","code");
CREATE INDEX IF NOT EXISTS "idx_page_actions_page" ON "page_actions" USING btree ("page_id");

-- ============================================
-- 4. User page access (tenant-scoped)
-- ============================================
CREATE TABLE IF NOT EXISTS "user_page_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"has_access" boolean NOT NULL DEFAULT true,
	"granted_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "user_page_access" ADD CONSTRAINT "user_page_access_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_page_access" ADD CONSTRAINT "user_page_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_page_access" ADD CONSTRAINT "user_page_access_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_page_access" ADD CONSTRAINT "user_page_access_granted_by_actor_id_actors_id_fk" FOREIGN KEY ("granted_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;

CREATE UNIQUE INDEX IF NOT EXISTS "user_page_access_uniq" ON "user_page_access" USING btree ("tenant_id","user_id","page_id");
CREATE INDEX IF NOT EXISTS "idx_user_page_access_lookup" ON "user_page_access" USING btree ("tenant_id","user_id");
CREATE INDEX IF NOT EXISTS "idx_user_page_access_page" ON "user_page_access" USING btree ("page_id");

-- ============================================
-- 5. User action access (tenant-scoped)
-- ============================================
CREATE TABLE IF NOT EXISTS "user_action_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"has_access" boolean NOT NULL DEFAULT true,
	"granted_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "user_action_access" ADD CONSTRAINT "user_action_access_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_action_access" ADD CONSTRAINT "user_action_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_action_access" ADD CONSTRAINT "user_action_access_action_id_page_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."page_actions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_action_access" ADD CONSTRAINT "user_action_access_granted_by_actor_id_actors_id_fk" FOREIGN KEY ("granted_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;

CREATE UNIQUE INDEX IF NOT EXISTS "user_action_access_uniq" ON "user_action_access" USING btree ("tenant_id","user_id","action_id");
CREATE INDEX IF NOT EXISTS "idx_user_action_access_lookup" ON "user_action_access" USING btree ("tenant_id","user_id");
CREATE INDEX IF NOT EXISTS "idx_user_action_access_action" ON "user_action_access" USING btree ("action_id");

-- ============================================
-- 6. Tenant payment history (for monitoring)
-- ============================================
CREATE TABLE IF NOT EXISTS "tenant_payment_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text NOT NULL DEFAULT 'USD',
	"status" text NOT NULL,
	"payment_method" text,
	"stripe_payment_intent_id" text,
	"stripe_invoice_id" text,
	"description" text,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "tenant_payment_history" ADD CONSTRAINT "tenant_payment_history_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "idx_tenant_payments_tenant" ON "tenant_payment_history" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_tenant_payments_status" ON "tenant_payment_history" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_tenant_payments_created" ON "tenant_payment_history" USING btree ("created_at" DESC);

-- ============================================
-- 7. Add index on tenants for platform owner lookup
-- ============================================
CREATE INDEX IF NOT EXISTS "idx_tenants_platform_owner" ON "tenants" USING btree ("is_platform_owner") WHERE "is_platform_owner" = true;
CREATE INDEX IF NOT EXISTS "idx_tenants_status" ON "tenants" USING btree ("status");
