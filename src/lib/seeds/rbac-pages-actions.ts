/**
 * RBAC Pages and Actions Seed Data
 * Defines all pages and their actions for granular access control
 */

export interface PageSeed {
  code: string;
  name: string;
  route: string;
  module: string;
  description?: string;
  icon?: string;
  isAlwaysAccessible?: boolean;
  displayOrder: number;
  parentPageCode?: string;
}

export interface ActionSeed {
  pageCode: string;
  code: string;
  name: string;
  description?: string;
  actionType: "button" | "form" | "link" | "modal";
  requiresPermission?: string;
  displayOrder: number;
}

// ============================================================================
// PAGES SEED DATA
// ============================================================================

export const pagesSeed: PageSeed[] = [
  // Dashboard Module
  { code: "dashboard", name: "Dashboard", route: "/dashboard", module: "dashboard", isAlwaysAccessible: true, displayOrder: 1 },
  { code: "dashboard-cards", name: "AI Card Studio", route: "/dashboard/cards", module: "dashboard", parentPageCode: "dashboard", displayOrder: 2 },

  // Finance Module
  { code: "finance", name: "Finance Dashboard", route: "/finance", module: "finance", displayOrder: 10 },
  { code: "finance-coa", name: "Chart of Accounts", route: "/finance/coa", module: "finance", parentPageCode: "finance", displayOrder: 11 },
  { code: "finance-journals", name: "Journal Entries", route: "/finance/journals", module: "finance", parentPageCode: "finance", displayOrder: 12 },
  { code: "finance-general-ledger", name: "General Ledger", route: "/finance/general-ledger", module: "finance", parentPageCode: "finance", displayOrder: 13 },
  { code: "finance-payments", name: "Payments", route: "/finance/payments", module: "finance", parentPageCode: "finance", displayOrder: 14 },
  { code: "finance-payments-detail", name: "Payment Detail", route: "/finance/payments/[id]", module: "finance", parentPageCode: "finance-payments", displayOrder: 15 },
  { code: "finance-invoices", name: "Sales Invoices", route: "/finance/invoices", module: "finance", parentPageCode: "finance", displayOrder: 16 },
  { code: "finance-bills", name: "Vendor Bills", route: "/finance/bills", module: "finance", parentPageCode: "finance", displayOrder: 17 },
  { code: "finance-trial-balance", name: "Trial Balance", route: "/finance/trial-balance", module: "finance", parentPageCode: "finance", displayOrder: 18 },
  { code: "finance-ar", name: "Accounts Receivable", route: "/finance/ar", module: "finance", parentPageCode: "finance", displayOrder: 19 },
  { code: "finance-ap", name: "Accounts Payable", route: "/finance/ap", module: "finance", parentPageCode: "finance", displayOrder: 20 },
  { code: "finance-ar-aging", name: "AR Aging Report", route: "/finance/ar-aging", module: "finance", parentPageCode: "finance", displayOrder: 21 },
  { code: "finance-ap-aging", name: "AP Aging Report", route: "/finance/ap-aging", module: "finance", parentPageCode: "finance", displayOrder: 22 },
  { code: "finance-cash-position", name: "Cash Position", route: "/finance/cash-position", module: "finance", parentPageCode: "finance", displayOrder: 23 },
  { code: "finance-balance-sheet", name: "Balance Sheet", route: "/finance/balance-sheet", module: "finance", parentPageCode: "finance", displayOrder: 24 },
  { code: "finance-profit-loss", name: "Profit & Loss", route: "/finance/profit-loss", module: "finance", parentPageCode: "finance", displayOrder: 25 },
  { code: "finance-periods", name: "Accounting Periods", route: "/finance/periods", module: "finance", parentPageCode: "finance", displayOrder: 26 },
  { code: "finance-reconciliation", name: "Reconciliation", route: "/finance/reconciliation", module: "finance", parentPageCode: "finance", displayOrder: 27 },

  // Sales Module
  { code: "sales", name: "Sales", route: "/sales", module: "sales", displayOrder: 30 },
  { code: "sales-detail", name: "Sales Document Detail", route: "/sales/[id]", module: "sales", parentPageCode: "sales", displayOrder: 31 },
  { code: "sales-pipeline", name: "Sales Pipeline", route: "/sales/pipeline", module: "sales", parentPageCode: "sales", displayOrder: 32 },
  { code: "sales-customers", name: "Sales & Customers", route: "/sales-customers", module: "sales", displayOrder: 33 },

  // Procurement Module
  { code: "procurement", name: "Procurement", route: "/procurement", module: "procurement", displayOrder: 40 },
  { code: "procurement-detail", name: "Purchase Document Detail", route: "/procurement/[id]", module: "procurement", parentPageCode: "procurement", displayOrder: 41 },

  // Operations Module
  { code: "operations", name: "Operations Hub", route: "/operations", module: "operations", displayOrder: 50 },
  { code: "operations-vendors", name: "Vendors", route: "/operations/vendors", module: "operations", parentPageCode: "operations", displayOrder: 51 },
  { code: "operations-warehouses", name: "Warehouses", route: "/operations/warehouses", module: "operations", parentPageCode: "operations", displayOrder: 52 },
  { code: "operations-catalog", name: "Product Catalog", route: "/operations/catalog", module: "operations", parentPageCode: "operations", displayOrder: 53 },
  { code: "operations-fulfillment", name: "Order Fulfillment", route: "/operations/fulfillment", module: "operations", parentPageCode: "operations", displayOrder: 54 },
  { code: "operations-offices", name: "Offices", route: "/operations/offices", module: "operations", parentPageCode: "operations", displayOrder: 55 },
  { code: "operations-people", name: "Operations People", route: "/operations/people", module: "operations", parentPageCode: "operations", displayOrder: 56 },
  { code: "operations-contractors", name: "Contractors", route: "/operations/contractors", module: "operations", parentPageCode: "operations", displayOrder: 57 },
  { code: "operations-services", name: "Service Quotes", route: "/operations/services", module: "operations", parentPageCode: "operations", displayOrder: 58 },

  // Inventory Module
  { code: "inventory-balances", name: "Inventory Balances", route: "/inventory/balances", module: "inventory", displayOrder: 60 },
  { code: "items", name: "Items Catalog", route: "/items", module: "inventory", displayOrder: 61 },

  // HR/People Module
  { code: "hr-people", name: "HR & People Hub", route: "/hr-people", module: "hr", displayOrder: 70 },
  { code: "hr-people-persons", name: "Person List", route: "/hr-people/persons", module: "hr", parentPageCode: "hr-people", displayOrder: 71 },
  { code: "hr-people-payroll", name: "Payroll History", route: "/hr-people/payroll", module: "hr", parentPageCode: "hr-people", displayOrder: 72 },
  { code: "hr-people-performance", name: "Performance Reviews", route: "/hr-people/performance", module: "hr", parentPageCode: "hr-people", displayOrder: 73 },
  { code: "people", name: "People Dashboard", route: "/people", module: "hr", displayOrder: 74 },

  // Marketing Module
  { code: "marketing", name: "Marketing Hub", route: "/marketing", module: "marketing", displayOrder: 80 },

  // GRC Module
  { code: "grc", name: "GRC Dashboard", route: "/grc", module: "grc", displayOrder: 90 },
  { code: "grc-alerts", name: "Compliance Alerts", route: "/grc/alerts", module: "grc", parentPageCode: "grc", displayOrder: 91 },
  { code: "grc-audit", name: "Audit Log", route: "/grc/audit", module: "grc", parentPageCode: "grc", displayOrder: 92 },

  // Strategy Module
  { code: "strategy", name: "Strategy Hub", route: "/strategy", module: "strategy", displayOrder: 100 },
  { code: "strategy-initiatives", name: "Strategic Initiatives", route: "/strategy/initiatives", module: "strategy", parentPageCode: "strategy", displayOrder: 101 },

  // Master Data
  { code: "master-parties", name: "Parties", route: "/master/parties", module: "master", displayOrder: 110 },
  { code: "master-products", name: "Products", route: "/master/products", module: "master", displayOrder: 111 },
  { code: "customers", name: "Customers", route: "/customers", module: "sales", displayOrder: 112 },
  { code: "customers-accounts", name: "Customer Accounts", route: "/customers/accounts", module: "sales", parentPageCode: "customers", displayOrder: 113 },

  // Company
  { code: "company", name: "Company Hub", route: "/company", module: "company", displayOrder: 120 },
  { code: "company-master", name: "Master Data", route: "/company/master", module: "company", parentPageCode: "company", displayOrder: 121 },
  { code: "company-master-categories", name: "Categories", route: "/company/master/categories", module: "company", parentPageCode: "company-master", displayOrder: 122 },
  { code: "company-organization", name: "Organization", route: "/company/organization", module: "company", parentPageCode: "company", displayOrder: 123 },

  // Settings (Admin only)
  { code: "settings", name: "Settings", route: "/settings", module: "settings", displayOrder: 130 },
  { code: "settings-tenant", name: "Tenant Settings", route: "/settings/tenant", module: "settings", isAlwaysAccessible: true, parentPageCode: "settings", displayOrder: 131 },
  { code: "settings-users", name: "User Management", route: "/settings/users", module: "settings", parentPageCode: "settings", displayOrder: 132 },
  { code: "settings-permissions", name: "Role Permissions", route: "/settings/permissions", module: "settings", parentPageCode: "settings", displayOrder: 133 },
  { code: "settings-billing", name: "Billing", route: "/settings/billing", module: "settings", parentPageCode: "settings", displayOrder: 134 },
  { code: "settings-integrations", name: "Integrations", route: "/settings/integrations", module: "settings", parentPageCode: "settings", displayOrder: 135 },
  { code: "admin-users", name: "Admin User Management", route: "/admin/users", module: "admin", displayOrder: 136 },

  // System
  { code: "alerts", name: "Alerts", route: "/alerts", module: "system", displayOrder: 140 },
  { code: "tasks", name: "Tasks", route: "/tasks", module: "system", displayOrder: 141 },
];

