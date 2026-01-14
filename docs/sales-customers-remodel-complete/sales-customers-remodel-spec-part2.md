# Sales & Customers Module - Part 2: Technical Specification

## 8. Database Schema

### 8.1 Core People & Relationships

```sql
-- Universal people registry
CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  full_name TEXT NOT NULL,
  display_name TEXT, -- Optional nickname
  primary_email TEXT,
  primary_phone TEXT,
  photo_url TEXT,
  date_of_birth DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_actor_id UUID REFERENCES actors(id),
  
  -- Indexes
  CONSTRAINT people_tenant_email_unique UNIQUE(tenant_id, primary_email),
  INDEX idx_people_tenant (tenant_id),
  INDEX idx_people_email (tenant_id, primary_email),
  INDEX idx_people_phone (tenant_id, primary_phone),
  INDEX idx_people_search (tenant_id, full_name)
);

-- Relationship bridge (one person, multiple roles)
CREATE TABLE person_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL, -- customer, vendor, employee, contractor, etc.
  status TEXT DEFAULT 'active', -- active, inactive, suspended
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  is_primary_contact BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}', -- Role-specific data
  related_entity_id UUID, -- FK to parties/employees/etc
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_person_rel_person (person_id),
  INDEX idx_person_rel_tenant (tenant_id),
  INDEX idx_person_rel_type (tenant_id, relationship_type, status),
  INDEX idx_person_rel_entity (related_entity_id)
);

-- Contact methods (supports multiple)
CREATE TABLE person_contact_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  method_type TEXT NOT NULL, -- email, phone, whatsapp, telegram, address
  value TEXT NOT NULL,
  label TEXT, -- work, personal, home, mobile
  is_primary BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_contact_person (person_id),
  INDEX idx_contact_type (person_id, method_type)
);

-- Keep existing parties table but link to people
ALTER TABLE parties ADD COLUMN person_id UUID REFERENCES people(id);
CREATE INDEX idx_parties_person ON parties(person_id);
```

### 8.2 Sales Activities

```sql
CREATE TABLE sales_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Activity classification
  activity_type TEXT NOT NULL, -- phone_call, email, meeting, quote_sent, order_received, etc.
  activity_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Related entities
  person_id UUID REFERENCES people(id), -- Who this activity is about
  customer_id UUID REFERENCES parties(id), -- Redundant but useful for queries
  lead_id UUID REFERENCES leads(id),
  sales_doc_id UUID REFERENCES sales_docs(id),
  
  -- Activity details
  outcome TEXT, -- success, failed, needs_followup, no_answer, etc.
  duration_minutes INTEGER, -- For calls/meetings
  
  -- Discussion/content
  discussion_points TEXT[], -- Array of tags/topics
  notes TEXT,
  internal_notes TEXT, -- Private notes
  
  -- Commitments
  our_commitments JSONB, -- [{commitment, dueDate}, ...]
  their_commitments JSONB, -- [{commitment, dueDate}, ...]
  
  -- Follow-up
  next_action TEXT, -- none, call_back, send_quote, schedule_meeting
  follow_up_date DATE,
  follow_up_note TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  attachments JSONB, -- [{documentId, filename, url}, ...]
  
  -- Audit
  performed_by_actor_id UUID NOT NULL REFERENCES actors(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_sales_act_tenant (tenant_id),
  INDEX idx_sales_act_type (tenant_id, activity_type),
  INDEX idx_sales_act_person (person_id),
  INDEX idx_sales_act_customer (customer_id),
  INDEX idx_sales_act_lead (lead_id),
  INDEX idx_sales_act_doc (sales_doc_id),
  INDEX idx_sales_act_date (tenant_id, activity_date DESC),
  INDEX idx_sales_act_followup (tenant_id, follow_up_date) WHERE follow_up_date IS NOT NULL
);

-- Activity type enum for validation
CREATE TYPE sales_activity_type AS ENUM (
  'phone_call',
  'email_sent',
  'email_received',
  'meeting',
  'site_visit',
  'quote_sent',
  'quote_followed_up',
  'order_received',
  'order_confirmed',
  'delivery_scheduled',
  'delivery_completed',
  'payment_reminder_sent',
  'customer_issue',
  'deal_won',
  'deal_lost',
  'note'
);

-- Outcome enum
CREATE TYPE activity_outcome AS ENUM (
  'connected_successful',
  'connected_needs_followup',
  'voicemail',
  'no_answer',
  'wrong_number',
  'very_positive',
  'positive',
  'neutral',
  'negative',
  'resolved',
  'escalated',
  'investigating',
  'pending_followup'
);
```

### 8.3 Enhanced Leads

```sql
-- Extend existing leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES people(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_activity_date TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS activity_count INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS customer_health_score INTEGER; -- 0-100
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lost_reason TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lost_at TIMESTAMPTZ;

CREATE INDEX idx_leads_person ON leads(person_id);
CREATE INDEX idx_leads_last_activity ON leads(tenant_id, last_activity_date DESC);
CREATE INDEX idx_leads_health ON leads(tenant_id, customer_health_score);
```

### 8.4 Enhanced Sales Documents

