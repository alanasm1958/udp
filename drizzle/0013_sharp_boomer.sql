CREATE TYPE "public"."payment_allocation_target_type" AS ENUM('sales_doc', 'purchase_doc');--> statement-breakpoint
DROP INDEX "payment_allocations_payment_idx";--> statement-breakpoint
DROP INDEX "payments_tenant_type_idx";--> statement-breakpoint
ALTER TABLE "payment_allocations" ALTER COLUMN "target_type" SET DATA TYPE "public"."payment_allocation_target_type" USING "target_type"::text::"public"."payment_allocation_target_type";--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "cash_account_code" text DEFAULT '1000' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "bank_account_code" text DEFAULT '1020' NOT NULL;--> statement-breakpoint
CREATE INDEX "payment_allocations_tenant_payment_idx" ON "payment_allocations" USING btree ("tenant_id","payment_id");--> statement-breakpoint
CREATE INDEX "payments_tenant_date_idx" ON "payments" USING btree ("tenant_id","payment_date");--> statement-breakpoint
DROP TYPE "public"."allocation_target_type";