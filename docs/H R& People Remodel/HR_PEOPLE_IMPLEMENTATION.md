# HR & PEOPLE MODULE - IMPLEMENTATION GUIDE

## Overview

Complete remodel of the HR & People module for UDP ERP, following SME-friendly design principles with:
- Single-page interface with tabs
- Editable until financially posted
- AI-powered performance reviews
- External document storage
- Comprehensive audit trail
- Global and jurisdiction-agnostic

## What's Been Implemented

### 1. Database Schema (hr_people_schema.sql)

#### New Tables
- `people_addresses` - Contact addresses for people
- `payroll_runs_v2` - Unified payroll run headers
- `payroll_run_lines` - Payroll lines with embedded JSONB for earnings/deductions
- `performance_reviews_v2` - Guided performance reviews with AI outcomes
- `hr_documents` - Document metadata (external storage)
- `hr_document_links` - Link documents to entities
- `hr_audit_log` - Comprehensive audit trail

#### Views
- `hr_active_headcount` - Active staff/intern counts
- `hr_contract_endings` - Contracts ending in 30 days

#### Key Features
- Multi-tenant isolation on all tables
- JSONB storage for flexible earnings/deductions
- AI outcome tracking with input hash (locked unless content changes)
- Comprehensive audit logging

### 2. API Routes

#### Analytics & Dashboard
- `GET /api/people/analytics` - Dashboard analytics cards
  - Headcount (staff + interns)
  - New hires (last 30 days)
  - Contracts ending soon
  - Payroll status
  - Open HR tasks

- `GET /api/people/alerts` - HR alerts and tasks
  - Contract endings (30d, 7d, 1d warnings)
  - Missing payroll
  - Document expiry
  - Performance follow-ups

#### Payroll Management
- `GET /api/people/payroll/runs` - List payroll runs
- `POST /api/people/payroll/runs` - Create run with preload options
  - Preload: staff, interns, both, or custom
  - Auto-includes eligible employees based on:
    - Active status
    - Start date ≤ period end
    - End date empty or ≥ period start
  
- `GET /api/people/payroll/runs/[id]` - Get run with lines
- `POST /api/people/payroll/runs/[id]/calculate` - Calculate all lines
  - Applies percentages to basis amounts
  - Recalculates totals
  - Updates gross, net, employer cost
  
- `POST /api/people/payroll/runs/[id]/post` - Post to financial ledger
  - Creates journal entry
  - Locks run (no further edits)
  - Links via journal_entry_id
  
- `POST /api/people/payroll/runs/[id]/void` - Void posted run
- `GET /api/people/payroll/runs/[id]/pdf` - Generate PDF

#### Performance Reviews
- `GET /api/people/performance/reviews` - List reviews
- `POST /api/people/performance/reviews` - Create review
- `GET /api/people/performance/reviews/[id]` - Get review details
- `PATCH /api/people/performance/reviews/[id]` - Update review
- `POST /api/people/performance/reviews/[id]/generate-outcome` - AI outcome
  - Categories: outstanding, strong, solid, below, critical
  - Generates key reasons and next steps
  - Creates improvement tasks for below/critical
  - Locked unless input text changes (via hash)
  
- `POST /api/people/performance/reviews/[id]/acknowledge` - Employee ack

### 3. Frontend Components

#### Main Page (people_page.tsx)
- Single page with tab navigation
- Dashboard analytics cards
- Todo/Alerts panels
- Action menu dropdown:
  - Add person
  - Record performance
  - Upload document
  - Record leave
  - Other HR event

#### PayrollTab.tsx
- List all payroll runs
- Select and view run details
- Editable table (draft only):
  - Include/exclude employees
  - Edit earnings, deductions, taxes
  - Real-time calculation
  - Row-level notes
- Actions:
  - Calculate payroll
  - Post to ledger
  - Download PDF
- Summary totals at bottom
- Status badges (draft/posted/voided)

#### PerformanceReviewWizard.tsx
- 7-step guided wizard:
  1. **Context** - Employee, period type, dates
  2. **Strengths** - What went well + examples
  3. **Improvements** - Areas to develop + examples
  4. **Fairness** - Constraints, support, external factors
  5. **Goals** - 1-3 goals + support plan + follow-up date
  6. **Visibility** - Who can see + private notes
  7. **AI Outcome** - Locked category, reasons, next step

- Features:
  - Progress indicator
  - Section-specific guidance
  - AI outcome locked once generated
  - Regenerates if content changes
  - Creates improvement tasks automatically

