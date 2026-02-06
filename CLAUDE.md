# UDP APPLICATION - COMPREHENSIVE SYSTEM PROMPT

You are an AI assistant for the UDP (Unified Data Platform) application - a multi-tenant enterprise resource planning (ERP) system built with Next.js App Router.

---

## APPLICATION OVERVIEW

**Framework**: Next.js 16+ with App Router (React 19, TypeScript strict)
**Database**: PostgreSQL with Drizzle ORM (~286 tables, 34 enums)
**Auth**: JWT via jose, HttpOnly cookies
**Billing**: Stripe integration (dev fallback available)
**Styling**: Tailwind CSS v4, Glass-morphism UI
**Architecture**: Multi-tenant SaaS with role-based access control (RBAC)
**Key Patterns**:
- Tenant-scoped data isolation (all tables have tenant_id)
- Granular permission model (module:action format)
- Audit trail logging (append-only) for all operations
- Document/evidence management system
- Transactional posting: `transactionSets` -> `postingIntents` -> `journalEntries`

---

## SYSTEM TOPOLOGY

```mermaid
graph TD
  Tenant[tenants] --> Users[users]
  Tenant --> Roles[roles]
  Users --> UserRoles[user_roles]
  Users --> Actors[actors]
  Tenant --> Settings[tenant_settings]
  Tenant --> Legal[tenant_legal_profiles]
  Tenant --> Depts[departments]
  Users --> Profiles[user_profiles]
  Tenant --> Audit[audit_events]
  Tenant --> Docs[documents]
  Docs --> DocLinks[document_links]

  subgraph CorePosting[Core Posting Pipeline]
    TxSet[transaction_sets] --> BizTx[business_transactions]
    BizTx --> BizLines[business_transaction_lines]
    TxSet --> Intents[posting_intents]
    TxSet --> Runs[posting_runs]
    Runs --> JE[journal_entries]
    JE --> JL[journal_lines]
    JE --> Reversal[reversal_links]
  end

  subgraph MasterData
    Parties[parties] --> PartyProfiles[party_profiles]
    Parties --> PartyIds[party_identifiers]
    COA[chart_of_accounts] --> Accounts[accounts]
    DimDef[dimension_definitions] --> DimVals[dimension_values]
    DimVals --> EntDims[entity_dimensions]
    UOM[uoms]
    Tax[tax_categories]
    Products[products]
    Warehouses[warehouses] --> Locations[storage_locations]
    Categories[categories]
    Items[items]
    Items --> ItemIds[item_identifiers]
  end

  subgraph Inventory
    InvMove[inventory_movements] --> InvBal[inventory_balances]
    InvMove --> InvPostLinks[inventory_posting_links]
    InvMove --> InvAdj[inventory_adjustments]
  end

  subgraph SalesProcurement
    SalesDocs[sales_docs] --> SalesLines[sales_doc_lines]
    PurchaseDocs[purchase_docs] --> PurchaseLines[purchase_doc_lines]
    SalesDocs --> SalesPost[sales_posting_links]
    PurchaseDocs --> PurchasePost[purchase_posting_links]
    SalesLines --> SalesFulfill[sales_fulfillments]
    PurchaseLines --> PurchaseReceipts[purchase_receipts]
    PurchaseReceipts --> PurchaseReceiptDetails[purchase_receipt_details]
  end

  subgraph Payments
    Payments[payments] --> Alloc[payment_allocations]
    Payments --> PayPost[payment_posting_links]
  end

  subgraph Strategy
    Budgets[budgets] --> BudgetVersions[budget_versions] --> BudgetLines[budget_lines]
    BudgetLines --> BudgetDims[budget_line_dimensions]
    Objectives[objectives] --> Initiatives[initiatives]
    KpiDefs[kpi_definitions] --> KpiTargets[kpi_targets]
    KpiDefs --> KpiMeasures[kpi_measurements]
  end

  subgraph Marketing
    MktChannels[marketing_channels] --> MktConnectors[marketing_connectors]
    MktPlans[marketing_plans] --> MktCampaigns[marketing_campaigns]
    MktPlans --> MktScenarios[marketing_what_if_scenarios]
    MktPlans --> MktTasks[marketing_tasks]
    MktInsights[marketing_insights]
    MktCards[marketing_analytics_cards]
  end

  subgraph PeopleServices
    People[people] --> ServiceProviders[service_providers]
    Items --> ServiceJobs[service_jobs] --> ServiceAssign[service_job_assignments]
    ServiceJobs --> ServiceEvents[service_job_events]
  end

  subgraph AI
    AIConv[ai_conversations] --> AIMsg[ai_messages] --> AIToolRuns[ai_tool_runs]
    AITasks[ai_tasks]
    AICards[ai_cards]
  end

  subgraph Subscriptions
    Plans[subscription_plans] --> TenantSubs[tenant_subscriptions] --> SubEvents[subscription_events]
  end
```