```sql
-- Add payment tracking fields
ALTER TABLE sales_docs ADD COLUMN IF NOT EXISTS allocated_amount DECIMAL(15,2) DEFAULT 0;
ALTER TABLE sales_docs ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(15,2);
ALTER TABLE sales_docs ADD COLUMN IF NOT EXISTS payment_status TEXT; -- unpaid, partial, paid, overdue

-- Add activity tracking
ALTER TABLE sales_docs ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE sales_docs ADD COLUMN IF NOT EXISTS sent_method TEXT; -- email, whatsapp, hand_delivered
ALTER TABLE sales_docs ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ;
ALTER TABLE sales_docs ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0;

-- Add issue tracking
ALTER TABLE sales_docs ADD COLUMN IF NOT EXISTS has_issues BOOLEAN DEFAULT false;
ALTER TABLE sales_docs ADD COLUMN IF NOT EXISTS issue_count INTEGER DEFAULT 0;

CREATE INDEX idx_sales_docs_payment_status ON sales_docs(tenant_id, payment_status);
CREATE INDEX idx_sales_docs_overdue ON sales_docs(tenant_id, due_date) 
  WHERE payment_status IN ('unpaid', 'partial', 'overdue');
```

### 8.5 Customer Health & Scoring

```sql
CREATE TABLE customer_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  customer_id UUID NOT NULL REFERENCES parties(id),
  
  -- Score components (0-100 each)
  payment_score INTEGER DEFAULT 50, -- Payment reliability
  engagement_score INTEGER DEFAULT 50, -- Activity/responsiveness
  order_frequency_score INTEGER DEFAULT 50, -- Regular orders
  growth_score INTEGER DEFAULT 50, -- Increasing order values
  issue_score INTEGER DEFAULT 100, -- Fewer issues = higher score
  
  -- Calculated overall
  overall_score INTEGER DEFAULT 50, -- Weighted average
  score_trend TEXT, -- improving, stable, declining
  
  -- Risk flags
  risk_level TEXT DEFAULT 'low', -- low, medium, high, critical
  risk_factors TEXT[], -- [payment_delays, declining_orders, multiple_issues]
  
  -- Metrics
  total_orders INTEGER DEFAULT 0,
  total_revenue DECIMAL(15,2) DEFAULT 0,
  average_order_value DECIMAL(15,2) DEFAULT 0,
  days_since_last_order INTEGER,
  payment_delay_days_avg INTEGER DEFAULT 0,
  issue_count_30d INTEGER DEFAULT 0,
  
  -- Timestamps
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT customer_health_unique UNIQUE(tenant_id, customer_id),
  INDEX idx_health_tenant (tenant_id),
  INDEX idx_health_score (tenant_id, overall_score DESC),
  INDEX idx_health_risk (tenant_id, risk_level)
);

-- Function to calculate health score
CREATE OR REPLACE FUNCTION calculate_customer_health_score(
  p_tenant_id UUID,
  p_customer_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_payment_score INTEGER;
  v_engagement_score INTEGER;
  v_order_frequency_score INTEGER;
  v_growth_score INTEGER;
  v_issue_score INTEGER;
  v_overall_score INTEGER;
BEGIN
  -- Payment score: Based on payment timeliness
  SELECT 
    CASE 
      WHEN AVG(EXTRACT(epoch FROM (paid_at - due_date))/86400) <= 0 THEN 100
      WHEN AVG(EXTRACT(epoch FROM (paid_at - due_date))/86400) <= 7 THEN 80
      WHEN AVG(EXTRACT(epoch FROM (paid_at - due_date))/86400) <= 30 THEN 60
      ELSE 40
    END INTO v_payment_score
  FROM sales_docs
  WHERE tenant_id = p_tenant_id 
    AND party_id = p_customer_id
    AND status = 'paid'
    AND paid_at IS NOT NULL;
  
  v_payment_score := COALESCE(v_payment_score, 50);
  
  -- Engagement score: Based on activity recency and frequency
  SELECT 
    CASE
      WHEN MAX(activity_date) > NOW() - INTERVAL '7 days' THEN 100
      WHEN MAX(activity_date) > NOW() - INTERVAL '30 days' THEN 80
      WHEN MAX(activity_date) > NOW() - INTERVAL '90 days' THEN 60
      ELSE 40
    END INTO v_engagement_score
  FROM sales_activities
  WHERE tenant_id = p_tenant_id AND customer_id = p_customer_id;
  
  v_engagement_score := COALESCE(v_engagement_score, 50);
  
  -- Order frequency score: Based on order consistency
  SELECT
    CASE
      WHEN COUNT(*) FILTER (WHERE doc_date > NOW() - INTERVAL '30 days') >= 4 THEN 100
      WHEN COUNT(*) FILTER (WHERE doc_date > NOW() - INTERVAL '30 days') >= 2 THEN 80
      WHEN COUNT(*) FILTER (WHERE doc_date > NOW() - INTERVAL '90 days') >= 1 THEN 60
      ELSE 40
    END INTO v_order_frequency_score
  FROM sales_docs
  WHERE tenant_id = p_tenant_id 
    AND party_id = p_customer_id
    AND doc_type = 'invoice'
    AND status NOT IN ('cancelled', 'void');
  
  v_order_frequency_score := COALESCE(v_order_frequency_score, 50);
  
  -- Growth score: Based on order value trend
  WITH recent_orders AS (
    SELECT 
      total_amount,
      doc_date,
      ROW_NUMBER() OVER (ORDER BY doc_date DESC) as rn
    FROM sales_docs
    WHERE tenant_id = p_tenant_id 
      AND party_id = p_customer_id
      AND doc_type = 'invoice'
      AND status NOT IN ('cancelled', 'void')
    LIMIT 6
  ),
  trend_calc AS (
    SELECT
      AVG(total_amount) FILTER (WHERE rn <= 3) as recent_avg,
      AVG(total_amount) FILTER (WHERE rn > 3) as older_avg
    FROM recent_orders
  )
  SELECT
    CASE
      WHEN recent_avg > older_avg * 1.2 THEN 100
      WHEN recent_avg > older_avg * 1.0 THEN 80
      WHEN recent_avg > older_avg * 0.8 THEN 60
      ELSE 40
    END INTO v_growth_score
  FROM trend_calc;
  
  v_growth_score := COALESCE(v_growth_score, 50);
  
  -- Issue score: Based on complaints/issues
  SELECT
    CASE
      WHEN COUNT(*) = 0 THEN 100
      WHEN COUNT(*) FILTER (WHERE activity_date > NOW() - INTERVAL '30 days') = 0 THEN 80
      WHEN COUNT(*) FILTER (WHERE activity_date > NOW() - INTERVAL '30 days') <= 2 THEN 60
      ELSE 40
    END INTO v_issue_score
  FROM sales_activities
  WHERE tenant_id = p_tenant_id 
    AND customer_id = p_customer_id
    AND activity_type = 'customer_issue';
  
  v_issue_score := COALESCE(v_issue_score, 100);
  
  -- Calculate weighted overall score
  v_overall_score := (
    v_payment_score * 0.30 +
    v_engagement_score * 0.20 +
    v_order_frequency_score * 0.20 +
    v_growth_score * 0.15 +
    v_issue_score * 0.15
  )::INTEGER;
  
  -- Upsert health score record
  INSERT INTO customer_health_scores (
    tenant_id, customer_id,
    payment_score, engagement_score, order_frequency_score, 
    growth_score, issue_score, overall_score,
    risk_level
  ) VALUES (
    p_tenant_id, p_customer_id,
    v_payment_score, v_engagement_score, v_order_frequency_score,
    v_growth_score, v_issue_score, v_overall_score,
    CASE
      WHEN v_overall_score >= 70 THEN 'low'
      WHEN v_overall_score >= 50 THEN 'medium'
      WHEN v_overall_score >= 30 THEN 'high'
      ELSE 'critical'
    END
  )
  ON CONFLICT (tenant_id, customer_id) DO UPDATE SET
    payment_score = EXCLUDED.payment_score,
    engagement_score = EXCLUDED.engagement_score,
    order_frequency_score = EXCLUDED.order_frequency_score,
    growth_score = EXCLUDED.growth_score,
    issue_score = EXCLUDED.issue_score,
    overall_score = EXCLUDED.overall_score,
    risk_level = EXCLUDED.risk_level,
    updated_at = NOW();
  
  RETURN v_overall_score;
END;
$$ LANGUAGE plpgsql;
```

