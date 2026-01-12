-- ============================================================================
-- HR & PEOPLE MODULE - CLEAN SCHEMA
-- ============================================================================
-- Simple, focused schema for persons, payroll, and performance reviews

-- ============================================================================
-- PERSONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS hr_persons (
  id TEXT PRIMARY KEY DEFAULT ('person_' || gen_random_uuid()::text),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  
  -- Basic Information
  full_name TEXT NOT NULL,
  preferred_name TEXT,
  email TEXT,
  phone TEXT,
  
  -- Employment Details
  employment_type TEXT CHECK (employment_type IN ('staff', 'intern', 'part_time', 'contractor', 'consultant', 'other')),
  job_title TEXT,
  department TEXT,
  manager_id TEXT REFERENCES hr_persons(id),
  
  -- Dates
  hire_date DATE,
  end_date DATE,
  
  -- Personal Details
  date_of_birth DATE,
  nationality TEXT,
  gender TEXT,
  
  -- Address
  address_line_1 TEXT,
  address_line_2 TEXT,
  city TEXT,
  region TEXT,
  country TEXT,
  postal_code TEXT,
  
  -- Emergency Contact
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relationship TEXT,
  
  -- Banking (for payroll)
  bank_name TEXT,
  bank_account_number TEXT,
  bank_routing_number TEXT,
  
  -- Tax & Legal
  tax_id TEXT,
  social_security_number TEXT,
  work_permit_number TEXT,
  work_permit_expiry DATE,
  
  -- Compensation
  gross_salary DECIMAL(15,2),
  pay_frequency TEXT CHECK (pay_frequency IN ('weekly', 'biweekly', 'monthly', 'annual')),
  currency TEXT DEFAULT 'USD',
  
  -- Benefits & Deductions
  health_insurance BOOLEAN DEFAULT false,
  pension_contribution_percent DECIMAL(5,2),
  other_deductions JSONB DEFAULT '[]'::jsonb,
  
  -- Platform Access
  platform_user_id TEXT REFERENCES users(id),
  can_access_platform BOOLEAN DEFAULT false,
  platform_role TEXT,
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
  
  -- Notes
  notes TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);

CREATE INDEX idx_hr_persons_tenant ON hr_persons(tenant_id);
CREATE INDEX idx_hr_persons_status ON hr_persons(tenant_id, status);
CREATE INDEX idx_hr_persons_type ON hr_persons(tenant_id, employment_type);
CREATE INDEX idx_hr_persons_manager ON hr_persons(manager_id);

-- ============================================================================
-- PAYROLL HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS hr_payroll_runs (
  id TEXT PRIMARY KEY DEFAULT ('payrun_' || gen_random_uuid()::text),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  
  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  pay_date DATE NOT NULL,
  
  -- Filters used
  employment_types TEXT[], -- Which types were included
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'posted_to_finance')),
  
  -- Financial Posting
  journal_entry_id TEXT REFERENCES journal_entries(id),
  posted_at TIMESTAMPTZ,
  posted_by TEXT,
  
  -- Metadata
  currency TEXT DEFAULT 'USD',
  total_gross DECIMAL(15,2) DEFAULT 0,
  total_net DECIMAL(15,2) DEFAULT 0,
  total_tax DECIMAL(15,2) DEFAULT 0,
  total_deductions DECIMAL(15,2) DEFAULT 0,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);

CREATE INDEX idx_hr_payroll_runs_tenant ON hr_payroll_runs(tenant_id);
CREATE INDEX idx_hr_payroll_runs_period ON hr_payroll_runs(tenant_id, period_start, period_end);
CREATE INDEX idx_hr_payroll_runs_status ON hr_payroll_runs(tenant_id, status);

-- ============================================================================
-- PAYROLL LINES (per person in a run)
-- ============================================================================

