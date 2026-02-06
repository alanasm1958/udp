ALTER TABLE "document_links" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "deleted_at" timestamp with time zone;