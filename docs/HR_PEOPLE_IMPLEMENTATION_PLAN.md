# HR & People Module Implementation Plan

## Executive Summary

This document outlines the implementation plan for the unified HR & People module in UDP. Based on codebase analysis, significant infrastructure already exists. This plan focuses on filling gaps and consolidating into a single-page tabbed interface.

---

## 1. Current State Analysis

### 1.1 What Already Exists

#### Database Schema (Complete)
| Table | Purpose | Status |
|-------|---------|--------|
| `people` | Unified directory (staff, contractors, contacts) | ✅ Complete |
| `employees` | Employment-specific data (50+ fields) | ✅ Complete |
| `compensationRecords` | Effective-dated compensation history | ✅ Complete |
| `employeeBankAccounts` | Direct deposit configuration | ✅ Complete |
| `employeeDeductions` | Per-employee deduction setup | ✅ Complete |
| `employeeLeaveBalances` | Leave tracking per type | ✅ Complete |
| `payrollRuns` | Batch payroll processing | ✅ Complete |
| `payrollRunEmployees` | Individual employee payroll | ✅ Complete |
| `payrollEarnings` | Earnings breakdown | ✅ Complete |
| `payrollTaxes` | Tax calculations | ✅ Complete |
| `payrollDeductions` | Deduction application | ✅ Complete |
| `payrollGlMappings` | GL account routing | ✅ Complete |
| `jurisdictions` | Country/state/local tax jurisdictions | ✅ Complete |
| `taxTables` / `taxBrackets` | Tax calculation tables | ✅ Complete |
| `deductionTypes` / `earningTypes` | Standard types | ✅ Complete |
| `tenantComplianceProfiles` | Tenant compliance setup | ✅ Complete |
| `tenantTaxRegistrations` | Per-jurisdiction registrations | ✅ Complete |
| `departments` | Hierarchical structure | ✅ Complete |
| `tasks` / `alerts` | Task and alert system | ✅ Complete |
| `documents` / `documentLinks` | Document storage | ✅ Complete |
| `auditEvents` | Audit trail | ✅ Complete |

#### API Routes (Partial)
| Endpoint | Status |
|----------|--------|
| `/api/people` | ✅ Complete |
| `/api/people/[id]` | ✅ Complete |
| `/api/people/ai/validate` | ✅ Complete |
| `/api/people/time-off` | ✅ Complete |
| `/api/people/performance-notes` | ✅ Complete |
| `/api/people/payroll` | ✅ Basic (simple ledger entry) |
| `/api/payroll/employees` | ✅ Complete |
| `/api/payroll/employees/[id]/compensation` | ✅ Complete |
| `/api/payroll/employees/[id]/deductions` | ✅ Complete |
| `/api/payroll/runs` | ❌ Missing |
| `/api/payroll/runs/[id]/calculate` | ❌ Missing |
| `/api/payroll/runs/[id]/approve` | ❌ Missing |
| `/api/payroll/runs/[id]/post` | ❌ Missing |
| `/api/people/performance-cycles` | ❌ Missing |
| `/api/people/performance-reviews` | ❌ Missing |
| `/api/people/documents` | ❌ Missing (expiry tracking) |
| `/api/people/leave-requests` | ❌ Missing |

#### UI (Partial)
| Component | Status |
|-----------|--------|
| `/people` page | ✅ Exists with Record Activity drawer |
| Add Person workflow | ✅ Complete |
| Quick Add workflow | ✅ Complete |
| Time Off recording | ✅ Basic |
| Performance Notes | ✅ Basic |
| Payroll recording | ✅ Simple ledger entry only |
| Person profile drawer | ❌ Missing |
| Payroll runs management | ❌ Missing |
| Performance cycles | ❌ Missing |
| Documents tab | ❌ Missing |
| Settings tab | ❌ Missing |

### 1.2 Gap Analysis

**High Priority Gaps:**
1. Tabbed single-page layout (People, Payroll, Performance, Documents, Settings)
2. Payroll run workflow (create draft → calculate → review → approve → post)
3. Person profile drawer with tabs
4. Performance cycles and reviews UI
5. Document expiry tracking and alerts

**Medium Priority Gaps:**
1. Leave request/approval workflow
2. Employee self-service restrictions
3. Payroll calculation engine
4. Tax calculation per jurisdiction