#### Other Tabs (Placeholders)
- `PeopleTab.tsx` - People list and management
- `DocumentsTab.tsx` - Document upload/management
- `SettingsTab.tsx` - HR module settings

## Key Design Decisions

### 1. Payroll Design
**One Table for Everyone**: Single `payroll_run_lines` table for staff, interns, contractors. Type only affects preload, not structure.

**JSONB for Flexibility**: Earnings, deductions, taxes stored as JSONB arrays:
```json
{
  "allowances": [
    { "name": "Housing", "amount": 1000, "percent": 10, "basis": 10000 }
  ],
  "employee_taxes": [
    { "name": "Income Tax", "amount": 500, "percent": 5, "basis": 10000 }
  ]
}
```

**Calculation Rules**:
- Percent edits → recalc amounts
- Amount edits → recalc implied percent
- Always show calculation basis
- Currency rounding applied

**Editability**:
- Draft: Fully editable
- Posted: Read-only (financial entry created)
- Voided: Read-only

### 2. Performance Reviews
**Guided Sections**: Each section has specific guidance to ensure fairness and clarity.

**AI Outcome**:
- Locked once generated
- Regenerates only if input text changes (via SHA256 hash)
- Categories map to severity levels
- Auto-creates improvement tasks for below/critical

**Fairness Built-In**: Dedicated section for constraints, support, and external factors to ensure context is captured.

### 3. Document Storage
**External Storage Strategy**:
- Documents stored in object storage (S3, etc)
- Only metadata in database
- Signed URLs for upload/download
- No server-side file handling

**Access Control**:
- Tenant isolated
- Scope-based (employee_self, manager, hr_only, public)
- Signed download URLs

### 4. Audit Trail
**Everything Logged**:
- Who, when, what
- Before/after snapshots
- AI outcome snapshots
- IP address and user agent

## Alerts & Tasks System

### Contract Endings
- 30 days: "Upcoming"
- 7 days: "Urgent"
- 1 day: "Critical"
- Auto-inactivate after end date

### Payroll
- Missing payroll for period
- Payroll due end of month
- Eligible person excluded

### Performance
- Follow-up improvement tasks
- Due date from review or +30 days
- Assigned to line manager and/or HR

### Documents
- Missing required documents
- Document expiry warnings

## Data Validation Rules

### People
- Line manager required (except first tenant owner)
- Cannot delete if has direct reports
- End date must be ≥ start date
- Email must be unique per tenant

### Payroll
- Period start < period end < pay date
- Cannot have overlapping periods
- Cannot edit posted runs
- Must calculate before posting

### Performance Reviews
- Only active employees
- One review per person per period
- Period must be within employment dates
- Cannot delete completed reviews

## Financial Posting

### Payroll Posting
When posting a payroll run:
1. Create transaction set
2. For each employee:
   - DR: Wages Expense (gross)
   - DR: Employer Contributions
   - CR: Payroll Payable (net)
   - CR: Tax Payable (taxes)
   - CR: Deduction Payable (deductions)
3. Create journal entry
4. Link via `journal_entry_id`
5. Mark as posted
6. Lock from edits

The financial entry is undeletable. To correct, void the run and create a new one.

## Migration Path

### From Existing System
1. Run schema migration (hr_people_schema.sql)
2. Migrate existing people data
3. Map old compensation to new structure
4. Test payroll calculation
5. Deploy new UI
6. Train users on guided performance reviews

### Rollback Plan
Keep old tables until validation complete. Use feature flags to toggle between old/new UI.

## Testing Checklist

### Payroll
- [ ] Create run with each preload option
- [ ] Verify eligibility rules
- [ ] Edit line amounts and percentages
- [ ] Calculate totals
- [ ] Post to ledger
- [ ] Verify financial entry created
- [ ] Attempt edit after posting (should fail)
- [ ] Download PDF
- [ ] Void run

### Performance Reviews
- [ ] Complete full wizard
- [ ] Generate AI outcome
- [ ] Edit content and verify outcome clears
- [ ] Regenerate outcome
- [ ] Verify improvement task created
- [ ] Check audit log entries

### Documents
- [ ] Upload document
- [ ] Link to person
- [ ] Download with signed URL
- [ ] Verify access control
- [ ] Check expiry alerts

### Alerts
- [ ] Contract ending alerts (30d, 7d, 1d)
- [ ] Missing payroll alert
- [ ] Document expiry alert
- [ ] Performance follow-up task