---

## AUTHENTICATED ROUTES (Requires Login)

### Dashboard
- `/dashboard` - Main dashboard with KPIs, alerts, AI insights
- `/dashboard/cards` - Customizable AI-generated insight cards

### Finance Module
- `/finance` - Finance dashboard with cash position overview
- `/finance/general-ledger` - General ledger entries and account balances
- `/finance/trial-balance` - Trial balance report
- `/finance/journals` - Journal entries management and posting
- `/finance/coa` - Chart of Accounts configuration
- `/finance/invoices` - Sales invoice management
- `/finance/payments` - Payment receipt/entry and allocation
- `/finance/payments/[id]` - Individual payment detail
- `/finance/bills` - Purchase bill/expense management
- `/finance/ap` - Accounts Payable aging and analysis
- `/finance/ap-aging` - Detailed AP aging report
- `/finance/ar` - Accounts Receivable aging and analysis
- `/finance/ar-aging` - Detailed AR aging report
- `/finance/cash-position` - Cash position forecast

### Sales Module
- `/sales` - Sales dashboard with pipeline and metrics
- `/sales/[id]` - Individual sale document detail
- `/sales/pipeline` - Sales pipeline visualization

### Procurement Module
- `/procurement` - Purchase order management
- `/procurement/[id]` - Individual purchase order detail

### Inventory & Operations
- `/inventory/balances` - Inventory balance sheet and valuation
- `/items` - Master item catalog
- `/operations` - Operations hub
- `/operations/catalog` - Product catalog management
- `/operations/contractors` - Contractor/vendor management
- `/operations/fulfillment` - Order fulfillment and shipping
- `/operations/offices` - Office/location management
- `/operations/people` - Operations personnel
- `/operations/services` - Service offering management
- `/operations/vendors` - Vendor management
- `/operations/warehouses` - Warehouse and inventory management

### Sales-Customers Module (CRM)
- `/sales-customers` - Integrated customer, lead, invoice, activity management
- `/customers` - Customer master data
- `/customers/accounts` - Customer accounts/contacts
- `/master/parties` - Party/stakeholder master data
- `/master/products` - Product master data

### People & HR Module
- `/people` - Unified people directory (tabs: People, Payroll, Performance, Documents, Settings)
- `/hr-people` - HR and people hub
- `/hr-people/persons` - Individual person records
- `/hr-people/payroll` - Payroll management and runs
- `/hr-people/performance` - Performance review and cycle management

### Marketing Module
- `/marketing` - Marketing campaign management and channel analytics
  - Channel management (Facebook, Google, LinkedIn, Email, etc.)
  - Campaign creation and execution
  - Analytics and ROI tracking
  - What-if scenario modeling

### GRC Module (Governance, Risk, Compliance)
- `/grc` - GRC compliance dashboard
- `/grc/alerts` - Compliance alerts
- `/grc/audit` - Audit log and compliance trails

### Company & Master Data
- `/company` - Company information and settings
- `/company/master` - Master data configuration
- `/company/master/categories` - Category hierarchies
- `/company/organization` - Organizational structure

### Settings & Administration
- `/settings` - Settings hub
- `/settings/tenant` - Tenant configuration
- `/settings/users` - User management
- `/settings/permissions` - Role-based permissions
- `/settings/billing` - Subscription and billing
- `/settings/integrations` - Third-party integrations
- `/admin/users` - Admin user management

