# HR & PEOPLE MODULE - Clean Implementation

## Overview

Simple, focused HR & People module for disadvantaged SME owners with:
- **One page** with snapshot, todos/alerts, and quick access cards
- **Three tables**: Persons, Payroll History, Performance Reviews
- **Record Activity drawer** for all entries
- **Comprehensive person management** with platform access
- **Multi-step payroll wizard** with AI analysis
- **Performance reviews** with dual acceptance locking

---

## 📦 What's Included

### 1. Database Schema (`hr_people_schema_clean.sql`)
- `hr_persons` - All persons (staff, interns, contractors, etc.)
- `hr_payroll_runs` - Payroll run headers
- `hr_payroll_lines` - Individual payroll entries with AI analysis
- `hr_performance_reviews` - Performance reviews with dual locking
- 3 analytics views for dashboard

### 2. Main Page (`hr_people_page.tsx`)
**Three Sections:**
1. **Snapshot** - Analytics cards showing key metrics
2. **To Do & Alerts** - Pending tasks and important notifications
3. **Quick Access** - Cards to navigate to Persons, Payroll, Performance tables

**Record Activity Button** - Opens drawer with:
- Add Person card → Opens comprehensive person form
- Run Payroll card → Opens multi-step wizard
- Create Performance Review card → Navigate to review form

### 3. Add Person Drawer (`AddPersonDrawer.tsx`)
Comprehensive form for hiring someone with SME-friendly explanations:

**Sections:**
- Basic Information (name, email, phone)
- Employment Details (type, title, department, dates)
- Personal Details (DOB, nationality, gender)
- Address (full address fields)
- Emergency Contact (name, phone, relationship)
- Banking Details (for payroll)
- Tax & Legal (tax ID, SSN, work permit)
- Compensation (salary, frequency, currency)
- Benefits (health insurance, pension)
- Platform Access (create account, set role)
- Notes

**Features:**
- Info tooltips (!) explaining each field
- SME-friendly language
- Optional/required field indicators
- Secure fields (password type for sensitive data)

### 4. Payroll Wizard (`PayrollWizard.tsx`)
Multi-step wizard for running payroll:

**Step 1: Filter & Period**
- Select employment types (checkboxes)
- Set period start, end, and pay date
- Default to current month

**Step 2: Review & Edit**
- Preloaded payroll table with all selected employees
- Editable columns:
  - Gross salary, Overtime, Bonus, Allowances
  - Income tax, Social security, Pension, Health insurance, Other deductions
- Auto-calculated totals (Gross, Deductions, Net)
- Info tooltips (!) for each column explaining what it means
- **Analyze with AI** button - fills in compliance-based suggestions
- Totals row at bottom

**Step 3: Confirm**
- Summary cards (total employees, total gross, total net)
- Actions:
  - Save as PDF
  - Save as Spreadsheet
  - Save Draft (can edit later)
  - Confirm Payroll (locks it)

### 5. Persons Table Page (`persons_page.tsx`)
Table showing all persons with:
- Search functionality (name, email, job title)
- Columns: Name, Employment Type, Job Title, Department, Hire Date, Status
- Click row → Opens person detail page (editable)
- Back button to HR & People main page

### 6. Database Views (Analytics)
- `hr_analytics_headcount` - Active count by employment type
- `hr_analytics_payroll` - Payroll summary by status
- `hr_analytics_performance` - Performance review stats

---

## 🎯 Key Features

### 1. SME-Friendly Design
- Clear explanations everywhere
- "What is this for?" guidance
- No jargon - simple language
- Info tooltips (!) for help

### 2. Editable Until Posted
- Persons: Always editable
- Payroll: Editable until posted to finance
- Performance: Editable until both reviewer and employee accept

### 3. Dual Acceptance Locking (Performance Reviews)
```sql
is_locked BOOLEAN GENERATED ALWAYS AS 
  (reviewer_accepted AND employee_accepted) STORED
```
- Review can be edited when `is_locked = false`
- Locks automatically when both parties accept
- Database-enforced via generated column

### 4. AI Integration Points
- **Payroll**: AI analyzes compliance and suggests corrections
- Stores `ai_analyzed`, `ai_suggestions`, `compliance_issues`
- Can be run multiple times as user makes changes

