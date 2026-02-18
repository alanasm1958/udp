-- Migration: Add sessions table for token revocation support
-- Required by /api/auth/login and middleware session validation.

CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text,
	"ip_address" text
);
--> statement-breakpoint

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'sessions_tenant_id_tenants_id_fk'
	) THEN
		ALTER TABLE "sessions"
			ADD CONSTRAINT "sessions_tenant_id_tenants_id_fk"
			FOREIGN KEY ("tenant_id")
			REFERENCES "public"."tenants"("id")
			ON DELETE no action
			ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'sessions_user_id_users_id_fk'
	) THEN
		ALTER TABLE "sessions"
			ADD CONSTRAINT "sessions_user_id_users_id_fk"
			FOREIGN KEY ("user_id")
			REFERENCES "public"."users"("id")
			ON DELETE no action
			ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_sessions_user_id" ON "sessions" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_sessions_token_hash" ON "sessions" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sessions_expires_at" ON "sessions" USING btree ("expires_at");