---

## 9. API Routes

### 9.1 Activity Recording API

```typescript
// POST /api/sales-customers/activities
{
  endpoint: "/api/sales-customers/activities",
  methods: ["GET", "POST"],
  
  GET: {
    description: "List sales activities",
    queryParams: {
      personId: "UUID (optional)",
      customerId: "UUID (optional)",
      leadId: "UUID (optional)",
      activityType: "string (optional)",
      startDate: "ISO date (optional)",
      endDate: "ISO date (optional)",
      limit: "number (default 50)",
      offset: "number (default 0)"
    },
    response: {
      activities: [
        {
          id: "uuid",
          activityType: "phone_call",
          activityDate: "2026-01-14T10:30:00Z",
          person: { id, fullName, primaryEmail },
          customer: { id, name },
          outcome: "connected_successful",
          notes: "Discussed pricing...",
          performedBy: { id, fullName },
          nextAction: "call_back",
          followUpDate: "2026-01-17"
        }
      ],
      total: 125,
      limit: 50,
      offset: 0
    }
  },
  
  POST: {
    description: "Create new sales activity",
    body: {
      activityType: "required string",
      activityDate: "optional ISO datetime (defaults to now)",
      personId: "optional UUID",
      customerId: "optional UUID",
      leadId: "optional UUID",
      salesDocId: "optional UUID",
      outcome: "optional string",
      durationMinutes: "optional number",
      discussionPoints: "optional string[]",
      notes: "optional string",
      internalNotes: "optional string",
      ourCommitments: "optional [{commitment, dueDate}]",
      theirCommitments: "optional [{commitment, dueDate}]",
      nextAction: "optional string",
      followUpDate: "optional ISO date",
      followUpNote: "optional string",
      attachments: "optional [{documentId, filename, url}]"
    },
    postProcessing: [
      "create_followup_todo_if_specified",
      "create_alert_for_critical_issues",
      "update_lead_last_activity_date",
      "update_customer_health_score",
      "increment_activity_count"
    ],
    response: {
      activity: { ...created_activity },
      todosCreated: [ {...todo_objects} ],
      alertsCreated: [ {...alert_objects} ]
    }
  }
}

// GET /api/sales-customers/activities/[id]
{
  endpoint: "/api/sales-customers/activities/:id",
  methods: ["GET", "PATCH", "DELETE"],
  
  GET: {
    description: "Get activity details with full related data",
    response: {
      activity: { ...full_activity_with_relations }
    }
  },
  
  PATCH: {
    description: "Update activity",
    body: "partial activity fields",
    response: { activity: { ...updated_activity } }
  },
  
  DELETE: {
    description: "Delete activity",
    response: { success: true }
  }
}

// POST /api/sales-customers/activities/bulk
{
  endpoint: "/api/sales-customers/activities/bulk",
  method: "POST",
  description: "Create multiple activities at once (e.g., from meeting with multiple topics)",
  body: {
    activities: [ {...activity_data}, {...activity_data} ]
  },
  response: {
    created: [ {...activity}, {...activity} ],
    errors: []
  }
}
```

