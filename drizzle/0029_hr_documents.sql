-- Migration: HR Document Extensions
-- Created: 2026-01-10
-- Phase 4 of HR & People Implementation

-- Add HR-specific columns to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS expiry_alert_days INTEGER DEFAULT 30;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_category TEXT; -- 'id', 'contract', 'certificate', 'visa', 'license', 'policy', 'other'
ALTER TABLE documents ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending'; -- 'pending', 'verified', 'rejected', 'expired'
ALTER TABLE documents ADD COLUMN IF NOT EXISTS verified_by_user_id UUID REFERENCES users(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_documents_expiry ON documents(tenant_id, expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(tenant_id, document_category) WHERE document_category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_verification ON documents(tenant_id, verification_status);

-- Add constraint for verification status
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_verification_status_check;
ALTER TABLE documents ADD CONSTRAINT documents_verification_status_check
  CHECK (verification_status IS NULL OR verification_status IN ('pending', 'verified', 'rejected', 'expired'));

-- Add constraint for document category
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_category_check;
ALTER TABLE documents ADD CONSTRAINT documents_category_check
  CHECK (document_category IS NULL OR document_category IN ('id', 'contract', 'certificate', 'visa', 'license', 'policy', 'tax', 'other'));
