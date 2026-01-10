-- Migration: Performance Management Tables
-- Created: 2026-01-10
-- Phase 3 of HR & People Implementation

-- Performance cycles (quarterly, semi-annual, annual reviews)
CREATE TABLE IF NOT EXISTS performance_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('quarterly', 'semi_annual', 'annual', 'custom')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  due_date DATE NOT NULL,
  assigned_to_role TEXT CHECK (assigned_to_role IN ('hr', 'manager', 'owner')),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
  notes TEXT,
  created_by_actor_id UUID REFERENCES actors(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_perf_cycles_tenant ON performance_cycles(tenant_id);
CREATE INDEX idx_perf_cycles_status ON performance_cycles(tenant_id, status);
CREATE INDEX idx_perf_cycles_dates ON performance_cycles(tenant_id, period_start, period_end);

-- Performance reviews (individual review records)
CREATE TABLE IF NOT EXISTS performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  cycle_id UUID NOT NULL REFERENCES performance_cycles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  reviewer_employee_id UUID REFERENCES employees(id),
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'submitted', 'approved', 'cancelled')),
  overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
  strengths TEXT,
  areas_for_improvement TEXT,
  goals_for_next_period TEXT,
  manager_comments TEXT,
  employee_comments TEXT,
  completed_at TIMESTAMPTZ,
  approved_by_actor_id UUID REFERENCES actors(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cycle_id, employee_id)
);

CREATE INDEX idx_perf_reviews_cycle ON performance_reviews(cycle_id);
CREATE INDEX idx_perf_reviews_employee ON performance_reviews(employee_id);
CREATE INDEX idx_perf_reviews_reviewer ON performance_reviews(reviewer_employee_id);
CREATE INDEX idx_perf_reviews_status ON performance_reviews(tenant_id, status);

-- Performance review ratings (detailed ratings by category)
CREATE TABLE IF NOT EXISTS performance_review_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  review_id UUID NOT NULL REFERENCES performance_reviews(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- 'job_knowledge', 'quality_of_work', 'communication', 'teamwork', 'initiative', 'attendance', 'custom'
  category_label TEXT NOT NULL, -- Display name for custom categories
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  weight NUMERIC(5,2) DEFAULT 1.0, -- For weighted averages
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_perf_ratings_review ON performance_review_ratings(review_id);

-- Performance goals (optional goal tracking within reviews)
CREATE TABLE IF NOT EXISTS performance_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  cycle_id UUID REFERENCES performance_cycles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'deferred', 'cancelled')),
  progress_percent INTEGER DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  completed_at TIMESTAMPTZ,
  created_by_actor_id UUID REFERENCES actors(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_perf_goals_employee ON performance_goals(employee_id);
CREATE INDEX idx_perf_goals_cycle ON performance_goals(cycle_id);
CREATE INDEX idx_perf_goals_status ON performance_goals(tenant_id, status);