### 9.2 People & Relationships API

```typescript
// POST /api/sales-customers/people
{
  endpoint: "/api/sales-customers/people",
  methods: ["GET", "POST"],
  
  GET: {
    description: "Search people across all relationships",
    queryParams: {
      q: "search term",
      relationshipType: "customer|vendor|employee (optional)",
      status: "active|inactive (optional)",
      limit: "number",
      offset: "number"
    },
    response: {
      people: [
        {
          id: "uuid",
          fullName: "Sarah Johnson",
          primaryEmail: "sarah@email.com",
          primaryPhone: "+964 750 123 4567",
          photoUrl: "https://...",
          relationships: [
            {
              type: "customer",
              status: "active",
              startDate: "2023-01-15",
              relatedEntityId: "party_uuid"
            },
            {
              type: "contractor",
              status: "inactive",
              startDate: "2023-08-01",
              endDate: "2024-12-31"
            }
          ]
        }
      ]
    }
  },
  
  POST: {
    description: "Create new person with relationships",
    body: {
      fullName: "required",
      displayName: "optional",
      primaryEmail: "optional",
      primaryPhone: "optional",
      dateOfBirth: "optional",
      relationships: [
        {
          type: "customer",
          status: "active",
          metadata: { customerCode: "CUS-001", creditLimit: 10000 }
        }
      ],
      contactMethods: [
        { type: "email", value: "work@email.com", label: "work", isPrimary: false },
        { type: "whatsapp", value: "+964 750 123 4567", isPrimary: true }
      ]
    },
    postProcessing: [
      "create_person_record",
      "create_relationship_records",
      "create_contact_method_records",
      "create_party_if_customer_or_vendor",
      "create_employee_if_employee"
    ],
    response: {
      person: { ...created_person_with_relationships }
    }
  }
}

// GET /api/sales-customers/people/:id
{
  endpoint: "/api/sales-customers/people/:id",
  method: "GET",
  description: "Get person with all relationships and history",
  response: {
    person: { ...person_data },
    relationships: [ ...relationships ],
    contactMethods: [ ...contact_methods ],
    activityHistory: [ ...recent_activities ],
    healthScore: { ...health_data if customer },
    stats: {
      totalOrders: 12,
      totalRevenue: 45000,
      lastOrderDate: "2026-01-10",
      outstandingBalance: 2300
    }
  }
}

// POST /api/sales-customers/people/:id/relationships
{
  endpoint: "/api/sales-customers/people/:id/relationships",
  method: "POST",
  description: "Add new relationship to existing person",
  body: {
    relationshipType: "customer|vendor|contractor|etc",
    status: "active",
    startDate: "ISO date",
    metadata: { ...role_specific_data }
  },
  validation: [
    "check_duplicate_relationship",
    "check_conflict_of_interest"
  ],
  response: {
    relationship: { ...created_relationship },
    warnings: [ "This person is also your customer. Consider conflict of interest." ]
  }
}
```

### 9.3 Customer Health & Analytics API

