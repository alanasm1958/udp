CREATE TABLE "purchase_doc_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"purchase_doc_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" uuid,
	"description" text NOT NULL,
	"quantity" numeric(18, 6) DEFAULT '1' NOT NULL,
	"uom_id" uuid,
	"unit_price" numeric(18, 6) DEFAULT '0' NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(18, 6) DEFAULT '0' NOT NULL,
	"tax_category_id" uuid,
	"tax_amount" numeric(18, 6) DEFAULT '0' NOT NULL,
	"line_total" numeric(18, 6) DEFAULT '0' NOT NULL,
	"metadata" jsonb,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_docs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"doc_type" text NOT NULL,
	"doc_number" text NOT NULL,
	"party_id" uuid NOT NULL,
	"doc_date" date NOT NULL,
	"due_date" date,
	"currency" text DEFAULT 'USD' NOT NULL,
	"subtotal" numeric(18, 6) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(18, 6) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(18, 6) DEFAULT '0' NOT NULL,
	"total_amount" numeric(18, 6) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_doc_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sales_doc_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" uuid,
	"description" text NOT NULL,
	"quantity" numeric(18, 6) DEFAULT '1' NOT NULL,
	"uom_id" uuid,
	"unit_price" numeric(18, 6) DEFAULT '0' NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(18, 6) DEFAULT '0' NOT NULL,
	"tax_category_id" uuid,
	"tax_amount" numeric(18, 6) DEFAULT '0' NOT NULL,
	"line_total" numeric(18, 6) DEFAULT '0' NOT NULL,
	"metadata" jsonb,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_docs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"doc_type" text NOT NULL,
	"doc_number" text NOT NULL,
	"party_id" uuid NOT NULL,
	"doc_date" date NOT NULL,
	"due_date" date,
	"currency" text DEFAULT 'USD' NOT NULL,
	"subtotal" numeric(18, 6) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(18, 6) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(18, 6) DEFAULT '0' NOT NULL,
	"total_amount" numeric(18, 6) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "purchase_doc_lines" ADD CONSTRAINT "purchase_doc_lines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_doc_lines" ADD CONSTRAINT "purchase_doc_lines_purchase_doc_id_purchase_docs_id_fk" FOREIGN KEY ("purchase_doc_id") REFERENCES "public"."purchase_docs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_doc_lines" ADD CONSTRAINT "purchase_doc_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_doc_lines" ADD CONSTRAINT "purchase_doc_lines_uom_id_uoms_id_fk" FOREIGN KEY ("uom_id") REFERENCES "public"."uoms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_doc_lines" ADD CONSTRAINT "purchase_doc_lines_tax_category_id_tax_categories_id_fk" FOREIGN KEY ("tax_category_id") REFERENCES "public"."tax_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_doc_lines" ADD CONSTRAINT "purchase_doc_lines_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_docs" ADD CONSTRAINT "purchase_docs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_docs" ADD CONSTRAINT "purchase_docs_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_docs" ADD CONSTRAINT "purchase_docs_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_doc_lines" ADD CONSTRAINT "sales_doc_lines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_doc_lines" ADD CONSTRAINT "sales_doc_lines_sales_doc_id_sales_docs_id_fk" FOREIGN KEY ("sales_doc_id") REFERENCES "public"."sales_docs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_doc_lines" ADD CONSTRAINT "sales_doc_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_doc_lines" ADD CONSTRAINT "sales_doc_lines_uom_id_uoms_id_fk" FOREIGN KEY ("uom_id") REFERENCES "public"."uoms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_doc_lines" ADD CONSTRAINT "sales_doc_lines_tax_category_id_tax_categories_id_fk" FOREIGN KEY ("tax_category_id") REFERENCES "public"."tax_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_doc_lines" ADD CONSTRAINT "sales_doc_lines_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_docs" ADD CONSTRAINT "sales_docs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_docs" ADD CONSTRAINT "sales_docs_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_docs" ADD CONSTRAINT "sales_docs_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_doc_lines_tenant_doc_line_uniq" ON "purchase_doc_lines" USING btree ("tenant_id","purchase_doc_id","line_no");--> statement-breakpoint
CREATE INDEX "purchase_doc_lines_tenant_doc_idx" ON "purchase_doc_lines" USING btree ("tenant_id","purchase_doc_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_docs_tenant_docnumber_uniq" ON "purchase_docs" USING btree ("tenant_id","doc_number");--> statement-breakpoint
CREATE INDEX "purchase_docs_tenant_party_idx" ON "purchase_docs" USING btree ("tenant_id","party_id");--> statement-breakpoint
CREATE INDEX "purchase_docs_tenant_status_idx" ON "purchase_docs" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_doc_lines_tenant_doc_line_uniq" ON "sales_doc_lines" USING btree ("tenant_id","sales_doc_id","line_no");--> statement-breakpoint
CREATE INDEX "sales_doc_lines_tenant_doc_idx" ON "sales_doc_lines" USING btree ("tenant_id","sales_doc_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_docs_tenant_docnumber_uniq" ON "sales_docs" USING btree ("tenant_id","doc_number");--> statement-breakpoint
CREATE INDEX "sales_docs_tenant_party_idx" ON "sales_docs" USING btree ("tenant_id","party_id");--> statement-breakpoint
CREATE INDEX "sales_docs_tenant_status_idx" ON "sales_docs" USING btree ("tenant_id","status");