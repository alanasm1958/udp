CREATE TYPE "public"."allocation_target_type" AS ENUM('sales_doc', 'purchase_doc');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'bank');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('draft', 'posted', 'void');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('receipt', 'payment');--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"target_type" "allocation_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"amount" numeric(18, 6) NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_posting_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"transaction_set_id" uuid,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" "payment_type" NOT NULL,
	"method" "payment_method" NOT NULL,
	"payment_date" date NOT NULL,
	"party_id" uuid,
	"currency" text DEFAULT 'USD' NOT NULL,
	"amount" numeric(18, 6) NOT NULL,
	"memo" text,
	"reference" text,
	"status" "payment_status" DEFAULT 'draft' NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_posting_links" ADD CONSTRAINT "payment_posting_links_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_posting_links" ADD CONSTRAINT "payment_posting_links_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_posting_links" ADD CONSTRAINT "payment_posting_links_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_posting_links" ADD CONSTRAINT "payment_posting_links_transaction_set_id_transaction_sets_id_fk" FOREIGN KEY ("transaction_set_id") REFERENCES "public"."transaction_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_allocations_uniq" ON "payment_allocations" USING btree ("tenant_id","payment_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_payment_idx" ON "payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_posting_links_tenant_payment_uniq" ON "payment_posting_links" USING btree ("tenant_id","payment_id");--> statement-breakpoint
CREATE INDEX "payment_posting_links_journal_idx" ON "payment_posting_links" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "payments_tenant_idx" ON "payments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "payments_tenant_party_idx" ON "payments" USING btree ("tenant_id","party_id");--> statement-breakpoint
CREATE INDEX "payments_tenant_status_idx" ON "payments" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "payments_tenant_type_idx" ON "payments" USING btree ("tenant_id","type");