```typescript
// GET /api/sales-customers/health
{
  endpoint: "/api/sales-customers/health",
  method: "GET",
  description: "Get customer health scores and risk analysis",
  queryParams: {
    riskLevel: "low|medium|high|critical (optional)",
    minScore: "number 0-100 (optional)",
    maxScore: "number 0-100 (optional)",
    orderBy: "overall_score|payment_score|risk_level",
    limit: "number",
    offset: "number"
  },
  response: {
    customers: [
      {
        customerId: "uuid",
        customerName: "Sarah Johnson",
        healthScore: {
          overall: 85,
          payment: 90,
          engagement: 80,
          orderFrequency: 85,
          growth: 90,
          issues: 100
        },
        riskLevel: "low",
        riskFactors: [],
        metrics: {
          totalOrders: 12,
          totalRevenue: 45000,
          avgOrderValue: 3750,
          daysSinceLastOrder: 4,
          paymentDelayAvg: 2
        },
        trend: "improving",
        calculatedAt: "2026-01-14T10:00:00Z"
      }
    ]
  }
}

// POST /api/sales-customers/health/:customerId/recalculate
{
  endpoint: "/api/sales-customers/health/:customerId/recalculate",
  method: "POST",
  description: "Manually trigger health score recalculation",
  response: {
    healthScore: { ...updated_health_score }
  }
}

// GET /api/sales-customers/health/at-risk
{
  endpoint: "/api/sales-customers/health/at-risk",
  method: "GET",
  description: "Get customers at risk of churn",
  queryParams: {
    daysWithoutOrder: "number (default 90)",
    includeDeclineScore: "boolean (default true)"
  },
  response: {
    atRiskCustomers: [
      {
        customer: { ...customer_data },
        riskFactors: [
          "No orders in 87 days",
          "Health score declining (was 75, now 45)",
          "Last interaction 60 days ago"
        ],
        recommendations: [
          "Call to check in",
          "Offer special promotion",
          "Review if relationship is still active"
        ],
        lastOrderDate: "2025-10-18",
        daysSinceLastOrder: 87,
        scoreTrend: "declining"
      }
    ]
  }
}
```

### 9.4 AI Analysis API

```typescript
// POST /api/sales-customers/analyze-sale
{
  endpoint: "/api/sales-customers/analyze-sale",
  method: "POST",
  description: "AI-powered sales opportunity analysis",
  body: {
    customerId: "optional UUID",
    leadId: "optional UUID",
    estimatedValue: "number",
    products: [{ productId, quantity }],
    description: "optional string"
  },
  aiProcessing: {
    steps: [
      "fetch_customer_history",
      "analyze_payment_reliability",
      "calculate_pricing_strategy",
      "assess_risks",
      "generate_action_plan",
      "calculate_confidence_score"
    ],
    model: "claude-sonnet-4",
    timeout: 30000 // 30 seconds
  },
  response: {
    analysis: {
      customerAnalysis: {
        positiveSignals: [ ...strings ],
        warnings: [ ...strings ],
        recommendation: "string"
      },
      pricingStrategy: {
        totalCost: 9000,
        proposedPrice: 15000,
        margin: 40,
        competitorRange: { min: 14000, max: 16500 },
        position: "competitive",
        maxDiscount: 10,
        recommendedDiscount: 5,
        recommendation: "string"
      },
      riskAssessment: {
        overallRisk: "low|medium|high|critical",
        strengths: [ ...strings ],
        risks: [
          {
            risk: "Large order may stretch cash flow",
            severity: "medium",
            mitigation: "Request 50% deposit"
          }
        ],
        recommendations: [ ...strings ]
      },
      actionPlan: [
        {
          step: 1,
          action: "Send detailed quote by tomorrow",
          deadline: "2026-01-15",
          priority: "high",
          autoCreateTodo: true
        }
      ],
      confidence: {
        score: 85,
        level: "excellent_opportunity",
        reasoning: "Customer has excellent payment history..."
      }
    },
    metadata: {
      analyzedAt: "2026-01-14T10:30:00Z",
      processingTimeMs: 2500
    }
  }
}

// POST /api/sales-customers/ai/suggest-next-action
{
  endpoint: "/api/sales-customers/ai/suggest-next-action",
  method: "POST",
  description: "Get AI suggestions for next best action with a customer",
  body: {
    customerId: "UUID",
    context: "optional string describing current situation"
  },
  response: {
    suggestions: [
      {
        action: "send_payment_reminder",
        priority: "high",
        reasoning: "Invoice #123 is 15 days overdue",
        estimatedImpact: "high",
        confidenceScore: 95
      },
      {
        action: "check_in_call",
        priority: "medium",
        reasoning: "No contact in 45 days, was previously engaged",
        estimatedImpact: "medium",
        confidenceScore: 75
      }
    ]
  }
}
```

### 9.5 Analytics & Reporting API

```typescript
// GET /api/sales-customers/analytics/dashboard
{
  endpoint: "/api/sales-customers/analytics/dashboard",
  method: "GET",
  description: "Get dashboard analytics cards data",
  queryParams: {
    period: "mtd|qtd|ytd|last_30d|last_90d (default mtd)"
  },
  response: {
    cards: [
      {
        id: "revenue_mtd",
        label: "Revenue MTD",
        value: 45230,
        formatted: "$45,230",
        change: 12.5,
        changeFormatted: "+12.5%",
        trend: "up",
        status: "on-track",
        comparisonPeriod: "vs last month"
      },
      {
        id: "pipeline_value",
        label: "Pipeline Value",
        value: 128450,
        formatted: "$128,450",
        subtitle: "18 opportunities",
        status: "healthy"
      },
      {
        id: "active_customers",
        label: "Active Customers",
        value: 87,
        change: 5,
        changeFormatted: "+5",
        period: "this month"
      },
      {
        id: "conversion_rate",
        label: "Conversion Rate",
        value: 42,
        formatted: "42%",
        subtitle: "Lead to Customer",
        trend: "up",
        period: "last 90 days"
      },
      {
        id: "outstanding_ar",
        label: "Outstanding AR",
        value: 23450,
        formatted: "$23,450",
        subtitle: "15 invoices",
        status: "warning",
        breakdown: {
          current: 15000,
          overdue_30: 5450,
          overdue_60: 3000
        }
      }
    ],
    calculatedAt: "2026-01-14T10:00:00Z"
  }
}

// GET /api/sales-customers/analytics/funnel
{
  endpoint: "/api/sales-customers/analytics/funnel",
  method: "GET",
  description: "Get sales funnel metrics",
  queryParams: {
    startDate: "ISO date",
    endDate: "ISO date"
  },
  response: {
    funnel: [
      { stage: "leads_created", count: 150, value: 450000 },
      { stage: "contacted", count: 120, value: 380000 },
      { stage: "qualified", count: 80, value: 280000 },
      { stage: "quote_sent", count: 50, value: 200000 },
      { stage: "won", count: 21, value: 95000 }
    ],
    conversionRates: {
      leads_to_contacted: 80,
      contacted_to_qualified: 67,
      qualified_to_quote: 63,
      quote_to_won: 42,
      overall: 14
    }
  }
}
```

