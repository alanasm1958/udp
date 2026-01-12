CREATE TYPE "public"."alert_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."evidence_state" AS ENUM('evidence_ok', 'pending_evidence');--> statement-breakpoint
CREATE TYPE "public"."item_availability" AS ENUM('available', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."item_expiry_policy" AS ENUM('none', 'required', 'optional');--> statement-breakpoint
CREATE TYPE "public"."ops_domain" AS ENUM('operations', 'sales', 'finance', 'hr', 'marketing');--> statement-breakpoint
CREATE TYPE "public"."ops_payment_method" AS ENUM('cash', 'bank');--> statement-breakpoint
CREATE TYPE "public"."ops_payment_status" AS ENUM('paid', 'unpaid');--> statement-breakpoint
CREATE TYPE "public"."return_type" AS ENUM('customer_return', 'supplier_return');--> statement-breakpoint
CREATE TYPE "public"."task_assigned_role" AS ENUM('sme_owner', 'operations_user');--> statement-breakpoint
CREATE TYPE "public"."task_domain" AS ENUM('operations', 'sales', 'finance', 'hr', 'marketing');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('open', 'done', 'dismissed');--> statement-breakpoint
ALTER TYPE "public"."ai_task_type" ADD VALUE 'assign_item_to_warehouse' BEFORE 'approve_purchase_variance';--> statement-breakpoint
CREATE TABLE "inventory_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(18, 6) NOT NULL,
	"from_warehouse_id" uuid NOT NULL,
	"to_warehouse_id" uuid NOT NULL,
	"transfer_date" date NOT NULL,
	"notes" text,
	"movement_id" uuid,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"payee_person_id" uuid,
	"linked_purchase_doc_id" uuid,
	"payment_date" date NOT NULL,
	"amount" numeric(18, 6) NOT NULL,
	"currency" text,
	"status" "ops_payment_status" DEFAULT 'unpaid' NOT NULL,
	"method" "ops_payment_method",
	"bank_account_id" uuid,
	"domain" "ops_domain" DEFAULT 'operations' NOT NULL,
	"notes" text,
	"evidence_state" "evidence_state" DEFAULT 'pending_evidence' NOT NULL,
	"finance_payment_id" uuid,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" "return_type" NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(18, 6) NOT NULL,
	"warehouse_id" uuid,
	"return_date" date NOT NULL,
	"reason" text,
	"linked_sale_doc_id" uuid,
	"linked_purchase_doc_id" uuid,
	"movement_id" uuid,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "domain" "task_domain";--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "low_stock_threshold_percent" integer DEFAULT 20;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "low_stock_threshold_override_qty" numeric(18, 6);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "expiry_policy" "item_expiry_policy" DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "expiry_date" date;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "batch_or_lot" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "hazard_flag" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "food_flag" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "non_expiring_flag" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "default_warehouse_id" uuid;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "vendor_person_id" uuid;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "availability" "item_availability";--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "service_provider_person_ids" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "consent_to_notify" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "inventory_product_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "domain" "task_domain";--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "assigned_to_role" "task_assigned_role";--> statement-breakpoint
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_from_warehouse_id_warehouses_id_fk" FOREIGN KEY ("from_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_to_warehouse_id_warehouses_id_fk" FOREIGN KEY ("to_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_movement_id_inventory_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."inventory_movements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_payments" ADD CONSTRAINT "ops_payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_payments" ADD CONSTRAINT "ops_payments_payee_person_id_people_id_fk" FOREIGN KEY ("payee_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_payments" ADD CONSTRAINT "ops_payments_linked_purchase_doc_id_purchase_docs_id_fk" FOREIGN KEY ("linked_purchase_doc_id") REFERENCES "public"."purchase_docs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_payments" ADD CONSTRAINT "ops_payments_bank_account_id_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_payments" ADD CONSTRAINT "ops_payments_finance_payment_id_payments_id_fk" FOREIGN KEY ("finance_payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_payments" ADD CONSTRAINT "ops_payments_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_linked_sale_doc_id_sales_docs_id_fk" FOREIGN KEY ("linked_sale_doc_id") REFERENCES "public"."sales_docs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_linked_purchase_doc_id_purchase_docs_id_fk" FOREIGN KEY ("linked_purchase_doc_id") REFERENCES "public"."purchase_docs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_movement_id_inventory_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."inventory_movements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_transfers_tenant_item_idx" ON "inventory_transfers" USING btree ("tenant_id","item_id");--> statement-breakpoint
CREATE INDEX "inventory_transfers_tenant_from_wh_idx" ON "inventory_transfers" USING btree ("tenant_id","from_warehouse_id");--> statement-breakpoint
CREATE INDEX "inventory_transfers_tenant_to_wh_idx" ON "inventory_transfers" USING btree ("tenant_id","to_warehouse_id");--> statement-breakpoint
CREATE INDEX "inventory_transfers_tenant_date_idx" ON "inventory_transfers" USING btree ("tenant_id","transfer_date");--> statement-breakpoint
CREATE INDEX "ops_payments_tenant_status_idx" ON "ops_payments" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "ops_payments_tenant_payee_idx" ON "ops_payments" USING btree ("tenant_id","payee_person_id");--> statement-breakpoint
CREATE INDEX "ops_payments_tenant_date_idx" ON "ops_payments" USING btree ("tenant_id","payment_date");--> statement-breakpoint
CREATE INDEX "ops_payments_tenant_evidence_idx" ON "ops_payments" USING btree ("tenant_id","evidence_state");--> statement-breakpoint
CREATE INDEX "ops_payments_tenant_purchase_idx" ON "ops_payments" USING btree ("tenant_id","linked_purchase_doc_id");--> statement-breakpoint
CREATE INDEX "returns_tenant_type_idx" ON "returns" USING btree ("tenant_id","type");--> statement-breakpoint
CREATE INDEX "returns_tenant_item_idx" ON "returns" USING btree ("tenant_id","item_id");--> statement-breakpoint
CREATE INDEX "returns_tenant_date_idx" ON "returns" USING btree ("tenant_id","return_date");--> statement-breakpoint
CREATE INDEX "returns_tenant_sale_idx" ON "returns" USING btree ("tenant_id","linked_sale_doc_id");--> statement-breakpoint
CREATE INDEX "returns_tenant_purchase_idx" ON "returns" USING btree ("tenant_id","linked_purchase_doc_id");--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_default_warehouse_id_warehouses_id_fk" FOREIGN KEY ("default_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_inventory_product_id_products_id_fk" FOREIGN KEY ("inventory_product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_tenant_domain_idx" ON "alerts" USING btree ("tenant_id","domain");--> statement-breakpoint
CREATE INDEX "items_tenant_warehouse_idx" ON "items" USING btree ("tenant_id","default_warehouse_id");--> statement-breakpoint
CREATE INDEX "tasks_tenant_domain_idx" ON "tasks" USING btree ("tenant_id","domain");