CREATE TABLE IF NOT EXISTS hr_payroll_lines (
  id TEXT PRIMARY KEY DEFAULT ('payline_' || gen_random_uuid()::text),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  payroll_run_id TEXT NOT NULL REFERENCES hr_payroll_runs(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES hr_persons(id),
  
  -- Person snapshot
  person_name TEXT NOT NULL,
  employment_type TEXT NOT NULL,
  
  -- Earnings
  gross_salary DECIMAL(15,2) DEFAULT 0,
  overtime DECIMAL(15,2) DEFAULT 0,
  bonus DECIMAL(15,2) DEFAULT 0,
  allowances DECIMAL(15,2) DEFAULT 0,
  
  -- Deductions
  income_tax DECIMAL(15,2) DEFAULT 0,
  social_security DECIMAL(15,2) DEFAULT 0,
  pension DECIMAL(15,2) DEFAULT 0,
  health_insurance DECIMAL(15,2) DEFAULT 0,
  other_deductions DECIMAL(15,2) DEFAULT 0,
  
  -- Totals
  total_gross DECIMAL(15,2) DEFAULT 0,
  total_deductions DECIMAL(15,2) DEFAULT 0,
  net_pay DECIMAL(15,2) DEFAULT 0,
  
  -- AI Compliance Check
  ai_analyzed BOOLEAN DEFAULT false,
  ai_suggestions JSONB,
  compliance_issues JSONB,
  
  -- Notes
  notes TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hr_payroll_lines_tenant ON hr_payroll_lines(tenant_id);
CREATE INDEX idx_hr_payroll_lines_run ON hr_payroll_lines(payroll_run_id);
CREATE INDEX idx_hr_payroll_lines_person ON hr_payroll_lines(person_id);

-- ============================================================================
-- PERFORMANCE REVIEWS
-- ============================================================================

CREATE TABLE IF NOT EXISTS hr_performance_reviews (
  id TEXT PRIMARY KEY DEFAULT ('review_' || gen_random_uuid()::text),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  
  -- Who is being reviewed
  person_id TEXT NOT NULL REFERENCES hr_persons(id),
  person_name TEXT NOT NULL,
  
  -- Who is reviewing
  reviewer_id TEXT REFERENCES users(id),
  reviewer_name TEXT,
  
  -- Period
  review_period_start DATE NOT NULL,
  review_period_end DATE NOT NULL,
  review_date DATE DEFAULT CURRENT_DATE,
  
  -- Review Content
  strengths TEXT,
  areas_for_improvement TEXT,
  goals_set TEXT,
  overall_rating TEXT CHECK (overall_rating IN ('outstanding', 'exceeds_expectations', 'meets_expectations', 'needs_improvement', 'unsatisfactory')),
  
  -- Comments
  reviewer_comments TEXT,
  employee_comments TEXT,
  
  -- Status & Acceptance
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'acknowledged', 'completed')),
  reviewer_accepted BOOLEAN DEFAULT false,
  reviewer_accepted_at TIMESTAMPTZ,
  employee_accepted BOOLEAN DEFAULT false,
  employee_accepted_at TIMESTAMPTZ,
  
  -- Locking (both must accept to lock)
  is_locked BOOLEAN GENERATED ALWAYS AS (reviewer_accepted AND employee_accepted) STORED,
  
  -- Notes
  private_notes TEXT, -- Only visible to reviewer and HR
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);

CREATE INDEX idx_hr_performance_reviews_tenant ON hr_performance_reviews(tenant_id);
CREATE INDEX idx_hr_performance_reviews_person ON hr_performance_reviews(person_id);
CREATE INDEX idx_hr_performance_reviews_status ON hr_performance_reviews(tenant_id, status);
CREATE INDEX idx_hr_performance_reviews_locked ON hr_performance_reviews(tenant_id, is_locked);

-- ============================================================================
-- VIEWS FOR ANALYTICS
-- ============================================================================

-- Active headcount by type
CREATE OR REPLACE VIEW hr_analytics_headcount AS
SELECT 
  tenant_id,
  employment_type,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE hire_date >= CURRENT_DATE - INTERVAL '30 days') as new_hires_last_30d
FROM hr_persons
WHERE status = 'active'
GROUP BY tenant_id, employment_type;

-- Payroll summary
CREATE OR REPLACE VIEW hr_analytics_payroll AS
SELECT 
  tenant_id,
  status,
  COUNT(*) as run_count,
  SUM(total_gross) as total_gross,
  SUM(total_net) as total_net,
  MAX(period_end) as last_period_end
FROM hr_payroll_runs
GROUP BY tenant_id, status;

-- Performance review status
CREATE OR REPLACE VIEW hr_analytics_performance AS
SELECT 
  tenant_id,
  status,
  COUNT(*) as review_count,
  COUNT(*) FILTER (WHERE is_locked = true) as locked_reviews
FROM hr_performance_reviews
GROUP BY tenant_id, status;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE hr_persons IS 'All persons in the organization - staff, interns, contractors, etc';
COMMENT ON TABLE hr_payroll_runs IS 'Payroll run headers - can be draft, confirmed, or posted to finance';
COMMENT ON TABLE hr_payroll_lines IS 'Individual person entries in a payroll run';
COMMENT ON TABLE hr_performance_reviews IS 'Performance reviews - locked only when both reviewer and employee accept';

COMMENT ON COLUMN hr_payroll_lines.ai_analyzed IS 'Whether AI has analyzed this line for compliance';
COMMENT ON COLUMN hr_payroll_lines.ai_suggestions IS 'AI suggestions for this payroll line';
COMMENT ON COLUMN hr_payroll_lines.compliance_issues IS 'Any compliance issues detected by AI';

COMMENT ON COLUMN hr_performance_reviews.is_locked IS 'Automatically true when both reviewer_accepted AND employee_accepted are true';
