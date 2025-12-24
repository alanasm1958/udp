CREATE TABLE "sales_fulfillments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sales_doc_id" uuid NOT NULL,
	"sales_doc_line_id" uuid NOT NULL,
	"movement_id" uuid NOT NULL,
	"fulfillment_type" text NOT NULL,
	"quantity" numeric(18, 6) NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sales_fulfillments" ADD CONSTRAINT "sales_fulfillments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_fulfillments" ADD CONSTRAINT "sales_fulfillments_sales_doc_id_sales_docs_id_fk" FOREIGN KEY ("sales_doc_id") REFERENCES "public"."sales_docs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_fulfillments" ADD CONSTRAINT "sales_fulfillments_sales_doc_line_id_sales_doc_lines_id_fk" FOREIGN KEY ("sales_doc_line_id") REFERENCES "public"."sales_doc_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_fulfillments" ADD CONSTRAINT "sales_fulfillments_movement_id_inventory_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."inventory_movements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_fulfillments" ADD CONSTRAINT "sales_fulfillments_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sales_fulfillments_uniq" ON "sales_fulfillments" USING btree ("tenant_id","sales_doc_line_id","movement_id","fulfillment_type");--> statement-breakpoint
CREATE INDEX "sales_fulfillments_tenant_doc_idx" ON "sales_fulfillments" USING btree ("tenant_id","sales_doc_id");--> statement-breakpoint
CREATE INDEX "sales_fulfillments_tenant_line_idx" ON "sales_fulfillments" USING btree ("tenant_id","sales_doc_line_id");