### 5. Comprehensive Person Data
Everything needed when hiring:
- Identity & contact
- Employment terms
- Personal details
- Address
- Emergency contact
- Banking for payroll
- Tax & legal documents
- Compensation structure
- Benefits enrollment
- Platform access rights

---

## 📊 Analytics Cards (Snapshot)

Recommended analytics for HR dashboard:

1. **Total Headcount** - Active persons count
   ```sql
   SELECT COUNT(*) FROM hr_persons WHERE status = 'active'
   ```

2. **Headcount by Type** - Staff vs Interns vs Contractors
   ```sql
   SELECT employment_type, COUNT(*) 
   FROM hr_persons 
   WHERE status = 'active'
   GROUP BY employment_type
   ```

3. **New Hires (30d)** - Recently hired
   ```sql
   SELECT COUNT(*) FROM hr_persons 
   WHERE hire_date >= CURRENT_DATE - INTERVAL '30 days'
   ```

4. **Payroll This Month** - Current month status
   ```sql
   SELECT status FROM hr_payroll_runs
   WHERE period_start >= DATE_TRUNC('month', CURRENT_DATE)
   ORDER BY period_start DESC LIMIT 1
   ```

5. **Pending Reviews** - Not yet locked
   ```sql
   SELECT COUNT(*) FROM hr_performance_reviews
   WHERE is_locked = false
   ```

6. **Average Tenure** - How long people stay
   ```sql
   SELECT AVG(CURRENT_DATE - hire_date) 
   FROM hr_persons WHERE status = 'active'
   ```

---

## 🔌 API Endpoints

### Analytics
```
GET /api/hr-people/analytics
→ Returns analytics cards, todos, alerts
```

### Persons
```
GET    /api/hr-people/persons
POST   /api/hr-people/persons
GET    /api/hr-people/persons/:id
PATCH  /api/hr-people/persons/:id
DELETE /api/hr-people/persons/:id
```

### Payroll
```
POST   /api/hr-people/payroll/create
  { employment_types, period_start, period_end, pay_date }
  → Creates run and preloads lines

POST   /api/hr-people/payroll/analyze
  { run_id, lines }
  → AI analyzes compliance

PATCH  /api/hr-people/payroll/:id/save
  { lines, status: 'draft' }
  → Saves draft

POST   /api/hr-people/payroll/:id/confirm
  { lines }
  → Confirms and locks payroll

GET    /api/hr-people/payroll/:id/export?format=pdf|xlsx
  → Downloads payroll file

GET    /api/hr-people/payroll
  → List all payroll runs

GET    /api/hr-people/payroll/:id
  → Get payroll run details

DELETE /api/hr-people/payroll/:id
  → Delete draft payroll (only if not posted)
```

### Performance Reviews
```
GET    /api/hr-people/performance
POST   /api/hr-people/performance
GET    /api/hr-people/performance/:id
PATCH  /api/hr-people/performance/:id
DELETE /api/hr-people/performance/:id

POST   /api/hr-people/performance/:id/accept
  { party: 'reviewer' | 'employee' }
  → Accept review (auto-locks when both accept)
```

---

## 🗄️ Database Rules

### Status Values
```typescript
// Persons
status: 'active' | 'inactive' | 'terminated'

// Payroll
status: 'draft' | 'confirmed' | 'posted_to_finance'

// Performance Reviews
status: 'draft' | 'submitted' | 'acknowledged' | 'completed'
```

### Employment Types
```typescript
employment_type: 'staff' | 'intern' | 'part_time' | 
                 'contractor' | 'consultant' | 'other'
```

### Locking Rules
| Entity | Can Edit? |
|--------|-----------|
| Person | Always (unless deleted) |
| Payroll Draft | Yes |
| Payroll Confirmed | No (but can delete) |
| Payroll Posted | No (cannot delete) |
| Performance Draft | Yes |
| Performance Locked | No (both accepted) |

---

## 🎨 UI Components Used

### From Glass Library
- `GlassCard` - Card containers
- `GlassButton` - Buttons with variants (primary, secondary, ghost)
- `GlassInput` - Text inputs
- `GlassTextArea` - Multi-line text
- `GlassSelect` - Dropdowns
- `GlassCheckbox` - Checkboxes
- `GlassTable` - Data tables
- `GlassModal` - Full-screen modals
- `SlideOver` - Right-hand drawers
- `GlassBadge` - Status badges
- `useToast` - Toast notifications

