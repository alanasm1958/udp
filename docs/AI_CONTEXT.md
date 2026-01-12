# UDP - Universal Data Platform - AI Context Document

## Project Overview
UDP is a comprehensive, multi-tenant ERP/business application with integrated modules for HR, Finance, Inventory, Sales, Procurement, GRC, Marketing, and Strategy. Built with Next.js 16, React 19, Drizzle ORM, PostgreSQL, and Tailwind CSS.

---

## Technology Stack

### Runtime & Framework
- **Next.js**: 16.1.1 (App Router, React Server Components)
- **React**: 19.2.3
- **Node.js**: 20+
- **TypeScript**: ^5 (strict mode)

### Database & ORM
- **PostgreSQL** (via pg: ^8.16.3)
- **Drizzle ORM**: ^0.45.1 (type-safe SQL builder)
- **Drizzle Kit**: ^0.31.8 (migrations)

### Authentication & Payments
- **jose**: ^6.1.3 (JWT JOSE standard)
- **Stripe**: ^20.1.0 (billing)

### Styling
- **Tailwind CSS**: ^4
- **Glass-morphism UI design**

---

## Architecture Principles

### Multi-Tenant Design
- All tables have `tenantId` for data isolation
- Middleware enforces tenant context on every request
- Tenant-scoped unique indexes

### Posting Model (Financial)
- Transactional posting: `transactionSets` → `postingIntents` → `journalEntries`
- Idempotent posting tracking via `postingRuns`
- Reversal support via `reversalLinks`

### Commercial Documents
- Non-posting design for flexibility (quotes, orders, invoices)
- Fulfillment linking (sales) and receipt linking (procurement)
- Independent posting via linking tables

---

## Database Schema

### Core System Tables

#### Authentication & Users
```
tenants              - Multi-tenant root (id, name, domain, settings)
users                - User accounts (id, tenantId, email, passwordHash, fullName, isActive)
roles                - Role definitions (id, tenantId, name, permissions)
userRoles            - User-role mapping (userId, roleId)
actors               - Actor context (id, tenantId, type[user|system|connector], userId)
```

#### Audit Trail
```
auditEvents          - Append-only audit log (id, tenantId, actorId, entityType, entityId, action, occurredAt, metadata)
```

#### Documents
```
documents            - File storage (id, tenantId, name, mimeType, size, storageKey, url)
documentExtractions  - AI-extracted data from documents
documentLinks        - Links documents to entities
```

### Financial/Accounting Layer

#### Chart of Accounts
```
chartOfAccounts      - COA definitions (id, tenantId, name, isDefault)
accounts             - Account records (id, tenantId, coaId, code, name, type, parentId, isActive)
                     - Types: asset, liability, equity, income, expense, contra_asset, contra_liability, contra_equity, contra_income, contra_expense
```

#### Journal & Posting
```
journalEntries       - Journal headers (id, tenantId, entryDate, memo, status[draft|posted|reversed], reversedById)
journalLines         - Journal lines (id, journalEntryId, accountId, debit, credit, memo)
transactionSets      - Business transaction batches (id, tenantId, status, sourceType, sourceId)
businessTransactions - Individual transactions in set
businessTransactionLines - Transaction line details
postingIntents       - Posting queue items
postingRuns          - Idempotent posting tracking
reversalLinks        - Links reversed entries
```

#### Payments & Allocations
```
payments             - Payment records (id, tenantId, paymentType[receipt|payment], method[cash|bank|check|card],
                       partyId, amount, status[draft|posted|void], paymentDate)
paymentAllocations   - Allocation to documents (id, paymentId, targetType[sales_doc|purchase_doc], targetId, amount)
paymentPostingLinks  - Links payments to journal entries
```

#### Advanced Financial
```
prepaidExpenses             - Prepaid expense tracking
prepaidAmortizationSchedule - Amortization schedules
deferredRevenue             - Deferred revenue tracking
deferredRevenueRecognition  - Recognition schedules
```

### Master Data Layer

#### Parties (Customers/Vendors/Employees)
```
parties              - All business parties (id, tenantId, type[customer|vendor|employee|bank|government|other],
                       code, name, isActive, defaultCurrency, creditLimit, paymentTerms)
partyProfiles        - Extended party info (address, phone, email, taxId)
partyIdentifiers     - Additional identifiers (type, value)
```

