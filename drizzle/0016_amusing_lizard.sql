CREATE TYPE "public"."billing_type" AS ENUM('recurring', 'trial');--> statement-breakpoint
ALTER TYPE "public"."subscription_status" ADD VALUE 'none' BEFORE 'trialing';--> statement-breakpoint
ALTER TYPE "public"."subscription_status" ADD VALUE 'expired';--> statement-breakpoint
DROP INDEX "tenant_subscriptions_tenant_uniq";--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "price_amount" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "billing_type" "billing_type" DEFAULT 'recurring' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "interval" text DEFAULT 'month' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "interval_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "trial_days" integer;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "duration_months" integer;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "is_promotional" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "stripe_product_id" text;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_subscriptions" ADD COLUMN "is_current" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_subscriptions" ADD COLUMN "started_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_subscriptions" ADD COLUMN "ended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenant_subscriptions" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_subscriptions" ADD COLUMN "created_by_actor_id" uuid;--> statement-breakpoint
CREATE INDEX "tenant_subscriptions_tenant_status_idx" ON "tenant_subscriptions" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "tenant_subscriptions_tenant_period_end_idx" ON "tenant_subscriptions" USING btree ("tenant_id","current_period_end");--> statement-breakpoint
CREATE INDEX "tenant_subscriptions_tenant_current_idx" ON "tenant_subscriptions" USING btree ("tenant_id","is_current");--> statement-breakpoint
ALTER TABLE "subscription_plans" DROP COLUMN "price_monthly_cents";
