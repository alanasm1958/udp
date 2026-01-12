-- ============================================================================
-- GRC MODULE - REQUIREMENTS-DRIVEN SCHEMA
-- ============================================================================
-- Philosophy: Requirements are the source of truth. Tasks and alerts are 
-- linked to requirements, not independent. AI interprets only, never makes 
-- irreversible decisions. All closures are deterministic.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. BUSINESS PROFILE
-- ----------------------------------------------------------------------------
-- Captures legal, operational, and activity details for compliance assessment

CREATE TABLE business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Legal Identity
  legal_name VARCHAR(500) NOT NULL,
  trade_name VARCHAR(500),
  legal_structure VARCHAR(100), -- LLC, Corporation, Partnership, Sole Proprietor
  incorporation_date DATE,
  jurisdiction VARCHAR(100), -- State/Country of incorporation
  tax_id VARCHAR(100),
  
  -- Operational Details
  primary_industry VARCHAR(200),
  naics_codes TEXT[], -- Array of NAICS codes
  business_description TEXT,
  annual_revenue DECIMAL(15,2),
  employee_count INTEGER,
  
  -- Locations
  headquarters_address JSONB, -- {street, city, state, zip, country}
  operating_locations JSONB[], -- Array of location objects
  
  -- Activities
  business_activities TEXT[], -- e.g., ["manufacturing", "retail", "import/export"]
  licenses_held TEXT[], -- Current licenses
  regulated_activities TEXT[], -- Activities requiring special compliance
  
  -- Metadata
  ai_analysis JSONB, -- AI-generated insights and classification
  confidence_score DECIMAL(3,2), -- AI confidence in classification
  last_analyzed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE INDEX idx_business_profiles_tenant ON business_profiles(tenant_id);

-- ----------------------------------------------------------------------------
-- 2. REQUIREMENTS (Source of Truth)
-- ----------------------------------------------------------------------------
-- Represents a compliance need (registration, filing, licensing, etc.)

CREATE TABLE grc_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Identification
  requirement_code VARCHAR(100) NOT NULL, -- e.g., "TX-SALES-TAX-REG", "FED-EIN"
  title VARCHAR(500) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL, -- tax, labor, licensing, environmental, data_privacy, financial
  
  -- Applicability Rules
  applies_to_jurisdictions TEXT[], -- ["US-TX", "US-CA"]
  applies_to_industries TEXT[], -- NAICS codes or industry names
  applies_to_activities TEXT[], -- ["import", "data_processing", "food_service"]
  applies_to_structure TEXT[], -- ["corporation", "llc"]
  threshold_rules JSONB, -- Revenue, employee count, or other triggers
  
  -- Status & Risk
  status VARCHAR(50) NOT NULL DEFAULT 'unknown', -- satisfied, unsatisfied, at_risk, unknown
  risk_level VARCHAR(50) NOT NULL DEFAULT 'medium', -- low, medium, high, critical
  priority INTEGER DEFAULT 5, -- 1-10, lower is higher priority
  
  -- Closure Criteria (Deterministic)
  closure_criteria JSONB NOT NULL, -- Required fields, documents, validity rules
  -- Example: {
  --   "required_documents": ["tax_registration_certificate"],
  --   "required_fields": ["tax_id", "registration_date"],
  --   "validity_rules": {
  --     "expiration_check": true,
  --     "renewal_days_before": 30
  --   }
  -- }
  
  -- Evidence
  evidence_documents UUID[], -- Array of document IDs
  evidence_data JSONB, -- Structured data (dates, numbers, IDs)
  evidence_updated_at TIMESTAMPTZ,
  
  -- AI Narrative
  ai_explanation TEXT, -- AI-generated explanation of requirement
  ai_interpretation JSONB, -- Structured AI findings
  ai_confidence DECIMAL(3,2),
  
  -- Compliance Tracking
  satisfied_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- For renewable requirements
  next_action_due DATE,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  
  UNIQUE(tenant_id, requirement_code)
);

CREATE INDEX idx_grc_requirements_tenant ON grc_requirements(tenant_id);
CREATE INDEX idx_grc_requirements_status ON grc_requirements(tenant_id, status);
CREATE INDEX idx_grc_requirements_risk ON grc_requirements(tenant_id, risk_level);
CREATE INDEX idx_grc_requirements_category ON grc_requirements(tenant_id, category);

-- ----------------------------------------------------------------------------
-- 3. REQUIREMENT EVALUATION HISTORY
-- ----------------------------------------------------------------------------
-- Tracks each evaluation of a requirement