#### Products & Services
```
products             - Product catalog (id, tenantId, type[good|service], sku, name, description,
                       unitPrice, costPrice, uomId, taxCategoryId, isActive)
productIdentifiers   - Barcodes, SKUs, etc.
items                - Unified item catalog (products + services + assets)
```

#### Dimensions
```
dimensionDefinitions - Dimension types (id, tenantId, code, name, type[cost_center|department|project|region])
dimensionValues      - Dimension values (id, dimensionId, code, name)
entityDimensions     - Links dimensions to entities
```

#### Warehouses & Locations
```
warehouses           - Warehouse records (id, tenantId, code, name, address, isActive)
storageLocations     - Storage locations within warehouses (id, warehouseId, code, name)
```

#### Reference Data
```
uoms                 - Units of measure
taxCategories        - Tax rate categories
```

### Inventory Management

```
inventoryMovements   - Movement history (id, tenantId, movementType[receipt|issue|transfer|adjustment],
                       productId, warehouseId, locationId, quantity, status[draft|posted|reversed], movementDate)
inventoryBalances    - Current balances (id, tenantId, productId, warehouseId, locationId,
                       onHand, reserved, available)
inventoryPostingLinks - Links movements to journal entries
```

### Commercial Documents

#### Sales
```
salesDocs            - Sales documents (id, tenantId, docType[quote|order|invoice|credit_note|debit_note],
                       docNumber, partyId, docDate, dueDate, status[draft|issued|approved|partially_fulfilled|fulfilled|cancelled],
                       totalAmount, currency)
salesDocLines        - Line items (id, salesDocId, lineNo, productId, description, quantity, unitPrice, lineTotal)
salesFulfillments    - Fulfillment records (id, salesDocId, fulfillmentDate, warehouseId, status)
salesPostingLinks    - Links to journal entries
```

#### Procurement
```
purchaseDocs         - Purchase documents (id, tenantId, docType[quote|order|invoice|credit_note|debit_note],
                       docNumber, partyId, docDate, dueDate, status, totalAmount, currency)
purchaseDocLines     - Line items
purchaseReceipts     - Receipt records (id, purchaseDocId, receiptType[receive|unreceive|return_to_vendor])
purchasePostingLinks - Links to journal entries
```

### HR/People Module

#### Employee Management
```
people               - People records (id, tenantId, type[employee|contractor|intern], firstName, lastName,
                       email, phone, status[active|inactive|terminated], hireDate, terminationDate)
employees            - Extended employee data (personId, employeeNumber, departmentId, managerId,
                       employmentStatus, employmentType, workLocation)
```

#### Compensation
```
compensationRecords  - Compensation history (id, employeeId, effectiveDate, salary, payType[salary|hourly],
                       payFrequency, currency, changeReason)
```

#### Payroll
```
paySchedules         - Pay schedule definitions (id, tenantId, name, frequency[weekly|biweekly|semimonthly|monthly])
payPeriods           - Pay period instances (id, scheduleId, startDate, endDate, payDate, status)
payrollRuns          - Payroll run headers (id, tenantId, payPeriodId, status[draft|calculated|approved|posted|void])
payrollRunEmployees  - Employees in payroll run
payrollEarnings      - Earnings detail
payrollDeductions    - Deduction detail
payrollTaxes         - Tax withholding detail
earningTypes         - Earning type definitions
deductionTypes       - Deduction type definitions
```

#### Leave Management
```
leaveTypes           - Leave type definitions (id, tenantId, code, name, accrualType[none|annual|monthly|per_pay_period],
                       accrualRate, maxCarryover, defaultBalance)
leaveRequests        - Leave requests (id, employeeId, leaveTypeId, startDate, endDate, status[pending|approved|rejected|cancelled])
leaveBalances        - Current leave balances (employeeId, leaveTypeId, balance, used, pending)
```

#### Performance Management
```
performanceCycles    - Review cycles (id, tenantId, name, startDate, endDate, status[draft|active|completed])
performanceReviews   - Individual reviews (id, cycleId, employeeId, reviewerId, status[pending|in_progress|completed], rating)
performanceGoals     - Goals/objectives (id, reviewId, description, weight, selfRating, managerRating)
performanceReviewRatings - Rating criteria
```

### GRC Module (Governance, Risk, Compliance)