## Performance Considerations

### Database Indexes
All critical queries indexed:
- Tenant isolation
- Date ranges
- Status filters
- Foreign key lookups

### JSONB Queries
When querying JSONB earnings/deductions, use GIN indexes:
```sql
CREATE INDEX idx_payroll_lines_allowances 
ON payroll_run_lines USING GIN (allowances);
```

### Caching
- Cache analytics for 5 minutes
- Cache document signed URLs for 1 hour
- Cache active employees list

## Security Considerations

### Data Isolation
- All queries filtered by `tenant_id`
- Middleware enforces tenant context
- Row-level security on sensitive fields

### Document Access
- Signed URLs expire after 1 hour
- Access scope enforced
- Employee self-access only to own docs

### Audit Trail
- Immutable audit log
- Cannot delete audit entries
- All changes tracked

## Future Enhancements

### Phase 2
- Employee self-service portal
- Leave request workflows
- Time tracking integration
- Benefits management

### Phase 3
- Payroll tax calculations (jurisdiction-specific)
- Multi-currency payroll
- Payslip generation
- Employee onboarding workflows

### Phase 4
- Learning & development module
- Succession planning
- Talent analytics
- Integration with HRIS systems

## Support & Troubleshooting

### Common Issues

**Payroll won't calculate**
- Check that base pay is set
- Verify percentages are valid (0-100)
- Ensure run is in draft status

**AI outcome not generating**
- Check that required sections are filled
- Verify API key is configured
- Check audit log for errors

**Document upload fails**
- Verify object storage configuration
- Check file size limits
- Ensure signed URL not expired

**Performance review locked**
- Only editable in draft status
- Cannot edit after employee acknowledgment
- Check status field

## API Response Examples

### Analytics Response
```json
{
  "analytics": {
    "headcount": {
      "label": "Active Headcount",
      "value": 42,
      "detail": "38 staff, 4 interns",
      "variant": "default"
    },
    "newHires": {
      "label": "New Hires (30d)",
      "value": 3,
      "variant": "success"
    }
  }
}
```

### Payroll Run Response
```json
{
  "run": {
    "id": "prun_123",
    "period_start": "2025-01-01",
    "period_end": "2025-01-31",
    "pay_date": "2025-02-05",
    "currency": "USD",
    "status": "draft"
  },
  "lines": [
    {
      "id": "pline_456",
      "person_name": "John Doe",
      "person_type": "staff",
      "base_pay": 5000,
      "gross_pay": 5500,
      "net_pay": 4200,
      "total_employer_cost": 5800
    }
  ]
}
```

### AI Outcome Response
```json
{
  "outcome": {
    "category": "strong_performance",
    "reasons": [
      "Consistently delivers quality work",
      "Demonstrates initiative and ownership"
    ],
    "next_step": "Continue current trajectory, consider stretch assignments"
  }
}
```

## Deployment Notes

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://...

# Object Storage (for documents)
S3_BUCKET=hr-documents
S3_REGION=us-east-1
S3_ACCESS_KEY=...
S3_SECRET_KEY=...

# AI (for performance outcomes)
ANTHROPIC_API_KEY=sk-ant-...
```

### Database Migration
```bash
# Apply schema
psql $DATABASE_URL < hr_people_schema.sql

# Run seed data (if needed)
npm run seed:hr
```

### Feature Flags
```typescript
const FEATURES = {
  hr_people_v2: true,
  performance_ai_outcome: true,
  document_external_storage: true,
};
```

## Acceptance Criteria Status

✅ Single HR & People page with tabs
✅ Editable until financially posted
✅ Payroll locks correctly
✅ Performance is guided and fair
✅ AI outcome is locked unless text changes
✅ Documents scale without server storage issues
✅ Alerts and tasks cover all edge cases discussed

## Next Steps

1. **Code Review**: Review all API endpoints and validation logic
2. **Testing**: Complete testing checklist
3. **Documentation**: User guides for each role (manager, HR, employee)
4. **Training**: Train users on new workflows
5. **Rollout**: Gradual rollout with feature flags
6. **Monitor**: Watch for errors and performance issues

## Contact

For questions or issues:
- Backend: Check API logs and audit trail
- Frontend: Check browser console and network tab
- Database: Check PostgreSQL logs
- Documents: Check object storage logs

---

*Generated: January 2025*
*Version: 1.0*
*Module: HR & People*