CREATE TABLE grc_requirement_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id UUID NOT NULL REFERENCES grc_requirements(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Evaluation Context
  triggered_by VARCHAR(100), -- user_input, document_upload, scheduled, manual
  trigger_source_id UUID, -- ID of task, document, or user that triggered
  
  -- Input State
  business_profile_snapshot JSONB, -- Snapshot of business profile at evaluation time
  evidence_snapshot JSONB, -- Snapshot of evidence at evaluation time
  
  -- AI Analysis
  ai_findings JSONB, -- Structured findings from AI
  ai_explanation TEXT, -- Narrative explanation
  ai_confidence DECIMAL(3,2),
  
  -- Deterministic Outcome
  previous_status VARCHAR(50),
  new_status VARCHAR(50),
  previous_risk_level VARCHAR(50),
  new_risk_level VARCHAR(50),
  closure_check_passed BOOLEAN,
  closure_check_details JSONB, -- Details of what passed/failed
  
  -- Metadata
  evaluated_at TIMESTAMPTZ DEFAULT NOW(),
  evaluated_by UUID REFERENCES users(id)
);

CREATE INDEX idx_grc_evaluations_requirement ON grc_requirement_evaluations(requirement_id);
CREATE INDEX idx_grc_evaluations_tenant ON grc_requirement_evaluations(tenant_id);

-- ----------------------------------------------------------------------------
-- 4. TASKS (Linked to Requirements)
-- ----------------------------------------------------------------------------
-- Human actions to satisfy requirements

CREATE TABLE grc_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  requirement_id UUID NOT NULL REFERENCES grc_requirements(id) ON DELETE CASCADE,
  
  -- Task Details
  title VARCHAR(500) NOT NULL,
  description TEXT,
  action_type VARCHAR(100), -- register, file, renew, upload_document, provide_info
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'open', -- open, blocked, completed
  blocked_reason TEXT,
  
  -- Assignment
  assigned_to UUID REFERENCES users(id),
  due_date DATE,
  
  -- Evidence & Feedback
  completion_evidence JSONB, -- User-provided completion details
  uploaded_documents UUID[], -- Document IDs
  user_feedback TEXT,
  
  -- Completion (Deterministic)
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id),
  auto_closed BOOLEAN DEFAULT false, -- true if system closed based on requirement
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_grc_tasks_tenant ON grc_tasks(tenant_id);
CREATE INDEX idx_grc_tasks_requirement ON grc_tasks(requirement_id);
CREATE INDEX idx_grc_tasks_status ON grc_tasks(tenant_id, status);
CREATE INDEX idx_grc_tasks_assigned ON grc_tasks(assigned_to) WHERE assigned_to IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 5. ALERTS (Linked to Requirements)
-- ----------------------------------------------------------------------------
-- Signals risk, urgency, or incomplete requirement

CREATE TABLE grc_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  requirement_id UUID NOT NULL REFERENCES grc_requirements(id) ON DELETE CASCADE,
  
  -- Alert Details
  title VARCHAR(500) NOT NULL,
  message TEXT,
  alert_type VARCHAR(100), -- deadline_approaching, requirement_unsatisfied, risk_elevated, renewal_needed
  severity VARCHAR(50) NOT NULL, -- info, warning, critical
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, resolved
  
  -- Resolution (Automatic)
  resolved_at TIMESTAMPTZ,
  auto_resolved BOOLEAN DEFAULT false, -- true if system resolved based on requirement
  resolution_reason TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ -- Alert auto-dismisses after this date
);

CREATE INDEX idx_grc_alerts_tenant ON grc_alerts(tenant_id);
CREATE INDEX idx_grc_alerts_requirement ON grc_alerts(requirement_id);
CREATE INDEX idx_grc_alerts_status ON grc_alerts(tenant_id, status);
CREATE INDEX idx_grc_alerts_severity ON grc_alerts(tenant_id, severity);

-- ----------------------------------------------------------------------------
-- 6. DOCUMENTS (Evidence)
-- ----------------------------------------------------------------------------
-- Links to the existing documents table

CREATE TABLE grc_document_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  requirement_id UUID NOT NULL REFERENCES grc_requirements(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  
  -- Classification
  document_type VARCHAR(100), -- certificate, registration, license, filing, correspondence
  validity_start DATE,
  validity_end DATE,
  
  -- AI Analysis
  ai_extracted_data JSONB, -- Structured data extracted from document
  ai_confidence DECIMAL(3,2),
  
  -- Metadata
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by UUID REFERENCES users(id),
  
  UNIQUE(requirement_id, document_id)
);