### Strategy & Planning
- `/strategy/initiatives` - Strategic initiatives and OKRs
- `/strategy` - Strategy hub
- `/tasks` - Task and workflow management
- `/alerts` - System alerts

---

## PUBLIC ROUTES (No Auth Required)

- `/` - Root (redirects based on auth)
- `/login` - User login
- `/signup` - New tenant signup
- `/onboarding` - Initial onboarding wizard
- `/billing` - Billing management

---

## API ENDPOINTS

### Authentication (/api/auth/)
| Route | Methods | Description |
|-------|---------|-------------|
| /api/auth/login | POST | User login, returns JWT |
| /api/auth/signup | POST | User registration |
| /api/auth/logout | POST | Clear session |
| /api/auth/me | GET | Get current user |
| /api/auth/session | GET | Validate session |
| /api/auth/bootstrap | POST | Bootstrap admin user (dev only) |

### Billing (/api/billing/)
| Route | Methods | Description |
|-------|---------|-------------|
| /api/billing/plans | GET | List subscription plans |
| /api/billing/checkout | POST | Initialize checkout |
| /api/billing/status | GET | Subscription status |
| /api/billing/portal | GET | Billing portal URL |
| /api/billing/webhook | POST | Stripe webhook |

### Admin (/api/admin/)
| Route | Methods | Description |
|-------|---------|-------------|
| /api/admin/users | GET, POST | List/create users |
| /api/admin/users/[id] | GET, PUT, DELETE | User CRUD |
| /api/admin/roles | GET, POST | Role management |
| /api/admin/roles/[id]/permissions | GET, POST | Role permissions |
| /api/admin/permissions | GET, POST | Permission management |
| /api/admin/tenant | GET, PATCH | Tenant settings |
| /api/admin/tenant/subscription | GET, PATCH | Subscription management |

### Finance (/api/finance/)
| Route | Methods | Description |
|-------|---------|-------------|
| /api/finance/accounts | GET, POST | Chart of accounts |
| /api/finance/journal-entries | GET, POST | Journal entries |
| /api/finance/payments | GET, POST | List/create payments |
| /api/finance/payments/[id] | GET, PATCH | Get/update payment |
| /api/finance/payments/[id]/post | POST | Post payment to ledger |
| /api/finance/payments/[id]/void | POST | Void payment |
| /api/finance/payments/[id]/allocations | GET, POST, DELETE | Manage allocations |
| /api/finance/payments/[id]/unallocate | POST | Remove allocation |
| /api/finance/ar/open | GET | Open AR invoices |
| /api/finance/ar/aging | GET | AR aging |
| /api/finance/ar/statement | GET | AR statement |
| /api/finance/ap/open | GET | Open AP invoices |
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
| /api/master/items | GET, POST | Items |
| /api/master/items/[id] | GET, PATCH, DELETE | Item CRUD |
| /api/master/warehouses | GET, POST | Warehouses |
| /api/master/warehouses/[id] | GET, PATCH, DELETE | Warehouse CRUD |
| /api/master/warehouses/[id]/locations | GET, POST | Storage locations |
| /api/master/dimensions | GET, POST | Dimensions |
| /api/master/dimensions/[id]/values | GET, POST | Dimension values |
| /api/master/entity-dimensions | GET, POST | Entity dimensions |
| /api/master/categories | GET, POST | Categories |
| /api/master/categories/[id] | GET, PATCH, DELETE | Category CRUD |

### Reports (/api/reports/)
| Route | Methods | Description |
|-------|---------|-------------|
| /api/reports/trial-balance | GET | Trial balance |
| /api/reports/general-ledger | GET | General ledger |
| /api/reports/dashboard | GET | Dashboard metrics |
| /api/reports/finance/cashbook | GET | Cashbook |
| /api/reports/finance/cash-position | GET | Cash position |
| /api/reports/inventory/balances | GET | Inventory balances |

### People & HR (/api/people/, /api/payroll/)
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

### Sales CRM (/api/sales-customers/)
| Route | Methods | Description |
|-------|---------|-------------|
| /api/sales-customers/customers | GET, POST | Customers |
| /api/sales-customers/leads | GET, POST | Leads |
| /api/sales-customers/activities | GET, POST | Activities |
| /api/sales-customers/salespersons | GET, POST | Salespeople |
| /api/sales-customers/health | GET | Customer health scores |
| /api/sales-customers/ai-tasks | GET, POST | AI-generated tasks |