```
grcRisks             - Risk register (id, tenantId, title, description, category, severity[low|medium|high|critical],
                       likelihood, impact, status[identified|assessed|mitigated|accepted|closed])
grcControls          - Control definitions (id, tenantId, title, description, category, status[draft|active|inactive],
                       frequency, owner)
grcControlTests      - Control test results (id, controlId, testDate, result[passed|failed|not_tested], notes)
grcIncidents         - Incident log (id, tenantId, title, description, category, severity, status[open|investigating|resolved|closed],
                       reportedDate, resolvedDate)
```

### Marketing Module

```
marketingCampaigns   - Campaign records (id, tenantId, name, type, status, startDate, endDate, budget, spent)
marketingChannels    - Channel definitions (id, tenantId, name, type, status, monthlyBudget)
marketingTasks       - Marketing tasks
marketingAnalyticsCards - Analytics card definitions
marketingInsights    - AI-generated insights
marketingWhatIfScenarios - Scenario modeling
marketingManualEntries - Manual data entries
marketingObjectives  - Marketing objectives
marketingPlans       - Marketing plans
```

### Strategy & Planning

```
budgets              - Budget headers (id, tenantId, name, type[marketing|sales|opex|capex|payroll|project],
                       fiscalYear, status[draft|active|closed])
budgetVersions       - Budget versions (for revisions)
budgetLines          - Budget line items (id, budgetId, accountId, period, amount)
budgetLineDimensions - Dimensional allocation

objectives           - Strategic objectives (id, tenantId, title, description, status[active|archived|completed],
                       targetDate, progress)
initiatives          - Strategic initiatives (id, tenantId, objectiveId, title, status[active|paused|completed|archived],
                       startDate, endDate, budget)

kpiDefinitions       - KPI definitions (id, tenantId, name, description, unit[%|USD|count|ratio|days], formula)
kpiTargets           - KPI targets (id, kpiId, period, targetValue)
kpiMeasurements      - KPI measurements (id, kpiId, period, actualValue, measurementDate)
```

### Tasks & Alerts System

```
tasks                - Task records (id, tenantId, title, description, domain[operations|sales|finance|hr|marketing],
                       status[open|done|dismissed], priority[low|medium|high|critical], dueAt, assignedToUserId)
taskEvents           - Task event history

alerts               - Alert records (id, tenantId, title, message, severity[info|warning|critical],
                       source[system|ai|connector], status[active|dismissed|resolved], entityType, entityId)
alertEvents          - Alert event history
```

### AI/Automation

```
aiConversations      - AI conversation sessions (id, tenantId, userId, context, status)
aiMessages           - Conversation messages (id, conversationId, role[user|assistant|system], content)
aiToolRuns           - Tool execution log (id, conversationId, toolName, input, output, status)
aiTasks              - AI-generated tasks (id, tenantId, title, description, type, status,
                       linkedEntityType, linkedEntityId, resolutionAction)
```

### Validation & Approvals

```
validationRules      - Validation rule definitions (id, tenantId, entityType, ruleName, condition, severity)
validationIssues     - Validation issue instances (id, ruleId, entityType, entityId, status[open|resolved|overridden])
validationResolutions - Resolution history

overrides            - Override approvals (id, issueId, approvedBy, reason, expiresAt)

approvals            - Approval workflow (id, tenantId, entityType, entityId, status[pending|approved|rejected],
                       requestedBy, approvedBy, approvedAt)
```

### Subscription & Billing

```
subscriptionPlans    - Plan definitions (id, code, name, price, interval, features, capabilities)
tenantSubscriptions  - Tenant subscriptions (id, tenantId, planId, status[active|cancelled|past_due],
                       currentPeriodStart, currentPeriodEnd, stripeSubscriptionId)
```

---

## API Routes

### Authentication (/api/auth/)
| Route | Methods | Description |
|-------|---------|-------------|
| /api/auth/login | POST | User login, returns JWT |
| /api/auth/signup | POST | User registration |
| /api/auth/logout | POST | Clear session |
| /api/auth/me | GET | Get current user |
| /api/auth/session | GET | Validate session |
| /api/auth/bootstrap | POST | Bootstrap admin user |

### Admin (/api/admin/)
| Route | Methods | Description |
|-------|---------|-------------|
| /api/admin/users | GET, POST | List/create users |
| /api/admin/tenant | GET, PATCH | Tenant settings |
| /api/admin/tenant/subscription | GET, PATCH | Subscription management |