### Custom Components
- `InfoTooltip` - "!" icon with hover explanation
- Progress steps in wizard
- Summary cards
- Editable table cells

---

## 💡 Implementation Notes

### Person Creation Flow
1. User clicks "Record HR & People Activity"
2. Drawer opens with 3 cards
3. User clicks "Add Person"
4. Comprehensive form appears
5. User fills required fields (*, explained for SMEs)
6. Optionally creates platform account
7. Submits → Person saved
8. Success toast → Drawer closes → Dashboard refreshes

### Payroll Flow
1. User clicks "Run Payroll" card
2. Full-screen wizard opens
3. **Step 1**: Select employment types + set period
4. Click Next → Backend preloads eligible persons
5. **Step 2**: Table appears with preloaded data
   - User can edit any field
   - Changes auto-recalculate totals
   - Click "Analyze with AI" for suggestions
6. Click Next → Go to confirmation
7. **Step 3**: Review summary
   - Export PDF/spreadsheet
   - Save draft (can resume later)
   - Confirm (locks payroll)

### Performance Review Flow
1. User creates review (person, period, content)
2. Status: `draft` → Can edit freely
3. Reviewer submits → `reviewer_accepted = true`
4. Employee reviews → `employee_accepted = true`
5. Both true → `is_locked = true` (auto-generated)
6. No further edits possible

---

## 🚀 Getting Started

### 1. Run Schema Migration
```bash
psql $DATABASE_URL < hr_people_schema_clean.sql
```

### 2. Install Files
- Copy `hr_people_page.tsx` to `app/(app)/hr-people/page.tsx`
- Copy `AddPersonDrawer.tsx` to `components/hr/AddPersonDrawer.tsx`
- Copy `PayrollWizard.tsx` to `components/hr/PayrollWizard.tsx`
- Copy `persons_page.tsx` to `app/(app)/hr-people/persons/page.tsx`

### 3. Update Sidebar
Add to sidebar navigation:
```tsx
{
  label: "HR & People",
  href: "/hr-people",
  icon: <Users />
}
```

### 4. Implement APIs
Create API routes as documented above in `app/api/hr-people/`

---

## 📝 To Do Next

### Immediate
- [ ] Create payroll history table page
- [ ] Create performance reviews table page
- [ ] Create person detail/edit page
- [ ] Implement all API endpoints
- [ ] Add API key for AI analysis (optional)

### Near Term
- [ ] Export to PDF functionality
- [ ] Export to Excel functionality
- [ ] Email payslips to employees
- [ ] Performance review templates
- [ ] Bulk upload persons (CSV)

### Future
- [ ] Automated payroll posting to finance
- [ ] Leave management
- [ ] Time tracking integration
- [ ] Document storage (contracts, IDs)
- [ ] Compliance alerts by jurisdiction

---

## 🐛 Common Issues

**Q: Person form too long?**
A: It's comprehensive by design for SME owners. All fields optional except name, type, and hire date.

**Q: Payroll table hard to edit?**
A: Consider implementing inline editing or a detail panel for complex changes.

**Q: AI analysis not working?**
A: Need to implement AI endpoint with Claude API key or use rule-based suggestions.

**Q: Can't delete payroll?**
A: Once posted to finance, it creates financial entries. Use void/reversal instead.

**Q: Performance review stuck?**
A: Check both `reviewer_accepted` and `employee_accepted` flags. Both must be true to lock.

---

## ✅ Success Criteria

This implementation is complete when:

- ✅ Single HR & People page with 3 sections
- ✅ Analytics cards show key metrics
- ✅ To-do and alerts functional
- ✅ Quick access cards navigate to tables
- ✅ "Record Activity" button opens drawer
- ✅ Add Person form has all fields with explanations
- ✅ Payroll wizard has 3 steps with AI analysis
- ✅ Column tooltips (!) explain each field
- ✅ Persons table clickable to edit
- ✅ Payroll editable until posted
- ✅ Performance reviews lock with dual acceptance

---

*Clean, simple, SME-friendly HR management*
*Built for disadvantaged business owners*
*January 2026*