**Low Priority Gaps:**
1. Org chart visualization
2. Payslip generation
3. Bank file export

---

## 2. Data Model Extensions

### 2.1 New Tables Required

#### Performance Cycles
```sql
-- Already exists in spec, needs creation
CREATE TABLE performance_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  frequency TEXT NOT NULL, -- 'quarterly', 'semi_annual', 'annual', 'custom'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  due_date DATE NOT NULL,
  assigned_to_role TEXT, -- 'hr', 'manager', 'owner'
  status TEXT NOT NULL DEFAULT 'planned', -- 'planned', 'active', 'completed'
  created_by_actor_id UUID REFERENCES actors(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  cycle_id UUID NOT NULL REFERENCES performance_cycles(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  reviewer_employee_id UUID REFERENCES employees(id),
  status TEXT NOT NULL DEFAULT 'not_started', -- 'not_started', 'in_progress', 'submitted', 'approved'
  overall_rating INTEGER, -- 1-5 or null
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cycle_id, employee_id)
);
```

#### Leave Requests
```sql
CREATE TABLE leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  accrual_type TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'monthly', 'annual'
  default_annual_allowance NUMERIC(6,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(tenant_id, code)
);

CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  leave_type_id UUID NOT NULL REFERENCES leave_types(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_requested NUMERIC(5,2) NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'cancelled'
  approved_by_user_id UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  affects_payroll BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Document Expiry Extension
```sql
-- Add to existing documents table or create HR-specific extension
ALTER TABLE documents ADD COLUMN expiry_date DATE;
ALTER TABLE documents ADD COLUMN expiry_alert_days INTEGER DEFAULT 30;
ALTER TABLE documents ADD COLUMN document_category TEXT; -- 'id', 'contract', 'certificate', 'visa', 'other'
ALTER TABLE documents ADD COLUMN verification_status TEXT DEFAULT 'pending'; -- 'pending', 'verified', 'rejected'
ALTER TABLE documents ADD COLUMN verified_by_user_id UUID REFERENCES users(id);
ALTER TABLE documents ADD COLUMN verified_at TIMESTAMPTZ;
```

### 2.2 Schema Migration File

**File:** `drizzle/0028_hr_people_extensions.sql`

```sql
-- Performance management
CREATE TABLE IF NOT EXISTS performance_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('quarterly', 'semi_annual', 'annual', 'custom')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  due_date DATE NOT NULL,
  assigned_to_role TEXT CHECK (assigned_to_role IN ('hr', 'manager', 'owner')),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed')),
  created_by_actor_id UUID REFERENCES actors(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_perf_cycles_tenant ON performance_cycles(tenant_id);
CREATE INDEX idx_perf_cycles_status ON performance_cycles(tenant_id, status);

CREATE TABLE IF NOT EXISTS performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  cycle_id UUID NOT NULL REFERENCES performance_cycles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  reviewer_employee_id UUID REFERENCES employees(id),
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'submitted', 'approved')),
  overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cycle_id, employee_id)
);

CREATE INDEX idx_perf_reviews_cycle ON performance_reviews(cycle_id);
CREATE INDEX idx_perf_reviews_employee ON performance_reviews(employee_id);