### Finance (/api/finance/)
| Route | Methods | Description |
|-------|---------|-------------|
| /api/finance/payments | GET, POST | List/create payments |
| /api/finance/payments/[id] | GET, PATCH | Get/update payment |
| /api/finance/payments/[id]/post | POST | Post payment to ledger |
| /api/finance/payments/[id]/void | POST | Void payment |
| /api/finance/payments/[id]/allocations | GET, POST, DELETE | Manage allocations |
| /api/finance/payments/[id]/unallocate | POST | Remove allocation |
| /api/finance/ar/open | GET | Open AR invoices |
| /api/finance/ap/open | GET | Open AP invoices |
| /api/finance/ar/statement | GET | AR statement |
| /api/finance/ap/statement | GET | AP statement |
| /api/finance/capital | POST | Capital transactions |
| /api/finance/expenses | POST | Expense transactions |
| /api/finance/transfers | POST | Bank transfers |

### Sales (/api/sales/)
| Route | Methods | Description |
|-------|---------|-------------|
| /api/sales/docs | GET, POST | List/create sales docs |
| /api/sales/docs/[id] | GET, PATCH | Get/update doc |
| /api/sales/docs/[id]/lines | GET, POST, DELETE | Manage lines |
| /api/sales/docs/[id]/post | POST | Post to ledger |
| /api/sales/docs/[id]/fulfill | POST | Record fulfillment |
| /api/sales/docs/[id]/fulfillments | GET | List fulfillments |

### Procurement (/api/procurement/)
| Route | Methods | Description |
|-------|---------|-------------|
| /api/procurement/docs | GET, POST | List/create purchase docs |
| /api/procurement/docs/[id] | GET, PATCH | Get/update doc |
| /api/procurement/docs/[id]/lines | GET, POST, DELETE | Manage lines |
| /api/procurement/docs/[id]/post | POST | Post to ledger |
| /api/procurement/docs/[id]/receive | POST | Record receipt |
| /api/procurement/docs/[id]/receipts | GET | List receipts |

### Master Data (/api/master/)
| Route | Methods | Description |
|-------|---------|-------------|
| /api/master/products | GET, POST | Products |
| /api/master/products/[id] | GET, PATCH, DELETE | Product CRUD |
| /api/master/parties | GET, POST | Parties |
| /api/master/parties/[id] | GET, PATCH, DELETE | Party CRUD |
| /api/master/warehouses | GET, POST | Warehouses |
| /api/master/warehouses/[id] | GET, PATCH, DELETE | Warehouse CRUD |
| /api/master/warehouses/[id]/locations | GET, POST | Storage locations |
| /api/master/dimensions | GET, POST | Dimensions |
| /api/master/dimensions/[id]/values | GET, POST | Dimension values |
| /api/master/categories | GET, POST | Categories |

### Reports (/api/reports/)
| Route | Methods | Description |
|-------|---------|-------------|
| /api/reports/trial-balance | GET | Trial balance |
| /api/reports/general-ledger | GET | General ledger |
| /api/reports/finance/cashbook | GET | Cashbook |
| /api/reports/inventory/balances | GET | Inventory balances |
| /api/reports/dashboard | GET | Dashboard metrics |

### People/HR (/api/people/, /api/payroll/)
| Route | Methods | Description |
|-------|---------|-------------|
| /api/people | GET, POST | List/create people |
| /api/people/[id] | GET, PATCH, DELETE | Person CRUD |
| /api/people/documents | GET, POST | HR documents |
| /api/people/documents/[id] | GET, PATCH, DELETE | Document CRUD |
| /api/people/leave-types | GET, POST | Leave types |
| /api/people/leave-requests | GET, POST | Leave requests |
| /api/people/leave-requests/[id] | GET, PATCH | Request approval |
| /api/people/performance-cycles | GET, POST | Performance cycles |
| /api/people/performance-cycles/[id] | GET, PATCH, DELETE | Cycle CRUD |
| /api/people/performance-reviews | GET, POST | Reviews |
| /api/people/performance-reviews/[id] | GET, PATCH | Review CRUD |
| /api/payroll/employees | GET, POST | Payroll employees |
| /api/payroll/employees/[id] | GET, PATCH | Employee payroll |
| /api/payroll/employees/[id]/compensation | GET, POST | Compensation |
| /api/payroll/employees/[id]/deductions | GET, POST | Deductions |
| /api/payroll/runs | GET, POST | Payroll runs |
| /api/payroll/runs/[id] | GET, PATCH | Run details |
| /api/payroll/runs/[id]/calculate | POST | Calculate payroll |
| /api/payroll/runs/[id]/approve | POST | Approve run |
| /api/payroll/runs/[id]/post | POST | Post to ledger |

