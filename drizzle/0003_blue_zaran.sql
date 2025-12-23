CREATE TABLE "posting_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"transaction_set_id" uuid NOT NULL,
	"status" text DEFAULT 'started' NOT NULL,
	"journal_entry_id" uuid,
	"started_by_actor_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"error" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posting_runs" ADD CONSTRAINT "posting_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posting_runs" ADD CONSTRAINT "posting_runs_transaction_set_id_transaction_sets_id_fk" FOREIGN KEY ("transaction_set_id") REFERENCES "public"."transaction_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posting_runs" ADD CONSTRAINT "posting_runs_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posting_runs" ADD CONSTRAINT "posting_runs_started_by_actor_id_actors_id_fk" FOREIGN KEY ("started_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "posting_runs_active_uniq" ON "posting_runs" USING btree ("tenant_id","transaction_set_id");