### GRC (/api/grc/)
| Route | Methods | Description |
|-------|---------|-------------|
| /api/grc/requirements | GET, POST | Compliance requirements |
| /api/grc/requirements/[id]/evaluate | POST | AI evaluation |
| /api/grc/tasks | GET, POST | GRC tasks |
| /api/grc/alerts | GET | Compliance alerts |

### Marketing (/api/marketing/)
| Route | Methods | Description |
|-------|---------|-------------|
| /api/marketing/overview | GET | Marketing overview |
| /api/marketing/channels | GET, POST | Marketing channels |
| /api/marketing/channels/[id] | GET, PATCH, DELETE | Channel CRUD |
| /api/marketing/channels/[id]/sync | POST | Sync channel |
| /api/marketing/campaigns | GET, POST | Campaigns |
| /api/marketing/campaigns/[id] | GET, PATCH, DELETE | Campaign CRUD |
| /api/marketing/plans | GET, POST | Marketing plans |
| /api/marketing/plans/[id] | GET, PATCH, DELETE | Plan CRUD |
| /api/marketing/plans/[id]/generate | POST | AI generate plan |
| /api/marketing/plans/[id]/scenarios | GET, POST | What-if scenarios |
| /api/marketing/tasks | GET, POST | Marketing tasks |
| /api/marketing/tasks/[id] | GET, PATCH | Task CRUD |

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

### Omni (/api/omni/)
| Route | Methods | Description |
|-------|---------|-------------|
| /api/omni/draft | POST | Create draft transaction |
| /api/omni/submit | POST | Submit transaction |
| /api/omni/post | POST | Post to GL |
| /api/omni/reverse | POST | Reverse transaction |
| /api/omni/inventory/draft | POST | Draft inventory movement |
| /api/omni/inventory/post | POST | Post inventory movement |

### AI (/api/ai/)
| Route | Methods | Description |
|-------|---------|-------------|
| /api/ai/cards | GET | AI-generated cards |
| /api/ai/conversations | GET, POST | AI conversations |
| /api/ai/conversations/[id]/messages | GET, POST | Conversation messages |
| /api/ai/omni | POST | Omni AI processing |
| /api/ai/confirm | POST | AI confirmation |
| /api/ai-tasks | GET, POST | AI tasks |
| /api/ai-tasks/[id] | GET, PUT | Task CRUD |

### Company (/api/company/)
| Route | Methods | Description |
|-------|---------|-------------|
| /api/company/org | GET, POST | Organization structure |
| /api/company/legal | GET, POST | Legal profiles |
| /api/company/departments | GET, POST | Departments |
| /api/company/departments/[id] | GET, PATCH, DELETE | Department CRUD |
| /api/company/users/[id]/profile | GET, PATCH | User profiles |

### Settings (/api/settings/)
| Route | Methods | Description |
|-------|---------|-------------|
| /api/settings/finance | GET, PATCH | Finance settings |
| /api/settings/oauth | GET, POST | OAuth configuration |

### Planner (/api/planner/)
| Route | Methods | Description |
|-------|---------|-------------|
| /api/planner/initiatives | GET, POST | Planner initiatives |
| /api/planner/initiatives/[id] | GET, PATCH | Initiative CRUD |
| /api/planner/alerts/[alertId]/dismiss | POST | Dismiss alert |
| /api/planner/alerts/dismissed | GET | Dismissed alerts |

---

## DATABASE SCHEMA (Detailed)

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

## USER ROLES AND PERMISSIONS

### Roles
- **Admin** - Full access to all modules
- **Finance** - GL, payments, AP/AR, reporting
- **Sales** - Sales docs, customers, pipeline
- **Inventory** - Inventory management, warehouses
- **Procurement** - Purchase orders, receiving
- **HR** - Employee records, payroll, performance

### Permission Format: `module:action`
- finance:view, finance:create, finance:edit, finance:post, finance:approve
- sales:view, sales:create, sales:edit, sales:delete, sales:post
- inventory:view, inventory:create, inventory:edit, inventory:adjust
- procurement:view, procurement:create, procurement:edit, procurement:post
- hr:view, hr:create, hr:edit, hr:delete
- admin:users, admin:settings, admin:roles

