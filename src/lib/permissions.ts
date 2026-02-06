/**
 * Granular permission definitions
 * Format: module:action (e.g., finance:create, sales:post)
 */

export const PERMISSIONS = {
  // Finance
  FINANCE_VIEW: "finance:view",
  FINANCE_CREATE: "finance:create",
  FINANCE_EDIT: "finance:edit",
  FINANCE_DELETE: "finance:delete",
  FINANCE_POST: "finance:post",
  FINANCE_APPROVE: "finance:approve",

  // Sales
  SALES_VIEW: "sales:view",
  SALES_CREATE: "sales:create",
  SALES_EDIT: "sales:edit",
  SALES_DELETE: "sales:delete",
  SALES_POST: "sales:post",

  // Inventory
  INVENTORY_VIEW: "inventory:view",
  INVENTORY_CREATE: "inventory:create",
  INVENTORY_EDIT: "inventory:edit",
  INVENTORY_DELETE: "inventory:delete",
  INVENTORY_ADJUST: "inventory:adjust",

  // Procurement
  PROCUREMENT_VIEW: "procurement:view",
  PROCUREMENT_CREATE: "procurement:create",
  PROCUREMENT_EDIT: "procurement:edit",
  PROCUREMENT_DELETE: "procurement:delete",
  PROCUREMENT_POST: "procurement:post",

  // HR/People
  HR_VIEW: "hr:view",
  HR_CREATE: "hr:create",
  HR_EDIT: "hr:edit",
  HR_DELETE: "hr:delete",
  HR_APPROVE: "hr:approve",

  // Marketing
  MARKETING_VIEW: "marketing:view",
  MARKETING_CREATE: "marketing:create",
  MARKETING_EDIT: "marketing:edit",
  MARKETING_DELETE: "marketing:delete",

  // Strategy
  STRATEGY_VIEW: "strategy:view",
  STRATEGY_CREATE: "strategy:create",
  STRATEGY_EDIT: "strategy:edit",
  STRATEGY_DELETE: "strategy:delete",

  // Admin
  ADMIN_USERS: "admin:users",
  ADMIN_SETTINGS: "admin:settings",
  ADMIN_ROLES: "admin:roles",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * All permission definitions for database seeding
 */
export const ALL_PERMISSIONS: Array<{
  code: string;
  module: string;
  action: string;
  description: string;
}> = [
  // Finance
  { code: "finance:view", module: "finance", action: "view", description: "View financial records" },
  { code: "finance:create", module: "finance", action: "create", description: "Create financial records" },
  { code: "finance:edit", module: "finance", action: "edit", description: "Edit financial records" },
  { code: "finance:delete", module: "finance", action: "delete", description: "Delete financial records" },
  { code: "finance:post", module: "finance", action: "post", description: "Post transactions to ledger" },
  { code: "finance:approve", module: "finance", action: "approve", description: "Approve financial transactions" },

  // Sales
  { code: "sales:view", module: "sales", action: "view", description: "View sales records" },
  { code: "sales:create", module: "sales", action: "create", description: "Create sales orders" },
  { code: "sales:edit", module: "sales", action: "edit", description: "Edit sales orders" },
  { code: "sales:delete", module: "sales", action: "delete", description: "Delete sales orders" },
  { code: "sales:post", module: "sales", action: "post", description: "Post sales invoices" },

  // Inventory
  { code: "inventory:view", module: "inventory", action: "view", description: "View inventory" },
  { code: "inventory:create", module: "inventory", action: "create", description: "Create inventory items" },
  { code: "inventory:edit", module: "inventory", action: "edit", description: "Edit inventory items" },
  { code: "inventory:delete", module: "inventory", action: "delete", description: "Delete inventory items" },
  { code: "inventory:adjust", module: "inventory", action: "adjust", description: "Adjust inventory quantities" },

  // Procurement
  { code: "procurement:view", module: "procurement", action: "view", description: "View procurement records" },
  { code: "procurement:create", module: "procurement", action: "create", description: "Create purchase orders" },
  { code: "procurement:edit", module: "procurement", action: "edit", description: "Edit purchase orders" },
  { code: "procurement:delete", module: "procurement", action: "delete", description: "Delete purchase orders" },
  { code: "procurement:post", module: "procurement", action: "post", description: "Post procurement documents" },

  // HR/People
  { code: "hr:view", module: "hr", action: "view", description: "View employee records" },
  { code: "hr:create", module: "hr", action: "create", description: "Create employee records" },
  { code: "hr:edit", module: "hr", action: "edit", description: "Edit employee records" },
  { code: "hr:delete", module: "hr", action: "delete", description: "Delete employee records" },
  { code: "hr:approve", module: "hr", action: "approve", description: "Approve payroll and leave requests" },

  // Marketing
  { code: "marketing:view", module: "marketing", action: "view", description: "View marketing campaigns and channels" },
  { code: "marketing:create", module: "marketing", action: "create", description: "Create marketing campaigns" },
  { code: "marketing:edit", module: "marketing", action: "edit", description: "Edit marketing campaigns" },
  { code: "marketing:delete", module: "marketing", action: "delete", description: "Delete marketing campaigns" },

  // Strategy
  { code: "strategy:view", module: "strategy", action: "view", description: "View strategic initiatives and KPIs" },
  { code: "strategy:create", module: "strategy", action: "create", description: "Create strategic initiatives" },
  { code: "strategy:edit", module: "strategy", action: "edit", description: "Edit strategic initiatives" },
  { code: "strategy:delete", module: "strategy", action: "delete", description: "Delete strategic initiatives" },

  // Admin
  { code: "admin:users", module: "admin", action: "users", description: "Manage users" },
  { code: "admin:settings", module: "admin", action: "settings", description: "Manage tenant settings" },
  { code: "admin:roles", module: "admin", action: "roles", description: "Manage roles and permissions" },
];

/**
 * Default permissions assigned to each role when a new tenant is created
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: Object.values(PERMISSIONS), // Admin gets all permissions

  finance: [
    "finance:view",
    "finance:create",
    "finance:edit",
    "finance:post",
    "finance:approve",
    "sales:view", // Cross-module visibility
    "procurement:view",
  ],

  sales: [
    "sales:view",
    "sales:create",
    "sales:edit",
    "sales:delete",
    "sales:post",
    "inventory:view", // Can view inventory for availability
  ],

  inventory: [
    "inventory:view",
    "inventory:create",
    "inventory:edit",
    "inventory:delete",
    "inventory:adjust",
    "sales:view", // Can view sales for fulfillment
    "procurement:view", // Can view procurement for receiving
  ],

  procurement: [
    "procurement:view",
    "procurement:create",
    "procurement:edit",
    "procurement:delete",
    "procurement:post",
    "inventory:view", // Can view inventory for reorder
  ],

  hr: [
    "hr:view",
    "hr:create",
    "hr:edit",
    "hr:delete",
    "hr:approve",
    "finance:view", // Can view finance for payroll posting
  ],

  marketing: [
    "marketing:view",
    "marketing:create",
    "marketing:edit",
    "marketing:delete",
    "sales:view", // Cross-module visibility for campaign alignment
  ],

};

/**
 * Group permissions by module for UI display
 */
export function groupPermissionsByModule(
  perms: Array<{ code: string; module: string; action: string; description?: string }>
): Record<string, typeof perms> {
  return perms.reduce(
    (acc, p) => {
      if (!acc[p.module]) acc[p.module] = [];
      acc[p.module].push(p);
      return acc;
    },
    {} as Record<string, typeof perms>
  );
}

/**
 * Module display order for consistent UI rendering
 */
export const MODULE_ORDER = ["finance", "sales", "inventory", "procurement", "hr", "marketing", "strategy", "admin"];
