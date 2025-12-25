CREATE TABLE "purchase_posting_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"purchase_doc_id" uuid NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"transaction_set_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_posting_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sales_doc_id" uuid NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"transaction_set_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "purchase_posting_links" ADD CONSTRAINT "purchase_posting_links_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_posting_links" ADD CONSTRAINT "purchase_posting_links_purchase_doc_id_purchase_docs_id_fk" FOREIGN KEY ("purchase_doc_id") REFERENCES "public"."purchase_docs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_posting_links" ADD CONSTRAINT "purchase_posting_links_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_posting_links" ADD CONSTRAINT "purchase_posting_links_transaction_set_id_transaction_sets_id_fk" FOREIGN KEY ("transaction_set_id") REFERENCES "public"."transaction_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_posting_links" ADD CONSTRAINT "sales_posting_links_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_posting_links" ADD CONSTRAINT "sales_posting_links_sales_doc_id_sales_docs_id_fk" FOREIGN KEY ("sales_doc_id") REFERENCES "public"."sales_docs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_posting_links" ADD CONSTRAINT "sales_posting_links_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_posting_links" ADD CONSTRAINT "sales_posting_links_transaction_set_id_transaction_sets_id_fk" FOREIGN KEY ("transaction_set_id") REFERENCES "public"."transaction_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_posting_links_tenant_doc_uniq" ON "purchase_posting_links" USING btree ("tenant_id","purchase_doc_id");--> statement-breakpoint
CREATE INDEX "purchase_posting_links_journal_idx" ON "purchase_posting_links" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_posting_links_tenant_doc_uniq" ON "sales_posting_links" USING btree ("tenant_id","sales_doc_id");--> statement-breakpoint
CREATE INDEX "sales_posting_links_journal_idx" ON "sales_posting_links" USING btree ("journal_entry_id");