### Strategy (/api/strategy/)
| Route | Methods | Description |
|-------|---------|-------------|
| /api/strategy/budgets | GET, POST | Budgets |
| /api/strategy/budgets/[id] | GET, PATCH, DELETE | Budget CRUD |
| /api/strategy/budgets/[id]/lines | GET, POST | Budget lines |
| /api/strategy/objectives | GET, POST | Objectives |
| /api/strategy/objectives/[id] | GET, PATCH, DELETE | Objective CRUD |
| /api/strategy/initiatives | GET, POST | Initiatives |
| /api/strategy/initiatives/[id] | GET, PATCH, DELETE | Initiative CRUD |
| /api/strategy/kpis | GET, POST | KPIs |
| /api/strategy/kpis/[id] | GET, PATCH, DELETE | KPI CRUD |
| /api/strategy/kpis/[id]/targets | GET, POST | KPI targets |
| /api/strategy/kpis/[id]/measurements | GET, POST | KPI measurements |

### Operations (/api/operations/)
| Route | Methods | Description |
|-------|---------|-------------|
| /api/operations/metrics | GET | Operations metrics |
| /api/operations/tasks | GET, POST | Operations tasks |
| /api/operations/alerts | GET | Operations alerts |
| /api/operations/service-jobs | GET, POST | Service jobs |
| /api/operations/service-jobs/[id] | GET, PATCH, DELETE | Job CRUD |

### GRC (/api/grc/)
| Route | Methods | Description |
|-------|---------|-------------|
| /api/grc/alerts | GET | GRC alerts (operational) |

### AI (/api/ai-tasks/)
| Route | Methods | Description |
|-------|---------|-------------|
| /api/ai-tasks | GET, POST | AI tasks |
| /api/ai-tasks/[id] | GET, PUT | Task CRUD |

---

## Frontend Pages

### Dashboard
- `/dashboard` - Main dashboard with KPIs and alerts
- `/dashboard/cards` - Dashboard card configuration

### Finance
- `/finance/payments` - Payment list
- `/finance/payments/[id]` - Payment detail
- `/finance/ar` - Accounts receivable
- `/finance/ap` - Accounts payable
- `/finance/ar-aging` - AR aging report
- `/finance/cash-position` - Cash position
- `/finance/trial-balance` - Trial balance
- `/finance/general-ledger` - General ledger

### Sales
- `/sales` - Sales documents
- `/sales/[id]` - Document detail
- `/sales/pipeline` - Sales pipeline
- `/sales-customers` - Unified sales/customer view

### Procurement
- `/procurement` - Purchase documents
- `/procurement/[id]` - Document detail

### Inventory
- `/inventory/balances` - Inventory balances

### Master Data
- `/master/products` - Products
- `/master/parties` - Parties (customers/vendors)
- `/items` - Unified item catalog

### Company
- `/company` - Company overview
- `/company/master` - Company master data
- `/company/master/categories` - Categories
- `/company/organization` - Org structure

### People/HR
- `/people` - People/HR module (tabs: People, Payroll, Performance, Documents, Settings)

### Marketing
- `/marketing` - Marketing module (Overview, Campaigns, Planner, What-If)

### Operations
- `/operations` - Operations dashboard
- `/operations/catalog` - Service catalog
- `/operations/fulfillment` - Fulfillment
- `/operations/warehouses` - Warehouses
- `/operations/services` - Services

### Strategy
- `/strategy` - Strategy dashboard
- `/strategy/initiatives` - Initiatives

### GRC
- `/grc` - GRC dashboard
- `/grc/alerts` - Alerts
- `/grc/audit` - Audit log

### Settings
- `/settings` - Settings overview
- `/settings/billing` - Billing/subscription
- `/settings/tenant` - Tenant settings
- `/settings/users` - User management

### Admin
- `/admin/users` - Admin user management

### Customers
- `/customers` - Customer list
- `/customers/accounts` - Customer accounts

