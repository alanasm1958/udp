-- Migration: Leave Management
-- Created: 2026-01-10
-- Phase 5 of HR & People Implementation

-- Leave Types (vacation, sick, personal, etc.)
CREATE TABLE IF NOT EXISTS leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  accrual_type TEXT NOT NULL DEFAULT 'manual' CHECK (accrual_type IN ('manual', 'monthly', 'annual', 'per_period')),
  default_annual_allowance NUMERIC(6,2),
  max_carryover_days NUMERIC(6,2),
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  is_paid BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_leave_types_tenant ON leave_types(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leave_types_active ON leave_types(tenant_id, is_active);

-- Leave Requests
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  leave_type_id UUID NOT NULL REFERENCES leave_types(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_requested NUMERIC(5,2) NOT NULL,
  half_day_start BOOLEAN DEFAULT false, -- true if starts at noon
  half_day_end BOOLEAN DEFAULT false,   -- true if ends at noon
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'taken')),
  approved_by_user_id UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  affects_payroll BOOLEAN DEFAULT true,
  notes TEXT,
  created_by_actor_id UUID REFERENCES actors(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_tenant ON leave_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_pending ON leave_requests(tenant_id) WHERE status = 'pending';

-- Leave Balance Adjustments (manual adjustments to balances)
CREATE TABLE IF NOT EXISTS leave_balance_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  leave_type_id UUID NOT NULL REFERENCES leave_types(id),
  adjustment_date DATE NOT NULL,
  days_adjusted NUMERIC(6,2) NOT NULL, -- positive for add, negative for deduct
  reason TEXT NOT NULL,
  adjusted_by_actor_id UUID REFERENCES actors(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_adjustments_employee ON leave_balance_adjustments(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_adjustments_type ON leave_balance_adjustments(leave_type_id);