---

## 10. Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Database Schema**
- [ ] Create `people` table
- [ ] Create `person_relationships` table
- [ ] Create `person_contact_methods` table
- [ ] Create `sales_activities` table
- [ ] Create `customer_health_scores` table
- [ ] Add columns to existing `leads` and `sales_docs` tables
- [ ] Create health score calculation function
- [ ] Create necessary indexes

**API Routes - Core**
- [ ] POST /api/sales-customers/people (create person)
- [ ] GET /api/sales-customers/people/:id (get person with relationships)
- [ ] POST /api/sales-customers/activities (create activity)
- [ ] GET /api/sales-customers/activities (list activities)

### Phase 2: Activity Recording (Week 2-3)
**Forms Implementation**
- [ ] Add New Customer form
- [ ] Add New Lead form
- [ ] Log Phone Call form
- [ ] Log Meeting/Visit form
- [ ] Log Customer Issue form
- [ ] Send Payment Reminder form

**Drawer Component**
- [ ] Activity cards layout
- [ ] Form routing logic
- [ ] Context-aware pre-filling
- [ ] Success actions (todos, alerts)

### Phase 3: Dashboard & Analytics (Week 3-4)
**Analytics Cards**
- [ ] Revenue MTD calculation
- [ ] Pipeline Value calculation
- [ ] Active Customers calculation
- [ ] Conversion Rate calculation
- [ ] Outstanding AR calculation

**Dashboard Layout**
- [ ] Three-tier layout component
- [ ] Analytics cards section
- [ ] Todos & Alerts section
- [ ] Quick access cards section

**API Endpoints**
- [ ] GET /api/sales-customers/analytics/dashboard
- [ ] GET /api/sales-customers/health
- [ ] GET /api/sales-customers/health/at-risk

### Phase 4: Wizards & AI (Week 4-5)
**First Invoice Wizard**
- [ ] 6-step wizard component
- [ ] Step navigation
- [ ] Template generation
- [ ] Email sending integration
- [ ] PDF generation

**Analyze Sale Wizard**
- [ ] 5-step wizard component
- [ ] AI integration (customer analysis)
- [ ] AI integration (pricing strategy)
- [ ] AI integration (risk assessment)
- [ ] AI integration (action plan generation)
- [ ] Confidence score calculation
- [ ] Todo/quote creation from wizard

**API Endpoints**
- [ ] POST /api/sales-customers/analyze-sale
- [ ] POST /api/sales-customers/ai/suggest-next-action

### Phase 5: Health Scoring & Automation (Week 5-6)
**Health Score System**
- [ ] Automated score calculation triggers
- [ ] Scheduled recalculation job
- [ ] Risk assessment logic
- [ ] At-risk customer identification
- [ ] Health score dashboard

**Automated Todos & Alerts**
- [ ] Activity-triggered todos
- [ ] Document-triggered todos
- [ ] Overdue payment alerts
- [ ] Lead going cold alerts
- [ ] Quote follow-up alerts
- [ ] Customer at-risk alerts

### Phase 6: Integration & Polish (Week 6-7)
**Cross-Module Integration**
- [ ] Link to Finance (payments, invoices)
- [ ] Link to Inventory (fulfillment)
- [ ] Link to HR (salesperson assignment)
- [ ] Link to GRC (compliance issues)

**UX Refinements**
- [ ] Tooltips for all fields
- [ ] Loading states
- [ ] Error handling
- [ ] Empty states
- [ ] Success animations
- [ ] Mobile responsiveness

**Documentation**
- [ ] User guide for SME owners
- [ ] API documentation
- [ ] Workflow diagrams
- [ ] Video tutorials

---

## 11. Key Design Patterns

### 11.1 Context-Aware Pre-filling
When opening activity drawer from different contexts:

```typescript
// From customer profile
{
  customerId: "pre-filled",
  suggestedActivity: "check_in_call",
  prefilledNotes: "Following up with {customerName}..."
}

// From sales document
{
  customerId: "pre-filled",
  salesDocId: "pre-filled",
  relatedDocument: "pre-filled",
  suggestedActivity: "quote_follow_up",
  prefilledNotes: "Following up on quote sent {daysAgo} days ago..."
}

// From lead profile
{
  leadId: "pre-filled",
  suggestedActivity: "first_contact",
  prefilledNotes: "First contact with {leadName}..."
}
```

