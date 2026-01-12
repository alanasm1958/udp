CREATE TYPE "public"."ai_task_status" AS ENUM('pending', 'in_review', 'approved', 'rejected', 'auto_resolved', 'expired');--> statement-breakpoint
CREATE TYPE "public"."ai_task_type" AS ENUM('link_person_to_user', 'merge_duplicate_people', 'complete_quick_add', 'approve_purchase_variance', 'low_stock_reorder', 'service_job_unassigned', 'service_job_overdue', 'supplier_delay_impact', 'review_substitution', 'landed_cost_allocation');--> statement-breakpoint
CREATE TYPE "public"."contact_channel" AS ENUM('whatsapp', 'email', 'phone', 'sms');--> statement-breakpoint
CREATE TYPE "public"."item_type" AS ENUM('product', 'service', 'consumable', 'asset');--> statement-breakpoint
CREATE TYPE "public"."person_type" AS ENUM('staff', 'contractor', 'supplier_contact', 'sales_rep', 'service_provider', 'partner_contact', 'customer_contact');--> statement-breakpoint
CREATE TYPE "public"."service_job_status" AS ENUM('pending', 'assigned', 'acknowledged', 'in_progress', 'delivered', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "ai_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"task_type" "ai_task_type" NOT NULL,
	"status" "ai_task_status" DEFAULT 'pending' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"reasoning" text,
	"confidence_score" numeric(5, 4),
	"primary_entity_type" text,
	"primary_entity_id" uuid,
	"secondary_entity_type" text,
	"secondary_entity_id" uuid,
	"suggested_action" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"assigned_to_user_id" uuid,
	"owner_role_name" text,
	"priority" text DEFAULT 'normal' NOT NULL,
	"due_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"resolved_by_actor_id" uuid,
	"resolved_at" timestamp with time zone,
	"resolution_action" text,
	"resolution_notes" text,
	"trigger_hash" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"movement_id" uuid NOT NULL,
	"adjustment_type" text NOT NULL,
	"reason" text NOT NULL,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"approved_by_actor_id" uuid,
	"approved_at" timestamp with time zone,
	"document_id" uuid,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_identifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"identifier_type" text NOT NULL,
	"identifier_value" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" "item_type" NOT NULL,
	"sku" text,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"category_id" uuid,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"default_sales_price" numeric(18, 6),
	"default_purchase_cost" numeric(18, 6),
	"tax_category_id" uuid,
	"default_uom_id" uuid,
	"track_inventory" boolean DEFAULT false NOT NULL,
	"reorder_point" numeric(18, 6),
	"reorder_quantity" numeric(18, 6),
	"preferred_vendor_party_id" uuid,
	"default_notification_channel" text,
	"notification_fallback_order" jsonb DEFAULT '["whatsapp","email"]'::jsonb,
	"requires_acknowledgement" boolean DEFAULT true NOT NULL,
	"acknowledgement_timeout_hours" integer DEFAULT 24,
	"notify_all_assignees" boolean DEFAULT false NOT NULL,
	"estimated_hours" numeric(10, 2),
	"fixed_cost" numeric(18, 6),
	"expense_category_code" text,
	"asset_category_code" text,
	"depreciation_method" text,
	"useful_life_months" integer,
	"costing_method" text DEFAULT 'weighted_average',
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landed_cost_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"landed_cost_id" uuid NOT NULL,
	"purchase_doc_line_id" uuid NOT NULL,
	"allocated_amount" numeric(18, 6) NOT NULL,
	"allocation_percentage" numeric(10, 6),
	"unit_cost_impact" numeric(18, 6),
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landed_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"purchase_doc_id" uuid NOT NULL,
	"cost_type" text NOT NULL,
	"description" text,
	"amount" numeric(18, 6) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"exchange_rate" numeric(18, 10) DEFAULT '1',
	"allocation_method" text DEFAULT 'by_value' NOT NULL,
	"is_allocated" boolean DEFAULT false NOT NULL,
	"allocated_at" timestamp with time zone,
	"vendor_party_id" uuid,
	"reference_number" text,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"display_name" text,
	"types" jsonb DEFAULT '["staff"]'::jsonb NOT NULL,
	"primary_email" text,
	"secondary_emails" jsonb DEFAULT '[]'::jsonb,
	"primary_phone" text,
	"secondary_phones" jsonb DEFAULT '[]'::jsonb,
	"whatsapp_number" text,
	"preferred_channel" "contact_channel" DEFAULT 'whatsapp',
	"channel_fallback_order" jsonb DEFAULT '["whatsapp","email","phone"]'::jsonb,
	"linked_party_id" uuid,
	"linked_user_id" uuid,
	"job_title" text,
	"department_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"is_quick_add" boolean DEFAULT false NOT NULL,
	"quick_add_completed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_receipt_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"purchase_receipt_id" uuid NOT NULL,
	"quantity_accepted" numeric(18, 6) NOT NULL,
	"quantity_damaged" numeric(18, 6) DEFAULT '0',
	"quantity_rejected" numeric(18, 6) DEFAULT '0',
	"damage_reason" text,
	"rejection_reason" text,
	"is_substitution" boolean DEFAULT false NOT NULL,
	"substituted_item_id" uuid,
	"substitution_approved" boolean,
	"substitution_approved_by_actor_id" uuid,
	"backorder_quantity" numeric(18, 6) DEFAULT '0',
	"expected_backorder_date" date,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_job_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"service_job_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"role" text,
	"notified_at" timestamp with time zone,
	"notification_channel" text,
	"notification_status" text,
	"notification_failure_reason" text,
	"acknowledged_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"removed_at" timestamp with time zone,
	"removal_reason" text,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_job_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"service_job_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"person_id" uuid,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actor_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sales_doc_id" uuid,
	"sales_doc_line_id" uuid,
	"item_id" uuid NOT NULL,
	"customer_party_id" uuid,
	"customer_contact_person_id" uuid,
	"job_number" text NOT NULL,
	"description" text,
	"quantity" numeric(18, 6) DEFAULT '1' NOT NULL,
	"status" "service_job_status" DEFAULT 'pending' NOT NULL,
	"scheduled_date" date,
	"scheduled_time" text,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"completion_notes" text,
	"last_escalation_at" timestamp with time zone,
	"escalation_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"hourly_rate" numeric(18, 6),
	"fixed_rate" numeric(18, 6),
	"is_preferred" boolean DEFAULT false NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_resolved_by_actor_id_actors_id_fk" FOREIGN KEY ("resolved_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_movement_id_inventory_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."inventory_movements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_approved_by_actor_id_actors_id_fk" FOREIGN KEY ("approved_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_identifiers" ADD CONSTRAINT "item_identifiers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_identifiers" ADD CONSTRAINT "item_identifiers_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_identifiers" ADD CONSTRAINT "item_identifiers_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_tax_category_id_tax_categories_id_fk" FOREIGN KEY ("tax_category_id") REFERENCES "public"."tax_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_default_uom_id_uoms_id_fk" FOREIGN KEY ("default_uom_id") REFERENCES "public"."uoms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_preferred_vendor_party_id_parties_id_fk" FOREIGN KEY ("preferred_vendor_party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_cost_allocations" ADD CONSTRAINT "landed_cost_allocations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_cost_allocations" ADD CONSTRAINT "landed_cost_allocations_landed_cost_id_landed_costs_id_fk" FOREIGN KEY ("landed_cost_id") REFERENCES "public"."landed_costs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_cost_allocations" ADD CONSTRAINT "landed_cost_allocations_purchase_doc_line_id_purchase_doc_lines_id_fk" FOREIGN KEY ("purchase_doc_line_id") REFERENCES "public"."purchase_doc_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_cost_allocations" ADD CONSTRAINT "landed_cost_allocations_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_costs" ADD CONSTRAINT "landed_costs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_costs" ADD CONSTRAINT "landed_costs_purchase_doc_id_purchase_docs_id_fk" FOREIGN KEY ("purchase_doc_id") REFERENCES "public"."purchase_docs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_costs" ADD CONSTRAINT "landed_costs_vendor_party_id_parties_id_fk" FOREIGN KEY ("vendor_party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_costs" ADD CONSTRAINT "landed_costs_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_linked_party_id_parties_id_fk" FOREIGN KEY ("linked_party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_linked_user_id_users_id_fk" FOREIGN KEY ("linked_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipt_details" ADD CONSTRAINT "purchase_receipt_details_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipt_details" ADD CONSTRAINT "purchase_receipt_details_purchase_receipt_id_purchase_receipts_id_fk" FOREIGN KEY ("purchase_receipt_id") REFERENCES "public"."purchase_receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipt_details" ADD CONSTRAINT "purchase_receipt_details_substituted_item_id_items_id_fk" FOREIGN KEY ("substituted_item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipt_details" ADD CONSTRAINT "purchase_receipt_details_substitution_approved_by_actor_id_actors_id_fk" FOREIGN KEY ("substitution_approved_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipt_details" ADD CONSTRAINT "purchase_receipt_details_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_job_assignments" ADD CONSTRAINT "service_job_assignments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_job_assignments" ADD CONSTRAINT "service_job_assignments_service_job_id_service_jobs_id_fk" FOREIGN KEY ("service_job_id") REFERENCES "public"."service_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_job_assignments" ADD CONSTRAINT "service_job_assignments_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_job_assignments" ADD CONSTRAINT "service_job_assignments_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_job_events" ADD CONSTRAINT "service_job_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_job_events" ADD CONSTRAINT "service_job_events_service_job_id_service_jobs_id_fk" FOREIGN KEY ("service_job_id") REFERENCES "public"."service_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_job_events" ADD CONSTRAINT "service_job_events_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_job_events" ADD CONSTRAINT "service_job_events_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_sales_doc_id_sales_docs_id_fk" FOREIGN KEY ("sales_doc_id") REFERENCES "public"."sales_docs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_sales_doc_line_id_sales_doc_lines_id_fk" FOREIGN KEY ("sales_doc_line_id") REFERENCES "public"."sales_doc_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_customer_party_id_parties_id_fk" FOREIGN KEY ("customer_party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_customer_contact_person_id_people_id_fk" FOREIGN KEY ("customer_contact_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_providers" ADD CONSTRAINT "service_providers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_providers" ADD CONSTRAINT "service_providers_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_providers" ADD CONSTRAINT "service_providers_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_providers" ADD CONSTRAINT "service_providers_created_by_actor_id_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_tasks_tenant_status_idx" ON "ai_tasks" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "ai_tasks_tenant_type_idx" ON "ai_tasks" USING btree ("tenant_id","task_type");--> statement-breakpoint
CREATE INDEX "ai_tasks_tenant_assigned_idx" ON "ai_tasks" USING btree ("tenant_id","assigned_to_user_id");--> statement-breakpoint
CREATE INDEX "ai_tasks_tenant_priority_idx" ON "ai_tasks" USING btree ("tenant_id","priority","status");--> statement-breakpoint
CREATE INDEX "ai_tasks_trigger_hash_idx" ON "ai_tasks" USING btree ("tenant_id","trigger_hash");--> statement-breakpoint
CREATE INDEX "ai_tasks_tenant_due_idx" ON "ai_tasks" USING btree ("tenant_id","due_at");--> statement-breakpoint
CREATE INDEX "inventory_adjustments_tenant_movement_idx" ON "inventory_adjustments" USING btree ("tenant_id","movement_id");--> statement-breakpoint
CREATE INDEX "inventory_adjustments_tenant_type_idx" ON "inventory_adjustments" USING btree ("tenant_id","adjustment_type");--> statement-breakpoint
CREATE INDEX "item_identifiers_tenant_item_idx" ON "item_identifiers" USING btree ("tenant_id","item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "item_identifiers_tenant_type_value_uniq" ON "item_identifiers" USING btree ("tenant_id","identifier_type","identifier_value");--> statement-breakpoint
CREATE INDEX "items_tenant_type_idx" ON "items" USING btree ("tenant_id","type");--> statement-breakpoint
CREATE INDEX "items_tenant_status_idx" ON "items" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "items_tenant_name_idx" ON "items" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "items_tenant_category_idx" ON "items" USING btree ("tenant_id","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "items_tenant_sku_uniq" ON "items" USING btree ("tenant_id","sku") WHERE sku IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "landed_cost_allocations_uniq" ON "landed_cost_allocations" USING btree ("tenant_id","landed_cost_id","purchase_doc_line_id");--> statement-breakpoint
CREATE INDEX "landed_cost_allocations_tenant_cost_idx" ON "landed_cost_allocations" USING btree ("tenant_id","landed_cost_id");--> statement-breakpoint
CREATE INDEX "landed_cost_allocations_tenant_line_idx" ON "landed_cost_allocations" USING btree ("tenant_id","purchase_doc_line_id");--> statement-breakpoint
CREATE INDEX "landed_costs_tenant_doc_idx" ON "landed_costs" USING btree ("tenant_id","purchase_doc_id");--> statement-breakpoint
CREATE INDEX "people_tenant_name_idx" ON "people" USING btree ("tenant_id","full_name");--> statement-breakpoint
CREATE INDEX "people_tenant_email_idx" ON "people" USING btree ("tenant_id","primary_email");--> statement-breakpoint
CREATE INDEX "people_tenant_phone_idx" ON "people" USING btree ("tenant_id","primary_phone");--> statement-breakpoint
CREATE INDEX "people_tenant_whatsapp_idx" ON "people" USING btree ("tenant_id","whatsapp_number");--> statement-breakpoint
CREATE INDEX "people_tenant_party_idx" ON "people" USING btree ("tenant_id","linked_party_id");--> statement-breakpoint
CREATE INDEX "people_tenant_user_idx" ON "people" USING btree ("tenant_id","linked_user_id");--> statement-breakpoint
CREATE INDEX "people_tenant_quick_add_idx" ON "people" USING btree ("tenant_id","is_quick_add");--> statement-breakpoint
CREATE INDEX "purchase_receipt_details_tenant_receipt_idx" ON "purchase_receipt_details" USING btree ("tenant_id","purchase_receipt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_job_assignments_uniq" ON "service_job_assignments" USING btree ("tenant_id","service_job_id","person_id");--> statement-breakpoint
CREATE INDEX "service_job_assignments_tenant_job_idx" ON "service_job_assignments" USING btree ("tenant_id","service_job_id");--> statement-breakpoint
CREATE INDEX "service_job_assignments_tenant_person_idx" ON "service_job_assignments" USING btree ("tenant_id","person_id");--> statement-breakpoint
CREATE INDEX "service_job_events_tenant_job_idx" ON "service_job_events" USING btree ("tenant_id","service_job_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "service_jobs_tenant_job_number_uniq" ON "service_jobs" USING btree ("tenant_id","job_number");--> statement-breakpoint
CREATE INDEX "service_jobs_tenant_status_idx" ON "service_jobs" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "service_jobs_tenant_item_idx" ON "service_jobs" USING btree ("tenant_id","item_id");--> statement-breakpoint
CREATE INDEX "service_jobs_tenant_sales_doc_idx" ON "service_jobs" USING btree ("tenant_id","sales_doc_id");--> statement-breakpoint
CREATE INDEX "service_jobs_tenant_due_idx" ON "service_jobs" USING btree ("tenant_id","due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "service_providers_uniq" ON "service_providers" USING btree ("tenant_id","item_id","person_id");--> statement-breakpoint
CREATE INDEX "service_providers_tenant_item_idx" ON "service_providers" USING btree ("tenant_id","item_id");--> statement-breakpoint
CREATE INDEX "service_providers_tenant_person_idx" ON "service_providers" USING btree ("tenant_id","person_id");