---

## UI Components

### Glass Component Library (`src/components/ui/glass.tsx`)
Core glass-morphism UI components:

```typescript
// Layout
GlassCard        - Card container with glass effect
GlassModal       - Modal dialog
SlideOver        - Slide-over panel
GlassTabs        - Tab navigation

// Form Elements
GlassInput       - Text input
GlassTextArea    - Multi-line input
GlassSelect      - Dropdown select
GlassCheckbox    - Checkbox
GlassRadio       - Radio button
GlassSwitch      - Toggle switch

// Buttons
GlassButton      - Primary button (variants: primary, secondary, danger, ghost)
GlassIconButton  - Icon-only button

// Display
GlassBadge       - Status badge (variants: default, success, warning, danger, info)
GlassTable       - Data table (headers, rows, emptyMessage)
GlassAvatar      - User avatar

// Feedback
Spinner          - Loading spinner
useToast         - Toast notifications (addToast(type, message))

// Data Display
GlassProgress    - Progress bar
GlassStat        - Statistic display
```

### Module Layout (`src/components/layout/module-layout.tsx`)
Reusable module page components:

```typescript
ModulePageHeader    - Page title and actions
AnalyticsSection    - Analytics cards container
AnalyticsCard       - Single analytics card (variant, label, value, status)
TodoAlertsSection   - Combined todo/alerts layout
TodoPanel           - Todo list panel
AlertsPanel         - Alerts panel
QuickAccessSection  - Quick access links
QuickAccessCard     - Quick access card
```

### App Shell (`src/components/layout/shell.tsx`)
Main application shell:

```typescript
AppShell            - Main layout wrapper
Sidebar             - Navigation sidebar
Header              - Top header with user menu
```

### AI Components (`src/components/ai/`)
```typescript
CopilotSidebar      - AI assistant sidebar
OmniWindow          - Transaction entry modal
Planner             - AI-powered planner
```

---

## Middleware

### Authentication Flow (`src/middleware.ts`)

```typescript
// Request flow:
1. Check public paths (login, signup, onboarding, public API)
2. Verify JWT token from cookies
3. Check subscription status
4. Inject headers:
   - x-tenant-id
   - x-user-id
   - x-actor-id
   - x-user-roles
   - x-user-email
   - x-subscription-plan
   - x-subscription-active
5. Continue to route handler

// Error responses:
- 401 Unauthorized - Invalid/missing token
- 402 Payment Required - Subscription expired
- 403 Forbidden - Insufficient permissions
```

### Tenant Context
All API routes can access tenant context via headers:

```typescript
import { headers } from "next/headers";

const headersList = await headers();
const tenantId = headersList.get("x-tenant-id");
const userId = headersList.get("x-user-id");
const actorId = headersList.get("x-actor-id");
```

---

## Key Workflows

### 1. Sales Invoice Workflow
```
1. Create sales doc (draft) → POST /api/sales/docs
2. Add line items → POST /api/sales/docs/[id]/lines
3. Issue to customer → PATCH /api/sales/docs/[id] {status: "issued"}
4. Post to ledger → POST /api/sales/docs/[id]/post
   - Creates journal entry (DR: Receivable, CR: Revenue)
5. Receive payment → POST /api/finance/payments
6. Allocate to invoice → POST /api/finance/payments/[id]/allocations
7. Post payment → POST /api/finance/payments/[id]/post
   - Creates journal entry (DR: Cash, CR: Receivable)
```

### 2. Purchase Invoice Workflow
```
1. Create purchase doc (draft) → POST /api/procurement/docs
2. Add line items → POST /api/procurement/docs/[id]/lines
3. Receive goods → POST /api/procurement/docs/[id]/receive
   - Creates inventory movements
4. Post to ledger → POST /api/procurement/docs/[id]/post
   - Creates journal entry (DR: Inventory/Expense, CR: Payable)
5. Create payment → POST /api/finance/payments
6. Allocate to invoice → POST /api/finance/payments/[id]/allocations
7. Post payment → POST /api/finance/payments/[id]/post
   - Creates journal entry (DR: Payable, CR: Cash)
```