### 11.2 Auto-Todo Creation Rules
```typescript
const TODO_RULES = {
  quote_sent: {
    title: "Follow up on quote with {customerName}",
    dueInDays: 3,
    priority: "medium"
  },
  meeting_held: {
    title: "Send meeting summary to {customerName}",
    dueInDays: 0, // Same day
    priority: "high"
  },
  customer_issue_critical: {
    title: "URGENT: Resolve issue for {customerName}",
    dueInDays: 0,
    priority: "critical",
    assignTo: "manager"
  },
  payment_reminder_final: {
    title: "Escalate collection: {customerName}",
    dueInDays: 7,
    priority: "high"
  },
  lead_no_activity_7d: {
    title: "Follow up with lead: {leadName}",
    dueInDays: 0,
    priority: "medium"
  }
};
```

### 11.3 Alert Trigger Rules
```typescript
const ALERT_RULES = {
  payment_overdue_60d: {
    severity: "critical",
    title: "Payment 60+ days overdue: {customerName}",
    triggerCondition: "invoice.dueDate < NOW() - INTERVAL '60 days' AND status = 'unpaid'",
    autoCreate: true
  },
  quote_expiring_48h: {
    severity: "high",
    title: "{count} quotes expiring in 48 hours",
    triggerCondition: "quote.validUntil < NOW() + INTERVAL '48 hours'",
    aggregate: true
  },
  customer_at_risk: {
    severity: "medium",
    title: "Customer at risk: {customerName}",
    triggerCondition: "health_score.overall < 40 OR health_score.risk_level = 'high'",
    frequency: "weekly" // Don't spam
  },
  lead_going_cold: {
    severity: "medium",
    title: "Lead going cold: {leadName}",
    triggerCondition: "lead.last_activity_date < NOW() - INTERVAL '14 days'",
    autoCreate: true
  },
  large_order_approval: {
    severity: "high",
    title: "Large order needs approval: {amount} for {customerName}",
    triggerCondition: "order.totalAmount > 10000 OR order.totalAmount > customer.avgOrderValue * 3",
    assignTo: "manager"
  }
};
```

### 11.4 Health Score Recalculation Triggers
```typescript
// Recalculate health score when:
TRIGGERS = [
  "on_payment_received",
  "on_payment_overdue",
  "on_order_created",
  "on_activity_logged",
  "on_issue_logged",
  "on_issue_resolved",
  "daily_batch_recalculation" // For all customers
];

// Batch recalculation query
SELECT customer_id 
FROM parties 
WHERE type = 'customer' 
  AND is_active = true
  AND (
    last_health_calculation IS NULL 
    OR last_health_calculation < NOW() - INTERVAL '24 hours'
  );
```

---

## 12. SME-Friendly Features

### 12.1 Tooltips & Help Text
Every field must have:
- **Label**: Clear, simple language
- **Tooltip**: Explains what it means in plain language
- **Example**: Shows a real example
- **Why it matters**: Explains the business impact

Example:
```typescript
{
  label: "Payment Terms",
  tooltip: "How long does this customer have to pay? Start with COD for new customers until you build trust.",
  example: "Net 30 means they have 30 days to pay",
  whyItMatters: "The longer you wait, the longer your money is tied up!"
}
```

### 12.2 Progressive Disclosure
- Show simple options first
- Hide advanced features behind "Advanced Options" toggle
- Provide "Quick Create" vs "Detailed Create" options
- Use wizards for complex tasks

### 12.3 Contextual Help
```typescript
// Embedded help sections in forms
<HelpSection>
  <HelpTitle>💡 How to Choose?</HelpTitle>
  <HelpContent>
    Start conservative, then get flexible as trust builds:
    - 🆕 New customer? → Use 'Due Immediately' or 'Net 7'
    - 🤝 Established customer? → 'Net 30' is safe
    - ⭐ Long-term trusted? → 'Net 60' okay
  </HelpContent>
  <HelpLink href="/help/payment-terms">Learn more about payment terms</HelpLink>
</HelpSection>
```

### 12.4 Validation Messages
Use friendly, actionable language:
- ❌ Bad: "Invalid input"
- ✅ Good: "Please enter a phone number like +964 750 123 4567"

- ❌ Bad: "Required field"
- ✅ Good: "We need the customer's name to create the invoice"

### 12.5 Success Celebrations
First-time achievements should be celebrated:
```typescript
if (isFirstInvoice) {
  showConfetti();
  showModal({
    title: "🎉 Congratulations!",
    message: "You just created your first invoice! This is a big step for your business.",
    shareButton: "Share your achievement",
    nextSteps: [
      "Send the invoice to your customer",
      "Mark it as paid when you receive money",
      "Create your next invoice"
    ]
  });
}
```

---

## 13. Testing Strategy

### Unit Tests
- [ ] Health score calculation function
- [ ] Activity todo generation logic
- [ ] Alert trigger conditions
- [ ] Form validation rules
- [ ] Date calculations (due dates, follow-ups)