// ============================================================================
// PAGE ACTIONS SEED DATA
// ============================================================================

export const actionsSeed: ActionSeed[] = [
  // Dashboard Actions
  { pageCode: "dashboard", code: "view-dashboard", name: "View Dashboard", actionType: "link", displayOrder: 1 },
  { pageCode: "dashboard-cards", code: "create-card", name: "Create AI Card", actionType: "form", displayOrder: 1 },
  { pageCode: "dashboard-cards", code: "dismiss-card", name: "Dismiss Card", actionType: "button", displayOrder: 2 },
  { pageCode: "dashboard-cards", code: "snooze-card", name: "Snooze Card", actionType: "button", displayOrder: 3 },

  // Finance Dashboard Actions
  { pageCode: "finance", code: "record-activity", name: "Record Financial Activity", actionType: "modal", requiresPermission: "finance:create", displayOrder: 1 },
  { pageCode: "finance", code: "record-payment", name: "Record Payment", actionType: "form", requiresPermission: "finance:create", displayOrder: 2 },
  { pageCode: "finance", code: "record-expense", name: "Record Expense", actionType: "form", requiresPermission: "finance:create", displayOrder: 3 },
  { pageCode: "finance", code: "create-invoice", name: "Create Invoice", actionType: "form", requiresPermission: "finance:create", displayOrder: 4 },
  { pageCode: "finance", code: "enter-bill", name: "Enter Bill", actionType: "form", requiresPermission: "finance:create", displayOrder: 5 },
  { pageCode: "finance", code: "manual-journal", name: "Manual Journal Entry", actionType: "form", requiresPermission: "finance:create", displayOrder: 6 },

  // Payments Actions
  { pageCode: "finance-payments", code: "create-payment", name: "Create Payment", actionType: "form", requiresPermission: "finance:create", displayOrder: 1 },
  { pageCode: "finance-payments-detail", code: "post-payment", name: "Post Payment", actionType: "button", requiresPermission: "finance:post", displayOrder: 1 },
  { pageCode: "finance-payments-detail", code: "void-payment", name: "Void Payment", actionType: "button", requiresPermission: "finance:edit", displayOrder: 2 },
  { pageCode: "finance-payments-detail", code: "allocate-payment", name: "Allocate Payment", actionType: "form", requiresPermission: "finance:create", displayOrder: 3 },
  { pageCode: "finance-payments-detail", code: "remove-allocation", name: "Remove Allocation", actionType: "button", requiresPermission: "finance:edit", displayOrder: 4 },

  // Invoices & Bills Actions
  { pageCode: "finance-invoices", code: "view-invoice", name: "View Invoice", actionType: "link", displayOrder: 1 },
  { pageCode: "finance-invoices", code: "download-pdf", name: "Download PDF", actionType: "button", displayOrder: 2 },
  { pageCode: "finance-invoices", code: "send-reminder", name: "Send Reminder", actionType: "button", displayOrder: 3 },
  { pageCode: "finance-bills", code: "view-bill", name: "View Bill", actionType: "link", displayOrder: 1 },
  { pageCode: "finance-bills", code: "schedule-payment", name: "Schedule Payment", actionType: "button", requiresPermission: "finance:create", displayOrder: 2 },

  // AP Actions
  { pageCode: "finance-ap", code: "create-draft-payment", name: "Create Draft Payment", actionType: "form", requiresPermission: "finance:create", displayOrder: 1 },

  // Reports Actions
  { pageCode: "finance-trial-balance", code: "refresh-report", name: "Refresh Report", actionType: "button", displayOrder: 1 },
  { pageCode: "finance-balance-sheet", code: "export-csv", name: "Export CSV", actionType: "button", displayOrder: 1 },
  { pageCode: "finance-profit-loss", code: "export-csv", name: "Export CSV", actionType: "button", displayOrder: 1 },
  { pageCode: "finance-ar-aging", code: "export-csv", name: "Export CSV", actionType: "button", displayOrder: 1 },

  // Periods Actions
  { pageCode: "finance-periods", code: "initialize-periods", name: "Initialize Periods", actionType: "button", requiresPermission: "finance:create", displayOrder: 1 },
  { pageCode: "finance-periods", code: "soft-close", name: "Soft Close Period", actionType: "modal", requiresPermission: "finance:approve", displayOrder: 2 },
  { pageCode: "finance-periods", code: "hard-close", name: "Hard Close Period", actionType: "modal", requiresPermission: "finance:approve", displayOrder: 3 },
  { pageCode: "finance-periods", code: "reopen-period", name: "Reopen Period", actionType: "modal", requiresPermission: "finance:approve", displayOrder: 4 },

  // Sales Actions
  { pageCode: "sales", code: "create-document", name: "Create Sales Document", actionType: "form", requiresPermission: "sales:create", displayOrder: 1 },
  { pageCode: "sales-detail", code: "post-invoice", name: "Post Invoice", actionType: "button", requiresPermission: "sales:post", displayOrder: 1 },
  { pageCode: "sales-detail", code: "add-line", name: "Add Line Item", actionType: "form", requiresPermission: "sales:edit", displayOrder: 2 },

  // Sales-Customers Actions
  { pageCode: "sales-customers", code: "create-customer", name: "Create Customer", actionType: "form", requiresPermission: "sales:create", displayOrder: 1 },
  { pageCode: "sales-customers", code: "create-lead", name: "Create Lead", actionType: "form", requiresPermission: "sales:create", displayOrder: 2 },
  { pageCode: "sales-customers", code: "create-quote", name: "Create Quote", actionType: "form", requiresPermission: "sales:create", displayOrder: 3 },
  { pageCode: "sales-customers", code: "create-invoice", name: "Create Invoice", actionType: "form", requiresPermission: "sales:create", displayOrder: 4 },
  { pageCode: "sales-customers", code: "add-salesperson", name: "Add Salesperson", actionType: "form", requiresPermission: "sales:create", displayOrder: 5 },
  { pageCode: "sales-customers", code: "run-ai-scan", name: "Run AI Scan", actionType: "button", displayOrder: 6 },
  { pageCode: "sales-customers", code: "complete-ai-task", name: "Complete AI Task", actionType: "button", displayOrder: 7 },

  // Procurement Actions
  { pageCode: "procurement", code: "create-document", name: "Create Purchase Document", actionType: "form", requiresPermission: "procurement:create", displayOrder: 1 },
  { pageCode: "procurement-detail", code: "post-invoice", name: "Post Invoice", actionType: "button", requiresPermission: "procurement:post", displayOrder: 1 },
  { pageCode: "procurement-detail", code: "add-line", name: "Add Line Item", actionType: "form", requiresPermission: "procurement:edit", displayOrder: 2 },

  // Operations Actions
  { pageCode: "operations", code: "record-activity", name: "Record Activity", actionType: "modal", displayOrder: 1 },
  { pageCode: "operations-warehouses", code: "create-warehouse", name: "Create Warehouse", actionType: "form", requiresPermission: "inventory:create", displayOrder: 1 },
  { pageCode: "operations-fulfillment", code: "reserve-inventory", name: "Reserve Inventory", actionType: "button", requiresPermission: "inventory:adjust", displayOrder: 1 },
  { pageCode: "operations-fulfillment", code: "ship-items", name: "Ship Items", actionType: "button", requiresPermission: "inventory:adjust", displayOrder: 2 },
  { pageCode: "operations-people", code: "add-person", name: "Add Person", actionType: "form", requiresPermission: "hr:create", displayOrder: 1 },
  { pageCode: "operations-services", code: "save-quote", name: "Save Quote", actionType: "button", requiresPermission: "sales:create", displayOrder: 1 },

  // HR/People Actions
  { pageCode: "hr-people", code: "record-activity", name: "Record HR Activity", actionType: "modal", requiresPermission: "hr:create", displayOrder: 1 },
  { pageCode: "hr-people-performance", code: "accept-reviewer", name: "Accept as Reviewer", actionType: "button", requiresPermission: "hr:edit", displayOrder: 1 },
  { pageCode: "hr-people-performance", code: "accept-employee", name: "Accept as Employee", actionType: "button", displayOrder: 2 },
  { pageCode: "people", code: "create-payroll-run", name: "Create Payroll Run", actionType: "form", requiresPermission: "hr:create", displayOrder: 1 },
  { pageCode: "people", code: "calculate-payroll", name: "Calculate Payroll", actionType: "button", requiresPermission: "hr:edit", displayOrder: 2 },
  { pageCode: "people", code: "post-payroll", name: "Post Payroll to GL", actionType: "button", requiresPermission: "hr:edit", displayOrder: 3 },
  { pageCode: "people", code: "create-performance-cycle", name: "Create Performance Cycle", actionType: "form", requiresPermission: "hr:create", displayOrder: 4 },
  { pageCode: "people", code: "create-performance-review", name: "Create Performance Review", actionType: "form", requiresPermission: "hr:create", displayOrder: 5 },
  { pageCode: "people", code: "generate-ai-outcome", name: "Generate AI Outcome", actionType: "button", displayOrder: 6 },

  // GRC Actions
  { pageCode: "grc", code: "save-profile", name: "Save Business Profile", actionType: "form", displayOrder: 1 },
  { pageCode: "grc", code: "analyze-requirements", name: "Analyze Requirements", actionType: "button", displayOrder: 2 },
  { pageCode: "grc", code: "submit-evidence", name: "Submit Evidence", actionType: "form", displayOrder: 3 },
  { pageCode: "grc-alerts", code: "dismiss-alert", name: "Dismiss Alert", actionType: "button", displayOrder: 1 },
  { pageCode: "grc-alerts", code: "create-task", name: "Create Task from Alert", actionType: "button", displayOrder: 2 },

  // Master Data Actions
  { pageCode: "master-parties", code: "create-party", name: "Create Party", actionType: "form", displayOrder: 1 },
  { pageCode: "master-products", code: "create-product", name: "Create Product", actionType: "form", displayOrder: 1 },

  // Company Actions
  { pageCode: "company-master-categories", code: "create-category", name: "Create Category", actionType: "form", displayOrder: 1 },
  { pageCode: "company-master-categories", code: "edit-category", name: "Edit Category", actionType: "form", displayOrder: 2 },
  { pageCode: "company-master-categories", code: "delete-category", name: "Delete Category", actionType: "button", displayOrder: 3 },
  { pageCode: "company-organization", code: "edit-legal", name: "Edit Legal Info", actionType: "form", displayOrder: 1 },
  { pageCode: "company-organization", code: "create-department", name: "Create Department", actionType: "form", displayOrder: 2 },

  // Settings Actions
  { pageCode: "settings-users", code: "create-user", name: "Create User", actionType: "form", displayOrder: 1 },
  { pageCode: "settings-users", code: "toggle-role", name: "Toggle User Role", actionType: "button", displayOrder: 2 },
  { pageCode: "settings-users", code: "toggle-active", name: "Activate/Deactivate User", actionType: "button", displayOrder: 3 },
  { pageCode: "settings-permissions", code: "grant-permission", name: "Grant Permission", actionType: "button", displayOrder: 1 },
  { pageCode: "settings-permissions", code: "revoke-permission", name: "Revoke Permission", actionType: "button", displayOrder: 2 },
  { pageCode: "settings-billing", code: "select-plan", name: "Select Plan", actionType: "button", displayOrder: 1 },
  { pageCode: "settings-integrations", code: "configure-oauth", name: "Configure OAuth", actionType: "form", displayOrder: 1 },
  { pageCode: "settings-integrations", code: "remove-credentials", name: "Remove Credentials", actionType: "button", displayOrder: 2 },

  // Alerts & Tasks Actions
  { pageCode: "alerts", code: "acknowledge-alert", name: "Acknowledge Alert", actionType: "button", displayOrder: 1 },
  { pageCode: "alerts", code: "resolve-alert", name: "Resolve Alert", actionType: "button", displayOrder: 2 },
  { pageCode: "alerts", code: "dismiss-alert", name: "Dismiss Alert", actionType: "button", displayOrder: 3 },
  { pageCode: "tasks", code: "complete-task", name: "Complete Task", actionType: "button", displayOrder: 1 },
  { pageCode: "tasks", code: "dismiss-task", name: "Dismiss Task", actionType: "button", displayOrder: 2 },
];