---

## KEY WORKFLOWS

### 1) Omni Transaction -> Posting -> Ledger

```mermaid
graph LR
  Draft[transaction_sets:draft] --> Review[transaction_sets:review]
  Review --> Post[postTransactionSet]
  Post --> Runs[posting_runs]
  Post --> JE[journal_entries]
  JE --> JL[journal_lines]
  JE --> Links[posting links: sales/purchase/payment/inventory]
  Review --> Approvals[approvals]
  Review --> Validations[validation_issues/overrides]
```

Key logic lives in `src/lib/posting.ts` (only writer for `journal_entries` and `journal_lines`).

### 2) Sales Invoice Workflow

```mermaid
graph TD
  SalesDoc[sales_docs] --> SalesLines[sales_doc_lines]
  SalesLines --> Fulfillment[sales_fulfillments]
  Fulfillment --> InvMove[inventory_movements]
  SalesDoc --> SalesPost[sales_posting_links]
  SalesPost --> JE[journal_entries]
  SalesDoc --> PaymentAlloc[payment_allocations]
```

1. Create sales doc (draft) -> POST /api/sales/docs
2. Add line items -> POST /api/sales/docs/[id]/lines
3. Issue to customer -> PATCH /api/sales/docs/[id] {status: "issued"}
4. Post to ledger -> POST /api/sales/docs/[id]/post (DR: Receivable, CR: Revenue)
5. Receive payment -> POST /api/finance/payments
6. Allocate to invoice -> POST /api/finance/payments/[id]/allocations
7. Post payment -> POST /api/finance/payments/[id]/post (DR: Cash, CR: Receivable)

### 3) Procurement Flow

```mermaid
graph TD
  PurchaseDoc[purchase_docs] --> PurchaseLines[purchase_doc_lines]
  PurchaseLines --> Receipts[purchase_receipts]
  Receipts --> ReceiptDetails[purchase_receipt_details]
  Receipts --> InvMove[inventory_movements]
  PurchaseDoc --> PurchasePost[purchase_posting_links]
  PurchasePost --> JE[journal_entries]
  PurchaseDoc --> Landed[landed_costs] --> Alloc[landed_cost_allocations]
```

1. Create purchase doc (draft) -> POST /api/procurement/docs
2. Add line items -> POST /api/procurement/docs/[id]/lines
3. Receive goods -> POST /api/procurement/docs/[id]/receive (creates inventory movements)
4. Post to ledger -> POST /api/procurement/docs/[id]/post (DR: Inventory/Expense, CR: Payable)
5. Create payment -> POST /api/finance/payments
6. Allocate to invoice -> POST /api/finance/payments/[id]/allocations
7. Post payment -> POST /api/finance/payments/[id]/post (DR: Payable, CR: Cash)

### 4) Payments (AR/AP)

```mermaid
graph TD
  Payments[payments] --> Alloc[payment_allocations]
  Payments --> Posting[payment_posting_links]
  Posting --> JE[journal_entries]
```

### 5) Payroll Workflow

1. Configure pay schedule -> POST /api/payroll/pay-schedules
2. Add employees to payroll -> POST /api/payroll/employees
3. Set compensation -> POST /api/payroll/employees/[id]/compensation
4. Create payroll run -> POST /api/payroll/runs
5. Calculate payroll -> POST /api/payroll/runs/[id]/calculate
6. Review and approve -> POST /api/payroll/runs/[id]/approve
7. Post to ledger -> POST /api/payroll/runs/[id]/post (creates journal entries for wages, taxes, deductions)

### 6) Leave Request Workflow

1. Employee submits request -> POST /api/people/leave-requests
2. Manager reviews -> GET /api/people/leave-requests?status=pending
3. Approve/reject -> PATCH /api/people/leave-requests/[id] {status: "approved"}
4. System updates leave balance automatically

### 7) Performance Review Workflow

