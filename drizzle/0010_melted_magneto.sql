-- Layer 9B: Procurement Receiving Links
-- This migration represents the current state of purchase_receipts table
-- The table was created and modified via manual migrations to handle existing data

-- The following is the target state (already applied):
-- CREATE TYPE "public"."purchase_receipt_type" AS ENUM('receive', 'unreceive', 'return_to_vendor');
-- CREATE TABLE "purchase_receipts" (
--   "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
--   "tenant_id" uuid NOT NULL,
--   "purchase_doc_id" uuid NOT NULL,
--   "purchase_doc_line_id" uuid NOT NULL,
--   "movement_id" uuid NOT NULL,
--   "receipt_type" "purchase_receipt_type" NOT NULL,
--   "quantity" numeric(18, 6) NOT NULL,
--   "note" text,
--   "created_by_actor_id" uuid NOT NULL,
--   "created_at" timestamp with time zone DEFAULT now() NOT NULL
-- );
-- With indexes: purchase_receipts_uniq, purchase_receipts_tenant_idx, purchase_receipts_doc_idx,
--               purchase_receipts_line_idx, purchase_receipts_movement_idx

SELECT 1; -- No-op - schema already matches target state