### Integration Tests
- [ ] Activity creation → todo creation
- [ ] Activity creation → alert creation
- [ ] Health score recalculation on events
- [ ] Person-to-party linking
- [ ] Cross-module data consistency

### End-to-End Tests
- [ ] Complete "First Invoice" wizard flow
- [ ] Complete "Analyze Sale" wizard flow
- [ ] Record activity → view in timeline
- [ ] Customer issue → manager alert
- [ ] Overdue invoice → payment reminder flow

### User Acceptance Testing
- [ ] SME owner can create customer without confusion
- [ ] SME owner can log phone call in < 2 minutes
- [ ] SME owner understands payment terms options
- [ ] SME owner can track overdue payments easily
- [ ] Tooltips are helpful, not overwhelming

---

## 14. Performance Considerations

### Database Optimization
- Index on activity_date for timeline queries
- Index on follow_up_date for todo generation
- Index on payment_status for overdue queries
- Materialized view for dashboard analytics (refresh every 5 minutes)

### Caching Strategy
```typescript
// Cache dashboard analytics
CACHE_KEYS = {
  dashboard_analytics: "sales:analytics:dashboard:{tenantId}:{period}",
  customer_health: "sales:health:{customerId}",
  at_risk_customers: "sales:at_risk:{tenantId}"
};

CACHE_TTL = {
  dashboard_analytics: 300, // 5 minutes
  customer_health: 3600, // 1 hour
  at_risk_customers: 1800 // 30 minutes
};
```

### Lazy Loading
- Activity timeline: Load 20 at a time, infinite scroll
- Customer list: Paginated, 50 per page
- Dashboard quick access: Show 5-10, "View All" button

### Background Jobs
```typescript
CRON_JOBS = {
  recalculate_all_health_scores: "0 2 * * *", // 2 AM daily
  generate_daily_alerts: "0 8 * * *", // 8 AM daily
  cleanup_old_activities: "0 3 * * 0", // 3 AM weekly
  send_scheduled_reminders: "*/15 * * * *" // Every 15 minutes
};
```

---

## 15. Security Considerations

### Data Access Control
- Users can only see activities they created or are assigned to
- Managers can see all activities for their team
- Internal notes are never exposed to customers
- Customer health scores are internal-only

### Sensitive Data Handling
- Personal contact info (phone, email) encrypted at rest
- Credit limits visible only to authorized roles
- Payment history access controlled by role
- Activity notes may contain sensitive info - proper ACLs

### Audit Trail
- All activity CRUD operations logged
- Health score changes tracked
- Alert dismissals recorded
- Todo completions logged

---

## 16. Migration Plan

### Existing Data Migration
```sql
-- Step 1: Create people records from existing customers
INSERT INTO people (tenant_id, full_name, primary_email, primary_phone)
SELECT 
  p.tenant_id,
  p.name,
  pp.data->>'email',
  pp.data->>'phone'
FROM parties p
LEFT JOIN party_profiles pp ON pp.party_id = p.id AND pp.profile_type = 'contact'
WHERE p.type = 'customer';

-- Step 2: Link parties to people
UPDATE parties p
SET person_id = people.id
FROM people
WHERE p.name = people.full_name
  AND p.tenant_id = people.tenant_id
  AND p.type = 'customer';

-- Step 3: Create relationship records
INSERT INTO person_relationships (tenant_id, person_id, relationship_type, related_entity_id)
SELECT 
  p.tenant_id,
  p.person_id,
  'customer',
  p.id
FROM parties p
WHERE p.person_id IS NOT NULL;

-- Step 4: Calculate initial health scores
SELECT calculate_customer_health_score(tenant_id, id)
FROM parties
WHERE type = 'customer' AND is_active = true;
```

### Feature Flag Rollout
```typescript
FEATURE_FLAGS = {
  sales_activities_enabled: false, // Enable activity recording
  health_scoring_enabled: false, // Enable health score calculation
  ai_analysis_enabled: false, // Enable AI sale analysis
  first_invoice_wizard: false, // Enable first-time wizard
  unified_people_view: false // Enable people-centric view
};

// Gradual rollout
ROLLOUT_SCHEDULE = {
  week1: ["sales_activities_enabled"],
  week2: ["health_scoring_enabled"],
  week3: ["ai_analysis_enabled"],
  week4: ["first_invoice_wizard", "unified_people_view"]
};
```

---

## 17. Success Metrics

### Adoption Metrics
- % of users who record at least 1 activity per week
- Average activities recorded per user per week
- % of invoices created using wizard (for new users)
- % of users who use AI analysis feature

### Business Impact Metrics
- Reduction in overdue invoices (target: 20% reduction)
- Increase in customer follow-up rate (target: 50% increase)
- Average days to payment (target: 10% reduction)
- Customer retention rate (target: 5% increase)

### UX Metrics
- Time to create first invoice (target: < 5 minutes)
- Time to record activity (target: < 2 minutes)
- Form abandonment rate (target: < 10%)
- Help documentation click-through rate

### System Health Metrics
- API response time p95 (target: < 500ms)
- Health score calculation time (target: < 2s)
- Dashboard load time (target: < 1s)
- Error rate (target: < 0.1%)

---

*End of Technical Specification*
*Ready for implementation with Claude Code*