CREATE INDEX idx_grc_doc_links_requirement ON grc_document_links(requirement_id);
CREATE INDEX idx_grc_doc_links_tenant ON grc_document_links(tenant_id);

-- ----------------------------------------------------------------------------
-- 7. AUDIT HISTORY (Compliance Actions)
-- ----------------------------------------------------------------------------
-- Detailed audit trail for compliance activities

CREATE TABLE grc_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Event Details
  event_type VARCHAR(100) NOT NULL, -- requirement_created, status_changed, task_completed, document_uploaded
  entity_type VARCHAR(100) NOT NULL, -- requirement, task, alert, document
  entity_id UUID NOT NULL,
  
  -- Changes
  old_values JSONB,
  new_values JSONB,
  
  -- Context
  actor_id UUID REFERENCES users(id),
  actor_type VARCHAR(50), -- user, system, ai
  reason TEXT,
  
  -- Metadata
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_grc_audit_tenant ON grc_audit_log(tenant_id);
CREATE INDEX idx_grc_audit_entity ON grc_audit_log(entity_type, entity_id);
CREATE INDEX idx_grc_audit_occurred ON grc_audit_log(occurred_at DESC);

-- ----------------------------------------------------------------------------
-- 8. TAX FILING HISTORY
-- ----------------------------------------------------------------------------
-- Dedicated table for tax filings (high compliance importance)

CREATE TABLE grc_tax_filings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  requirement_id UUID REFERENCES grc_requirements(id),
  
  -- Filing Details
  filing_type VARCHAR(100) NOT NULL, -- income_tax, sales_tax, payroll_tax, property_tax
  jurisdiction VARCHAR(100) NOT NULL, -- Federal, State, Local
  tax_year INTEGER,
  tax_period VARCHAR(50), -- Q1, Q2, Q3, Q4, Annual, Monthly
  
  -- Amounts
  tax_liability DECIMAL(15,2),
  tax_paid DECIMAL(15,2),
  penalties DECIMAL(15,2),
  interest DECIMAL(15,2),
  
  -- Dates
  due_date DATE NOT NULL,
  filed_date DATE,
  paid_date DATE,
  
  -- Status
  status VARCHAR(50) NOT NULL, -- pending, filed, paid, overdue, amended
  
  -- Evidence
  filing_documents UUID[], -- Array of document IDs
  payment_reference VARCHAR(200),
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_grc_tax_filings_tenant ON grc_tax_filings(tenant_id);
CREATE INDEX idx_grc_tax_filings_requirement ON grc_tax_filings(requirement_id);
CREATE INDEX idx_grc_tax_filings_type ON grc_tax_filings(tenant_id, filing_type);
CREATE INDEX idx_grc_tax_filings_status ON grc_tax_filings(tenant_id, status);

-- ----------------------------------------------------------------------------
-- 9. REGULATORY LICENSES & PERMITS
-- ----------------------------------------------------------------------------

CREATE TABLE grc_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  requirement_id UUID REFERENCES grc_requirements(id),
  
  -- License Details
  license_type VARCHAR(200) NOT NULL, -- business_license, professional_license, environmental_permit
  license_number VARCHAR(200),
  issuing_authority VARCHAR(200) NOT NULL,
  jurisdiction VARCHAR(100),
  
  -- Validity
  issue_date DATE NOT NULL,
  expiration_date DATE,
  renewal_frequency VARCHAR(50), -- annual, biennial, never
  
  -- Status
  status VARCHAR(50) NOT NULL, -- active, expired, suspended, pending_renewal
  
  -- Documents
  license_documents UUID[],
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_grc_licenses_tenant ON grc_licenses(tenant_id);
CREATE INDEX idx_grc_licenses_requirement ON grc_licenses(requirement_id);
CREATE INDEX idx_grc_licenses_status ON grc_licenses(tenant_id, status);

-- ----------------------------------------------------------------------------
-- 10. COMPLIANCE CALENDAR
-- ----------------------------------------------------------------------------
-- Scheduled compliance events

CREATE TABLE grc_compliance_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  requirement_id UUID REFERENCES grc_requirements(id),
  
  -- Event Details
  event_type VARCHAR(100) NOT NULL, -- filing_due, renewal_due, inspection_scheduled, report_due
  title VARCHAR(500) NOT NULL,
  description TEXT,
  
  -- Dates
  due_date DATE NOT NULL,
  reminder_date DATE,
  completed_date DATE,
  
  -- Recurrence
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern VARCHAR(50), -- annual, quarterly, monthly, custom
  
  -- Status
  status VARCHAR(50) NOT NULL, -- upcoming, overdue, completed, cancelled
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_grc_calendar_tenant ON grc_compliance_calendar(tenant_id);
CREATE INDEX idx_grc_calendar_due ON grc_compliance_calendar(due_date);

