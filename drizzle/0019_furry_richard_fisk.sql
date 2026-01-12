CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'qualified', 'disqualified', 'won', 'lost');--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contact_name" text NOT NULL,
	"company" text,
	"email" text,
	"phone" text,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"source" text,
	"estimated_value" numeric(18, 6),
	"probability" integer DEFAULT 10,
	"expected_close_date" date,
	"notes" text,
	"assigned_to_user_id" uuid,
	"assigned_to_salesperson_id" uuid,
	"party_id" uuid,
	"converted_to_sales_doc_id" uuid,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salespersons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"linked_user_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"cash_account_codes" jsonb DEFAULT '[]'::jsonb,
	"bank_account_codes" jsonb DEFAULT '[]'::jsonb,
	"liquidity_min_balance" numeric(18, 6) DEFAULT '50000',
	"default_payment_terms_days" integer DEFAULT 30,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_actor_id" uuid
);
--> statement-breakpoint
CREATE TABLE "user_card_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"card_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"card_order" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_to_sales_doc_id_sales_docs_id_fk" FOREIGN KEY ("converted_to_sales_doc_id") REFERENCES "public"."sales_docs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salespersons" ADD CONSTRAINT "salespersons_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salespersons" ADD CONSTRAINT "salespersons_linked_user_id_users_id_fk" FOREIGN KEY ("linked_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salespersons" ADD CONSTRAINT "salespersons_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_updated_by_actor_id_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_card_preferences" ADD CONSTRAINT "user_card_preferences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_card_preferences" ADD CONSTRAINT "user_card_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leads_tenant_status_idx" ON "leads" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "leads_tenant_assignee_idx" ON "leads" USING btree ("tenant_id","assigned_to_user_id");--> statement-breakpoint
CREATE INDEX "leads_tenant_party_idx" ON "leads" USING btree ("tenant_id","party_id");--> statement-breakpoint
CREATE INDEX "salespersons_tenant_idx" ON "salespersons" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "salespersons_tenant_user_idx" ON "salespersons" USING btree ("tenant_id","linked_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tenant_settings_tenant" ON "tenant_settings" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_card_prefs_user_domain_uniq" ON "user_card_preferences" USING btree ("tenant_id","user_id","domain");