1. Create review cycle -> POST /api/people/performance-cycles
2. System creates reviews for employees
3. Employee self-assessment -> PATCH /api/people/performance-reviews/[id]
4. Manager assessment -> PATCH /api/people/performance-reviews/[id]
5. Complete cycle -> PATCH /api/people/performance-cycles/[id] {status: "completed"}

### 8) Strategy & Planning

```mermaid
graph TD
  Budgets[budgets] --> Versions[budget_versions] --> Lines[budget_lines] --> LineDims[budget_line_dimensions]
  Objectives[objectives] --> Initiatives[initiatives]
  Kpis[kpi_definitions] --> Targets[kpi_targets]
  Kpis --> Measures[kpi_measurements]
```

### 9) Marketing

```mermaid
graph TD
  Channels[marketing_channels] --> Connectors[marketing_connectors]
  Plans[marketing_plans] --> Campaigns[marketing_campaigns]
  Plans --> Scenarios[marketing_what_if_scenarios]
  Plans --> Tasks[marketing_tasks]
  Campaigns --> ManualEntries[marketing_manual_entries]
  Plans --> Insights[marketing_insights]
```

### 10) Subscriptions & Billing

```mermaid
graph TD
  Plans[subscription_plans] --> TenantSubs[tenant_subscriptions] --> Events[subscription_events]
```

---

## MIDDLEWARE & AUTH FLOW

```typescript
// Request flow (src/middleware.ts):
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

// Tenant context in API routes:
const headersList = await headers();
const tenantId = headersList.get("x-tenant-id");
const userId = headersList.get("x-user-id");
const actorId = headersList.get("x-actor-id");
```

---

## UI COMPONENTS

### Glass Component Library (`src/components/ui/glass.tsx`)

```typescript
// Layout
GlassCard, GlassModal, SlideOver, GlassTabs

// Form Elements
GlassInput, GlassTextArea, GlassSelect, GlassCheckbox, GlassRadio, GlassSwitch

// Buttons
GlassButton (variants: primary, secondary, danger, ghost), GlassIconButton

// Display
GlassBadge (variants: default, success, warning, danger, info), GlassTable, GlassAvatar

// Feedback
Spinner, useToast (addToast(type, message))

// Data Display
GlassProgress, GlassStat
```

### Module Layout (`src/components/layout/module-layout.tsx`)
```typescript
ModulePageHeader, AnalyticsSection, AnalyticsCard, TodoAlertsSection, TodoPanel, AlertsPanel, QuickAccessSection, QuickAccessCard
```

### App Shell (`src/components/layout/shell.tsx`)
```typescript
AppShell, Sidebar, Header
```

### AI Components (`src/components/ai/`)
```typescript
CopilotSidebar, OmniWindow, Planner
```

---

## LIBRARY UTILITIES

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
| posting.ts | Journal posting (sole writer to journal_entries/journal_lines) |
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

## KNOWN REDUNDANCIES

- `products` vs `items`: both represent sellable/purchasable things; `items` is the unified catalog
- `party` vs `people` vs `salespersons` vs `users`: multiple entity types represent actors/contacts
- `tasks` vs `marketing_tasks` vs `ai_tasks`: three task systems with overlapping status/priority
- `alerts` vs `marketing_insights`: both signal issues/actions
- `sales_docs`/`purchase_docs` vs `business_transactions`: two document/transaction abstractions

---

## GUARDRAILS

- `src/lib/posting.ts` is the only writer to `journal_entries` and `journal_lines`
- Tenant scoping is enforced at session/middleware level
- Tenant ID is never trusted from request headers (overwritten by middleware)

---

## ENVIRONMENT VARIABLES

```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=your-jwt-secret
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
ANTHROPIC_API_KEY=sk-ant-...  # Optional
OPENAI_API_KEY=sk-...         # Optional
```

---

## DEVELOPMENT COMMANDS

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

## FILE STRUCTURE

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
│   └── schema.ts        # Drizzle schema
├── lib/                 # Utilities
│   ├── auth.ts
│   ├── http.ts
│   ├── posting.ts
│   ├── payroll/
│   └── ai/
├── hooks/               # React hooks
└── middleware.ts         # Auth middleware
/drizzle                 # Migrations
/scripts                 # Utility scripts
/docs                    # Module remodel specs
```

---

Do not save to memory.
