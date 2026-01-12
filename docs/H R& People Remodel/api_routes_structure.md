# HR & PEOPLE MODULE - API ROUTES

## Route Structure

```
/api/people/
├── route.ts                      # GET: List people, POST: Create person
├── [id]/
│   ├── route.ts                  # GET: Person details, PATCH: Update, DELETE: Delete
│   ├── addresses/route.ts        # GET: List addresses, POST: Add address
│   ├── employment/route.ts       # GET: Employment history, POST: Add employment
│   └── documents/route.ts        # GET: Person documents
│
├── analytics/route.ts            # GET: Dashboard analytics
├── alerts/route.ts               # GET: HR alerts
│
├── payroll/
│   ├── runs/route.ts             # GET: List runs, POST: Create run
│   ├── runs/[id]/
│   │   ├── route.ts              # GET: Run details, PATCH: Update run
│   │   ├── lines/route.ts        # GET: Lines, POST: Add line, PATCH: Bulk update
│   │   ├── calculate/route.ts    # POST: Calculate payroll
│   │   ├── post/route.ts         # POST: Post to ledger
│   │   ├── void/route.ts         # POST: Void run
│   │   └── pdf/route.ts          # GET: Generate PDF
│   └── current-period/route.ts   # GET: Current period info
│
├── performance/
│   ├── reviews/route.ts          # GET: List reviews, POST: Create review
│   ├── reviews/[id]/
│   │   ├── route.ts              # GET: Review details, PATCH: Update
│   │   ├── generate-outcome/route.ts  # POST: Generate AI outcome
│   │   └── acknowledge/route.ts  # POST: Employee acknowledge
│   └── eligibility/route.ts      # GET: Check eligibility
│
└── documents/
    ├── route.ts                  # GET: List documents, POST: Upload
    ├── [id]/route.ts             # GET: Document, DELETE: Delete
    ├── [id]/download/route.ts    # GET: Download URL
    └── [id]/verify/route.ts      # POST: Verify document
```

## Key Endpoints

### People Management
- `GET /api/people` - List all people with filters
- `POST /api/people` - Create new person (with line manager validation)
- `GET /api/people/[id]` - Get person details
- `PATCH /api/people/[id]` - Update person
- `DELETE /api/people/[id]` - Soft delete person

### Payroll
- `GET /api/people/payroll/runs` - List payroll runs
- `POST /api/people/payroll/runs` - Create new run with preload
- `GET /api/people/payroll/runs/[id]` - Get run with all lines
- `PATCH /api/people/payroll/runs/[id]` - Update run header
- `POST /api/people/payroll/runs/[id]/calculate` - Recalculate all lines
- `POST /api/people/payroll/runs/[id]/post` - Post to financial ledger
- `POST /api/people/payroll/runs/[id]/void` - Void posted run
- `GET /api/people/payroll/runs/[id]/pdf` - Generate PDF

### Performance Reviews
- `GET /api/people/performance/reviews` - List reviews
- `POST /api/people/performance/reviews` - Create review
- `GET /api/people/performance/reviews/[id]` - Get review
- `PATCH /api/people/performance/reviews/[id]` - Update review
- `POST /api/people/performance/reviews/[id]/generate-outcome` - AI outcome
- `POST /api/people/performance/reviews/[id]/acknowledge` - Employee ack

### Documents
- `GET /api/people/documents` - List documents with filters
- `POST /api/people/documents` - Upload document (returns signed URL)
- `GET /api/people/documents/[id]` - Get document metadata
- `GET /api/people/documents/[id]/download` - Get signed download URL
- `POST /api/people/documents/[id]/verify` - Verify document
- `DELETE /api/people/documents/[id]` - Delete document

### Analytics & Alerts
- `GET /api/people/analytics` - Dashboard analytics cards
- `GET /api/people/alerts` - HR alerts and todos