### 3. Payroll Workflow
```
1. Configure pay schedule → POST /api/payroll/pay-schedules
2. Add employees to payroll → POST /api/payroll/employees
3. Set compensation → POST /api/payroll/employees/[id]/compensation
4. Create payroll run → POST /api/payroll/runs
5. Calculate payroll → POST /api/payroll/runs/[id]/calculate
6. Review and approve → POST /api/payroll/runs/[id]/approve
7. Post to ledger → POST /api/payroll/runs/[id]/post
   - Creates journal entries for wages, taxes, deductions
```

### 4. Leave Request Workflow
```
1. Employee submits request → POST /api/people/leave-requests
2. Manager reviews → GET /api/people/leave-requests?status=pending
3. Approve/reject → PATCH /api/people/leave-requests/[id] {status: "approved"}
4. System updates leave balance automatically
```

### 5. Performance Review Workflow
```
1. Create review cycle → POST /api/people/performance-cycles
2. System creates reviews for employees
3. Employee self-assessment → PATCH /api/people/performance-reviews/[id]
4. Manager assessment → PATCH /api/people/performance-reviews/[id]
5. Complete cycle → PATCH /api/people/performance-cycles/[id] {status: "completed"}
```

---

## Library Utilities

### Core (`src/lib/`)
| File | Purpose |
|------|---------|
| auth.ts | JWT session management, cookies |
| http.ts | HTTP client (apiGet, apiPost, apiPatch, apiDelete) |
| tenant.ts | Multi-tenant context |
| actor.ts | Actor context management |
| subscription.ts | Subscription validation |
| entitlements.ts | Feature entitlements |
| authz.ts | Authorization/RBAC |
| password.ts | Password hashing |

### Financial (`src/lib/`)
| File | Purpose |
|------|---------|
| coa.ts | Chart of accounts |
| arAp.ts | AR/AP logic |
| posting.ts | Journal posting |
| audit.ts | Audit trail |

### Domain (`src/lib/`)
| File | Purpose |
|------|---------|
| payroll/calculator.ts | Payroll calculations |
| payroll/types.ts | Payroll types |
| ai/provider.ts | LLM integration |
| ai/tools.ts | AI tool definitions |
| marketing/task-triggers.ts | Marketing automation |

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Authentication
JWT_SECRET=your-jwt-secret

# Stripe (Billing)
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...

# AI (Optional)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

---

## Development Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm run db:generate  # Generate migrations
npm run db:migrate   # Apply migrations
npm run db:studio    # Drizzle Studio (visual DB)
npm run db:seed      # Seed data
```

---

## File Structure

```
/src
├── app/
│   ├── (app)/           # Authenticated pages
│   │   ├── dashboard/
│   │   ├── finance/
│   │   ├── sales/
│   │   ├── procurement/
│   │   ├── inventory/
│   │   ├── master/
│   │   ├── people/
│   │   ├── marketing/
│   │   ├── operations/
│   │   ├── strategy/
│   │   ├── grc/
│   │   ├── settings/
│   │   └── admin/
│   ├── api/             # API routes
│   │   ├── auth/
│   │   ├── admin/
│   │   ├── finance/
│   │   ├── sales/
│   │   ├── procurement/
│   │   ├── master/
│   │   ├── people/
│   │   ├── payroll/
│   │   ├── operations/
│   │   ├── strategy/
│   │   ├── grc/
│   │   └── reports/
│   ├── login/
│   ├── signup/
│   └── onboarding/
├── components/
│   ├── ui/glass.tsx     # Glass UI components
│   ├── layout/          # Layout components
│   ├── ai/              # AI components
│   └── operations/      # Operations components
├── db/
│   └── schema.ts        # Drizzle schema (5,353 lines)
├── lib/                 # Utilities
│   ├── auth.ts
│   ├── http.ts
│   ├── posting.ts
│   ├── payroll/
│   └── ai/
├── hooks/               # React hooks
│   └── useAIValidator.ts
└── middleware.ts        # Auth middleware
/drizzle                 # Migrations
/scripts                 # Utility scripts
/docs                    # Documentation
```

---

## Summary Statistics

- **Database**: 286 tables, 34 enums
- **API Routes**: 158 route files, 22 domains
- **Frontend Pages**: 47 pages, 18 modules
- **Components**: Core glass UI library + layout + AI
- **Schema File**: 5,353 lines
- **Tech Stack**: Next.js 16 + React 19 + Drizzle + PostgreSQL + Stripe + Tailwind

---

*Generated: January 2026*
*For AI context and development assistance*
