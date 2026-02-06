/**
 * Application Context for AI System Prompt
 *
 * This file contains the comprehensive application context that is automatically
 * injected into every AI conversation. It provides the AI with full knowledge
 * of the application's structure, routes, features, and capabilities.
 *
 * To update this context, modify this file and redeploy.
 */

export const APP_CONTEXT = `
## APPLICATION OVERVIEW

UDP (Unified Data Platform) is a multi-tenant enterprise resource planning (ERP) system.
- Framework: Next.js with App Router
- Database: PostgreSQL with 197 tables
- Architecture: Multi-tenant SaaS with role-based access control (RBAC)

---

## AVAILABLE ROUTES & FEATURES

### Dashboard
- /dashboard - Main dashboard with KPIs, alerts, AI insights
- /dashboard/cards - Customizable AI-generated insight cards

### Finance Module
- /finance - Finance dashboard with cash position overview
- /finance/general-ledger - General ledger entries and account balances
- /finance/trial-balance - Trial balance report
- /finance/journals - Journal entries management and posting
- /finance/coa - Chart of Accounts configuration
- /finance/invoices - Sales invoice management
- /finance/payments - Payment receipt/entry and allocation
- /finance/payments/[id] - Individual payment detail
- /finance/bills - Purchase bill/expense management
- /finance/ap - Accounts Payable aging and analysis
- /finance/ap-aging - Detailed AP aging report
- /finance/ar - Accounts Receivable aging and analysis
- /finance/ar-aging - Detailed AR aging report
- /finance/cash-position - Cash position forecast

### Sales Module
- /sales - Sales dashboard with pipeline and metrics
- /sales/[id] - Individual sale document detail
- /sales/pipeline - Sales pipeline visualization

### Procurement Module
- /procurement - Purchase order management
- /procurement/[id] - Individual purchase order detail

### Inventory & Operations
- /inventory/balances - Inventory balance sheet and valuation
- /items - Master item catalog
- /operations - Operations hub
- /operations/catalog - Product catalog management
- /operations/contractors - Contractor/vendor management
- /operations/fulfillment - Order fulfillment and shipping
- /operations/offices - Office/location management
- /operations/people - Operations personnel
- /operations/services - Service offering management
- /operations/vendors - Vendor management
- /operations/warehouses - Warehouse and inventory management

### Sales-Customers Module (CRM)
- /sales-customers - Integrated customer, lead, invoice, activity management
- /customers - Customer master data
- /customers/accounts - Customer accounts/contacts
- /master/parties - Party/stakeholder master data
- /master/products - Product master data

### People & HR Module
- /people - Unified people directory
- /hr-people - HR and people hub
- /hr-people/persons - Individual person records
- /hr-people/payroll - Payroll management and runs
- /hr-people/performance - Performance review and cycle management

### Marketing Module
- /marketing - Marketing campaign management and channel analytics
  - Channel management (Facebook, Google, LinkedIn, Email)
  - Campaign creation and execution
  - Analytics and ROI tracking
  - What-if scenario modeling

### Company & Master Data
- /company - Company information and settings
- /company/master - Master data configuration
- /company/master/categories - Category hierarchies
- /company/organization - Organizational structure

### Settings & Administration
- /settings - Settings hub
- /settings/tenant - Tenant configuration
- /settings/users - User management
- /settings/permissions - Role-based permissions
- /settings/billing - Subscription and billing
- /settings/integrations - Third-party integrations
- /admin/users - Admin user management

### Strategy & Planning
- /strategy/initiatives - Strategic initiatives and OKRs
- /strategy - Strategy hub
- /tasks - Task and workflow management
- /alerts - System alerts

---

## KEY WORKFLOWS

### Sales-to-Cash Flow
1. Create sales doc (quote/order/invoice)
2. Add line items with products
3. Post invoice to GL
4. Receive payment and allocate
5. Customer health score updated

### Procurement-to-Payment Flow
1. Create purchase order
2. Add line items
3. Receive goods
4. 3-way match (PO, Receipt, Invoice)
5. Post to GL
6. Process payment

### Payroll Processing
1. Create payroll run for period
2. Set employee earnings/deductions
3. Calculate payroll with tax withholding
4. Approve payroll run
5. Post to GL
6. Generate payments

### Performance Review Cycle
1. Create performance cycle
2. Initiate reviews for employees
3. Record ratings and feedback
4. Generate AI-based outcomes
5. Employee acknowledgment

---

## USER ROLES

- Admin - Full access to all modules
- Finance - GL, payments, AP/AR, reporting
- Sales - Sales docs, customers, pipeline
- Inventory - Inventory management, warehouses
- Procurement - Purchase orders, receiving
- HR - Employee records, payroll, performance

---

## DATABASE TABLES (Key Entities)

Core: tenants, users, roles, permissions, actors, auditEvents
Finance: accounts, journalEntries, payments, paymentAllocations
Sales: salesDocs, salesDocLines, leads, customers, salespersons
Procurement: purchaseDocs, purchaseDocLines, purchaseReceipts
Inventory: inventoryMovements, inventoryBalances, warehouses, items
HR: employees, payrollRuns, compensationRecords, performanceReviews
Marketing: marketingChannels, marketingCampaigns, marketingPlans
`;
