-- ============================================================================
-- HR & PEOPLE MODULE - DATABASE SCHEMA
-- ============================================================================
-- Comprehensive schema for people management, payroll, performance, and documents
-- following UDP platform conventions and multi-tenant design

-- ============================================================================
-- PEOPLE & EMPLOYMENT
-- ============================================================================

-- Core people records (extends existing people table)
-- ALTER TABLE people ADD COLUMN IF NOT EXISTS preferred_name TEXT;
-- ALTER TABLE people ADD COLUMN IF NOT EXISTS date_of_birth DATE;
-- ALTER TABLE people ADD COLUMN IF NOT EXISTS nationality TEXT;
-- ALTER TABLE people ADD COLUMN IF NOT EXISTS gender TEXT;
-- ALTER TABLE people ADD COLUMN IF NOT EXISTS whatsapp TEXT;
-- ALTER TABLE people ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT CHECK (preferred_contact_method IN ('email', 'phone', 'whatsapp'));

-- Contact addresses for people
CREATE TABLE IF NOT EXISTS people_addresses (
  id TEXT PRIMARY KEY DEFAULT ('addr_' || gen_random_uuid()::text),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  
  -- Address fields
  address_type TEXT NOT NULL DEFAULT 'primary' CHECK (address_type IN ('primary', 'secondary', 'emergency')),
  country TEXT,
  region TEXT,
  city TEXT,
  address_line_1 TEXT,
  address_line_2 TEXT,
  postal_code TEXT,
  
  is_current BOOLEAN DEFAULT true,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_people_addresses_tenant ON people_addresses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_people_addresses_person ON people_addresses(person_id);

-- Employment details (extends existing employees table)
-- ALTER TABLE employees ADD COLUMN IF NOT EXISTS person_type TEXT CHECK (person_type IN ('staff', 'intern', 'contractor', 'other'));
-- ALTER TABLE employees ADD COLUMN IF NOT EXISTS end_date DATE;
-- ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_location TEXT;
-- ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_remote BOOLEAN DEFAULT false;
-- ALTER TABLE employees ADD COLUMN IF NOT EXISTS notes TEXT;
-- ALTER TABLE employees ADD COLUMN IF NOT EXISTS tags TEXT[];
-- ALTER TABLE employees ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;
-- ALTER TABLE employees ADD COLUMN IF NOT EXISTS platform_user_id TEXT REFERENCES users(id);

-- Compensation history (enhanced)
-- ALTER TABLE compensation_records ADD COLUMN IF NOT EXISTS pay_type TEXT CHECK (pay_type IN ('salary', 'hourly', 'daily', 'fixed'));
-- ALTER TABLE compensation_records ADD COLUMN IF NOT EXISTS effective_from DATE;

-- ============================================================================
-- PAYROLL
-- ============================================================================

-- Payroll run header
CREATE TABLE IF NOT EXISTS payroll_runs_v2 (
  id TEXT PRIMARY KEY DEFAULT ('prun_' || gen_random_uuid()::text),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  
  -- Period info
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  pay_date DATE NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'voided')),
  
  -- Preload metadata
  preload_option TEXT CHECK (preload_option IN ('staff', 'interns', 'both', 'custom')),
  
  -- Posting link
  journal_entry_id TEXT REFERENCES journal_entries(id),
  posted_at TIMESTAMPTZ,
  posted_by TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_v2_tenant ON payroll_runs_v2(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_v2_period ON payroll_runs_v2(tenant_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_v2_status ON payroll_runs_v2(tenant_id, status);

-- Payroll run lines (employees in run)
CREATE TABLE IF NOT EXISTS payroll_run_lines (
  id TEXT PRIMARY KEY DEFAULT ('pline_' || gen_random_uuid()::text),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  payroll_run_id TEXT NOT NULL REFERENCES payroll_runs_v2(id) ON DELETE CASCADE,
  
  -- Employee
  employee_id TEXT NOT NULL REFERENCES employees(id),
  person_id TEXT NOT NULL REFERENCES people(id),
  
  -- Inclusion
  is_included BOOLEAN DEFAULT true,
  exclude_reason TEXT,
  
  -- Identity snapshot
  person_name TEXT NOT NULL,
  person_type TEXT,
  jurisdiction TEXT,
  
  -- Base pay
  base_pay DECIMAL(15,2) DEFAULT 0,
  base_pay_type TEXT, -- salary, hourly, etc
  
  -- Earnings (stored as JSONB array)
  allowances JSONB DEFAULT '[]'::jsonb,
  other_earnings JSONB DEFAULT '[]'::jsonb,
  
  -- Deductions & Taxes (stored as JSONB array)
  employee_taxes JSONB DEFAULT '[]'::jsonb,
  employee_deductions JSONB DEFAULT '[]'::jsonb,
  employer_contributions JSONB DEFAULT '[]'::jsonb,
  
  -- Calculated totals
  gross_pay DECIMAL(15,2) DEFAULT 0,
  total_deductions DECIMAL(15,2) DEFAULT 0,
  total_taxes DECIMAL(15,2) DEFAULT 0,
  net_pay DECIMAL(15,2) DEFAULT 0,
  total_employer_cost DECIMAL(15,2) DEFAULT 0,
  
  -- Notes
  row_notes TEXT,
  flags JSONB DEFAULT '{}'::jsonb,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_run_lines_tenant ON payroll_run_lines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payroll_run_lines_run ON payroll_run_lines(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_run_lines_employee ON payroll_run_lines(employee_id);

-- ============================================================================
-- PERFORMANCE REVIEWS
-- ============================================================================

CREATE TABLE IF NOT EXISTS performance_reviews_v2 (
  id TEXT PRIMARY KEY DEFAULT ('perf_' || gen_random_uuid()::text),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  
  -- Context
  employee_id TEXT NOT NULL REFERENCES employees(id),
  person_id TEXT NOT NULL REFERENCES people(id),
  reviewer_id TEXT REFERENCES users(id),
  
  period_type TEXT CHECK (period_type IN ('monthly', 'quarterly', 'annual', 'probation', 'project', 'other')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Guided sections
  strengths TEXT,
  strengths_examples TEXT,
  
  improvements TEXT,
  improvements_examples TEXT,
  
  fairness_constraints TEXT,
  fairness_support TEXT,
  fairness_outside_control TEXT,
  
  goals TEXT,
  goals_support_plan TEXT,
  follow_up_date DATE,
  
  -- Visibility
  visibility TEXT DEFAULT 'visible_to_employee' CHECK (visibility IN ('visible_to_employee', 'manager_only', 'hr_only')),
  employee_acknowledged_at TIMESTAMPTZ,
  private_notes TEXT,
  
  -- AI Outcome (locked once generated)
  ai_outcome_category TEXT CHECK (ai_outcome_category IN (
    'outstanding_contribution',
    'strong_performance', 
    'solid_on_track',
    'below_expectations',
    'critical_concerns'
  )),
  ai_outcome_reasons TEXT,
  ai_outcome_next_step TEXT,
  ai_outcome_generated_at TIMESTAMPTZ,
  ai_outcome_input_hash TEXT, -- Hash of input text to detect changes
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'acknowledged')),
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_performance_reviews_v2_tenant ON performance_reviews_v2(tenant_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_v2_employee ON performance_reviews_v2(employee_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_v2_period ON performance_reviews_v2(tenant_id, period_start, period_end);
CREATE UNIQUE INDEX IF NOT EXISTS idx_performance_reviews_v2_unique ON performance_reviews_v2(tenant_id, employee_id, period_start, period_end);

-- ============================================================================
-- DOCUMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS hr_documents (
  id TEXT PRIMARY KEY DEFAULT ('doc_' || gen_random_uuid()::text),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  
  -- Storage (external object storage)
  storage_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  checksum TEXT,
  
  -- Classification
  category TEXT CHECK (category IN (
    'contract',
    'id_proof',
    'qualification',
    'certification',
    'visa_work_permit',
    'insurance',
    'tax_form',
    'bank_details',
    'other'
  )),
  
  -- Expiry tracking
  expiry_date DATE,
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected', 'expired')),
  
  -- Metadata
  description TEXT,
  tags TEXT[],
  
  -- Audit
  uploaded_by TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  verified_by TEXT,
  verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_hr_documents_tenant ON hr_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hr_documents_category ON hr_documents(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_hr_documents_expiry ON hr_documents(tenant_id, expiry_date) WHERE expiry_date IS NOT NULL;

-- Document links to entities
CREATE TABLE IF NOT EXISTS hr_document_links (
  id TEXT PRIMARY KEY DEFAULT ('dlink_' || gen_random_uuid()::text),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  document_id TEXT NOT NULL REFERENCES hr_documents(id) ON DELETE CASCADE,
  
  -- Link to entity
  entity_type TEXT NOT NULL CHECK (entity_type IN ('person', 'employee', 'payroll_run', 'performance_review')),
  entity_id TEXT NOT NULL,
  
  -- Access control
  access_scope TEXT DEFAULT 'hr_only' CHECK (access_scope IN ('employee_self', 'manager', 'hr_only', 'public')),
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_hr_document_links_tenant ON hr_document_links(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hr_document_links_document ON hr_document_links(document_id);
CREATE INDEX IF NOT EXISTS idx_hr_document_links_entity ON hr_document_links(tenant_id, entity_type, entity_id);

-- ============================================================================
-- AUDIT & COMPLIANCE
-- ============================================================================

-- Comprehensive audit log for HR actions
CREATE TABLE IF NOT EXISTS hr_audit_log (
  id TEXT PRIMARY KEY DEFAULT ('audit_' || gen_random_uuid()::text),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  
  -- Who & When
  actor_id TEXT,
  actor_name TEXT,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- What
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  
  -- Before & After
  before_snapshot JSONB,
  after_snapshot JSONB,
  
  -- AI outcome tracking
  ai_outcome_snapshot JSONB,
  
  -- Metadata
  ip_address TEXT,
  user_agent TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_hr_audit_log_tenant ON hr_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hr_audit_log_entity ON hr_audit_log(tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_hr_audit_log_occurred ON hr_audit_log(tenant_id, occurred_at DESC);

-- ============================================================================
-- VIEWS FOR REPORTING
-- ============================================================================

-- Active headcount view
CREATE OR REPLACE VIEW hr_active_headcount AS
SELECT 
  e.tenant_id,
  COUNT(DISTINCT e.id) as total_active,
  COUNT(DISTINCT CASE WHEN e.person_type = 'staff' THEN e.id END) as active_staff,
  COUNT(DISTINCT CASE WHEN e.person_type = 'intern' THEN e.id END) as active_interns,
  COUNT(DISTINCT CASE WHEN e.person_type = 'contractor' THEN e.id END) as active_contractors
FROM employees e
JOIN people p ON p.id = e.person_id
WHERE p.status = 'active'
  AND (e.end_date IS NULL OR e.end_date >= CURRENT_DATE)
GROUP BY e.tenant_id;

-- Contract endings view
CREATE OR REPLACE VIEW hr_contract_endings AS
SELECT
  e.tenant_id,
  e.id as employee_id,
  e.person_id,
  p.first_name || ' ' || p.last_name as person_name,
  e.end_date,
  CURRENT_DATE - e.end_date as days_until_end,
  CASE
    WHEN e.end_date - CURRENT_DATE <= 1 THEN 'critical'
    WHEN e.end_date - CURRENT_DATE <= 7 THEN 'urgent'
    WHEN e.end_date - CURRENT_DATE <= 30 THEN 'upcoming'
  END as urgency
FROM employees e
JOIN people p ON p.id = e.person_id
WHERE e.end_date IS NOT NULL
  AND e.end_date >= CURRENT_DATE
  AND e.end_date <= CURRENT_DATE + INTERVAL '30 days'
  AND p.status = 'active';

COMMENT ON TABLE people_addresses IS 'Contact addresses for people';
COMMENT ON TABLE payroll_runs_v2 IS 'Payroll run headers - unified table for all employee types';
COMMENT ON TABLE payroll_run_lines IS 'Payroll run lines with embedded earnings/deductions as JSONB';
COMMENT ON TABLE performance_reviews_v2 IS 'Guided performance reviews with AI outcome generation';
COMMENT ON TABLE hr_documents IS 'Document metadata stored externally';
COMMENT ON TABLE hr_document_links IS 'Links documents to people, employees, reviews, etc';
COMMENT ON TABLE hr_audit_log IS 'Comprehensive audit trail for HR module';