-- Leave management
CREATE TABLE IF NOT EXISTS leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  accrual_type TEXT NOT NULL DEFAULT 'manual' CHECK (accrual_type IN ('manual', 'monthly', 'annual')),
  default_annual_allowance NUMERIC(6,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, code)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  leave_type_id UUID NOT NULL REFERENCES leave_types(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_requested NUMERIC(5,2) NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by_user_id UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  affects_payroll BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(tenant_id, status);
CREATE INDEX idx_leave_requests_dates ON leave_requests(start_date, end_date);

-- Document extensions for HR
ALTER TABLE documents ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS expiry_alert_days INTEGER DEFAULT 30;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_category TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS verified_by_user_id UUID REFERENCES users(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_documents_expiry ON documents(tenant_id, expiry_date) WHERE expiry_date IS NOT NULL;
```

---

## 3. UI Implementation

### 3.1 Single Page Layout

**File:** `src/app/(app)/people/page.tsx`

Transform the existing page into a tabbed layout:

```
┌─────────────────────────────────────────────────────────────────┐
│ HR & People                               [Record Activity] btn │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐ │
│ │Headcount│ │New Hires│ │ Leavers │ │  Cost   │ │  Alerts     │ │
│ │   45    │ │    3    │ │    1    │ │ $125K   │ │     5       │ │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ To-Do & Alerts (collapsible)                                │ │
│ │ • Upload ID for John Smith                          [Open]  │ │
│ │ • Review payroll anomaly: +25% for Jane Doe         [Open]  │ │
│ │ • Visa expiring in 30 days: Maria Garcia            [Open]  │ │
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ [People] [Payroll] [Performance] [Documents] [Settings]        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    << Tab Content Here >>                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Tab Components

#### People Tab (Existing - Enhance)
- Current people table ✅
- Add: Row click opens person profile drawer
- Add: Bulk actions (assign to department, export)

#### Payroll Tab (New)
- Payroll runs table
- Run Payroll wizard (full workflow)
- Open draft view with line items

#### Performance Tab (New)
- Performance cycles table
- Reviews table by person
- Create cycle wizard

#### Documents Tab (New)
- Documents table with expiry column
- Upload drawer
- Verification actions

#### Settings Tab (New)
- Jurisdictions configuration
- Leave types configuration
- Document requirements templates
- Role-based access matrix

### 3.3 Person Profile Drawer

When clicking a row in the People table:

```
┌──────────────────────────────────────────────┐
│ ← John Smith                          [Edit] │
├──────────────────────────────────────────────┤
│ [Summary] [Employment] [Payroll] [Docs] [Log]│
├──────────────────────────────────────────────┤
│ Summary:                                     │
│ • Email: john@company.com                    │
│ • Phone: +1 555 123 4567                     │
│ • Department: Engineering                    │
│ • Manager: Jane Doe                          │
│ • Start Date: Jan 15, 2024                   │
│ • Status: Active                             │
│──────────────────────────────────────────────│
│ Employment:                                  │
│ • Employee Number: EMP-001                   │
│ • Type: Full-time                            │
│ • Contract: Permanent                        │
│ • Jurisdiction: USA - California             │
│──────────────────────────────────────────────│
│ Quick Actions:                               │
│ [Record Time Off] [Add Note] [Upload Doc]    │
└──────────────────────────────────────────────┘
```

### 3.4 Component Structure

```
src/app/(app)/people/
├── page.tsx                    # Main tabbed page
├── components/
│   ├── PeopleTab.tsx           # People table with profile drawer
│   ├── PayrollTab.tsx          # Payroll runs management
│   ├── PerformanceTab.tsx      # Performance cycles/reviews
│   ├── DocumentsTab.tsx        # HR documents with expiry
│   ├── SettingsTab.tsx         # HR settings
│   ├── PersonProfileDrawer.tsx # Person detail drawer
│   ├── PayrollRunWizard.tsx    # Full payroll workflow
│   ├── PerformanceCycleWizard.tsx
│   └── RecordActivityDrawer.tsx # (existing, enhance)
```

---

## 4. API Implementation

### 4.1 Payroll Runs API

**File:** `src/app/api/payroll/runs/route.ts`

```typescript
// GET /api/payroll/runs - List payroll runs
// POST /api/payroll/runs - Create new payroll run (draft)

interface PayrollRunCreate {
  payPeriodId?: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  jurisdictionId?: string;
  runType?: 'regular' | 'bonus' | 'correction' | 'final';
}
```

**File:** `src/app/api/payroll/runs/[id]/route.ts`

```typescript
// GET /api/payroll/runs/:id - Get run with line items
// PATCH /api/payroll/runs/:id - Update run (while draft)
// DELETE /api/payroll/runs/:id - Delete run (only if draft)
```

**File:** `src/app/api/payroll/runs/[id]/calculate/route.ts`

```typescript
// POST /api/payroll/runs/:id/calculate
// - Fetches all active employees for jurisdiction
// - Calculates earnings, taxes, deductions per employee
// - Creates/updates payroll_run_employees and detail records
// - Sets status to 'calculated'
```

**File:** `src/app/api/payroll/runs/[id]/approve/route.ts`

```typescript
// POST /api/payroll/runs/:id/approve
// - Validates all required data present
// - Checks for anomalies, requires comments if any
// - Sets status to 'approved'
// - Records approver
```

**File:** `src/app/api/payroll/runs/[id]/post/route.ts`

```typescript
// POST /api/payroll/runs/:id/post
// - Creates journal entries via posting service
// - Uses payroll_gl_mappings for account routing
// - Sets status to 'posted'
// - Records posting timestamp
```

### 4.2 Performance API

**File:** `src/app/api/people/performance-cycles/route.ts`

```typescript
// GET - List cycles
// POST - Create cycle (auto-generates reviews for employees)
```

**File:** `src/app/api/people/performance-reviews/route.ts`

```typescript
// GET - List reviews (filterable by cycle, employee, status)
// PATCH - Update review (rating, notes, status)
```

### 4.3 Leave API

**File:** `src/app/api/people/leave-types/route.ts`
**File:** `src/app/api/people/leave-requests/route.ts`

### 4.4 Documents API (HR Extension)

**File:** `src/app/api/people/documents/route.ts`

```typescript
// GET - List HR documents with expiry tracking
// POST - Upload document with category and expiry
// Includes: alerts for expiring documents
```

---

## 5. Payroll Calculation Engine

### 5.1 Architecture

```
src/lib/payroll/
├── index.ts                # Main exports
├── calculator.ts           # Core calculation logic
├── earnings.ts             # Earnings calculations
├── taxes.ts                # Tax calculations by jurisdiction
├── deductions.ts           # Deduction calculations
├── types.ts                # Type definitions
└── rules/
    ├── usa/
    │   ├── federal.ts      # Federal tax rules
    │   └── states/         # State-specific rules
    ├── default.ts          # Fallback/manual rules
    └── index.ts
```

### 5.2 Calculation Flow

```typescript
// src/lib/payroll/calculator.ts

interface PayrollCalculationResult {
  employeeId: string;
  grossPay: number;
  earnings: EarningLine[];
  taxes: TaxLine[];
  deductions: DeductionLine[];
  employerContributions: ContributionLine[];
  netPay: number;
  anomalies: Anomaly[];
}

async function calculatePayroll(
  tenantId: string,
  payrollRunId: string,
  options: {
    employees?: string[]; // specific employees or all active
    forceRecalculate?: boolean;
  }
): Promise<PayrollCalculationResult[]> {
  // 1. Get employees for this run (by jurisdiction)
  // 2. Get effective compensation for each
  // 3. Apply earning types
  // 4. Calculate taxes using jurisdiction rules
  // 5. Apply deductions
  // 6. Calculate employer contributions
  // 7. Detect anomalies (large changes vs prior period)
  // 8. Store results
}
```

### 5.3 Tax Calculation (Configurable)

Use existing `taxTables` and `taxBrackets` tables with calculation methods:
- `bracket`: Progressive tax brackets
- `flat_rate`: Single percentage
- `wage_base`: Percentage with cap
- `formula`: Custom formula (stored as JSON)

For unknown jurisdictions, allow `manual` override at the line item level.

---

## 6. Task & Alert Integration

### 6.1 HR Domain Tasks

Leverage existing `tasks` table with domain = 'hr':

| Task Type | Trigger | Auto-Create |
|-----------|---------|-------------|
| `upload_document` | Person created | Yes - for ID, Contract |
| `complete_profile` | Quick-add person created | Yes |
| `review_payroll_anomaly` | Anomaly detected in draft | Yes |
| `approve_leave_request` | Leave request submitted | Yes |
| `complete_performance_review` | Cycle activated | Yes |
| `verify_document` | Document uploaded | Yes |
| `link_user_to_person` | Overlap detected | Yes |
| `review_duplicate_person` | Duplicate detected | Yes |

### 6.2 HR Domain Alerts

Leverage existing `alerts` table with domain = 'hr':

| Alert Type | Trigger | Severity |
|------------|---------|----------|
| `document_expiring` | Expiry within threshold | warning |
| `document_expired` | Past expiry date | critical |
| `contract_expiring` | Contract end within 60 days | warning |
| `payroll_anomaly` | Large change detected | warning |
| `missing_required_document` | Person active without ID | warning |
| `performance_review_overdue` | Past due date | warning |
| `leave_balance_low` | Below threshold | info |

### 6.3 Alert Generation Service

**File:** `src/lib/hr/alerts.ts`

```typescript
// Run nightly or on-demand
async function generateHRAlerts(tenantId: string) {
  // 1. Check document expiries
  // 2. Check contract expiries
  // 3. Check missing required documents
  // 4. Check performance review due dates
  // 5. Check leave balances
  // Create/update alerts in `alerts` table
}
```

---

## 7. Permissions & Access

### 7.1 Role Capabilities

| Capability | Owner | HR | Manager | Finance | Employee |
|------------|-------|-----|---------|---------|----------|
| View all people | ✅ | ✅ | Team only | ❌ | ❌ |
| Add/edit people | ✅ | ✅ | ❌ | ❌ | ❌ |
| View salaries | ✅ | ✅ | ❌ | Totals only | Own only |
| Run payroll | ✅ | ✅ | ❌ | ❌ | ❌ |
| Approve payroll | ✅ | ❌ | ❌ | ❌ | ❌ |
| View payroll GL | ✅ | ❌ | ❌ | ✅ | ❌ |
| Approve leave | ✅ | ✅ | Team only | ❌ | ❌ |
| Complete reviews | ✅ | ✅ | ✅ | ❌ | Own only |
| Upload documents | ✅ | ✅ | ❌ | ❌ | Own only |
| Verify documents | ✅ | ✅ | ❌ | ❌ | ❌ |
| Configure settings | ✅ | ✅ | ❌ | ❌ | ❌ |

### 7.2 Per-User Overrides

Store in existing user permissions system:
- `hr.view_salaries` - Grant salary visibility
- `hr.edit_compensation` - Grant compensation editing
- `hr.approve_payroll` - Grant payroll approval
- `hr.verify_documents` - Grant document verification

---

## 8. Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal:** Tabbed layout with enhanced People tab

- [ ] Create tabbed page layout
- [ ] Implement Person Profile Drawer with tabs
- [ ] Add Employment tab to drawer (link to employee record)
- [ ] Create Payroll tab placeholder
- [ ] Create Performance tab placeholder
- [ ] Create Documents tab placeholder
- [ ] Create Settings tab placeholder

**Acceptance Criteria:**
- Single page with 5 tabs
- Row click opens profile drawer
- Profile drawer shows person details with tabs

### Phase 2: Payroll Runs (Week 3-4)
**Goal:** Full payroll run workflow

- [ ] Create payroll runs API routes
- [ ] Implement PayrollTab component
- [ ] Build PayrollRunWizard (create, select period)
- [ ] Implement basic calculation engine
- [ ] Create payroll draft view with line items
- [ ] Add approval workflow
- [ ] Integrate with posting service for GL entries

**Acceptance Criteria:**
- Create payroll run draft
- View/edit line items in draft
- Calculate earnings and deductions (basic)
- Approve and post to GL
- Anomaly flags for large changes

### Phase 3: Performance Management (Week 5)
**Goal:** Performance cycles and reviews

- [ ] Run database migration for performance tables
- [ ] Create performance cycles API
- [ ] Create performance reviews API
- [ ] Implement PerformanceTab component
- [ ] Build PerformanceCycleWizard
- [ ] Auto-generate tasks for reviewers

**Acceptance Criteria:**
- Create quarterly/annual cycles
- Auto-generate review records
- Track review completion
- Tasks created for due reviews

### Phase 4: Documents & Compliance (Week 6)
**Goal:** Document management with expiry tracking

- [ ] Run database migration for document extensions
- [ ] Create HR documents API
- [ ] Implement DocumentsTab component
- [ ] Add document upload with category/expiry
- [ ] Implement verification workflow
- [ ] Create expiry alert generation

**Acceptance Criteria:**
- Upload documents with expiry dates
- View documents by category
- Verify documents (HR only)
- Alerts for expiring/expired documents

### Phase 5: Leave Management (Week 7)
**Goal:** Leave request and approval workflow

- [ ] Run database migration for leave tables
- [ ] Seed default leave types
- [ ] Create leave types API
- [ ] Create leave requests API
- [ ] Add leave request form to Record Activity
- [ ] Implement manager approval workflow
- [ ] Update leave balances on approval

**Acceptance Criteria:**
- Configure leave types
- Submit leave requests
- Manager approval workflow
- Balance updates

### Phase 6: Settings & Polish (Week 8)
**Goal:** Configuration UI and refinements

- [ ] Implement SettingsTab with subsections
- [ ] Jurisdiction configuration UI
- [ ] Leave types configuration UI
- [ ] Document requirements templates
- [ ] Role-based access matrix UI
- [ ] Employee self-service restrictions
- [ ] End-to-end testing

**Acceptance Criteria:**
- Configure jurisdictions
- Configure leave types
- Employee can only see own data
- All CRUD operations tested

---

## 9. Migration & Cleanup

### 9.1 Remove Duplicate Pages

After implementation, deprecate:
- `/operations/people` → Redirect to `/people`
- Any legacy HR routes

### 9.2 Data Migration

```typescript
// src/scripts/migrate-hr-data.ts

async function migrateHRData() {
  // 1. Ensure all staff persons have employee records
  // 2. Create person_user_link suggestions for matches
  // 3. Migrate any legacy compensation data
  // 4. Preserve historical payroll data
}
```

### 9.3 Cleanup Tasks

- [ ] Remove `/operations/people` page
- [ ] Update navigation to only show `/people`
- [ ] Remove redundant API routes
- [ ] Clean up unused components

---

## 10. Testing Strategy

### 10.1 Smoke Tests

**File:** `scripts/smoke/layer20_hr_people.sh`

```bash
# People CRUD
# Employee CRUD
# Payroll run workflow
# Performance cycle creation
# Document upload
# Leave request
```

### 10.2 Integration Tests

- Payroll calculation accuracy
- GL posting correctness
- Permission enforcement
- Alert generation

### 10.3 Acceptance Tests

For each phase, validate against acceptance criteria listed above.

---

## 11. File Inventory

### New Files

```
src/app/(app)/people/
├── page.tsx                    # Rewrite as tabbed
├── components/
│   ├── PeopleTab.tsx
│   ├── PayrollTab.tsx
│   ├── PerformanceTab.tsx
│   ├── DocumentsTab.tsx
│   ├── SettingsTab.tsx
│   ├── PersonProfileDrawer.tsx
│   ├── PayrollRunWizard.tsx
│   └── PerformanceCycleWizard.tsx

src/app/api/payroll/
├── runs/
│   ├── route.ts
│   └── [id]/
│       ├── route.ts
│       ├── calculate/route.ts
│       ├── approve/route.ts
│       └── post/route.ts

src/app/api/people/
├── performance-cycles/route.ts
├── performance-reviews/route.ts
├── leave-types/route.ts
├── leave-requests/route.ts
└── documents/route.ts

src/lib/payroll/
├── index.ts
├── calculator.ts
├── earnings.ts
├── taxes.ts
├── deductions.ts
└── types.ts

src/lib/hr/
├── alerts.ts
└── tasks.ts

drizzle/
└── 0028_hr_people_extensions.sql
```

### Modified Files

```
src/db/schema.ts                # Add new tables
src/components/layout/shell.tsx # Verify nav (already correct)
```

---

## 12. Success Metrics

| Metric | Target |
|--------|--------|
| Add person workflow | < 2 minutes |
| Payroll run (10 employees) | < 30 seconds |
| Page load time | < 2 seconds |
| Tab switch | < 500ms |
| Test coverage | > 80% |

---

## Appendix A: Existing Table Relationships

```
people (1) ──┬── (0..1) employees
             ├── (0..1) users (via linked_user_id)
             └── (0..*) documents (via document_links)

employees (1) ──┬── (0..*) compensation_records
                ├── (0..*) employee_deductions
                ├── (0..*) employee_leave_balances
                ├── (0..*) payroll_run_employees
                └── (0..*) performance_reviews

payroll_runs (1) ──── (0..*) payroll_run_employees

payroll_run_employees (1) ──┬── (0..*) payroll_earnings
                            ├── (0..*) payroll_taxes
                            └── (0..*) payroll_deductions

performance_cycles (1) ──── (0..*) performance_reviews
```

---

## Appendix B: Person vs User vs Employee

```
┌─────────────────────────────────────────────────────────────────┐
│                           PERSON                                 │
│  • Any individual in the system                                  │
│  • Types: staff, contractor, supplier_contact, etc.              │
│  • May or may not have platform access                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
    ┌───────────┐     ┌───────────┐     ┌───────────┐
    │   USER    │     │  EMPLOYEE │     │  NEITHER  │
    │           │     │           │     │           │
    │ Platform  │     │ Employment│     │ External  │
    │ login     │     │ data      │     │ contact   │
    └───────────┘     └───────────┘     └───────────┘

Staff person typically has BOTH user (for login) AND employee (for payroll)
Contractor person may have employee record but no user account
Customer contact has neither
```

---

*Document Version: 1.0*
*Created: 2026-01-10*
*Author: Implementation Team*