-- ============================================================================
-- VIEWS FOR ANALYTICS
-- ============================================================================

-- Overall Compliance Score
CREATE VIEW grc_compliance_metrics AS
SELECT 
  tenant_id,
  COUNT(*) FILTER (WHERE status = 'satisfied') AS satisfied_count,
  COUNT(*) FILTER (WHERE status = 'unsatisfied') AS unsatisfied_count,
  COUNT(*) FILTER (WHERE status = 'at_risk') AS at_risk_count,
  COUNT(*) FILTER (WHERE status = 'unknown') AS unknown_count,
  COUNT(*) FILTER (WHERE risk_level = 'critical') AS critical_risk_count,
  COUNT(*) FILTER (WHERE risk_level = 'high') AS high_risk_count,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'satisfied')::DECIMAL / NULLIF(COUNT(*), 0) * 100, 
    1
  ) AS compliance_percentage
FROM grc_requirements
WHERE is_active = true
GROUP BY tenant_id;

-- Upcoming Deadlines
CREATE VIEW grc_upcoming_deadlines AS
SELECT
  r.tenant_id,
  r.id AS requirement_id,
  r.title,
  r.next_action_due,
  r.risk_level,
  CASE 
    WHEN r.next_action_due < CURRENT_DATE THEN 'overdue'
    WHEN r.next_action_due <= CURRENT_DATE + INTERVAL '7 days' THEN 'this_week'
    WHEN r.next_action_due <= CURRENT_DATE + INTERVAL '30 days' THEN 'this_month'
    ELSE 'future'
  END AS urgency
FROM grc_requirements r
WHERE r.is_active = true
  AND r.next_action_due IS NOT NULL
  AND r.status != 'satisfied'
ORDER BY r.next_action_due;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to evaluate requirement and auto-close tasks/alerts
CREATE OR REPLACE FUNCTION evaluate_requirement_closure(req_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  req_record RECORD;
  criteria JSONB;
  passes BOOLEAN := true;
  required_docs TEXT[];
  required_fields TEXT[];
  doc_id UUID;
  field_name TEXT;
BEGIN
  -- Get requirement
  SELECT * INTO req_record FROM grc_requirements WHERE id = req_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  criteria := req_record.closure_criteria;
  
  -- Check required documents
  IF criteria ? 'required_documents' THEN
    required_docs := ARRAY(SELECT jsonb_array_elements_text(criteria->'required_documents'));
    
    FOREACH doc_id IN ARRAY required_docs LOOP
      IF NOT EXISTS (
        SELECT 1 FROM grc_document_links 
        WHERE requirement_id = req_id 
        AND document_type = doc_id::TEXT
      ) THEN
        passes := false;
        EXIT;
      END IF;
    END LOOP;
  END IF;
  
  -- Check required fields
  IF passes AND criteria ? 'required_fields' THEN
    required_fields := ARRAY(SELECT jsonb_array_elements_text(criteria->'required_fields'));
    
    FOREACH field_name IN ARRAY required_fields LOOP
      IF req_record.evidence_data IS NULL OR NOT (req_record.evidence_data ? field_name) THEN
        passes := false;
        EXIT;
      END IF;
    END LOOP;
  END IF;
  
  -- If passes, update requirement and close linked tasks/alerts
  IF passes THEN
    UPDATE grc_requirements 
    SET status = 'satisfied',
        satisfied_at = NOW(),
        updated_at = NOW()
    WHERE id = req_id;
    
    UPDATE grc_tasks
    SET status = 'completed',
        completed_at = NOW(),
        auto_closed = true,
        updated_at = NOW()
    WHERE requirement_id = req_id
      AND status != 'completed';
    
    UPDATE grc_alerts
    SET status = 'resolved',
        resolved_at = NOW(),
        auto_resolved = true,
        resolution_reason = 'Requirement satisfied'
    WHERE requirement_id = req_id
      AND status = 'active';
  END IF;
  
  RETURN passes;
END;
$$ LANGUAGE plpgsql;

-- Trigger to re-evaluate on evidence update
CREATE OR REPLACE FUNCTION trigger_requirement_evaluation()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM evaluate_requirement_closure(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_requirement_evidence_update
AFTER UPDATE OF evidence_data, evidence_documents
ON grc_requirements
FOR EACH ROW
EXECUTE FUNCTION trigger_requirement_evaluation();
