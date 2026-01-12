# HR & PEOPLE MODULE - QUICK REFERENCE

## 🎯 Core Concepts

### Payroll Philosophy
**One Table, All Types**: Staff, interns, contractors all in `payroll_run_lines`
- Type affects preload, not structure
- JSONB for earnings/deductions = flexibility
- Calculate → Post → Lock

### Performance Philosophy
**Guided + Fair + AI**: 7-step wizard ensures context and fairness
- AI outcome locked until content changes
- Auto-creates improvement tasks
- Write for the employee to read

### Document Philosophy
**External + Metadata**: Documents live outside DB
- Signed URLs for upload/download
- Only metadata in database
- Scales infinitely

---

## 📊 Database Quick Ref

### Core Tables
| Table | Purpose | Key Fields |
|-------|---------|------------|
| `payroll_runs_v2` | Run headers | period_start, period_end, status |
| `payroll_run_lines` | Employee lines | base_pay, gross_pay, net_pay |
| `performance_reviews_v2` | Reviews | employee_id, period_start, ai_outcome_category |
| `hr_documents` | Doc metadata | storage_key, category, expiry_date |
| `hr_audit_log` | Audit trail | entity_type, entity_id, before/after |

### Status Values
```typescript
// Payroll
status: 'draft' | 'posted' | 'voided'

// Performance Review
status: 'draft' | 'completed' | 'acknowledged'
ai_outcome_category: 'outstanding_contribution' | 'strong_performance' | 
                     'solid_on_track' | 'below_expectations' | 'critical_concerns'

// Document
verification_status: 'pending' | 'verified' | 'rejected' | 'expired'
```

---

## 🔌 API Endpoints Cheat Sheet

### Dashboard
```bash
GET /api/people/analytics          # 5 analytics cards
GET /api/people/alerts?type=alert  # HR alerts
GET /api/people/alerts?type=task   # HR tasks
```

### Payroll
```bash
# List & Create
GET  /api/people/payroll/runs
POST /api/people/payroll/runs
  { periodStart, periodEnd, payDate, preloadOption: 'both'|'staff'|'interns'|'custom' }

# Run Operations
GET   /api/people/payroll/runs/:id
PATCH /api/people/payroll/runs/:id
POST  /api/people/payroll/runs/:id/calculate   # Recalc all lines
POST  /api/people/payroll/runs/:id/post        # Lock + Journal Entry
POST  /api/people/payroll/runs/:id/void        # Void posted
GET   /api/people/payroll/runs/:id/pdf         # Download PDF
```

### Performance
```bash
# CRUD
GET   /api/people/performance/reviews
POST  /api/people/performance/reviews
  { employee_id, period_type, period_start, period_end, ... }
GET   /api/people/performance/reviews/:id
PATCH /api/people/performance/reviews/:id

# AI & Actions
POST /api/people/performance/reviews/:id/generate-outcome
POST /api/people/performance/reviews/:id/acknowledge
```

### Documents
```bash
GET    /api/people/documents?category=contract
POST   /api/people/documents  # Returns signed upload URL
GET    /api/people/documents/:id
GET    /api/people/documents/:id/download  # Returns signed download URL
POST   /api/people/documents/:id/verify
DELETE /api/people/documents/:id
```

---

## 🎨 UI Components Quick Ref

### Layout Components
```tsx
<ModulePageHeader title="HR & People" action={<Button />} />
<AnalyticsSection>
  <AnalyticsCard variant="success" label="..." value="..." />
</AnalyticsSection>
<TodoAlertsSection>
  <TodoPanel todos={[]} />
  <AlertsPanel alerts={[]} />
</TodoAlertsSection>
```

### Glass UI
```tsx
<GlassCard>...</GlassCard>
<GlassButton variant="primary|secondary|danger|ghost">...</GlassButton>
<GlassInput type="text|date|number" />
<GlassTextArea rows={4} />
<GlassSelect>...</GlassSelect>
<GlassBadge variant="success|warning|danger|info">...</GlassBadge>
<GlassTable headers={[]} rows={[]} />
<GlassModal isOpen={} onClose={}>...</GlassModal>
<GlassTabs tabs={[]} activeTab="" onTabChange={} />
```

### Toast Notifications
```tsx
const { addToast } = useToast();
addToast('success', 'Operation completed');
addToast('error', 'Something went wrong');
addToast('info', 'FYI message');
addToast('warning', 'Be careful');
```

---

## 🔒 Security & Validation

### Tenant Isolation
```typescript
// Middleware injects headers
const tenantId = headers().get('x-tenant-id');
const userId = headers().get('x-user-id');
const actorId = headers().get('x-actor-id');

// All queries MUST filter by tenantId
db.select().from(table).where(eq(table.tenantId, tenantId))
```

### Editability Rules
```typescript
// Payroll
if (run.status !== 'draft') {
  return { error: 'Cannot edit posted or voided run' };
}

// Performance
if (review.employee_acknowledged_at) {
  return { error: 'Cannot edit acknowledged review' };
}
```

### Document Access
```typescript
// Check access scope
if (scope === 'employee_self' && userId !== document.person_id) {
  return { error: 'Access denied' };
}
```

---

## 💡 Common Patterns

### Creating with Preload
```typescript
// Payroll run with staff preload
const run = await createRun({
  periodStart: '2025-01-01',
  periodEnd: '2025-01-31',
  payDate: '2025-02-05',
  preloadOption: 'staff', // Auto-includes eligible staff
});
```

### AI Outcome Generation
```typescript
// Generate outcome (checks hash, only regenerates if changed)
const outcome = await generateAIOutcome(reviewId);
// outcome.category: 'strong_performance'
// outcome.reasons: ['...']
// outcome.next_step: '...'

// Auto-creates improvement task if below/critical
```

### JSONB Updates
```typescript
// Update allowances
await db.execute(sql`
  UPDATE payroll_run_lines
  SET allowances = ${JSON.stringify(newAllowances)}::jsonb
  WHERE id = ${lineId}
`);
```

### Audit Logging
```typescript
await logAudit({
  tenantId,
  actorId,
  entityType: 'payroll_run',
  entityId: runId,
  action: 'posted',
  beforeSnapshot: oldData,
  afterSnapshot: newData,
});
```

---

## 🐛 Debugging Tips

### Check Audit Log
```sql
SELECT * FROM hr_audit_log
WHERE tenant_id = 'xxx'
  AND entity_type = 'payroll_run'
  AND entity_id = 'prun_123'
ORDER BY occurred_at DESC;
```

### Verify Financial Posting
```sql
SELECT pr.id, pr.status, pr.journal_entry_id, je.status as je_status
FROM payroll_runs_v2 pr
LEFT JOIN journal_entries je ON je.id = pr.journal_entry_id
WHERE pr.tenant_id = 'xxx';
```

### Check AI Outcome Hash
```sql
SELECT 
  id,
  ai_outcome_category,
  ai_outcome_input_hash,
  ai_outcome_generated_at
FROM performance_reviews_v2
WHERE id = 'perf_123';
```

### Find Stale Alerts
```sql
SELECT * FROM tasks
WHERE tenant_id = 'xxx'
  AND domain = 'hr'
  AND status = 'open'
  AND due_at < CURRENT_DATE
ORDER BY due_at;
```

---

## 📈 Performance Tips

### Indexes to Add
```sql
-- If querying by category frequently
CREATE INDEX idx_payroll_lines_person_type 
ON payroll_run_lines(tenant_id, person_type);

-- If searching documents by expiry
CREATE INDEX idx_hr_documents_expiring 
ON hr_documents(tenant_id, expiry_date) 
WHERE expiry_date IS NOT NULL;
```

### Query Optimization
```typescript
// BAD: N+1 queries
for (const line of lines) {
  const person = await db.select().from(people).where(eq(people.id, line.person_id));
}

// GOOD: Single JOIN
const linesWithPeople = await db
  .select()
  .from(payrollRunLines)
  .leftJoin(people, eq(people.id, payrollRunLines.personId))
  .where(eq(payrollRunLines.payrollRunId, runId));
```

---

## 🚀 Deployment Checklist

- [ ] Run schema migration
- [ ] Configure object storage (S3/etc)
- [ ] Set AI API key (optional)
- [ ] Seed reference data (if needed)
- [ ] Test tenant isolation
- [ ] Test payroll calculation
- [ ] Test AI outcome generation
- [ ] Test document upload/download
- [ ] Verify audit logging
- [ ] Check alert generation
- [ ] Load test with 100+ employees

---

## 📞 Quick Help

| Issue | Check |
|-------|-------|
| Calculation wrong | Base pay set? Percentages valid? |
| Can't edit | Status = draft? Not posted? |
| AI won't generate | Required fields filled? Hash changed? |
| Document fails | Signed URL expired? Storage configured? |
| Alert not showing | Cron job running? Check tasks table |
| Posting fails | Journal entry service available? |

---

*Keep this handy while coding!*
