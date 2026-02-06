import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  jsonb,
  date,
  uniqueIndex,
  unique,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";

/* Enums */
export const actorType = pgEnum("actor_type", ["user", "system", "connector"]);
export const transactionSetStatus = pgEnum("transaction_set_status", ["draft", "review", "posted"]);
export const approvalStatus = pgEnum("approval_status", ["pending", "approved", "rejected"]);
export const partyType = pgEnum("party_type", ["customer", "vendor", "employee", "bank", "government", "other"]);
export const productType = pgEnum("product_type", ["good", "service"]);
export const movementType = pgEnum("movement_type", ["receipt", "issue", "transfer", "adjustment"]);
export const movementStatus = pgEnum("movement_status", ["draft", "posted", "reversed"]);
export const purchaseReceiptType = pgEnum("purchase_receipt_type", ["receive", "unreceive", "return_to_vendor"]);
export const subscriptionStatus = pgEnum("subscription_status", ["none", "trialing", "active", "past_due", "canceled", "expired"]);
export const billingType = pgEnum("billing_type", ["recurring", "trial"]);
export const accountType = pgEnum("account_type", [
  "asset",
  "liability",
  "equity",
  "income",
  "expense",
  "contra_asset",
  "contra_liability",
  "contra_equity",
  "contra_income",
  "contra_expense",
]);

/* Tenants */
export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    baseCurrency: text("base_currency").notNull(),
    // Platform owner & status fields for tenant management
    isPlatformOwner: boolean("is_platform_owner").notNull().default(false),
    status: text("status").notNull().default("active"), // 'active', 'suspended', 'archived'
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    suspendedReason: text("suspended_reason"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxPlatformOwner: index("idx_tenants_platform_owner").on(t.isPlatformOwner),
    idxStatus: index("idx_tenants_status").on(t.status),
  })
);

/* Users (one tenant per user) */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    email: text("email").notNull(),
    fullName: text("full_name").notNull(),
    passwordHash: text("password_hash"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqTenantEmail: uniqueIndex("users_tenant_email_uniq").on(t.tenantId, t.email),
  }),
);

/* Roles (needed for escalations later) */
export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userRoles = pgTable(
  "user_roles",
  {
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    roleId: uuid("role_id").notNull().references(() => roles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("user_roles_uniq").on(t.tenantId, t.userId, t.roleId),
  }),
);

/* Sessions - for token revocation and session management */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
  },
  (t) => ({
    idxUserId: index("idx_sessions_user_id").on(t.userId),
    idxTokenHash: uniqueIndex("idx_sessions_token_hash").on(t.tokenHash),
    idxExpiresAt: index("idx_sessions_expires_at").on(t.expiresAt),
  }),
);

/* Permissions (system-wide definitions) */
export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    code: text("code").notNull().unique(), // e.g., 'finance:create'
    module: text("module").notNull(), // e.g., 'finance'
    action: text("action").notNull(), // e.g., 'create'
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    moduleIdx: index("permissions_module_idx").on(t.module),
  }),
);

/* Actors (user/system/connector) */
export const actors = pgTable("actors", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  type: actorType("type").notNull(),
  userId: uuid("user_id").references(() => users.id),
  systemName: text("system_name"),
  connectorName: text("connector_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* Role-Permission Assignments (tenant-scoped) */
export const rolePermissions = pgTable(
  "role_permissions",
  {
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    roleId: uuid("role_id").notNull().references(() => roles.id),
    permissionId: uuid("permission_id").notNull().references(() => permissions.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
  },
  (t) => ({
    uniq: uniqueIndex("role_permissions_uniq").on(t.tenantId, t.roleId, t.permissionId),
    tenantRoleIdx: index("role_permissions_tenant_role_idx").on(t.tenantId, t.roleId),
  }),
);

/* Tenant Settings */
export const tenantSettings = pgTable("tenant_settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  // Finance settings
  cashAccountCodes: jsonb("cash_account_codes").$type<string[]>().default([]),
  bankAccountCodes: jsonb("bank_account_codes").$type<string[]>().default([]),
  liquidityMinBalance: numeric("liquidity_min_balance", { precision: 18, scale: 6 }).default("50000"),
  // Default terms
  defaultPaymentTermsDays: integer("default_payment_terms_days").default(30),
  // OAuth credentials for marketing integrations (encrypted)
  oauthCredentials: jsonb("oauth_credentials").$type<Record<string, { clientId: string; clientSecret: string }>>().default({}),
  // Timestamps
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedByActorId: uuid("updated_by_actor_id").references(() => actors.id),
}, (table) => [
  uniqueIndex("idx_tenant_settings_tenant").on(table.tenantId),
]);

/* Audit trail (append-only) */
export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  actorId: uuid("actor_id").notNull().references(() => actors.id),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  action: text("action").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb("metadata").notNull().default({}),
});

/* Documents (evidence) */
export const documentCategory = pgEnum("document_category", [
  "id",           // Government ID, passport, driver's license
  "contract",     // Employment contract, NDA
  "certificate",  // Certifications, qualifications
  "visa",         // Work permits, visas
  "license",      // Professional licenses
  "policy",       // Signed policies, handbooks
  "tax",          // Tax forms, W-4, W-2
  "other",        // Other documents
]);

export const documentVerificationStatus = pgEnum("document_verification_status", [
  "pending",   // Awaiting review
  "verified",  // Verified by HR
  "rejected",  // Rejected - needs replacement
  "expired",   // Past expiry date
]);

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  storageKey: text("storage_key").notNull(),
  sha256: text("sha256").notNull(),
  mimeType: text("mime_type").notNull(),
  originalFilename: text("original_filename").notNull(),
  uploadedByActorId: uuid("uploaded_by_actor_id").notNull().references(() => actors.id),
  // HR document extensions
  expiryDate: date("expiry_date"),
  expiryAlertDays: integer("expiry_alert_days").default(30),
  category: documentCategory("document_category"),
  verificationStatus: documentVerificationStatus("verification_status").default("pending"),
  verifiedByUserId: uuid("verified_by_user_id").references(() => users.id),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const documentExtractions = pgTable("document_extractions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  documentId: uuid("document_id").notNull().references(() => documents.id),
  model: text("model").notNull(),
  confidence: numeric("confidence", { precision: 5, scale: 4 }).notNull(),
  extracted: jsonb("extracted").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documentLinks = pgTable(
  "document_links",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    documentId: uuid("document_id").notNull().references(() => documents.id),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    linkType: text("link_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    uniq: uniqueIndex("document_links_uniq").on(t.tenantId, t.documentId, t.entityType, t.entityId, t.linkType),
  }),
);

/* Omni funnel: transaction set drafts */
export const transactionSets = pgTable("transaction_sets", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  status: transactionSetStatus("status").notNull().default("draft"),
  source: text("source").notNull().default("web"), // web, api, connector, csv
  createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
  businessDate: date("business_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const businessTransactions = pgTable("business_transactions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  transactionSetId: uuid("transaction_set_id").notNull().references(() => transactionSets.id),
  type: text("type").notNull(), // expand later with enum when you finalize list
  occurredOn: date("occurred_on"),
  memo: text("memo"),
  createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const businessTransactionLines = pgTable("business_transaction_lines", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  businessTransactionId: uuid("business_transaction_id").notNull().references(() => businessTransactions.id),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 18, scale: 6 }).notNull().default("0"),
  unitPrice: numeric("unit_price", { precision: 18, scale: 6 }).notNull().default("0"),
  amount: numeric("amount", { precision: 18, scale: 6 }).notNull().default("0"),
  metadata: jsonb("metadata").notNull().default({}),
});

export const postingIntents = pgTable("posting_intents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  transactionSetId: uuid("transaction_set_id").notNull().references(() => transactionSets.id),
  intent: jsonb("intent").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const approvals = pgTable("approvals", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  requiredRoleName: text("required_role_name").notNull(),
  status: approvalStatus("status").notNull().default("pending"),
  decidedByUserId: uuid("decided_by_user_id").references(() => users.id),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* Ledger kernel */
export const chartOfAccounts = pgTable("chart_of_accounts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    coaId: uuid("coa_id").notNull().references(() => chartOfAccounts.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    type: accountType("type").notNull(),
    parentAccountId: uuid("parent_account_id"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqCode: uniqueIndex("accounts_tenant_code_uniq").on(t.tenantId, t.code),
  }),
);

export const journalEntries = pgTable("journal_entries", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  postingDate: date("posting_date").notNull(),
  entryDate: timestamp("entry_date", { withTimezone: true }).notNull().defaultNow(),
  memo: text("memo"),
  sourceTransactionSetId: uuid("source_transaction_set_id").references(() => transactionSets.id),
  postedByActorId: uuid("posted_by_actor_id").notNull().references(() => actors.id),
  postedAt: timestamp("posted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const journalLines = pgTable("journal_lines", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  journalEntryId: uuid("journal_entry_id").notNull().references(() => journalEntries.id),
  lineNo: integer("line_no").notNull(),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  debit: numeric("debit", { precision: 18, scale: 6 }).notNull().default("0"),
  credit: numeric("credit", { precision: 18, scale: 6 }).notNull().default("0"),
  description: text("description"),
});

export const reversalLinks = pgTable("reversal_links", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  originalJournalEntryId: uuid("original_journal_entry_id").notNull().references(() => journalEntries.id),
  reversalJournalEntryId: uuid("reversal_journal_entry_id").notNull().references(() => journalEntries.id),
  reason: text("reason").notNull(),
  createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ─────────────────────────────────────────────────────────────────────────────
   Validation + Escalation
   ───────────────────────────────────────────────────────────────────────────── */

export const validationRules = pgTable("validation_rules", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  description: text("description"),
  entityType: text("entity_type").notNull(),
  fieldPath: text("field_path"),
  severity: text("severity").notNull(), // critical, warning, info
  ruleDefinition: jsonb("rule_definition").notNull().default({}),
  isActive: boolean("is_active").notNull().default(true),
  createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const validationIssues = pgTable("validation_issues", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  validationRuleId: uuid("validation_rule_id").references(() => validationRules.id),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  fieldPath: text("field_path"),
  severity: text("severity").notNull(), // critical, warning, info
  message: text("message").notNull(),
  status: text("status").notNull().default("open"), // open, resolved, overridden
  createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const validationResolutions = pgTable("validation_resolutions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  validationIssueId: uuid("validation_issue_id").notNull().references(() => validationIssues.id),
  action: text("action").notNull(), // resolved, dismissed, escalated
  actorId: uuid("actor_id").notNull().references(() => actors.id),
  notes: text("notes"),
  metadata: jsonb("metadata").notNull().default({}),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
});

export const overrides = pgTable("overrides", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  validationIssueId: uuid("validation_issue_id").references(() => validationIssues.id),
  reason: text("reason").notNull(),
  approvedByActorId: uuid("approved_by_actor_id").notNull().references(() => actors.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb("metadata").notNull().default({}),
});

/* ─────────────────────────────────────────────────────────────────────────────
   Tasks + Alerts (non-financial work system)
   ───────────────────────────────────────────────────────────────────────────── */

// Task status enum (per plan)
export const taskStatus = pgEnum("task_status", [
  "open",
  "done",
  "dismissed",
]);

// Task priority enum (per plan)
export const taskPriority = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
  "critical",
]);

// Task domain enum (per plan - shared with alerts)
export const taskDomain = pgEnum("task_domain", [
  "operations",
  "sales",
  "finance",
  "hr",
  "marketing",
]);

// Task assigned role enum (per plan)
export const taskAssignedRole = pgEnum("task_assigned_role", [
  "sme_owner",
  "operations_user",
]);

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

  // Operations: Domain field (per plan)
  domain: taskDomain("domain"),

  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("open"), // open, in_progress, completed, cancelled
  priority: text("priority").notNull().default("normal"), // low, normal, high, urgent
  assigneeUserId: uuid("assignee_user_id").references(() => users.id),

  // Operations: Assigned role fallback (per plan)
  assignedToRole: taskAssignedRole("assigned_to_role"),

  createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
  dueAt: timestamp("due_at", { withTimezone: true }),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: uuid("related_entity_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxTenantDomain: index("tasks_tenant_domain_idx").on(t.tenantId, t.domain),
}));

export const taskEvents = pgTable("task_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  taskId: uuid("task_id").notNull().references(() => tasks.id),
  actorId: uuid("actor_id").notNull().references(() => actors.id),
  action: text("action").notNull(), // created, updated, status_changed, assigned, commented
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  metadata: jsonb("metadata").notNull().default({}),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
});

// Alert severity enum (per plan)
export const alertSeverity = pgEnum("alert_severity", [
  "info",
  "warning",
  "critical",
]);

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

  // Operations: Domain field (per plan)
  domain: taskDomain("domain"),

  type: text("type").notNull(),
  severity: text("severity").notNull(), // info, warning, critical
  message: text("message").notNull(),
  status: text("status").notNull().default("active"), // active, acknowledged, resolved, dismissed
  source: text("source").notNull(), // system, ai, connector
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: uuid("related_entity_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxTenantDomain: index("alerts_tenant_domain_idx").on(t.tenantId, t.domain),
}));

export const alertEvents = pgTable("alert_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  alertId: uuid("alert_id").notNull().references(() => alerts.id),
  actorId: uuid("actor_id").references(() => actors.id), // nullable if system-generated
  action: text("action").notNull(), // acknowledged, resolved, dismissed, escalated
  metadata: jsonb("metadata").notNull().default({}),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ─────────────────────────────────────────────────────────────────────────────
   MASTER TASKS & ALERTS (Unified Cross-Module Tables)
   Consolidates: tasks, grcTasks, marketingTasks, aiTasks, alerts, grcAlerts
   ───────────────────────────────────────────────────────────────────────────── */

// Master task category - identifies the source/type of task
export const masterTaskCategory = pgEnum("master_task_category", [
  "standard",      // Generic tasks (Operations, HR, Finance, Sales)
  "compliance",    // GRC tasks
  "marketing",     // Marketing tasks
  "ai_suggestion", // AI-generated tasks requiring confirmation
]);

// Master task status - unified status across all task types
export const masterTaskStatus = pgEnum("master_task_status", [
  "open",          // Not started
  "in_progress",   // Being worked on
  "blocked",       // Blocked (GRC)
  "in_review",     // Under review (AI)
  "completed",     // Done successfully
  "cancelled",     // Manually cancelled
  "auto_resolved", // System resolved
  "approved",      // Action confirmed (AI)
  "rejected",      // Action declined (AI)
  "expired",       // Task expired (AI)
]);

// Master task priority - unified priority levels
export const masterTaskPriority = pgEnum("master_task_priority", [
  "low",
  "normal",
  "high",
  "urgent",
  "critical",
]);

// Master alert category
export const masterAlertCategory = pgEnum("master_alert_category", [
  "standard",   // Generic alerts (Operations, HR, Finance, Sales)
  "compliance", // GRC alerts
]);

// Master alert status
export const masterAlertStatus = pgEnum("master_alert_status", [
  "active",
  "acknowledged",
  "resolved",
  "dismissed",
]);

// Master alert severity
export const masterAlertSeverity = pgEnum("master_alert_severity", [
  "info",
  "warning",
  "critical",
]);

// Master alert source
export const masterAlertSource = pgEnum("master_alert_source", [
  "system",
  "ai",
  "connector",
  "user",
]);

/**
 * Master Tasks - Unified task table for all modules
 * Consolidates: tasks, grcTasks, marketingTasks, aiTasks
 */
export const masterTasks = pgTable(
  "master_tasks",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Classification
    category: masterTaskCategory("category").notNull(),
    domain: text("domain").notNull(), // operations, hr, finance, sales, grc, marketing
    taskType: text("task_type"), // marketing_task_type or ai_task_type value (optional)

    // Core fields (common to all)
    title: text("title").notNull(),
    description: text("description"),
    status: masterTaskStatus("status").notNull().default("open"),
    priority: masterTaskPriority("priority").notNull().default("normal"),

    // Assignment
    assigneeUserId: uuid("assignee_user_id").references(() => users.id),
    assigneeActorId: uuid("assignee_actor_id").references(() => actors.id),
    assignedToRole: text("assigned_to_role"),

    // Timing
    dueAt: timestamp("due_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    // Entity linking
    relatedEntityType: text("related_entity_type"),
    relatedEntityId: uuid("related_entity_id"),
    secondaryEntityType: text("secondary_entity_type"),
    secondaryEntityId: uuid("secondary_entity_id"),

    // AI-specific (nullable for non-AI tasks)
    confidenceScore: numeric("confidence_score", { precision: 5, scale: 4 }),
    reasoning: text("reasoning"),
    suggestedAction: jsonb("suggested_action"),

    // Marketing-specific (nullable for non-marketing tasks)
    actionUrl: text("action_url"),
    whyThis: text("why_this"),
    expectedOutcome: text("expected_outcome"),

    // GRC-specific (nullable for non-GRC tasks)
    requirementId: uuid("requirement_id"),
    actionType: text("action_type"),
    blockedReason: text("blocked_reason"),
    completionEvidence: jsonb("completion_evidence"),

    // Deduplication (marketing/AI)
    triggerHash: text("trigger_hash"),
    triggerCount: integer("trigger_count").default(1),
    lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),

    // Resolution
    resolvedByActorId: uuid("resolved_by_actor_id").references(() => actors.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolutionAction: text("resolution_action"),
    resolutionNotes: text("resolution_notes"),
    autoResolved: boolean("auto_resolved").default(false),

    // Extended data (module-specific overflow)
    metadata: jsonb("metadata").notNull().default({}),

    // Audit
    createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantDomain: index("master_tasks_tenant_domain_idx").on(t.tenantId, t.domain),
    idxTenantStatus: index("master_tasks_tenant_status_idx").on(t.tenantId, t.status),
    idxTenantCategory: index("master_tasks_tenant_category_idx").on(t.tenantId, t.category),
    idxTenantPriority: index("master_tasks_tenant_priority_idx").on(t.tenantId, t.priority, t.status),
    idxTriggerHash: index("master_tasks_trigger_hash_idx").on(t.tenantId, t.triggerHash),
    idxAssignee: index("master_tasks_assignee_idx").on(t.assigneeUserId),
    idxRequirement: index("master_tasks_requirement_idx").on(t.requirementId),
  })
);

/**
 * Master Alerts - Unified alert table for all modules
 * Consolidates: alerts, grcAlerts
 */
export const masterAlerts = pgTable(
  "master_alerts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Classification
    category: masterAlertCategory("category").notNull(),
    domain: text("domain").notNull(),
    alertType: text("alert_type").notNull(),

    // Core fields
    title: text("title").notNull(),
    message: text("message"),
    severity: masterAlertSeverity("severity").notNull(),
    status: masterAlertStatus("status").notNull().default("active"),
    source: masterAlertSource("source").notNull().default("system"),

    // Entity linking
    relatedEntityType: text("related_entity_type"),
    relatedEntityId: uuid("related_entity_id"),

    // GRC-specific
    requirementId: uuid("requirement_id"),

    // Resolution
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    autoResolved: boolean("auto_resolved").default(false),
    resolutionReason: text("resolution_reason"),

    // Expiration
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    // Extended data
    metadata: jsonb("metadata").notNull().default({}),

    // Audit
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantDomain: index("master_alerts_tenant_domain_idx").on(t.tenantId, t.domain),
    idxTenantStatus: index("master_alerts_tenant_status_idx").on(t.tenantId, t.status),
    idxTenantSeverity: index("master_alerts_tenant_severity_idx").on(t.tenantId, t.severity),
    idxRequirement: index("master_alerts_requirement_idx").on(t.requirementId),
  })
);

/* ─────────────────────────────────────────────────────────────────────────────
   Generic Linking (future-proof)
   ───────────────────────────────────────────────────────────────────────────── */

export const entityLinks = pgTable(
  "entity_links",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    fromEntityType: text("from_entity_type").notNull(),
    fromEntityId: uuid("from_entity_id").notNull(),
    toEntityType: text("to_entity_type").notNull(),
    toEntityId: uuid("to_entity_id").notNull(),
    linkType: text("link_type").notNull(),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("entity_links_uniq").on(
      t.tenantId,
      t.fromEntityType,
      t.fromEntityId,
      t.toEntityType,
      t.toEntityId,
      t.linkType
    ),
  })
);

/* ─────────────────────────────────────────────────────────────────────────────
   Posting Runs (idempotent posting tracking)
   ───────────────────────────────────────────────────────────────────────────── */

export const postingRuns = pgTable(
  "posting_runs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    transactionSetId: uuid("transaction_set_id").notNull().references(() => transactionSets.id),
    status: text("status").notNull().default("started"), // started, succeeded, failed
    journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id),
    startedByActorId: uuid("started_by_actor_id").notNull().references(() => actors.id),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    error: text("error"),
    metadata: jsonb("metadata").notNull().default({}),
  },
  (t) => ({
    // Prevent duplicate posting: only one started or succeeded run per transaction_set
    uniqActiveRun: uniqueIndex("posting_runs_active_uniq").on(t.tenantId, t.transactionSetId),
  })
);

/* ─────────────────────────────────────────────────────────────────────────────
   Layer 4: Master Data - Parties
   ───────────────────────────────────────────────────────────────────────────── */

export const parties = pgTable(
  "parties",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    type: partyType("type").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    defaultCurrency: text("default_currency"),
    notes: text("notes"),
    // Link to unified people directory (Sales & Customers Remodel)
    personId: uuid("person_id"),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqCode: uniqueIndex("parties_tenant_code_uniq").on(t.tenantId, t.code),
    idxPersonId: index("parties_tenant_person_idx").on(t.tenantId, t.personId),
  })
);

export const partyProfiles = pgTable("party_profiles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  partyId: uuid("party_id").notNull().references(() => parties.id),
  profileType: text("profile_type").notNull(), // billing, shipping, legal, contact
  data: jsonb("data").notNull().default({}),
  createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const partyIdentifiers = pgTable(
  "party_identifiers",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    partyId: uuid("party_id").notNull().references(() => parties.id),
    identifierType: text("identifier_type").notNull(), // tax_id, vat, duns, lei, internal_erp
    identifierValue: text("identifier_value").notNull(),
    issuingAuthority: text("issuing_authority"),
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqTypeValue: uniqueIndex("party_identifiers_tenant_type_value_uniq").on(
      t.tenantId,
      t.partyId,
      t.identifierType,
      t.identifierValue
    ),
  })
);

/* ─────────────────────────────────────────────────────────────────────────────
   Layer 4: Master Data - Dimensions
   ───────────────────────────────────────────────────────────────────────────── */

export const dimensionDefinitions = pgTable(
  "dimension_definitions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    code: text("code").notNull(), // cost_center, department, project, region
    name: text("name").notNull(),
    description: text("description"),
    isHierarchical: boolean("is_hierarchical").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqCode: uniqueIndex("dimension_definitions_tenant_code_uniq").on(t.tenantId, t.code),
  })
);

export const dimensionValues = pgTable(
  "dimension_values",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    dimensionDefinitionId: uuid("dimension_definition_id").notNull().references(() => dimensionDefinitions.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    parentValueId: uuid("parent_value_id"),
    isActive: boolean("is_active").notNull().default(true),
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqCode: uniqueIndex("dimension_values_tenant_dim_code_uniq").on(
      t.tenantId,
      t.dimensionDefinitionId,
      t.code
    ),
  })
);

export const entityDimensions = pgTable(
  "entity_dimensions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    entityType: text("entity_type").notNull(), // party, account, journal_entry, etc.
    entityId: uuid("entity_id").notNull(),
    dimensionValueId: uuid("dimension_value_id").notNull().references(() => dimensionValues.id),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqEntityDim: uniqueIndex("entity_dimensions_uniq").on(
      t.tenantId,
      t.entityType,
      t.entityId,
      t.dimensionValueId
    ),
  })
);

/* ─────────────────────────────────────────────────────────────────────────────
   Layer 5: Master Data - Products and Warehouses
   ───────────────────────────────────────────────────────────────────────────── */

export const uoms = pgTable(
  "uoms",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqCode: uniqueIndex("uoms_tenant_code_uniq").on(t.tenantId, t.code),
  })
);

export const taxCategories = pgTable(
  "tax_categories",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    status: text("status").notNull().default("active"),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqCode: uniqueIndex("tax_categories_tenant_code_uniq").on(t.tenantId, t.code),
  })
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    sku: text("sku"),
    name: text("name").notNull(),
    type: productType("type").notNull(),
    status: text("status").notNull().default("active"),
    description: text("description"),
    defaultUomId: uuid("default_uom_id").references(() => uoms.id),
    taxCategoryId: uuid("tax_category_id").references(() => taxCategories.id),
    defaultSalesPrice: numeric("default_sales_price", { precision: 18, scale: 6 }).notNull().default("0"),
    defaultPurchaseCost: numeric("default_purchase_cost", { precision: 18, scale: 6 }).notNull().default("0"),
    preferredVendorPartyId: uuid("preferred_vendor_party_id").references(() => parties.id),
    inventoryProductId: uuid("inventory_product_id").references((): AnyPgColumn => products.id),
    metadata: jsonb("metadata").notNull().default({}),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxType: index("products_tenant_type_idx").on(t.tenantId, t.type),
    idxStatus: index("products_tenant_status_idx").on(t.tenantId, t.status),
    idxName: index("products_tenant_name_idx").on(t.tenantId, t.name),
    uniqSku: uniqueIndex("products_tenant_sku_uniq")
      .on(t.tenantId, t.sku)
      .where(sql`sku IS NOT NULL`),
  })
);

export const productIdentifiers = pgTable(
  "product_identifiers",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    productId: uuid("product_id").notNull().references(() => products.id),
    identifierType: text("identifier_type").notNull(), // barcode, external, supplier, other
    identifierValue: text("identifier_value").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxProduct: index("product_identifiers_tenant_product_idx").on(t.tenantId, t.productId),
    uniqTypeValue: uniqueIndex("product_identifiers_tenant_type_value_uniq").on(
      t.tenantId,
      t.identifierType,
      t.identifierValue
    ),
  })
);

export const warehouses = pgTable(
  "warehouses",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"),
    address: jsonb("address").notNull().default({}),
    metadata: jsonb("metadata").notNull().default({}),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqCode: uniqueIndex("warehouses_tenant_code_uniq").on(t.tenantId, t.code),
  })
);

export const storageLocations = pgTable(
  "storage_locations",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    warehouseId: uuid("warehouse_id").notNull().references(() => warehouses.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"),
    metadata: jsonb("metadata").notNull().default({}),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxWarehouse: index("storage_locations_tenant_warehouse_idx").on(t.tenantId, t.warehouseId),
    uniqCode: uniqueIndex("storage_locations_tenant_warehouse_code_uniq").on(
      t.tenantId,
      t.warehouseId,
      t.code
    ),
  })
);

/* ─────────────────────────────────────────────────────────────────────────────
   Layer 6: Inventory Movements and Balances
   ───────────────────────────────────────────────────────────────────────────── */

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    transactionSetId: uuid("transaction_set_id").notNull().references(() => transactionSets.id),
    movementType: movementType("movement_type").notNull(),
    movementStatus: movementStatus("movement_status").notNull().default("draft"),
    movementDate: date("movement_date").notNull(),
    productId: uuid("product_id").notNull().references(() => products.id),
    fromWarehouseId: uuid("from_warehouse_id").references(() => warehouses.id),
    fromLocationId: uuid("from_location_id").references(() => storageLocations.id),
    toWarehouseId: uuid("to_warehouse_id").references(() => warehouses.id),
    toLocationId: uuid("to_location_id").references(() => storageLocations.id),
    quantity: numeric("quantity", { precision: 18, scale: 6 }).notNull(),
    uomId: uuid("uom_id").references(() => uoms.id),
    unitCost: numeric("unit_cost", { precision: 18, scale: 6 }),
    reference: text("reference"),
    documentId: uuid("document_id").references(() => documents.id),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTxSet: index("inventory_movements_tenant_txset_idx").on(t.tenantId, t.transactionSetId),
    idxProduct: index("inventory_movements_tenant_product_idx").on(t.tenantId, t.productId),
    idxToWarehouse: index("inventory_movements_tenant_to_wh_idx").on(t.tenantId, t.toWarehouseId, t.toLocationId),
    idxFromWarehouse: index("inventory_movements_tenant_from_wh_idx").on(t.tenantId, t.fromWarehouseId, t.fromLocationId),
  })
);

export const inventoryBalances = pgTable(
  "inventory_balances",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    productId: uuid("product_id").notNull().references(() => products.id),
    warehouseId: uuid("warehouse_id").notNull().references(() => warehouses.id),
    locationId: uuid("location_id").references(() => storageLocations.id),
    onHand: numeric("on_hand", { precision: 18, scale: 6 }).notNull().default("0"),
    reserved: numeric("reserved", { precision: 18, scale: 6 }).notNull().default("0"),
    available: numeric("available", { precision: 18, scale: 6 }).notNull().default("0"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqBalance: uniqueIndex("inventory_balances_uniq").on(
      t.tenantId,
      t.productId,
      t.warehouseId,
      t.locationId
    ),
  })
);

export const inventoryPostingLinks = pgTable(
  "inventory_posting_links",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    transactionSetId: uuid("transaction_set_id").notNull().references(() => transactionSets.id),
    journalEntryId: uuid("journal_entry_id").notNull().references(() => journalEntries.id),
    movementId: uuid("movement_id").notNull().references(() => inventoryMovements.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTxSet: index("inventory_posting_links_tenant_txset_idx").on(t.tenantId, t.transactionSetId),
    uniqLink: uniqueIndex("inventory_posting_links_uniq").on(t.tenantId, t.journalEntryId, t.movementId),
  })
);

/* ─────────────────────────────────────────────────────────────────────────────
   Layer 7: Strategy + Budgets
   ───────────────────────────────────────────────────────────────────────────── */

export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    budgetType: text("budget_type").notNull(), // marketing, sales, opex, capex, payroll, project
    currency: text("currency").notNull().default("USD"),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    status: text("status").notNull().default("active"), // active, archived
    notes: text("notes"),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqCode: uniqueIndex("budgets_tenant_code_uniq").on(t.tenantId, t.code),
  })
);

export const budgetVersions = pgTable(
  "budget_versions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    budgetId: uuid("budget_id").notNull().references(() => budgets.id),
    versionNo: integer("version_no").notNull(),
    label: text("label").notNull(), // baseline, revised, forecast, actual_plan
    status: text("status").notNull().default("active"), // active, locked, archived
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqVersion: uniqueIndex("budget_versions_tenant_budget_version_uniq").on(
      t.tenantId,
      t.budgetId,
      t.versionNo
    ),
  })
);

export const budgetLines = pgTable(
  "budget_lines",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    budgetVersionId: uuid("budget_version_id").notNull().references(() => budgetVersions.id),
    lineNo: integer("line_no").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    amount: numeric("amount", { precision: 18, scale: 6 }).notNull().default("0"),
    currency: text("currency").notNull().default("USD"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    accountId: uuid("account_id").references(() => accounts.id), // optional - planning can exist without COA mapping
    partyId: uuid("party_id").references(() => parties.id), // optional - vendor/customer budget owner
    productId: uuid("product_id").references(() => products.id), // optional - product line budgets
    metadata: jsonb("metadata"),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqLine: uniqueIndex("budget_lines_tenant_version_line_uniq").on(
      t.tenantId,
      t.budgetVersionId,
      t.lineNo
    ),
  })
);

export const budgetLineDimensions = pgTable(
  "budget_line_dimensions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    budgetLineId: uuid("budget_line_id").notNull().references(() => budgetLines.id),
    dimensionValueId: uuid("dimension_value_id").notNull().references(() => dimensionValues.id),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqDim: uniqueIndex("budget_line_dimensions_uniq").on(
      t.tenantId,
      t.budgetLineId,
      t.dimensionValueId
    ),
  })
);

export const objectives = pgTable(
  "objectives",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    ownerPartyId: uuid("owner_party_id").references(() => parties.id),
    status: text("status").notNull().default("active"), // active, archived, completed
    startDate: date("start_date"),
    endDate: date("end_date"),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqCode: uniqueIndex("objectives_tenant_code_uniq").on(t.tenantId, t.code),
  })
);

export const initiatives = pgTable(
  "initiatives",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    objectiveId: uuid("objective_id").references(() => objectives.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"), // active, paused, completed, archived
    startDate: date("start_date"),
    endDate: date("end_date"),
    ownerPartyId: uuid("owner_party_id").references(() => parties.id),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqCode: uniqueIndex("initiatives_tenant_code_uniq").on(t.tenantId, t.code),
  })
);

export const kpiDefinitions = pgTable(
  "kpi_definitions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    unit: text("unit").notNull(), // %, USD, count, ratio, days
    direction: text("direction").notNull(), // increase, decrease, maintain
    status: text("status").notNull().default("active"), // active, archived
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqCode: uniqueIndex("kpi_definitions_tenant_code_uniq").on(t.tenantId, t.code),
  })
);

export const kpiTargets = pgTable(
  "kpi_targets",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    kpiDefinitionId: uuid("kpi_definition_id").notNull().references(() => kpiDefinitions.id),
    objectiveId: uuid("objective_id").references(() => objectives.id),
    initiativeId: uuid("initiative_id").references(() => initiatives.id),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    targetValue: numeric("target_value", { precision: 18, scale: 6 }).notNull(),
    status: text("status").notNull().default("active"), // active, archived
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqTarget: uniqueIndex("kpi_targets_uniq").on(
      t.tenantId,
      t.kpiDefinitionId,
      t.periodStart,
      t.periodEnd,
      t.objectiveId,
      t.initiativeId
    ),
  })
);

export const kpiMeasurements = pgTable(
  "kpi_measurements",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    kpiDefinitionId: uuid("kpi_definition_id").notNull().references(() => kpiDefinitions.id),
    objectiveId: uuid("objective_id").references(() => objectives.id),
    initiativeId: uuid("initiative_id").references(() => initiatives.id),
    measuredAt: timestamp("measured_at", { withTimezone: true }).notNull(),
    value: numeric("value", { precision: 18, scale: 6 }).notNull(),
    source: text("source"), // manual, import, system, integration
    notes: text("notes"),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxKpiMeasured: index("kpi_measurements_tenant_kpi_measured_idx").on(
      t.tenantId,
      t.kpiDefinitionId,
      t.measuredAt
    ),
  })
);

/* ─────────────────────────────────────────────────────────────────────────────
   Layer 8: Commercial Documents (Sales + Procurement) - Non-posting
   ───────────────────────────────────────────────────────────────────────────── */

export const salesDocs = pgTable(
  "sales_docs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    docType: text("doc_type").notNull(), // quote, order, invoice, credit_note, debit_note
    docNumber: text("doc_number").notNull(),
    partyId: uuid("party_id").notNull().references(() => parties.id), // customer
    docDate: date("doc_date").notNull(),
    dueDate: date("due_date"),
    currency: text("currency").notNull().default("USD"),
    subtotal: numeric("subtotal", { precision: 18, scale: 6 }).notNull().default("0"),
    discountAmount: numeric("discount_amount", { precision: 18, scale: 6 }).notNull().default("0"),
    taxAmount: numeric("tax_amount", { precision: 18, scale: 6 }).notNull().default("0"),
    totalAmount: numeric("total_amount", { precision: 18, scale: 6 }).notNull().default("0"),
    status: text("status").notNull().default("draft"), // draft, issued, approved, partially_fulfilled, fulfilled, cancelled
    notes: text("notes"),
    metadata: jsonb("metadata"),
    // Payment tracking (Sales & Customers Remodel)
    allocatedAmount: numeric("allocated_amount", { precision: 15, scale: 2 }).default("0"),
    remainingAmount: numeric("remaining_amount", { precision: 15, scale: 2 }),
    paymentStatus: text("payment_status"), // unpaid, partial, paid, overdue
    // Document delivery tracking
    sentAt: timestamp("sent_at", { withTimezone: true }),
    sentMethod: text("sent_method"), // email, whatsapp, hand_delivered
    lastReminderSentAt: timestamp("last_reminder_sent_at", { withTimezone: true }),
    reminderCount: integer("reminder_count").default(0),
    // Issue tracking
    hasIssues: boolean("has_issues").default(false),
    issueCount: integer("issue_count").default(0),
    // Audit
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqDocNumber: uniqueIndex("sales_docs_tenant_docnumber_uniq").on(t.tenantId, t.docNumber),
    idxParty: index("sales_docs_tenant_party_idx").on(t.tenantId, t.partyId),
    idxStatus: index("sales_docs_tenant_status_idx").on(t.tenantId, t.status),
    idxPaymentStatus: index("sales_docs_tenant_payment_status_idx").on(t.tenantId, t.paymentStatus),
  })
);

export const salesDocLines = pgTable(
  "sales_doc_lines",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    salesDocId: uuid("sales_doc_id").notNull().references(() => salesDocs.id),
    lineNo: integer("line_no").notNull(),
    productId: uuid("product_id").references(() => products.id),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 18, scale: 6 }).notNull().default("1"),
    uomId: uuid("uom_id").references(() => uoms.id),
    unitPrice: numeric("unit_price", { precision: 18, scale: 6 }).notNull().default("0"),
    discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
    discountAmount: numeric("discount_amount", { precision: 18, scale: 6 }).notNull().default("0"),
    taxCategoryId: uuid("tax_category_id").references(() => taxCategories.id),
    taxAmount: numeric("tax_amount", { precision: 18, scale: 6 }).notNull().default("0"),
    lineTotal: numeric("line_total", { precision: 18, scale: 6 }).notNull().default("0"),
    metadata: jsonb("metadata"),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqLine: uniqueIndex("sales_doc_lines_tenant_doc_line_uniq").on(t.tenantId, t.salesDocId, t.lineNo),
    idxDoc: index("sales_doc_lines_tenant_doc_idx").on(t.tenantId, t.salesDocId),
  })
);

export const purchaseDocs = pgTable(
  "purchase_docs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    docType: text("doc_type").notNull(), // rfq, order, invoice, credit_note, debit_note
    docNumber: text("doc_number").notNull(),
    partyId: uuid("party_id").notNull().references(() => parties.id), // vendor
    docDate: date("doc_date").notNull(),
    dueDate: date("due_date"),
    currency: text("currency").notNull().default("USD"),
    subtotal: numeric("subtotal", { precision: 18, scale: 6 }).notNull().default("0"),
    discountAmount: numeric("discount_amount", { precision: 18, scale: 6 }).notNull().default("0"),
    taxAmount: numeric("tax_amount", { precision: 18, scale: 6 }).notNull().default("0"),
    totalAmount: numeric("total_amount", { precision: 18, scale: 6 }).notNull().default("0"),
    status: text("status").notNull().default("draft"), // draft, issued, approved, partially_fulfilled, fulfilled, cancelled
    notes: text("notes"),
    metadata: jsonb("metadata"),
    // Bill payment scheduling fields
    scheduledPaymentDate: date("scheduled_payment_date"),
    scheduledPaymentAmount: numeric("scheduled_payment_amount", { precision: 18, scale: 6 }),
    paymentPriority: text("payment_priority"), // high, medium, low
    paymentNotes: text("payment_notes"),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqDocNumber: uniqueIndex("purchase_docs_tenant_docnumber_uniq").on(t.tenantId, t.docNumber),
    idxParty: index("purchase_docs_tenant_party_idx").on(t.tenantId, t.partyId),
    idxStatus: index("purchase_docs_tenant_status_idx").on(t.tenantId, t.status),
  })
);

export const purchaseDocLines = pgTable(
  "purchase_doc_lines",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    purchaseDocId: uuid("purchase_doc_id").notNull().references(() => purchaseDocs.id),
    lineNo: integer("line_no").notNull(),
    productId: uuid("product_id").references(() => products.id),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 18, scale: 6 }).notNull().default("1"),
    uomId: uuid("uom_id").references(() => uoms.id),
    unitPrice: numeric("unit_price", { precision: 18, scale: 6 }).notNull().default("0"),
    discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
    discountAmount: numeric("discount_amount", { precision: 18, scale: 6 }).notNull().default("0"),
    taxCategoryId: uuid("tax_category_id").references(() => taxCategories.id),
    taxAmount: numeric("tax_amount", { precision: 18, scale: 6 }).notNull().default("0"),
    lineTotal: numeric("line_total", { precision: 18, scale: 6 }).notNull().default("0"),
    metadata: jsonb("metadata"),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqLine: uniqueIndex("purchase_doc_lines_tenant_doc_line_uniq").on(t.tenantId, t.purchaseDocId, t.lineNo),
    idxDoc: index("purchase_doc_lines_tenant_doc_idx").on(t.tenantId, t.purchaseDocId),
  })
);

/* ─────────────────────────────────────────────────────────────────────────────
   Layer 9A: Sales Fulfillment Links
   ───────────────────────────────────────────────────────────────────────────── */

export const salesFulfillments = pgTable(
  "sales_fulfillments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    salesDocId: uuid("sales_doc_id").notNull().references(() => salesDocs.id),
    salesDocLineId: uuid("sales_doc_line_id").notNull().references(() => salesDocLines.id),
    movementId: uuid("movement_id").notNull().references(() => inventoryMovements.id),
    fulfillmentType: text("fulfillment_type").notNull(), // reserve, ship, unreserve, return
    quantity: numeric("quantity", { precision: 18, scale: 6 }).notNull(),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqFulfillment: uniqueIndex("sales_fulfillments_uniq").on(
      t.tenantId,
      t.salesDocLineId,
      t.movementId,
      t.fulfillmentType
    ),
    idxDoc: index("sales_fulfillments_tenant_doc_idx").on(t.tenantId, t.salesDocId),
    idxLine: index("sales_fulfillments_tenant_line_idx").on(t.tenantId, t.salesDocLineId),
  })
);

/* ─────────────────────────────────────────────────────────────────────────────
   Layer 9B: Procurement Receiving Links
   ───────────────────────────────────────────────────────────────────────────── */

export const purchaseReceipts = pgTable(
  "purchase_receipts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    purchaseDocId: uuid("purchase_doc_id").notNull().references(() => purchaseDocs.id),
    purchaseDocLineId: uuid("purchase_doc_line_id").notNull().references(() => purchaseDocLines.id),
    movementId: uuid("movement_id").notNull().references(() => inventoryMovements.id),
    receiptType: purchaseReceiptType("receipt_type").notNull(),
    quantity: numeric("quantity", { precision: 18, scale: 6 }).notNull(),
    note: text("note"),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqReceipt: uniqueIndex("purchase_receipts_uniq").on(
      t.tenantId,
      t.purchaseDocLineId,
      t.movementId,
      t.receiptType
    ),
    idxTenant: index("purchase_receipts_tenant_idx").on(t.tenantId),
    idxDoc: index("purchase_receipts_doc_idx").on(t.purchaseDocId),
    idxLine: index("purchase_receipts_line_idx").on(t.purchaseDocLineId),
    idxMovement: index("purchase_receipts_movement_idx").on(t.movementId),
  })
);

/* ─────────────────────────────────────────────────────────────────────────────
   Layer 9C: Commercial Document Posting Links
   ───────────────────────────────────────────────────────────────────────────── */

export const salesPostingLinks = pgTable(
  "sales_posting_links",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    salesDocId: uuid("sales_doc_id").notNull().references(() => salesDocs.id),
    journalEntryId: uuid("journal_entry_id").notNull().references(() => journalEntries.id),
    transactionSetId: uuid("transaction_set_id").notNull().references(() => transactionSets.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqSalesDoc: uniqueIndex("sales_posting_links_tenant_doc_uniq").on(t.tenantId, t.salesDocId),
    idxJournal: index("sales_posting_links_journal_idx").on(t.journalEntryId),
  })
);

export const purchasePostingLinks = pgTable(
  "purchase_posting_links",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    purchaseDocId: uuid("purchase_doc_id").notNull().references(() => purchaseDocs.id),
    journalEntryId: uuid("journal_entry_id").notNull().references(() => journalEntries.id),
    transactionSetId: uuid("transaction_set_id").notNull().references(() => transactionSets.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqPurchaseDoc: uniqueIndex("purchase_posting_links_tenant_doc_uniq").on(t.tenantId, t.purchaseDocId),
    idxJournal: index("purchase_posting_links_journal_idx").on(t.journalEntryId),
  })
);

/* ─────────────────────────────────────────────────────────────────────────────
   Layer 10: Payments
   ───────────────────────────────────────────────────────────────────────────── */

export const paymentType = pgEnum("payment_type", ["receipt", "payment"]);
export const paymentMethod = pgEnum("payment_method", ["cash", "bank"]);
export const paymentStatus = pgEnum("payment_status", ["draft", "posted", "void"]);
export const paymentAllocationTargetType = pgEnum("payment_allocation_target_type", ["sales_doc", "purchase_doc"]);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    type: paymentType("type").notNull(),
    method: paymentMethod("method").notNull(),
    status: paymentStatus("status").notNull().default("draft"),
    paymentDate: date("payment_date").notNull(),
    partyId: uuid("party_id").references(() => parties.id),
    currency: text("currency").notNull().default("USD"),
    amount: numeric("amount", { precision: 18, scale: 6 }).notNull(),
    reference: text("reference"),
    memo: text("memo"),
    cashAccountCode: text("cash_account_code").notNull().default("1000"),
    bankAccountCode: text("bank_account_code").notNull().default("1020"),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenant: index("payments_tenant_idx").on(t.tenantId),
    idxParty: index("payments_tenant_party_idx").on(t.tenantId, t.partyId),
    idxDate: index("payments_tenant_date_idx").on(t.tenantId, t.paymentDate),
    idxStatus: index("payments_tenant_status_idx").on(t.tenantId, t.status),
  })
);

export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    paymentId: uuid("payment_id").notNull().references(() => payments.id),
    targetType: paymentAllocationTargetType("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    amount: numeric("amount", { precision: 18, scale: 6 }).notNull(),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqAllocation: uniqueIndex("payment_allocations_uniq").on(t.tenantId, t.paymentId, t.targetType, t.targetId),
    idxPayment: index("payment_allocations_tenant_payment_idx").on(t.tenantId, t.paymentId),
  })
);

export const paymentPostingLinks = pgTable(
  "payment_posting_links",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    paymentId: uuid("payment_id").notNull().references(() => payments.id),
    journalEntryId: uuid("journal_entry_id").notNull().references(() => journalEntries.id),
    transactionSetId: uuid("transaction_set_id").references(() => transactionSets.id),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqPayment: uniqueIndex("payment_posting_links_tenant_payment_uniq").on(t.tenantId, t.paymentId),
    idxJournal: index("payment_posting_links_journal_idx").on(t.journalEntryId),
  })
);

/* ─────────────────────────────────────────────────────────────────────────────
   Prepaid Expenses (Layer 11)
   ───────────────────────────────────────────────────────────────────────────── */

export const prepaidExpenseStatus = pgEnum("prepaid_expense_status", [
  "active",
  "fully_amortized",
  "cancelled",
]);

export const amortizationFrequency = pgEnum("amortization_frequency", [
  "monthly",
  "quarterly",
]);

export const amortizationStatus = pgEnum("amortization_status", [
  "scheduled",
  "posted",
  "skipped",
]);

/**
 * Prepaid Expenses - Track expenses paid upfront that cover multiple periods
 * Examples: Annual insurance, prepaid rent, software subscriptions
 */
export const prepaidExpenses = pgTable(
  "prepaid_expenses",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Description
    description: text("description").notNull(),
    category: text("category"), // e.g., "Insurance", "Rent", "Software"

    // Vendor (optional)
    vendorId: uuid("vendor_id").references(() => parties.id),
    vendorName: text("vendor_name"),

    // Amounts
    originalAmount: numeric("original_amount", { precision: 18, scale: 6 }).notNull(),
    remainingAmount: numeric("remaining_amount", { precision: 18, scale: 6 }).notNull(),
    currency: text("currency").notNull().default("USD"),

    // Coverage period
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    amortizationFrequency: amortizationFrequency("amortization_frequency").notNull().default("monthly"),

    // Account mapping
    prepaidAssetAccountCode: text("prepaid_asset_account_code").notNull().default("1400"), // Prepaid Expenses asset
    expenseAccountCode: text("expense_account_code").notNull(), // Where amortization goes

    // Source tracking
    sourceExpenseId: uuid("source_expense_id"), // Links to original expense record if created from expense flow
    sourcePaymentId: uuid("source_payment_id").references(() => payments.id),

    // Status
    status: prepaidExpenseStatus("status").notNull().default("active"),

    // Audit
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenant: index("prepaid_expenses_tenant_idx").on(t.tenantId),
    idxTenantStatus: index("prepaid_expenses_tenant_status_idx").on(t.tenantId, t.status),
    idxTenantEndDate: index("prepaid_expenses_tenant_end_date_idx").on(t.tenantId, t.endDate),
  })
);

/**
 * Prepaid Amortization Schedule - Individual amortization entries
 * Each row represents one period's amortization of a prepaid expense
 */
export const prepaidAmortizationSchedule = pgTable(
  "prepaid_amortization_schedule",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    prepaidExpenseId: uuid("prepaid_expense_id").notNull().references(() => prepaidExpenses.id, { onDelete: "cascade" }),

    // Period
    periodDate: date("period_date").notNull(), // First day of the period
    periodEndDate: date("period_end_date").notNull(), // Last day of the period

    // Amount
    amount: numeric("amount", { precision: 18, scale: 6 }).notNull(),

    // Posting
    status: amortizationStatus("status").notNull().default("scheduled"),
    journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedByActorId: uuid("posted_by_actor_id").references(() => actors.id),

    // Audit
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqPeriod: uniqueIndex("prepaid_amort_schedule_uniq").on(t.tenantId, t.prepaidExpenseId, t.periodDate),
    idxPrepaidExpense: index("prepaid_amort_schedule_prepaid_idx").on(t.prepaidExpenseId),
    idxTenantStatus: index("prepaid_amort_schedule_tenant_status_idx").on(t.tenantId, t.status),
    idxTenantPeriod: index("prepaid_amort_schedule_tenant_period_idx").on(t.tenantId, t.periodDate),
  })
);

/* ─────────────────────────────────────────────────────────────────────────────
   Deferred Revenue (Layer 12)
   ───────────────────────────────────────────────────────────────────────────── */

export const deferredRevenueStatus = pgEnum("deferred_revenue_status", [
  "pending",
  "partially_recognized",
  "recognized",
  "refunded",
]);

export const recognitionTrigger = pgEnum("recognition_trigger", [
  "manual",
  "completion",
  "schedule",
]);

/**
 * Deferred Revenue - Track customer deposits/prepayments that should not be
 * recognized as revenue until work is completed or service is delivered.
 * Examples: Customer deposits, prepaid service fees, retainers
 */
export const deferredRevenue = pgTable(
  "deferred_revenue",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Customer
    customerId: uuid("customer_id").references(() => parties.id),
    customerName: text("customer_name"),

    // Description
    description: text("description").notNull(),
    serviceType: text("service_type"), // e.g., "Consulting", "Project Work", "Retainer"

    // Amounts
    originalAmount: numeric("original_amount", { precision: 18, scale: 6 }).notNull(),
    remainingAmount: numeric("remaining_amount", { precision: 18, scale: 6 }).notNull(),
    currency: text("currency").notNull().default("USD"),

    // Timeline
    receivedDate: date("received_date").notNull(),
    expectedCompletionDate: date("expected_completion_date"),

    // Account mapping
    deferredRevenueLiabilityAccountCode: text("deferred_revenue_liability_account_code").notNull().default("2400"), // Deferred Revenue liability
    revenueAccountCode: text("revenue_account_code").notNull().default("4000"), // Where revenue goes when recognized

    // Source tracking
    sourcePaymentId: uuid("source_payment_id").references(() => payments.id),

    // Status
    status: deferredRevenueStatus("status").notNull().default("pending"),

    // Related task for completion tracking
    completionTaskId: uuid("completion_task_id").references(() => tasks.id),

    // Audit
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenant: index("deferred_revenue_tenant_idx").on(t.tenantId),
    idxTenantStatus: index("deferred_revenue_tenant_status_idx").on(t.tenantId, t.status),
    idxTenantCustomer: index("deferred_revenue_tenant_customer_idx").on(t.tenantId, t.customerId),
    idxTenantCompletion: index("deferred_revenue_tenant_completion_idx").on(t.tenantId, t.expectedCompletionDate),
  })
);

/**
 * Deferred Revenue Recognition - Track when and how deferred revenue is recognized
 * Each row represents a recognition event (partial or full)
 */
export const deferredRevenueRecognition = pgTable(
  "deferred_revenue_recognition",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    deferredRevenueId: uuid("deferred_revenue_id").notNull().references(() => deferredRevenue.id, { onDelete: "cascade" }),

    // Recognition details
    recognitionDate: date("recognition_date").notNull(),
    amount: numeric("amount", { precision: 18, scale: 6 }).notNull(),
    trigger: recognitionTrigger("trigger").notNull().default("manual"),
    notes: text("notes"),

    // Posting
    journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedByActorId: uuid("posted_by_actor_id").references(() => actors.id),

    // Audit
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxDeferredRevenue: index("deferred_rev_recognition_deferred_idx").on(t.deferredRevenueId),
    idxTenantDate: index("deferred_rev_recognition_tenant_date_idx").on(t.tenantId, t.recognitionDate),
  })
);

/* ─────────────────────────────────────────────────────────────────────────────
   Fixed Assets & Depreciation (Layer 13)
   Track capital purchases and automatically calculate depreciation
   ───────────────────────────────────────────────────────────────────────────── */

export const fixedAssetStatus = pgEnum("fixed_asset_status", [
  "active",           // Asset is in use, depreciation ongoing
  "fully_depreciated", // Asset has been fully depreciated
  "disposed",         // Asset has been sold or disposed of
]);

export const depreciationMethodEnum = pgEnum("depreciation_method", [
  "straight_line",     // Equal depreciation each period
  "none",              // No depreciation (e.g., land)
]);

export const depreciationEntryStatus = pgEnum("depreciation_entry_status", [
  "scheduled",  // Pending, not yet posted
  "posted",     // Journal entry created
  "skipped",    // Manually skipped
]);

/**
 * Fixed Assets - Track capital purchases that depreciate over time
 * Examples: Equipment, vehicles, machinery, furniture
 */
export const fixedAssets = pgTable(
  "fixed_assets",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Description
    name: text("name").notNull(),
    description: text("description"),
    category: text("category").notNull(), // e.g., "equipment", "vehicle", "furniture", "computer"

    // Purchase details
    purchaseDate: date("purchase_date").notNull(),
    purchasePrice: numeric("purchase_price", { precision: 18, scale: 6 }).notNull(),
    currency: text("currency").notNull().default("USD"),

    // Vendor (optional)
    vendorId: uuid("vendor_id").references(() => parties.id),
    vendorName: text("vendor_name"),

    // Depreciation configuration
    depreciationMethod: depreciationMethodEnum("depreciation_method").notNull().default("straight_line"),
    usefulLifeMonths: integer("useful_life_months").notNull(),
    salvageValue: numeric("salvage_value", { precision: 18, scale: 6 }).notNull().default("0"),

    // Depreciation tracking
    totalDepreciation: numeric("total_depreciation", { precision: 18, scale: 6 }).notNull().default("0"),
    bookValue: numeric("book_value", { precision: 18, scale: 6 }).notNull(), // purchasePrice - totalDepreciation

    // Account mapping
    assetAccountCode: text("asset_account_code").notNull().default("1500"), // Fixed Assets
    accumulatedDepreciationAccountCode: text("accumulated_depreciation_account_code").notNull().default("1510"), // Contra-asset
    depreciationExpenseAccountCode: text("depreciation_expense_account_code").notNull().default("6300"), // Depreciation Expense

    // Source tracking
    sourceExpenseId: uuid("source_expense_id"), // Links to original expense record if created from expense flow
    sourceJournalEntryId: uuid("source_journal_entry_id").references(() => journalEntries.id),

    // Status
    status: fixedAssetStatus("status").notNull().default("active"),

    // Disposal info (if disposed)
    disposalDate: date("disposal_date"),
    disposalAmount: numeric("disposal_amount", { precision: 18, scale: 6 }),
    disposalJournalEntryId: uuid("disposal_journal_entry_id").references(() => journalEntries.id),

    // Audit
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenant: index("fixed_assets_tenant_idx").on(t.tenantId),
    idxTenantStatus: index("fixed_assets_tenant_status_idx").on(t.tenantId, t.status),
    idxTenantCategory: index("fixed_assets_tenant_category_idx").on(t.tenantId, t.category),
  })
);

/**
 * Depreciation Schedule - Individual depreciation entries for each period
 * Each row represents one month's depreciation of a fixed asset
 */
export const depreciationSchedule = pgTable(
  "depreciation_schedule",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    fixedAssetId: uuid("fixed_asset_id").notNull().references(() => fixedAssets.id, { onDelete: "cascade" }),

    // Period
    periodDate: date("period_date").notNull(), // First day of the month
    periodEndDate: date("period_end_date").notNull(), // Last day of the month

    // Amount
    amount: numeric("amount", { precision: 18, scale: 6 }).notNull(),

    // Posting
    status: depreciationEntryStatus("status").notNull().default("scheduled"),
    journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedByActorId: uuid("posted_by_actor_id").references(() => actors.id),

    // Audit
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqPeriod: uniqueIndex("depreciation_schedule_uniq").on(t.tenantId, t.fixedAssetId, t.periodDate),
    idxFixedAsset: index("depreciation_schedule_asset_idx").on(t.fixedAssetId),
    idxTenantStatus: index("depreciation_schedule_tenant_status_idx").on(t.tenantId, t.status),
    idxTenantPeriod: index("depreciation_schedule_tenant_period_idx").on(t.tenantId, t.periodDate),
  })
);

/* ─────────────────────────────────────────────────────────────────────────────
   Period Closing (Layer 14)
   Month-end closing workflow with soft/hard close states
   ───────────────────────────────────────────────────────────────────────────── */

export const periodStatus = pgEnum("period_status", [
  "open",        // Normal operation, transactions allowed
  "soft_closed", // Warning shown for new transactions, but allowed
  "hard_closed", // No new transactions allowed
]);

/**
 * Accounting Periods - Track the status of each accounting period (month)
 * Supports soft close (warning) and hard close (blocked) states
 */
export const accountingPeriods = pgTable(
  "accounting_periods",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Period identification (YYYY-MM format stored as first day of month)
    periodStart: date("period_start").notNull(), // First day of month
    periodEnd: date("period_end").notNull(),     // Last day of month
    periodLabel: text("period_label").notNull(), // e.g., "January 2025"

    // Status
    status: periodStatus("status").notNull().default("open"),

    // Soft close info
    softClosedAt: timestamp("soft_closed_at", { withTimezone: true }),
    softClosedByActorId: uuid("soft_closed_by_actor_id").references(() => actors.id),

    // Hard close info
    hardClosedAt: timestamp("hard_closed_at", { withTimezone: true }),
    hardClosedByActorId: uuid("hard_closed_by_actor_id").references(() => actors.id),

    // Reopened info (if period was reopened)
    reopenedAt: timestamp("reopened_at", { withTimezone: true }),
    reopenedByActorId: uuid("reopened_by_actor_id").references(() => actors.id),
    reopenReason: text("reopen_reason"),

    // Pre-close checklist snapshot (stored when soft-closed)
    checklistSnapshot: jsonb("checklist_snapshot").$type<{
      unmatchedPayments: number;
      missingReceipts: number;
      pendingTasks: number;
      draftTransactions: number;
      scheduledDepreciation: number;
      scheduledAmortization: number;
    }>(),

    // Period totals snapshot (stored when hard-closed)
    periodTotals: jsonb("period_totals").$type<{
      revenue: number;
      expenses: number;
      netIncome: number;
      cashChange: number;
    }>(),

    // Audit
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqPeriod: uniqueIndex("accounting_periods_tenant_period_uniq").on(t.tenantId, t.periodStart),
    idxTenantStatus: index("accounting_periods_tenant_status_idx").on(t.tenantId, t.status),
  })
);

/* ─────────────────────────────────────────────────────────────────────────────
   Bank Reconciliation (Layer 14c)
   Match bank statements to recorded transactions
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Status for bank reconciliation sessions
 */
export const reconciliationStatus = pgEnum("reconciliation_status", [
  "in_progress",    // Session is active
  "completed",      // Reconciliation balanced and completed
  "abandoned",      // Session was abandoned
]);

/**
 * Status for bank statement lines
 */
export const statementLineStatus = pgEnum("statement_line_status", [
  "unmatched",      // Not yet matched to a transaction
  "matched",        // Matched to a transaction
  "excluded",       // Excluded from reconciliation (e.g., transfer between own accounts)
]);

/**
 * Bank reconciliation sessions - track reconciliation process
 */
export const bankReconciliationSessions = pgTable(
  "bank_reconciliation_sessions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Account being reconciled
    accountId: uuid("account_id").notNull().references(() => accounts.id),
    accountCode: text("account_code").notNull(),

    // Statement info
    statementDate: date("statement_date").notNull(),
    statementEndingBalance: numeric("statement_ending_balance", { precision: 18, scale: 6 }).notNull(),

    // Book balance at statement date
    bookBalance: numeric("book_balance", { precision: 18, scale: 6 }).notNull(),

    // Reconciliation status
    status: reconciliationStatus("status").notNull().default("in_progress"),
    difference: numeric("difference", { precision: 18, scale: 6 }),

    // Completion info
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedByActorId: uuid("completed_by_actor_id").references(() => actors.id),

    // Audit
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantAccount: index("bank_rec_sessions_tenant_account_idx").on(t.tenantId, t.accountId),
    idxTenantDate: index("bank_rec_sessions_tenant_date_idx").on(t.tenantId, t.statementDate),
  })
);

/**
 * Bank statement lines - imported from CSV/OFX
 */
export const bankStatementLines = pgTable(
  "bank_statement_lines",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    reconciliationSessionId: uuid("reconciliation_session_id").notNull().references(() => bankReconciliationSessions.id),

    // Transaction data from bank
    transactionDate: date("transaction_date").notNull(),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 18, scale: 6 }).notNull(), // Positive = deposit, Negative = withdrawal
    reference: text("reference"), // Check number, transaction ID, etc.
    transactionType: text("transaction_type"), // DEBIT, CREDIT, CHECK, etc.

    // Matching
    status: statementLineStatus("status").notNull().default("unmatched"),
    matchedPaymentId: uuid("matched_payment_id").references(() => payments.id),
    matchedJournalEntryId: uuid("matched_journal_entry_id").references(() => journalEntries.id),
    matchConfidence: numeric("match_confidence", { precision: 5, scale: 2 }), // 0-100 confidence score
    matchedByActorId: uuid("matched_by_actor_id").references(() => actors.id),
    matchedAt: timestamp("matched_at", { withTimezone: true }),

    // Audit
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxSession: index("bank_statement_lines_session_idx").on(t.reconciliationSessionId),
    idxTenantDate: index("bank_statement_lines_tenant_date_idx").on(t.tenantId, t.transactionDate),
    idxStatus: index("bank_statement_lines_status_idx").on(t.reconciliationSessionId, t.status),
  })
);

/**
 * Transaction reconciliation status - track which transactions are reconciled
 */
export const transactionReconciliation = pgTable(
  "transaction_reconciliation",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Link to transaction (either payment or journal entry)
    paymentId: uuid("payment_id").references(() => payments.id),
    journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id),

    // Reconciliation info
    reconciliationSessionId: uuid("reconciliation_session_id").notNull().references(() => bankReconciliationSessions.id),
    bankStatementLineId: uuid("bank_statement_line_id").references(() => bankStatementLines.id),
    reconciledAt: timestamp("reconciled_at", { withTimezone: true }).notNull().defaultNow(),
    reconciledByActorId: uuid("reconciled_by_actor_id").notNull().references(() => actors.id),

    // Audit
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxPayment: index("transaction_rec_payment_idx").on(t.paymentId),
    idxJournalEntry: index("transaction_rec_journal_entry_idx").on(t.journalEntryId),
    idxSession: index("transaction_rec_session_idx").on(t.reconciliationSessionId),
  })
);

/* ─────────────────────────────────────────────────────────────────────────────
   Expense Accruals (Layer 14b)
   Cross-period expense tracking for accrual accounting
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Status for expense accruals
 */
export const expenseAccrualStatus = pgEnum("expense_accrual_status", [
  "accrued",         // Expense recorded, awaiting payment
  "paid",            // Payment has been made
  "reversed",        // Accrual was reversed/cancelled
]);

/**
 * Expense accruals - track expenses that belong to a different period than when paid
 * Example: Paying January's phone bill in February
 */
export const expenseAccruals = pgTable(
  "expense_accruals",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Expense details
    description: text("description").notNull(),
    category: text("category"),
    vendorId: uuid("vendor_id").references(() => parties.id),
    vendorName: text("vendor_name"),
    amount: numeric("amount", { precision: 18, scale: 6 }).notNull(),
    currency: text("currency").notNull().default("USD"),

    // Period assignment - the key to accrual accounting
    expensePeriod: date("expense_period").notNull(), // YYYY-MM-01 - when the expense belongs
    paymentDate: date("payment_date").notNull(),     // When actually paid/will be paid

    // Account references
    expenseAccountCode: text("expense_account_code").notNull(),
    cashAccountCode: text("cash_account_code").notNull(),

    // Journal entries
    accrualJournalEntryId: uuid("accrual_journal_entry_id").references(() => journalEntries.id),
    paymentJournalEntryId: uuid("payment_journal_entry_id").references(() => journalEntries.id),

    // Status tracking
    status: expenseAccrualStatus("status").notNull().default("accrued"),

    // Audit
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenant: index("expense_accruals_tenant_idx").on(t.tenantId),
    idxTenantPeriod: index("expense_accruals_tenant_period_idx").on(t.tenantId, t.expensePeriod),
    idxTenantStatus: index("expense_accruals_tenant_status_idx").on(t.tenantId, t.status),
  })
);

/* ─────────────────────────────────────────────────────────────────────────────
   Recurring Transactions (Layer 14c)
   Automated recurring expense and transfer templates
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Frequency options for recurring transactions
 */
export const recurringFrequency = pgEnum("recurring_frequency", [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "yearly",
]);

/**
 * Status for recurring transactions
 */
export const recurringTransactionStatus = pgEnum("recurring_transaction_status", [
  "active",
  "paused",
  "cancelled",
  "completed",  // For limited-run recurring (e.g., 12 payments)
]);

/**
 * Type of recurring transaction
 */
export const recurringTransactionType = pgEnum("recurring_transaction_type", [
  "expense",
  "transfer",
  "payment",
]);

/**
 * Recurring transactions - templates for automatic transaction creation
 * Example: Monthly rent, quarterly insurance, weekly payroll
 */
export const recurringTransactions = pgTable(
  "recurring_transactions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Template info
    name: text("name").notNull(), // "Monthly Rent", "Office Supplies Subscription"
    description: text("description"),
    type: recurringTransactionType("type").notNull(),

    // Frequency settings
    frequency: recurringFrequency("frequency").notNull(),
    dayOfMonth: integer("day_of_month"), // For monthly: 1-28 (28 = last day)
    dayOfWeek: integer("day_of_week"), // For weekly: 0-6 (0 = Sunday)
    monthOfYear: integer("month_of_year"), // For yearly: 1-12

    // Schedule tracking
    startDate: date("start_date").notNull(),
    endDate: date("end_date"), // null = indefinite
    nextDueDate: date("next_due_date").notNull(),
    lastProcessedDate: date("last_processed_date"),
    occurrencesCompleted: integer("occurrences_completed").notNull().default(0),
    maxOccurrences: integer("max_occurrences"), // null = unlimited

    // Transaction template data
    amount: numeric("amount", { precision: 18, scale: 6 }).notNull(),
    currency: text("currency").notNull().default("USD"),

    // For expenses
    category: text("category"),
    expenseAccountCode: text("expense_account_code"),
    vendorId: uuid("vendor_id").references(() => parties.id),
    vendorName: text("vendor_name"),

    // For transfers
    fromAccountCode: text("from_account_code"),
    toAccountCode: text("to_account_code"),

    // For payments
    partyId: uuid("party_id").references(() => parties.id),
    partyName: text("party_name"),

    // Payment method
    method: paymentMethod("method").notNull().default("bank"),

    // Processing settings
    autoCreate: boolean("auto_create").notNull().default(true), // Auto-create or create as draft
    reminderDaysBefore: integer("reminder_days_before").default(3), // Days before to remind

    // Status
    status: recurringTransactionStatus("status").notNull().default("active"),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    pausedReason: text("paused_reason"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledReason: text("cancelled_reason"),

    // Audit
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenant: index("recurring_transactions_tenant_idx").on(t.tenantId),
    idxTenantStatus: index("recurring_transactions_tenant_status_idx").on(t.tenantId, t.status),
    idxTenantNextDue: index("recurring_transactions_tenant_next_due_idx").on(t.tenantId, t.nextDueDate),
    idxTenantType: index("recurring_transactions_tenant_type_idx").on(t.tenantId, t.type),
  })
);

/**
 * Recurring transaction instances - log of each generated transaction
 */
export const recurringTransactionInstances = pgTable(
  "recurring_transaction_instances",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    recurringTransactionId: uuid("recurring_transaction_id").notNull().references(() => recurringTransactions.id),

    // Instance details
    scheduledDate: date("scheduled_date").notNull(),
    amount: numeric("amount", { precision: 18, scale: 6 }).notNull(),

    // Generated transaction references
    expenseJournalEntryId: uuid("expense_journal_entry_id").references(() => journalEntries.id),
    paymentId: uuid("payment_id").references(() => payments.id),

    // Status
    status: text("status").notNull().default("pending"), // pending, created, skipped, failed
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
  },
  (t) => ({
    idxRecurring: index("recurring_instances_recurring_idx").on(t.recurringTransactionId),
    idxTenantScheduled: index("recurring_instances_tenant_scheduled_idx").on(t.tenantId, t.scheduledDate),
  })
);

/* ─────────────────────────────────────────────────────────────────────────────
   Invoice Follow-up (Layer 14d)
   Automated overdue invoice tracking and escalation
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Escalation level for overdue invoices
 */
export const followUpEscalationLevel = pgEnum("follow_up_escalation_level", [
  "reminder",      // 1 day overdue - friendly reminder
  "first_notice",  // 7 days overdue - first formal notice
  "second_notice", // 14 days overdue - second notice, more urgent
  "final_notice",  // 30 days overdue - final notice before collections
  "collections",   // 45+ days overdue - sent to collections
]);

/**
 * Status of follow-up action
 */
export const followUpStatus = pgEnum("follow_up_status", [
  "pending",     // Action needed
  "in_progress", // Being worked on
  "contacted",   // Customer contacted, awaiting response
  "promised",    // Customer promised payment
  "completed",   // Resolved (paid or written off)
  "skipped",     // User chose to skip this follow-up
]);

/**
 * Invoice follow-ups - tracks overdue invoice status and escalation
 */
export const invoiceFollowUps = pgTable(
  "invoice_follow_ups",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Invoice reference
    salesDocId: uuid("sales_doc_id").notNull().references(() => salesDocs.id),
    partyId: uuid("party_id").notNull().references(() => parties.id),

    // Escalation tracking
    escalationLevel: followUpEscalationLevel("escalation_level").notNull().default("reminder"),
    status: followUpStatus("status").notNull().default("pending"),

    // Financial info at time of follow-up creation
    invoiceAmount: numeric("invoice_amount", { precision: 18, scale: 6 }).notNull(),
    amountPaid: numeric("amount_paid", { precision: 18, scale: 6 }).notNull().default("0"),
    amountDue: numeric("amount_due", { precision: 18, scale: 6 }).notNull(),
    daysOverdue: integer("days_overdue").notNull(),

    // Due dates
    originalDueDate: date("original_due_date").notNull(),
    nextEscalationDate: date("next_escalation_date"),

    // Contact tracking
    lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
    lastContactMethod: text("last_contact_method"), // email, phone, letter
    contactAttempts: integer("contact_attempts").notNull().default(0),

    // Promise tracking
    promisedPaymentDate: date("promised_payment_date"),
    promisedAmount: numeric("promised_amount", { precision: 18, scale: 6 }),

    // Notes
    notes: text("notes"),

    // Resolution
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedByActorId: uuid("resolved_by_actor_id").references(() => actors.id),
    resolutionReason: text("resolution_reason"), // paid, partial_payment, write_off, disputed

    // Task reference
    taskId: uuid("task_id").references(() => tasks.id),

    // Audit
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenant: index("invoice_follow_ups_tenant_idx").on(t.tenantId),
    idxTenantStatus: index("invoice_follow_ups_tenant_status_idx").on(t.tenantId, t.status),
    idxTenantEscalation: index("invoice_follow_ups_tenant_escalation_idx").on(t.tenantId, t.escalationLevel),
    idxSalesDoc: index("invoice_follow_ups_sales_doc_idx").on(t.salesDocId),
    uniqSalesDoc: uniqueIndex("invoice_follow_ups_sales_doc_uniq").on(t.salesDocId),
  })
);

/**
 * Follow-up activity log - tracks all actions taken
 */
export const invoiceFollowUpActivities = pgTable(
  "invoice_follow_up_activities",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    followUpId: uuid("follow_up_id").notNull().references(() => invoiceFollowUps.id),

    // Activity details
    activityType: text("activity_type").notNull(), // email_sent, phone_call, letter_sent, payment_promised, payment_received, escalated, note_added
    description: text("description").notNull(),

    // Contact details
    contactMethod: text("contact_method"), // email, phone, letter, in_person
    contactPerson: text("contact_person"),
    contactDetails: text("contact_details"), // phone number or email used

    // Outcome
    outcome: text("outcome"), // no_answer, left_message, spoke_with_customer, email_bounced, promised_payment

    // Payment promise
    promisedDate: date("promised_date"),
    promisedAmount: numeric("promised_amount", { precision: 18, scale: 6 }),

    // Audit
    performedByActorId: uuid("performed_by_actor_id").references(() => actors.id), // nullable for system-generated activities
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxFollowUp: index("follow_up_activities_follow_up_idx").on(t.followUpId),
    idxTenantCreated: index("follow_up_activities_tenant_created_idx").on(t.tenantId, t.createdAt),
  })
);

/* ─────────────────────────────────────────────────────────────────────────────
   Subscription & Billing (Layer 15)
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Global subscription plans (not tenant-scoped)
 * Plans are shared across all tenants
 */
export const subscriptionPlans = pgTable(
  "subscription_plans",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    code: text("code").notNull().unique(), // MONTHLY_30, SEMIANNUAL_25, OFFER_6M_FREE
    name: text("name").notNull(),
    description: text("description"),
    currency: text("currency").notNull().default("USD"),
    priceAmount: numeric("price_amount", { precision: 10, scale: 2 }).notNull().default("0"),
    billingType: billingType("billing_type").notNull().default("recurring"),
    interval: text("interval").notNull().default("month"), // month, year
    intervalCount: integer("interval_count").notNull().default(1), // 1 = monthly, 6 = semi-annual
    trialDays: integer("trial_days"), // null for non-trial, 180 for OFFER_6M_FREE
    durationMonths: integer("duration_months"), // null for ongoing, 6 for semi-annual/trial
    isPromotional: boolean("is_promotional").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    stripePriceId: text("stripe_price_id"),
    stripeProductId: text("stripe_product_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxCode: index("subscription_plans_code_idx").on(t.code),
  })
);

/**
 * Tenant subscription - supports history with isCurrent flag
 * Only one row per tenant can have isCurrent=true at a time (enforced in app logic)
 */
export const tenantSubscriptions = pgTable(
  "tenant_subscriptions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    planCode: text("plan_code").notNull(), // references subscriptionPlans.code
    status: subscriptionStatus("status").notNull().default("trialing"),
    isCurrent: boolean("is_current").notNull().default(true),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    metadata: jsonb("metadata").notNull().default({}),
    createdByActorId: uuid("created_by_actor_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantStatus: index("tenant_subscriptions_tenant_status_idx").on(t.tenantId, t.status),
    idxTenantPeriodEnd: index("tenant_subscriptions_tenant_period_end_idx").on(t.tenantId, t.currentPeriodEnd),
    idxTenantCurrent: index("tenant_subscriptions_tenant_current_idx").on(t.tenantId, t.isCurrent),
    idxStripeCustomer: index("tenant_subscriptions_stripe_customer_idx").on(t.stripeCustomerId),
    idxStripeSub: index("tenant_subscriptions_stripe_sub_idx").on(t.stripeSubscriptionId),
  })
);

/**
 * Subscription events for billing audit trail
 */
export const subscriptionEvents = pgTable(
  "subscription_events",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    type: text("type").notNull(), // checkout_created, subscription_updated, payment_succeeded, etc.
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenant: index("subscription_events_tenant_idx").on(t.tenantId),
    idxType: index("subscription_events_type_idx").on(t.type),
  })
);

/* ============================================================================
   TENANT MANAGEMENT & GRANULAR RBAC TABLES
   ============================================================================ */

/**
 * Pages - Global reference table for all pages/routes in the application
 * Used for page-level access control
 */
export const pages = pgTable(
  "pages",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    code: text("code").notNull().unique(), // e.g., 'finance-payments', 'sales-detail'
    name: text("name").notNull(), // e.g., 'Payments', 'Sales Document Detail'
    route: text("route").notNull(), // e.g., '/finance/payments', '/sales/[id]'
    module: text("module").notNull(), // e.g., 'finance', 'sales', 'hr'
    description: text("description"),
    icon: text("icon"),
    isAlwaysAccessible: boolean("is_always_accessible").notNull().default(false),
    displayOrder: integer("display_order").notNull().default(0),
    parentPageCode: text("parent_page_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxModule: index("idx_pages_module").on(t.module),
    idxParent: index("idx_pages_parent").on(t.parentPageCode),
  })
);

/**
 * Page Actions - Global reference table for actions/forms on each page
 * Used for action-level access control within pages
 */
export const pageActions = pgTable(
  "page_actions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    pageId: uuid("page_id").notNull().references(() => pages.id, { onDelete: "cascade" }),
    code: text("code").notNull(), // e.g., 'create-payment', 'post-payment'
    name: text("name").notNull(), // e.g., 'Create Payment', 'Post Payment'
    description: text("description"),
    actionType: text("action_type").notNull().default("button"), // 'button', 'form', 'link', 'modal'
    requiresPermission: text("requires_permission"), // Links to existing permission code
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pageCodeUniq: uniqueIndex("page_actions_page_code_uniq").on(t.pageId, t.code),
    idxPage: index("idx_page_actions_page").on(t.pageId),
  })
);

/**
 * User Page Access - Per-user, per-page access control (tenant-scoped)
 * Determines which pages a user can see
 */
export const userPageAccess = pgTable(
  "user_page_access",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    pageId: uuid("page_id").notNull().references(() => pages.id, { onDelete: "cascade" }),
    hasAccess: boolean("has_access").notNull().default(true),
    grantedByActorId: uuid("granted_by_actor_id").references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("user_page_access_uniq").on(t.tenantId, t.userId, t.pageId),
    idxLookup: index("idx_user_page_access_lookup").on(t.tenantId, t.userId),
    idxPage: index("idx_user_page_access_page").on(t.pageId),
  })
);

/**
 * User Action Access - Per-user, per-action access control (tenant-scoped)
 * Determines which actions/forms a user can use within a page
 */
export const userActionAccess = pgTable(
  "user_action_access",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    actionId: uuid("action_id").notNull().references(() => pageActions.id, { onDelete: "cascade" }),
    hasAccess: boolean("has_access").notNull().default(true),
    grantedByActorId: uuid("granted_by_actor_id").references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("user_action_access_uniq").on(t.tenantId, t.userId, t.actionId),
    idxLookup: index("idx_user_action_access_lookup").on(t.tenantId, t.userId),
    idxAction: index("idx_user_action_access_action").on(t.actionId),
  })
);

/**
 * Tenant Payment History - For platform owner monitoring
 * Tracks all payment transactions across tenants
 */
export const tenantPaymentHistory = pgTable(
  "tenant_payment_history",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("USD"),
    status: text("status").notNull(), // 'succeeded', 'failed', 'pending', 'refunded'
    paymentMethod: text("payment_method"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeInvoiceId: text("stripe_invoice_id"),
    description: text("description"),
    periodStart: timestamp("period_start", { withTimezone: true }),
    periodEnd: timestamp("period_end", { withTimezone: true }),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenant: index("idx_tenant_payments_tenant").on(t.tenantId),
    idxStatus: index("idx_tenant_payments_status").on(t.status),
    idxCreated: index("idx_tenant_payments_created").on(t.createdAt),
  })
);

/* ============================================================================
   AI COPILOT TABLES
   ============================================================================ */

export const aiConversationStatus = pgEnum("ai_conversation_status", ["active", "archived"]);
export const aiMessageRole = pgEnum("ai_message_role", ["user", "assistant", "tool", "system"]);
export const aiToolRunStatus = pgEnum("ai_tool_run_status", ["ok", "error"]);

/**
 * AI Conversations - one conversation per user per tenant
 */
export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    title: text("title"),
    status: aiConversationStatus("status").notNull().default("active"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantUser: index("ai_conversations_tenant_user_idx").on(t.tenantId, t.userId),
    idxTenantLastMessage: index("ai_conversations_tenant_last_message_idx").on(t.tenantId, t.lastMessageAt),
  })
);

/**
 * AI Messages - messages in the conversation
 */
export const aiMessages = pgTable(
  "ai_messages",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    conversationId: uuid("conversation_id").notNull().references(() => aiConversations.id),
    role: aiMessageRole("role").notNull(),
    content: jsonb("content").notNull(), // { text: string, toolCalls?: [], toolResults?: [] }
    safeSummary: text("safe_summary"), // For display without sensitive data
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantConversation: index("ai_messages_tenant_conversation_idx").on(t.tenantId, t.conversationId, t.createdAt),
  })
);

/**
 * AI Tool Runs - every tool call request and result metadata
 */
export const aiToolRuns = pgTable(
  "ai_tool_runs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    conversationId: uuid("conversation_id").notNull().references(() => aiConversations.id),
    messageId: uuid("message_id").notNull().references(() => aiMessages.id),
    toolName: text("tool_name").notNull(),
    toolInput: jsonb("tool_input").notNull(),
    toolOutput: jsonb("tool_output").notNull(),
    status: aiToolRunStatus("status").notNull(),
    durationMs: integer("duration_ms").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantConversation: index("ai_tool_runs_tenant_conversation_idx").on(t.tenantId, t.conversationId),
    idxTenantTool: index("ai_tool_runs_tenant_tool_idx").on(t.tenantId, t.toolName),
  })
);

/**
 * AI Usage Daily - per-tenant usage counters for rate limiting
 */
export const aiUsageDaily = pgTable(
  "ai_usage_daily",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    date: date("date").notNull(),
    requests: integer("requests").notNull().default(0),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqTenantDate: uniqueIndex("ai_usage_daily_tenant_date_uniq").on(t.tenantId, t.date),
  })
);

/* ============================================================================
   COMPANY & ORGANIZATION TABLES
   ============================================================================ */

/**
 * Tenant Legal Profile - company registration and tax information
 */
export const tenantLegalProfiles = pgTable(
  "tenant_legal_profiles",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    legalName: text("legal_name"),
    registrationNumber: text("registration_number"),
    taxId: text("tax_id"),
    address: text("address"),
    city: text("city"),
    region: text("region"),
    country: text("country"),
    postalCode: text("postal_code"),
    phone: text("phone"),
    email: text("email"),
    website: text("website"),
    notes: text("notes"),
    updatedByActorId: uuid("updated_by_actor_id").references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqTenant: uniqueIndex("tenant_legal_profiles_tenant_uniq").on(t.tenantId),
  })
);

/**
 * Departments - organizational structure
 */
export const departments = pgTable(
  "departments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    name: text("name").notNull(),
    code: text("code"),
    parentDepartmentId: uuid("parent_department_id"),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenant: index("departments_tenant_idx").on(t.tenantId),
  })
);

/**
 * User Profiles - extended user info for org chart (job title, department, manager)
 */
export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    departmentId: uuid("department_id").references(() => departments.id),
    jobTitle: text("job_title"),
    managerUserId: uuid("manager_user_id").references(() => users.id),
    location: text("location"),
    phone: text("phone"),
    isOrgChartVisible: boolean("is_org_chart_visible").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqUser: uniqueIndex("user_profiles_tenant_user_uniq").on(t.tenantId, t.userId),
  })
);

/* ============================================================================
   PLANNER TABLES
   ============================================================================ */

export const plannerHorizon = pgEnum("planner_horizon", ["run", "improve", "grow"]);
export const plannerStatus = pgEnum("planner_status", ["pending", "active", "completed"]);
export const plannerPriority = pgEnum("planner_priority", ["low", "medium", "high"]);

/**
 * Planner Initiatives - replaces localStorage storage
 */
export const plannerInitiatives = pgTable(
  "planner_initiatives",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    domain: text("domain").notNull(), // finance, sales, company, etc.
    horizon: plannerHorizon("horizon").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    priority: plannerPriority("priority").notNull().default("medium"),
    status: plannerStatus("status").notNull().default("pending"),
    playbookId: text("playbook_id"), // for dedup when created from playbook
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantDomain: index("planner_initiatives_tenant_domain_idx").on(t.tenantId, t.domain),
    idxTenantHorizon: index("planner_initiatives_tenant_horizon_idx").on(t.tenantId, t.horizon),
    // Prevent duplicate playbook initiatives
    uniqPlaybook: uniqueIndex("planner_initiatives_playbook_uniq")
      .on(t.tenantId, t.domain, t.horizon, t.playbookId)
      .where(sql`playbook_id IS NOT NULL`),
  })
);

/**
 * Planner Alert Dismissals - track which alerts have been dismissed per domain
 */
export const plannerAlertDismissals = pgTable(
  "planner_alert_dismissals",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    domain: text("domain").notNull(),
    alertId: text("alert_id").notNull(), // generated alert ID from /api/grc/alerts
    dismissedByActorId: uuid("dismissed_by_actor_id").notNull().references(() => actors.id),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqDismissal: uniqueIndex("planner_alert_dismissals_uniq").on(t.tenantId, t.domain, t.alertId),
  })
);

/* ============================================================================
   MASTER DATA - CATEGORIES
   ============================================================================ */

export const categoryDomain = pgEnum("category_domain", ["product", "party", "service", "generic"]);

/**
 * Categories - classification for products, parties, services
 */
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    domain: categoryDomain("domain").notNull(),
    name: text("name").notNull(),
    code: text("code"),
    description: text("description"),
    parentCategoryId: uuid("parent_category_id"),
    isActive: boolean("is_active").notNull().default(true),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantDomain: index("categories_tenant_domain_idx").on(t.tenantId, t.domain),
  })
);

/**
 * AI Cards - monitoring cards for dashboard
 */
export const aiCards = pgTable(
  "ai_cards",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    type: text("type").notNull(), // metric_snapshot, task_suggestion, document_summary, recommendation
    title: text("title").notNull(),
    description: text("description"),
    priority: text("priority").notNull().default("medium"), // high, medium, low
    domain: text("domain").notNull(), // finance, sales, inventory, etc.
    definition: jsonb("definition").notNull().default({}), // card configuration
    isActive: boolean("is_active").notNull().default(true),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantDomain: index("ai_cards_tenant_domain_idx").on(t.tenantId, t.domain),
  })
);

/* ============================================================================
   SALES & CUSTOMERS - LEADS, SALESPERSONS, CARD PREFERENCES
   ============================================================================ */

export const leadStatus = pgEnum("lead_status", [
  "new",
  "contacted",
  "qualified",
  "disqualified",
  "won",
  "lost",
]);

/**
 * Leads - sales leads/opportunities
 */
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    // Contact info
    contactName: text("contact_name").notNull(),
    company: text("company"),
    email: text("email"),
    phone: text("phone"),
    // Lead details
    status: leadStatus("status").notNull().default("new"),
    source: text("source"), // website, referral, linkedin, etc.
    estimatedValue: numeric("estimated_value", { precision: 18, scale: 6 }),
    probability: integer("probability").default(10), // 0-100%
    expectedCloseDate: date("expected_close_date"),
    notes: text("notes"),
    // Assignment
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id),
    assignedToSalespersonId: uuid("assigned_to_salesperson_id"),
    // Linked customer (optional - can be created/linked later)
    partyId: uuid("party_id").references(() => parties.id),
    // Converted quote/invoice
    convertedToSalesDocId: uuid("converted_to_sales_doc_id").references(() => salesDocs.id),
    // Activity tracking (Sales & Customers Remodel)
    personId: uuid("person_id").references(() => people.id),
    lastActivityDate: timestamp("last_activity_date", { withTimezone: true }),
    activityCount: integer("activity_count").default(0),
    customerHealthScore: integer("customer_health_score"),
    // Conversion/Loss tracking
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    lostReason: text("lost_reason"),
    lostAt: timestamp("lost_at", { withTimezone: true }),
    // Audit
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantStatus: index("leads_tenant_status_idx").on(t.tenantId, t.status),
    idxTenantAssignee: index("leads_tenant_assignee_idx").on(t.tenantId, t.assignedToUserId),
    idxTenantParty: index("leads_tenant_party_idx").on(t.tenantId, t.partyId),
    idxTenantPerson: index("leads_tenant_person_idx").on(t.tenantId, t.personId),
    idxTenantLastActivity: index("leads_tenant_last_activity_idx").on(t.tenantId, t.lastActivityDate),
    idxTenantHealth: index("leads_tenant_health_idx").on(t.tenantId, t.customerHealthScore),
  })
);

/**
 * Salespersons - directory of salespeople (can be linked to users or external)
 */
export const salespersons = pgTable(
  "salespersons",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    // Optional link to platform user
    linkedUserId: uuid("linked_user_id").references(() => users.id),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenant: index("salespersons_tenant_idx").on(t.tenantId),
    idxTenantUser: index("salespersons_tenant_user_idx").on(t.tenantId, t.linkedUserId),
  })
);

/**
 * User Card Preferences - configurable overview cards per user per domain
 */
export const userCardPreferences = pgTable(
  "user_card_preferences",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    domain: text("domain").notNull(), // sales-customers, dashboard, etc.
    cardIds: jsonb("card_ids").$type<string[]>().notNull().default([]),
    cardOrder: jsonb("card_order").$type<string[]>().notNull().default([]),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqUserDomain: uniqueIndex("user_card_prefs_user_domain_uniq").on(t.tenantId, t.userId, t.domain),
  })
);

/* ============================================================================
   MARKETING MODULE
   ============================================================================ */

// Marketing Enums
export const marketingChannelType = pgEnum("marketing_channel_type", [
  "social",
  "email",
  "messaging",
  "ads",
  "website_analytics",
  "sms",
  "offline",
  "agency",
  "influencer",
]);

export const marketingChannelStatus = pgEnum("marketing_channel_status", [
  "connected",
  "disconnected",
  "partial",
  "error",
  "manual",
]);

export const connectorConnectionType = pgEnum("connector_connection_type", [
  "oauth",
  "api_key",
  "credentials",
  "csv_upload",
  "manual_entry",
]);

export const connectorSyncMode = pgEnum("connector_sync_mode", [
  "realtime",
  "scheduled",
  "manual",
]);

export const analyticsCardScopeType = pgEnum("analytics_card_scope_type", [
  "global",
  "channel",
  "multi_channel",
  "product",
  "service",
  "campaign",
  "segment",
]);

export const analyticsCardRenderType = pgEnum("analytics_card_render_type", [
  "kpi",
  "trend",
  "funnel",
  "breakdown",
  "insight",
]);

export const marketingObjectiveType = pgEnum("marketing_objective_type", [
  "revenue",
  "units_sold",
  "leads",
  "awareness",
  "launch",
  "clear_inventory",
  "market_entry",
]);

export const marketingPlanStatus = pgEnum("marketing_plan_status", [
  "draft",
  "recommended",
  "edited",
  "approved",
  "implemented",
  "archived",
]);

export const marketingCampaignStatus = pgEnum("marketing_campaign_status", [
  "active",
  "paused",
  "completed",
  "cancelled",
]);

export const whatIfScenarioType = pgEnum("what_if_scenario_type", [
  "budget_change",
  "channel_remove",
  "channel_add",
  "pricing_change",
  "time_horizon_change",
]);

export const attributionModel = pgEnum("attribution_model", [
  "simple",
  "last_touch",
  "first_touch",
]);

/**
 * Marketing Channels - represents a marketing channel (e.g., Instagram, Google Ads)
 */
export const marketingChannels = pgTable(
  "marketing_channels",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    name: text("name").notNull(),
    type: marketingChannelType("type").notNull(),
    status: marketingChannelStatus("status").notNull().default("manual"),
    integrationProvider: text("integration_provider"), // instagram, facebook, google_ads, etc.
    authMethod: text("auth_method"), // oauth2, api_key
    dataFreshnessPolicy: jsonb("data_freshness_policy").$type<{ maxAgeHours: number }>().default({ maxAgeHours: 24 }),
    permissions: jsonb("permissions").$type<string[]>().default([]),
    metadata: jsonb("metadata").default({}),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantType: index("marketing_channels_tenant_type_idx").on(t.tenantId, t.type),
    idxTenantStatus: index("marketing_channels_tenant_status_idx").on(t.tenantId, t.status),
  })
);

/**
 * Marketing Connectors - manages connection to external platforms
 */
export const marketingConnectors = pgTable(
  "marketing_connectors",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    channelId: uuid("channel_id").notNull().references(() => marketingChannels.id),
    connectionType: connectorConnectionType("connection_type").notNull(),
    requirementsSchema: jsonb("requirements_schema").default({}), // what fields are needed for this connector
    authState: jsonb("auth_state").default({}), // encrypted auth tokens, etc.
    syncMode: connectorSyncMode("sync_mode").notNull().default("manual"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    syncErrors: jsonb("sync_errors").$type<{ message: string; timestamp: string }[]>().default([]),
    dataSources: jsonb("data_sources").$type<string[]>().default([]), // what data this connector pulls
    isActive: boolean("is_active").notNull().default(true),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantChannel: index("marketing_connectors_tenant_channel_idx").on(t.tenantId, t.channelId),
    uniqChannelConnector: uniqueIndex("marketing_connectors_tenant_channel_uniq").on(t.tenantId, t.channelId),
  })
);

/**
 * Marketing Analytics Cards - configurable metric/insight cards
 */
export const marketingAnalyticsCards = pgTable(
  "marketing_analytics_cards",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    title: text("title").notNull(),
    scopeType: analyticsCardScopeType("scope_type").notNull().default("global"),
    scopeRefs: jsonb("scope_refs").$type<string[]>().default([]), // IDs of channels, products, campaigns, etc.
    metrics: jsonb("metrics").$type<{ key: string; label: string; aggregation: string }[]>().notNull().default([]),
    filters: jsonb("filters").default({}),
    timeRange: jsonb("time_range").$type<{ start?: string; end?: string; preset?: string }>().default({ preset: "last_7_days" }),
    comparisonMode: text("comparison_mode"), // previous_period, same_period_last_year, none
    attributionModel: attributionModel("attribution_model").notNull().default("simple"),
    renderType: analyticsCardRenderType("render_type").notNull().default("kpi"),
    isAiSuggested: boolean("is_ai_suggested").notNull().default(false),
    isPinned: boolean("is_pinned").notNull().default(false),
    layoutOrder: integer("layout_order").notNull().default(0),
    helpCopyId: text("help_copy_id"), // for inline help
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantScope: index("marketing_analytics_cards_tenant_scope_idx").on(t.tenantId, t.scopeType),
    idxTenantPinned: index("marketing_analytics_cards_tenant_pinned_idx").on(t.tenantId, t.isPinned),
  })
);

/**
 * Marketing Channel Metrics - stores fetched metrics from connected platforms
 */
export const marketingChannelMetrics = pgTable(
  "marketing_channel_metrics",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    channelId: uuid("channel_id").notNull().references(() => marketingChannels.id, { onDelete: "cascade" }),
    metricType: text("metric_type").notNull(), // 'followers', 'reach', 'engagement', 'impressions', 'clicks', etc.
    value: numeric("value", { precision: 18, scale: 4 }).notNull(),
    previousValue: numeric("previous_value", { precision: 18, scale: 4 }), // for trend calculation
    periodStart: timestamp("period_start", { withTimezone: true }),
    periodEnd: timestamp("period_end", { withTimezone: true }),
    rawData: jsonb("raw_data").$type<Record<string, unknown>>(), // full API response for AI processing
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantChannel: index("marketing_channel_metrics_tenant_channel_idx").on(t.tenantId, t.channelId),
    idxChannelMetricPeriod: index("marketing_channel_metrics_channel_metric_period_idx").on(t.channelId, t.metricType, t.periodStart),
    uniqChannelMetricPeriod: unique("marketing_channel_metrics_channel_metric_period_uniq").on(t.channelId, t.metricType, t.periodStart),
  })
);

/**
 * Marketing Channel Insights - AI-generated insights for connected channels
 */
export const marketingChannelInsights = pgTable(
  "marketing_channel_insights",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    channelId: uuid("channel_id").notNull().references(() => marketingChannels.id, { onDelete: "cascade" }),
    insightType: text("insight_type").notNull(), // 'summary', 'trend', 'recommendation', 'alert', 'comparison'
    title: text("title"),
    content: text("content").notNull(),
    priority: text("priority").notNull().default("medium"), // 'high', 'medium', 'low'
    metadata: jsonb("metadata").$type<Record<string, unknown>>(), // additional structured data
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }), // when this insight becomes stale
    aiModel: text("ai_model"), // which AI model generated this
    rawContext: jsonb("raw_context").$type<Record<string, unknown>>(), // input data sent to AI
  },
  (t) => ({
    idxTenantChannel: index("marketing_channel_insights_tenant_channel_idx").on(t.tenantId, t.channelId),
    idxChannelType: index("marketing_channel_insights_channel_type_idx").on(t.channelId, t.insightType),
    idxTenantPriority: index("marketing_channel_insights_tenant_priority_idx").on(t.tenantId, t.priority),
  })
);

/**
 * Marketing Objectives - what the business wants to achieve
 */
export const marketingObjectives = pgTable(
  "marketing_objectives",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    objectiveType: marketingObjectiveType("objective_type").notNull(),
    targetValue: numeric("target_value", { precision: 18, scale: 6 }),
    timeHorizon: text("time_horizon"), // e.g., "30_days", "quarter", "year"
    priority: integer("priority").notNull().default(1), // 1 = highest
    productOrServiceRefs: jsonb("product_or_service_refs").$type<string[]>().default([]),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantType: index("marketing_objectives_tenant_type_idx").on(t.tenantId, t.objectiveType),
    idxTenantActive: index("marketing_objectives_tenant_active_idx").on(t.tenantId, t.isActive),
  })
);

/**
 * Marketing Plans - AI-generated or manually created marketing plans
 */
export const marketingPlans = pgTable(
  "marketing_plans",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    name: text("name").notNull(),
    status: marketingPlanStatus("status").notNull().default("draft"),
    // Inputs snapshot - captures what was provided when plan was created
    inputsSnapshot: jsonb("inputs_snapshot").$type<{
      businessContext?: {
        businessType?: string;
        primaryMarketLocation?: string;
        targetAudience?: string;
        seasonalityNotes?: string;
        currentSalesChannels?: string[];
        capacityConstraints?: string;
      };
      productsServices?: Array<{
        itemId?: string;
        type: "product" | "service";
        name: string;
        price?: number;
        marginEstimate?: number;
        inventoryOrCapacity?: number;
        priority?: number;
      }>;
      objectives?: Array<{
        objectiveType: string;
        targetValue?: number;
        timeHorizon?: string;
        priority?: number;
      }>;
      constraints?: {
        totalBudget?: number;
        timeHorizon?: string;
        internalCapacity?: string;
        regulatoryOrCulturalLimits?: string[];
      };
      preferences?: {
        preferredChannels?: string[];
        openToRecommendations?: boolean;
        riskTolerance?: "low" | "medium" | "high";
        speedVsEfficiency?: "speed" | "balanced" | "efficiency";
        simpleModeEnabled?: boolean;
      };
      notes?: string;
    }>().default({}),
    // AI recommendations
    recommendations: jsonb("recommendations").$type<{
      summary: string;
      reasoning: string;
      confidenceLevel: "high" | "medium" | "low";
      missingData?: string[];
    } | null>(),
    // Budget
    budgetTotal: numeric("budget_total", { precision: 18, scale: 6 }),
    budgetAllocations: jsonb("budget_allocations").$type<Array<{
      channelId?: string;
      channelName: string;
      amount: number;
      percentage: number;
      reasoning: string;
    }>>().default([]),
    pacingSchedule: jsonb("pacing_schedule").$type<Array<{
      period: string;
      amount: number;
    }>>().default([]),
    // Channel strategy
    channelPriorities: jsonb("channel_priorities").$type<Array<{
      channelId?: string;
      channelName: string;
      priority: number;
      reasoning: string;
    }>>().default([]),
    excludedChannels: jsonb("excluded_channels").$type<Array<{
      channelName: string;
      reason: string;
    }>>().default([]),
    // Tactics and execution
    tactics: jsonb("tactics").$type<Array<{
      channel: string;
      tactic: string;
      description: string;
      expectedOutcome?: string;
    }>>().default([]),
    messaging: jsonb("messaging").$type<Array<{
      audience: string;
      angle: string;
      examples: string[];
    }>>().default([]),
    toolsAndServices: jsonb("tools_and_services").$type<Array<{
      name: string;
      purpose: string;
      estimatedCost?: number;
    }>>().default([]),
    // Risks and signals
    risksAndAssumptions: jsonb("risks_and_assumptions").$type<Array<{
      type: "risk" | "assumption";
      description: string;
      mitigation?: string;
    }>>().default([]),
    earlyWarningSignals: jsonb("early_warning_signals").$type<Array<{
      signal: string;
      threshold?: string;
      action: string;
    }>>().default([]),
    // Explanations for SME owners
    explanations: jsonb("explanations").$type<{
      whyThisRecommendation?: string;
      expectedOutcome?: string;
      nextBestAction?: string;
    }>().default({}),
    // Linked entities
    linkedCardIds: jsonb("linked_card_ids").$type<string[]>().default([]),
    createdCampaignIds: jsonb("created_campaign_ids").$type<string[]>().default([]),
    // Approval workflow
    approvedByActorId: uuid("approved_by_actor_id").references(() => actors.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    // Audit
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantStatus: index("marketing_plans_tenant_status_idx").on(t.tenantId, t.status),
    idxTenantCreated: index("marketing_plans_tenant_created_idx").on(t.tenantId, t.createdAt),
  })
);

/**
 * Marketing Campaigns - execution containers for marketing activities
 */
export const marketingCampaigns = pgTable(
  "marketing_campaigns",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    name: text("name").notNull(),
    status: marketingCampaignStatus("status").notNull().default("active"),
    // Link to source plan
    planId: uuid("plan_id").references(() => marketingPlans.id),
    // Goals and scope
    goalRefs: jsonb("goal_refs").$type<string[]>().default([]), // objective IDs
    channelRefs: jsonb("channel_refs").$type<string[]>().default([]), // channel IDs
    // Budget and timeline
    budget: numeric("budget", { precision: 18, scale: 6 }),
    spentToDate: numeric("spent_to_date", { precision: 18, scale: 6 }).default("0"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    // Analytics
    analyticsScope: jsonb("analytics_scope").$type<{
      scopeType: string;
      scopeRefs: string[];
      linkedCardIds: string[];
    } | null>(),
    attributionAssumptions: jsonb("attribution_assumptions").$type<{
      model: string;
      notes?: string;
    }>().default({ model: "simple" }),
    // Performance metrics (updated periodically)
    performanceSnapshot: jsonb("performance_snapshot").$type<{
      lastUpdated?: string;
      impressions?: number;
      clicks?: number;
      conversions?: number;
      revenue?: number;
      costPerConversion?: number;
      roas?: number;
    }>().default({}),
    // Audit
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantStatus: index("marketing_campaigns_tenant_status_idx").on(t.tenantId, t.status),
    idxTenantPlan: index("marketing_campaigns_tenant_plan_idx").on(t.tenantId, t.planId),
    idxTenantDates: index("marketing_campaigns_tenant_dates_idx").on(t.tenantId, t.startDate, t.endDate),
  })
);

/**
 * What-If Scenarios - for plan simulation
 */
export const marketingWhatIfScenarios = pgTable(
  "marketing_what_if_scenarios",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    planId: uuid("plan_id").notNull().references(() => marketingPlans.id),
    name: text("name").notNull(),
    scenarioType: whatIfScenarioType("scenario_type").notNull(),
    parameters: jsonb("parameters").$type<{
      budgetChange?: { amount?: number; percentage?: number };
      channelRemove?: { channelId: string };
      channelAdd?: { channelName: string; budget: number };
      pricingChange?: { productId: string; newPrice: number };
      timeHorizonChange?: { newHorizon: string };
    }>().notNull().default({}),
    resultSnapshot: jsonb("result_snapshot").$type<{
      projectedOutcome?: string;
      budgetImpact?: number;
      roiChange?: number;
      recommendedAction?: string;
      reasoning?: string;
    }>().default({}),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantPlan: index("marketing_what_if_scenarios_tenant_plan_idx").on(t.tenantId, t.planId),
  })
);

/**
 * Marketing Manual Data Entries - for channels without connectors
 */
export const marketingManualEntries = pgTable(
  "marketing_manual_entries",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    channelId: uuid("channel_id").references(() => marketingChannels.id),
    campaignId: uuid("campaign_id").references(() => marketingCampaigns.id),
    entryDate: date("entry_date").notNull(),
    // Metrics
    spend: numeric("spend", { precision: 18, scale: 6 }),
    impressions: integer("impressions"),
    clicks: integer("clicks"),
    conversions: integer("conversions"),
    revenue: numeric("revenue", { precision: 18, scale: 6 }),
    leads: integer("leads"),
    // Custom metrics
    customMetrics: jsonb("custom_metrics").$type<Record<string, number>>().default({}),
    notes: text("notes"),
    // Audit
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantChannel: index("marketing_manual_entries_tenant_channel_idx").on(t.tenantId, t.channelId),
    idxTenantCampaign: index("marketing_manual_entries_tenant_campaign_idx").on(t.tenantId, t.campaignId),
    idxTenantDate: index("marketing_manual_entries_tenant_date_idx").on(t.tenantId, t.entryDate),
  })
);

/**
 * Marketing Insights - AI-generated insights and recommendations
 */
export const marketingInsights = pgTable(
  "marketing_insights",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    insightType: text("insight_type").notNull(), // performance_alert, recommendation, trend, anomaly
    title: text("title").notNull(),
    description: text("description").notNull(),
    severity: text("severity").notNull().default("info"), // info, warning, critical
    // Linked entities
    channelId: uuid("channel_id").references(() => marketingChannels.id),
    campaignId: uuid("campaign_id").references(() => marketingCampaigns.id),
    planId: uuid("plan_id").references(() => marketingPlans.id),
    // AI explanation
    reasoning: text("reasoning"),
    suggestedAction: text("suggested_action"),
    // Status
    status: text("status").notNull().default("active"), // active, acknowledged, resolved, dismissed
    acknowledgedByActorId: uuid("acknowledged_by_actor_id").references(() => actors.id),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    // Audit
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => ({
    idxTenantType: index("marketing_insights_tenant_type_idx").on(t.tenantId, t.insightType),
    idxTenantStatus: index("marketing_insights_tenant_status_idx").on(t.tenantId, t.status),
    idxTenantSeverity: index("marketing_insights_tenant_severity_idx").on(t.tenantId, t.severity),
  })
);

/**
 * Marketing Task Type enum
 */
export const marketingTaskType = pgEnum("marketing_task_type", [
  "plan_approval",
  "connector_error",
  "stale_data",
  "campaign_launch",
  "campaign_underperforming",
  "onboarding_incomplete",
  "budget_review",
  "channel_setup",
]);

/**
 * Marketing Task Status enum
 */
export const marketingTaskStatus = pgEnum("marketing_task_status", [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
  "auto_resolved",
]);

/**
 * Marketing Tasks - actionable items for marketing users
 * Assignment rule: MARKETING_USER else SME_OWNER
 * Anti-spam rules:
 * - One task equals one action
 * - Rate-limit repeated alerts
 * - Auto-resolve when fixed
 */
export const marketingTasks = pgTable(
  "marketing_tasks",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    taskType: marketingTaskType("task_type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    status: marketingTaskStatus("status").notNull().default("pending"),

    // Assignment - single owner (MARKETING_USER else SME_OWNER)
    assignedToActorId: uuid("assigned_to_actor_id").references(() => actors.id),
    assignmentRule: text("assignment_rule").notNull().default("auto"), // auto, manual

    // Linked entities (one task = one action)
    planId: uuid("plan_id").references(() => marketingPlans.id),
    campaignId: uuid("campaign_id").references(() => marketingCampaigns.id),
    channelId: uuid("channel_id").references(() => marketingChannels.id),

    // Plain language explanation fields
    whyThis: text("why_this"),
    expectedOutcome: text("expected_outcome"),
    confidenceLevel: text("confidence_level"), // high, medium, low
    missingData: jsonb("missing_data").$type<string[]>().default([]),
    nextAction: text("next_action"),

    // Action URL for direct navigation
    actionUrl: text("action_url"),

    // Priority and timing
    priority: integer("priority").notNull().default(2), // 1 = high, 2 = medium, 3 = low
    dueAt: timestamp("due_at", { withTimezone: true }),

    // Anti-spam: rate limiting
    triggerHash: text("trigger_hash"), // hash of trigger conditions for deduplication
    lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
    triggerCount: integer("trigger_count").notNull().default(1),

    // Resolution
    resolvedByActorId: uuid("resolved_by_actor_id").references(() => actors.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolutionNotes: text("resolution_notes"),
    autoResolved: boolean("auto_resolved").notNull().default(false),

    // Audit
    createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantStatus: index("marketing_tasks_tenant_status_idx").on(t.tenantId, t.status),
    idxTenantAssigned: index("marketing_tasks_tenant_assigned_idx").on(t.tenantId, t.assignedToActorId),
    idxTenantType: index("marketing_tasks_tenant_type_idx").on(t.tenantId, t.taskType),
    idxTriggerHash: index("marketing_tasks_trigger_hash_idx").on(t.tenantId, t.triggerHash),
    idxTenantPriority: index("marketing_tasks_tenant_priority_idx").on(t.tenantId, t.priority, t.status),
  })
);

/**
 * Marketing User Preferences - per-user settings for marketing module
 */
export const marketingUserPreferences = pgTable(
  "marketing_user_preferences",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    actorId: uuid("actor_id").notNull().references(() => actors.id),

    // Mode preferences
    viewMode: text("view_mode").notNull().default("simple"), // simple, advanced
    onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
    onboardingSkippedAt: timestamp("onboarding_skipped_at", { withTimezone: true }),

    // Dismissed tips and tutorials
    dismissedTips: jsonb("dismissed_tips").$type<string[]>().default([]),

    // Channel preferences
    preferredChannels: jsonb("preferred_channels").$type<string[]>().default([]),
    excludedChannels: jsonb("excluded_channels").$type<string[]>().default([]),

    // Dashboard customization
    pinnedCardIds: jsonb("pinned_card_ids").$type<string[]>().default([]),
    hiddenSections: jsonb("hidden_sections").$type<string[]>().default([]),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqTenantActor: uniqueIndex("marketing_user_prefs_tenant_actor_uniq").on(t.tenantId, t.actorId),
  })
);

/* ============================================================================
   UNIFIED ITEMS CATALOG
   One catalog for: Product (stock tracked), Service (fulfillable),
   Consumable/Overhead (expensed), Asset (capitalized)
   ============================================================================ */

export const itemType = pgEnum("item_type", [
  "product",      // Physical, stock tracked
  "service",      // No stock, fulfillable via service jobs
  "consumable",   // No stock, expensed (overhead)
  "asset",        // No stock, capitalized (equipment, vehicles)
]);

export const itemExpiryPolicy = pgEnum("item_expiry_policy", [
  "none",         // No expiry tracking
  "required",     // Expiry date required (food, hazardous)
  "optional",     // Expiry date optional
]);

export const itemAvailability = pgEnum("item_availability", [
  "available",    // Service/Asset is available
  "unavailable",  // Service/Asset is unavailable
]);

/**
 * Unified Items Catalog - single source of truth for all sellable/purchasable things
 * Replaces the need for separate product and service catalogs
 */
export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Common fields
    type: itemType("type").notNull(),
    sku: text("sku"),  // Internal code (optional)
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"), // active, inactive, discontinued

    // Classification
    categoryId: uuid("category_id").references(() => categories.id),
    tags: jsonb("tags").$type<string[]>().default([]),

    // Pricing
    defaultSalesPrice: numeric("default_sales_price", { precision: 18, scale: 6 }),
    defaultPurchaseCost: numeric("default_purchase_cost", { precision: 18, scale: 6 }),
    taxCategoryId: uuid("tax_category_id").references(() => taxCategories.id),

    // Units
    defaultUomId: uuid("default_uom_id").references(() => uoms.id),

    // Product-specific: Inventory tracking
    trackInventory: boolean("track_inventory").notNull().default(false),
    reorderPoint: numeric("reorder_point", { precision: 18, scale: 6 }),
    reorderQuantity: numeric("reorder_quantity", { precision: 18, scale: 6 }),
    preferredVendorPartyId: uuid("preferred_vendor_party_id").references(() => parties.id),

    // Service-specific: Fulfillment
    defaultNotificationChannel: text("default_notification_channel"), // whatsapp, email
    notificationFallbackOrder: jsonb("notification_fallback_order").$type<string[]>().default(["whatsapp", "email"]),
    requiresAcknowledgement: boolean("requires_acknowledgement").notNull().default(true),
    acknowledgementTimeoutHours: integer("acknowledgement_timeout_hours").default(24),
    notifyAllAssignees: boolean("notify_all_assignees").notNull().default(false), // false = primary only

    // Service-specific: Cost estimation (optional)
    estimatedHours: numeric("estimated_hours", { precision: 10, scale: 2 }),
    fixedCost: numeric("fixed_cost", { precision: 18, scale: 6 }),

    // Consumable/Overhead-specific
    expenseCategoryCode: text("expense_category_code"), // Required for consumable type

    // Asset-specific
    assetCategoryCode: text("asset_category_code"),
    depreciationMethod: text("depreciation_method"), // straight_line, declining_balance, none
    usefulLifeMonths: integer("useful_life_months"),

    // Costing
    costingMethod: text("costing_method").default("weighted_average"), // weighted_average, fifo, specific

    // Operations: Stock thresholds (per plan)
    lowStockThresholdPercent: integer("low_stock_threshold_percent").default(20),
    lowStockThresholdOverrideQty: numeric("low_stock_threshold_override_qty", { precision: 18, scale: 6 }),

    // Operations: Expiry tracking (per plan)
    expiryPolicy: itemExpiryPolicy("expiry_policy").default("none"),
    expiryDate: date("expiry_date"),
    batchOrLot: text("batch_or_lot"),

    // Operations: Category flags (per plan - drive expiry behavior)
    hazardFlag: boolean("hazard_flag").notNull().default(false),
    foodFlag: boolean("food_flag").notNull().default(false),
    nonExpiringFlag: boolean("non_expiring_flag").notNull().default(false),

    // Operations: Default warehouse and vendor person
    defaultWarehouseId: uuid("default_warehouse_id").references(() => warehouses.id),
    vendorPersonId: uuid("vendor_person_id"), // references people.id (added after people table)

    // Operations: Service/Asset availability
    availability: itemAvailability("availability"),

    // Operations: Eligible service providers (for service items)
    serviceProviderPersonIds: jsonb("service_provider_person_ids").$type<string[]>().default([]),

    // Metadata
    metadata: jsonb("metadata").notNull().default({}),

    // Audit
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantType: index("items_tenant_type_idx").on(t.tenantId, t.type),
    idxTenantStatus: index("items_tenant_status_idx").on(t.tenantId, t.status),
    idxTenantName: index("items_tenant_name_idx").on(t.tenantId, t.name),
    idxTenantCategory: index("items_tenant_category_idx").on(t.tenantId, t.categoryId),
    idxTenantWarehouse: index("items_tenant_warehouse_idx").on(t.tenantId, t.defaultWarehouseId),
    uniqSku: uniqueIndex("items_tenant_sku_uniq")
      .on(t.tenantId, t.sku)
      .where(sql`sku IS NOT NULL`),
  })
);

/**
 * Item Identifiers - barcodes, supplier codes, external IDs
 */
export const itemIdentifiers = pgTable(
  "item_identifiers",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    itemId: uuid("item_id").notNull().references(() => items.id),
    identifierType: text("identifier_type").notNull(), // barcode, supplier_code, external_id, gtin
    identifierValue: text("identifier_value").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxItem: index("item_identifiers_tenant_item_idx").on(t.tenantId, t.itemId),
    uniqTypeValue: uniqueIndex("item_identifiers_tenant_type_value_uniq").on(
      t.tenantId,
      t.identifierType,
      t.identifierValue
    ),
  })
);

/* ============================================================================
   UNIFIED PEOPLE DIRECTORY
   One directory for: Staff, Contractors, Supplier Contacts, Sales Reps,
   Service Providers, Partner Contacts
   ============================================================================ */

export const personType = pgEnum("person_type", [
  "staff",             // Internal employee
  "contractor",        // External contractor
  "supplier_contact",  // Contact at a supplier/vendor
  "sales_rep",         // Salesperson (internal or external)
  "service_provider",  // Can deliver services
  "partner_contact",   // Contact at a partner organization
  "customer_contact",  // Contact at a customer organization
]);

export const contactChannel = pgEnum("contact_channel", [
  "whatsapp",
  "email",
  "phone",
  "sms",
]);

/**
 * Unified People Directory - single source of truth for all people
 * Used by Sales, Procurement, Operations, and Service fulfillment
 */
export const people = pgTable(
  "people",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Identity
    fullName: text("full_name").notNull(),
    displayName: text("display_name"), // Short name for UI

    // Person types (can have multiple)
    types: jsonb("types").$type<string[]>().notNull().default(["staff"]),

    // Contact information
    primaryEmail: text("primary_email"),
    secondaryEmails: jsonb("secondary_emails").$type<string[]>().default([]),
    primaryPhone: text("primary_phone"),
    secondaryPhones: jsonb("secondary_phones").$type<string[]>().default([]),
    whatsappNumber: text("whatsapp_number"),

    // Communication preferences
    preferredChannel: contactChannel("preferred_channel").default("whatsapp"),
    channelFallbackOrder: jsonb("channel_fallback_order").$type<string[]>().default(["whatsapp", "email", "phone"]),

    // Organization links (optional)
    linkedPartyId: uuid("linked_party_id").references(() => parties.id), // Partner organization
    linkedUserId: uuid("linked_user_id").references(() => users.id),     // Platform user

    // Employment/relationship info
    jobTitle: text("job_title"),
    departmentId: uuid("department_id").references(() => departments.id),

    // Status
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),

    // Operations: Location and consent (per plan)
    location: text("location"),
    consentToNotify: boolean("consent_to_notify").notNull().default(true),

    // Quick-add tracking (for completion prompts)
    isQuickAdd: boolean("is_quick_add").notNull().default(false),
    quickAddCompletedAt: timestamp("quick_add_completed_at", { withTimezone: true }),

    // Metadata
    metadata: jsonb("metadata").notNull().default({}),

    // Audit
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantName: index("people_tenant_name_idx").on(t.tenantId, t.fullName),
    idxTenantEmail: index("people_tenant_email_idx").on(t.tenantId, t.primaryEmail),
    idxTenantPhone: index("people_tenant_phone_idx").on(t.tenantId, t.primaryPhone),
    idxTenantWhatsapp: index("people_tenant_whatsapp_idx").on(t.tenantId, t.whatsappNumber),
    idxTenantParty: index("people_tenant_party_idx").on(t.tenantId, t.linkedPartyId),
    idxTenantUser: index("people_tenant_user_idx").on(t.tenantId, t.linkedUserId),
    idxTenantQuickAdd: index("people_tenant_quick_add_idx").on(t.tenantId, t.isQuickAdd),
  })
);

/**
 * Service Providers - links People to Items they can deliver (for service items)
 */
export const serviceProviders = pgTable(
  "service_providers",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    itemId: uuid("item_id").notNull().references(() => items.id),       // Service item
    personId: uuid("person_id").notNull().references(() => people.id),  // Provider

    // Provider details for this service
    hourlyRate: numeric("hourly_rate", { precision: 18, scale: 6 }),
    fixedRate: numeric("fixed_rate", { precision: 18, scale: 6 }),
    isPreferred: boolean("is_preferred").notNull().default(false),
    notes: text("notes"),

    // Availability
    isActive: boolean("is_active").notNull().default(true),

    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqProvider: uniqueIndex("service_providers_uniq").on(t.tenantId, t.itemId, t.personId),
    idxItem: index("service_providers_tenant_item_idx").on(t.tenantId, t.itemId),
    idxPerson: index("service_providers_tenant_person_idx").on(t.tenantId, t.personId),
  })
);

/* ============================================================================
   SERVICE FULFILLMENT
   When a service item is sold, a Service Job is created
   ============================================================================ */

export const serviceJobStatus = pgEnum("service_job_status", [
  "pending",        // Created, not yet assigned
  "assigned",       // Assigned to provider(s)
  "acknowledged",   // Provider acknowledged assignment
  "in_progress",    // Work has started
  "delivered",      // Service delivered, pending completion
  "completed",      // Fully completed
  "cancelled",      // Job cancelled
]);

/**
 * Service Jobs - created when a service item is sold
 */
export const serviceJobs = pgTable(
  "service_jobs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Link to sale
    salesDocId: uuid("sales_doc_id").references(() => salesDocs.id),
    salesDocLineId: uuid("sales_doc_line_id").references(() => salesDocLines.id),

    // Service item
    itemId: uuid("item_id").notNull().references(() => items.id),

    // Customer
    customerPartyId: uuid("customer_party_id").references(() => parties.id),
    customerContactPersonId: uuid("customer_contact_person_id").references(() => people.id),

    // Job details
    jobNumber: text("job_number").notNull(),
    description: text("description"),
    quantity: numeric("quantity", { precision: 18, scale: 6 }).notNull().default("1"),

    // Status
    status: serviceJobStatus("status").notNull().default("pending"),

    // Scheduling
    scheduledDate: date("scheduled_date"),
    scheduledTime: text("scheduled_time"), // HH:MM format
    dueDate: date("due_date"),

    // Completion
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completionNotes: text("completion_notes"),

    // Escalation tracking
    lastEscalationAt: timestamp("last_escalation_at", { withTimezone: true }),
    escalationCount: integer("escalation_count").notNull().default(0),

    // Metadata
    metadata: jsonb("metadata").notNull().default({}),

    // Audit
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqJobNumber: uniqueIndex("service_jobs_tenant_job_number_uniq").on(t.tenantId, t.jobNumber),
    idxTenantStatus: index("service_jobs_tenant_status_idx").on(t.tenantId, t.status),
    idxTenantItem: index("service_jobs_tenant_item_idx").on(t.tenantId, t.itemId),
    idxTenantSalesDoc: index("service_jobs_tenant_sales_doc_idx").on(t.tenantId, t.salesDocId),
    idxTenantDue: index("service_jobs_tenant_due_idx").on(t.tenantId, t.dueDate),
  })
);

/**
 * Service Job Assignments - who is assigned to deliver the service
 */
export const serviceJobAssignments = pgTable(
  "service_job_assignments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    serviceJobId: uuid("service_job_id").notNull().references(() => serviceJobs.id),
    personId: uuid("person_id").notNull().references(() => people.id),

    // Assignment role
    isPrimary: boolean("is_primary").notNull().default(true),
    role: text("role"), // lead, assistant, specialist, etc.

    // Notification tracking
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    notificationChannel: text("notification_channel"), // whatsapp, email, in_app
    notificationStatus: text("notification_status"), // sent, delivered, failed
    notificationFailureReason: text("notification_failure_reason"),

    // Acknowledgement
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),

    // Status
    isActive: boolean("is_active").notNull().default(true),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removalReason: text("removal_reason"),

    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqAssignment: uniqueIndex("service_job_assignments_uniq").on(t.tenantId, t.serviceJobId, t.personId),
    idxJob: index("service_job_assignments_tenant_job_idx").on(t.tenantId, t.serviceJobId),
    idxPerson: index("service_job_assignments_tenant_person_idx").on(t.tenantId, t.personId),
  })
);

/**
 * Service Job Events - status changes and activity log
 */
export const serviceJobEvents = pgTable(
  "service_job_events",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    serviceJobId: uuid("service_job_id").notNull().references(() => serviceJobs.id),

    eventType: text("event_type").notNull(), // status_changed, assigned, acknowledged, escalated, completed, etc.
    fromStatus: text("from_status"),
    toStatus: text("to_status"),

    // Related entities
    personId: uuid("person_id").references(() => people.id),

    notes: text("notes"),
    metadata: jsonb("metadata").notNull().default({}),

    actorId: uuid("actor_id").notNull().references(() => actors.id),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxJob: index("service_job_events_tenant_job_idx").on(t.tenantId, t.serviceJobId, t.occurredAt),
  })
);

/* ============================================================================
   AI TASKS (Confirmation-Required Suggestions)
   AI may suggest or detect, but these require human confirmation
   ============================================================================ */

export const aiTaskType = pgEnum("ai_task_type", [
  "link_person_to_user",           // Overlap detected between Person and User
  "merge_duplicate_people",        // Duplicate people records detected
  "complete_quick_add",            // Quick-add record needs completion
  "assign_item_to_warehouse",      // Item needs initial warehouse assignment
  "approve_purchase_variance",     // Price variance exceeds threshold
  "low_stock_reorder",             // Suggest reorder for low stock
  "service_job_unassigned",        // Service job needs assignment
  "service_job_overdue",           // Service job past acknowledgement window
  "supplier_delay_impact",         // Supplier delay impacts sales/service jobs
  "review_substitution",           // Supplier substitution needs confirmation
  "landed_cost_allocation",        // Landed costs need allocation
  "complete_performance_review",   // Performance review needs completion
  "document_expiry_alert",         // Document expiring soon
  "verify_document",               // Document needs verification
  "approve_leave_request",         // Leave request pending approval
]);

export const aiTaskStatus = pgEnum("ai_task_status", [
  "pending",       // Awaiting action
  "in_review",     // Being reviewed
  "approved",      // Action confirmed
  "rejected",      // Action declined
  "auto_resolved", // System resolved (e.g., situation changed)
  "expired",       // Task expired without action
]);

/**
 * AI Tasks - suggestions and detections requiring human confirmation
 * Never auto-merge, auto-link, or auto-change without confirmation
 */
export const aiTasks = pgTable(
  "ai_tasks",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    taskType: aiTaskType("task_type").notNull(),
    status: aiTaskStatus("status").notNull().default("pending"),

    // Human-readable
    title: text("title").notNull(),
    description: text("description").notNull(),

    // AI reasoning
    reasoning: text("reasoning"),           // Why this was suggested
    confidenceScore: numeric("confidence_score", { precision: 5, scale: 4 }), // 0.0000 to 1.0000

    // Related entities (type-specific)
    primaryEntityType: text("primary_entity_type"),
    primaryEntityId: uuid("primary_entity_id"),
    secondaryEntityType: text("secondary_entity_type"),
    secondaryEntityId: uuid("secondary_entity_id"),

    // Suggested action details (JSON for flexibility)
    suggestedAction: jsonb("suggested_action").notNull().default({}),

    // Assignment
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id),
    ownerRoleName: text("owner_role_name"), // Fallback role if no user assigned

    // Priority
    priority: text("priority").notNull().default("normal"), // low, normal, high, urgent

    // Timing
    dueAt: timestamp("due_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    // Resolution
    resolvedByActorId: uuid("resolved_by_actor_id").references(() => actors.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolutionAction: text("resolution_action"), // approved, rejected, deferred
    resolutionNotes: text("resolution_notes"),

    // Deduplication
    triggerHash: text("trigger_hash"), // Prevent duplicate tasks for same condition

    // Metadata
    metadata: jsonb("metadata").notNull().default({}),

    // Audit
    createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantStatus: index("ai_tasks_tenant_status_idx").on(t.tenantId, t.status),
    idxTenantType: index("ai_tasks_tenant_type_idx").on(t.tenantId, t.taskType),
    idxTenantAssigned: index("ai_tasks_tenant_assigned_idx").on(t.tenantId, t.assignedToUserId),
    idxTenantPriority: index("ai_tasks_tenant_priority_idx").on(t.tenantId, t.priority, t.status),
    idxTriggerHash: index("ai_tasks_trigger_hash_idx").on(t.tenantId, t.triggerHash),
    idxTenantDue: index("ai_tasks_tenant_due_idx").on(t.tenantId, t.dueAt),
  })
);

/* ============================================================================
   PROCUREMENT ENHANCEMENTS
   Support for landed costs, receiving details, and unified items
   ============================================================================ */

/**
 * Purchase Receipt Details - enhanced receiving with damage/rejection tracking
 */
export const purchaseReceiptDetails = pgTable(
  "purchase_receipt_details",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    purchaseReceiptId: uuid("purchase_receipt_id").notNull().references(() => purchaseReceipts.id),

    // Receiving details
    quantityAccepted: numeric("quantity_accepted", { precision: 18, scale: 6 }).notNull(),
    quantityDamaged: numeric("quantity_damaged", { precision: 18, scale: 6 }).default("0"),
    quantityRejected: numeric("quantity_rejected", { precision: 18, scale: 6 }).default("0"),

    // Rejection reasons
    damageReason: text("damage_reason"),
    rejectionReason: text("rejection_reason"),

    // Substitution (if received item differs from ordered)
    isSubstitution: boolean("is_substitution").notNull().default(false),
    substitutedItemId: uuid("substituted_item_id").references(() => items.id),
    substitutionApproved: boolean("substitution_approved"),
    substitutionApprovedByActorId: uuid("substitution_approved_by_actor_id").references(() => actors.id),

    // Backorder tracking
    backorderQuantity: numeric("backorder_quantity", { precision: 18, scale: 6 }).default("0"),
    expectedBackorderDate: date("expected_backorder_date"),

    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxReceipt: index("purchase_receipt_details_tenant_receipt_idx").on(t.tenantId, t.purchaseReceiptId),
  })
);

/**
 * Landed Costs - shipping, customs, handling costs to allocate to items
 */
export const landedCosts = pgTable(
  "landed_costs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    purchaseDocId: uuid("purchase_doc_id").notNull().references(() => purchaseDocs.id),

    costType: text("cost_type").notNull(), // shipping, customs, handling, insurance, duty, other
    description: text("description"),
    amount: numeric("amount", { precision: 18, scale: 6 }).notNull(),
    currency: text("currency").notNull().default("USD"),
    exchangeRate: numeric("exchange_rate", { precision: 18, scale: 10 }).default("1"),

    // Allocation method
    allocationMethod: text("allocation_method").notNull().default("by_value"), // by_value, by_quantity, by_weight, manual
    isAllocated: boolean("is_allocated").notNull().default(false),
    allocatedAt: timestamp("allocated_at", { withTimezone: true }),

    // Reference document
    vendorPartyId: uuid("vendor_party_id").references(() => parties.id), // Shipping vendor, customs agent, etc.
    referenceNumber: text("reference_number"),

    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxDoc: index("landed_costs_tenant_doc_idx").on(t.tenantId, t.purchaseDocId),
  })
);

/**
 * Landed Cost Allocations - how landed costs are distributed to items
 */
export const landedCostAllocations = pgTable(
  "landed_cost_allocations",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    landedCostId: uuid("landed_cost_id").notNull().references(() => landedCosts.id),
    purchaseDocLineId: uuid("purchase_doc_line_id").notNull().references(() => purchaseDocLines.id),

    allocatedAmount: numeric("allocated_amount", { precision: 18, scale: 6 }).notNull(),
    allocationPercentage: numeric("allocation_percentage", { precision: 10, scale: 6 }),

    // Per-unit impact
    unitCostImpact: numeric("unit_cost_impact", { precision: 18, scale: 6 }),

    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqAllocation: uniqueIndex("landed_cost_allocations_uniq").on(t.tenantId, t.landedCostId, t.purchaseDocLineId),
    idxCost: index("landed_cost_allocations_tenant_cost_idx").on(t.tenantId, t.landedCostId),
    idxLine: index("landed_cost_allocations_tenant_line_idx").on(t.tenantId, t.purchaseDocLineId),
  })
);

/**
 * Inventory Adjustments - manual adjustments with audit trail
 */
export const inventoryAdjustments = pgTable(
  "inventory_adjustments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    movementId: uuid("movement_id").notNull().references(() => inventoryMovements.id),

    adjustmentType: text("adjustment_type").notNull(), // shrinkage, expiry, wastage, correction, count_variance, damage
    reason: text("reason").notNull(),

    // Approval (if required)
    requiresApproval: boolean("requires_approval").notNull().default(false),
    approvedByActorId: uuid("approved_by_actor_id").references(() => actors.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),

    // Evidence
    documentId: uuid("document_id").references(() => documents.id),

    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxMovement: index("inventory_adjustments_tenant_movement_idx").on(t.tenantId, t.movementId),
    idxType: index("inventory_adjustments_tenant_type_idx").on(t.tenantId, t.adjustmentType),
  })
);

/* ============================================================================
   OPERATIONS: ADDITIONAL TABLES PER REMODEL PLAN
   ============================================================================ */

// Domain enum for tasks and alerts
export const opsDomain = pgEnum("ops_domain", [
  "operations",
  "sales",
  "finance",
  "hr",
  "marketing",
]);

/**
 * Inventory Transfers - move stock between warehouses
 * Per plan: InventoryTransfer entity
 */
export const inventoryTransfers = pgTable(
  "inventory_transfers",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // What and how much
    itemId: uuid("item_id").notNull().references(() => items.id),
    quantity: numeric("quantity", { precision: 18, scale: 6 }).notNull(),

    // From/To warehouses
    fromWarehouseId: uuid("from_warehouse_id").notNull().references(() => warehouses.id),
    toWarehouseId: uuid("to_warehouse_id").notNull().references(() => warehouses.id),

    // When
    transferDate: date("transfer_date").notNull(),

    // Notes
    notes: text("notes"),

    // Link to inventory movement (for posting)
    movementId: uuid("movement_id").references(() => inventoryMovements.id),

    // Audit
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantItem: index("inventory_transfers_tenant_item_idx").on(t.tenantId, t.itemId),
    idxTenantFromWarehouse: index("inventory_transfers_tenant_from_wh_idx").on(t.tenantId, t.fromWarehouseId),
    idxTenantToWarehouse: index("inventory_transfers_tenant_to_wh_idx").on(t.tenantId, t.toWarehouseId),
    idxTenantDate: index("inventory_transfers_tenant_date_idx").on(t.tenantId, t.transferDate),
  })
);

// Return type enum
export const returnType = pgEnum("return_type", [
  "customer_return",   // Customer returns item (adds to stock)
  "supplier_return",   // Return to supplier (reduces stock)
]);

/**
 * Returns - customer returns (add stock) or supplier returns (reduce stock)
 * Per plan: Return entity
 */
export const returns = pgTable(
  "returns",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Return type
    type: returnType("type").notNull(),

    // What and how much
    itemId: uuid("item_id").notNull().references(() => items.id),
    quantity: numeric("quantity", { precision: 18, scale: 6 }).notNull(),

    // Where
    warehouseId: uuid("warehouse_id").references(() => warehouses.id),

    // When
    returnDate: date("return_date").notNull(),

    // Why
    reason: text("reason"),

    // Links (optional)
    linkedSaleDocId: uuid("linked_sale_doc_id").references(() => salesDocs.id),
    linkedPurchaseDocId: uuid("linked_purchase_doc_id").references(() => purchaseDocs.id),

    // Link to inventory movement (for posting)
    movementId: uuid("movement_id").references(() => inventoryMovements.id),

    // Audit
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantType: index("returns_tenant_type_idx").on(t.tenantId, t.type),
    idxTenantItem: index("returns_tenant_item_idx").on(t.tenantId, t.itemId),
    idxTenantDate: index("returns_tenant_date_idx").on(t.tenantId, t.returnDate),
    idxTenantSale: index("returns_tenant_sale_idx").on(t.tenantId, t.linkedSaleDocId),
    idxTenantPurchase: index("returns_tenant_purchase_idx").on(t.tenantId, t.linkedPurchaseDocId),
  })
);

// Evidence state enum for operations payments
export const evidenceState = pgEnum("evidence_state", [
  "evidence_ok",       // Attachment provided and valid
  "pending_evidence",  // Missing required attachment
]);

// Operations payment status
export const opsPaymentStatus = pgEnum("ops_payment_status", [
  "paid",
  "unpaid",
]);

// Operations payment method
export const opsPaymentMethod = pgEnum("ops_payment_method", [
  "cash",
  "bank",
]);

/**
 * Operations Payments - simplified payment records for Operations domain
 * Per plan: Payment entity with evidence_state enforcement
 *
 * This is separate from the finance payments table as Operations payments
 * may not always post to the ledger and have different workflow requirements.
 */
export const opsPayments = pgTable(
  "ops_payments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Who
    payeePersonId: uuid("payee_person_id").references(() => people.id),

    // Link to purchase (optional)
    linkedPurchaseDocId: uuid("linked_purchase_doc_id").references(() => purchaseDocs.id),

    // When
    paymentDate: date("payment_date").notNull(),

    // How much
    amount: numeric("amount", { precision: 18, scale: 6 }).notNull(),
    currency: text("currency"),

    // Payment details
    status: opsPaymentStatus("status").notNull().default("unpaid"),
    method: opsPaymentMethod("method"),
    bankAccountId: uuid("bank_account_id").references(() => accounts.id),

    // Domain
    domain: opsDomain("domain").notNull().default("operations"),

    // Notes
    notes: text("notes"),

    // Evidence enforcement (per plan)
    evidenceState: evidenceState("evidence_state").notNull().default("pending_evidence"),

    // Link to finance payment (if posted)
    financePaymentId: uuid("finance_payment_id").references(() => payments.id),

    // Audit
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantStatus: index("ops_payments_tenant_status_idx").on(t.tenantId, t.status),
    idxTenantPayee: index("ops_payments_tenant_payee_idx").on(t.tenantId, t.payeePersonId),
    idxTenantDate: index("ops_payments_tenant_date_idx").on(t.tenantId, t.paymentDate),
    idxTenantEvidence: index("ops_payments_tenant_evidence_idx").on(t.tenantId, t.evidenceState),
    idxTenantPurchase: index("ops_payments_tenant_purchase_idx").on(t.tenantId, t.linkedPurchaseDocId),
  })
);

/**
 * Operations Payment Attachments - link documents to ops payments
 * Uses existing documents table via document_links
 */

/* =============================================================================
   PAYROLL & COMPLIANCE SYSTEM
   ============================================================================= */

/* Enums for Payroll */
export const jurisdictionType = pgEnum("jurisdiction_type", ["country", "state", "province", "territory", "local"]);
export const employmentStatus = pgEnum("employment_status", ["active", "on_leave", "suspended", "terminated", "retired"]);
export const employmentType = pgEnum("employment_type", ["full_time", "part_time", "contractor", "temp", "intern"]);
export const flsaStatus = pgEnum("flsa_status", ["exempt", "non_exempt"]);
export const payType = pgEnum("pay_type", ["salary", "hourly", "commission"]);
export const payFrequency = pgEnum("pay_frequency", ["weekly", "biweekly", "semimonthly", "monthly"]);
export const compensationChangeReason = pgEnum("compensation_change_reason", ["hire", "promotion", "annual_review", "adjustment", "demotion", "transfer"]);
export const deductionCalcMethod = pgEnum("deduction_calc_method", ["fixed", "percent_gross", "percent_net"]);
export const payrollRunStatus = pgEnum("payroll_run_status", ["draft", "calculating", "calculated", "reviewing", "approved", "posting", "posted", "paid", "void"]);
export const payrollRunType = pgEnum("payroll_run_type", ["regular", "bonus", "correction", "final"]);
export const taxCalcMethod = pgEnum("tax_calc_method", ["bracket", "flat_rate", "wage_base", "formula"]);
export const filingFrequency = pgEnum("filing_frequency", ["monthly", "quarterly", "annual"]);
export const taxFilingStatus = pgEnum("tax_filing_status", ["pending", "in_progress", "submitted", "accepted", "rejected", "amended"]);
export const taxDepositStatus = pgEnum("tax_deposit_status", ["pending", "submitted", "confirmed", "rejected"]);
export const bankAccountTypeEnum = pgEnum("bank_account_type", ["checking", "savings"]);
export const depositType = pgEnum("deposit_type", ["percent", "fixed", "remainder"]);
export const taxRegistrationStatus = pgEnum("tax_registration_status", ["pending", "active", "suspended", "closed"]);

/* Jurisdictions (countries, states, localities) */
export const jurisdictions = pgTable("jurisdictions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  countryCode: text("country_code").notNull(),
  subdivisionCode: text("subdivision_code"),
  jurisdictionType: jurisdictionType("jurisdiction_type").notNull(),
  parentJurisdictionId: uuid("parent_jurisdiction_id").references((): AnyPgColumn => jurisdictions.id),
  currencyCode: text("currency_code").notNull().default("USD"),
  timezone: text("timezone"),
  isActive: boolean("is_active").notNull().default(true),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxCountry: index("idx_jurisdictions_country").on(t.countryCode),
  idxParent: index("idx_jurisdictions_parent").on(t.parentJurisdictionId),
}));

/* Compliance rule sets per jurisdiction */
export const complianceRuleSets = pgTable("compliance_rule_sets", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  jurisdictionId: uuid("jurisdiction_id").notNull().references(() => jurisdictions.id),
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to"),
  version: text("version").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  minPayFrequency: payFrequency("min_pay_frequency"),
  maxDaysToPay: integer("max_days_to_pay"),
  overtimeThresholdDaily: numeric("overtime_threshold_daily", { precision: 4, scale: 2 }),
  overtimeThresholdWeekly: numeric("overtime_threshold_weekly", { precision: 5, scale: 2 }),
  overtimeMultiplier: numeric("overtime_multiplier", { precision: 3, scale: 2 }).default("1.50"),
  doubleTimeThreshold: numeric("double_time_threshold", { precision: 4, scale: 2 }),
  doubleTimeMultiplier: numeric("double_time_multiplier", { precision: 3, scale: 2 }).default("2.00"),
  minimumWageHourly: numeric("minimum_wage_hourly", { precision: 10, scale: 4 }),
  minimumWageSalaryAnnual: numeric("minimum_wage_salary_annual", { precision: 12, scale: 2 }),
  minimumWageExemptThreshold: numeric("minimum_wage_exempt_threshold", { precision: 12, scale: 2 }),
  minAnnualLeaveDays: integer("min_annual_leave_days"),
  minSickLeaveDays: integer("min_sick_leave_days"),
  parentalLeaveWeeks: integer("parental_leave_weeks"),
  recordRetentionYears: integer("record_retention_years").default(7),
  filingFrequency: filingFrequency("filing_frequency"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxJurisdiction: index("idx_compliance_rules_jurisdiction").on(t.jurisdictionId),
  uniqJurisdictionEffective: uniqueIndex("compliance_rule_sets_jurisdiction_effective_uniq").on(t.jurisdictionId, t.effectiveFrom),
}));

/* Tax tables (federal, state, local taxes) */
export const taxTables = pgTable("tax_tables", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  jurisdictionId: uuid("jurisdiction_id").notNull().references(() => jurisdictions.id),
  taxType: text("tax_type").notNull(),
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to"),
  version: text("version").notNull(),
  name: text("name").notNull(),
  calculationMethod: taxCalcMethod("calculation_method").notNull(),
  flatRate: numeric("flat_rate", { precision: 8, scale: 6 }),
  wageBaseLimit: numeric("wage_base_limit", { precision: 12, scale: 2 }),
  employerRate: numeric("employer_rate", { precision: 8, scale: 6 }),
  employerWageBase: numeric("employer_wage_base", { precision: 12, scale: 2 }),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxJurisdiction: index("idx_tax_tables_jurisdiction").on(t.jurisdictionId),
  idxType: index("idx_tax_tables_type").on(t.taxType),
  uniqJurisdictionTypeEffective: uniqueIndex("tax_tables_jurisdiction_type_effective_uniq").on(t.jurisdictionId, t.taxType, t.effectiveFrom),
}));

/* Tax brackets for progressive taxes */
export const taxBrackets = pgTable("tax_brackets", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  taxTableId: uuid("tax_table_id").notNull().references(() => taxTables.id, { onDelete: "cascade" }),
  filingStatus: text("filing_status").notNull(),
  bracketOrder: integer("bracket_order").notNull(),
  minAmount: numeric("min_amount", { precision: 12, scale: 2 }).notNull(),
  maxAmount: numeric("max_amount", { precision: 12, scale: 2 }),
  rate: numeric("rate", { precision: 8, scale: 6 }).notNull(),
  baseTax: numeric("base_tax", { precision: 12, scale: 2 }).notNull().default("0"),
}, (t) => ({
  idxTaxTable: index("idx_tax_brackets_table").on(t.taxTableId),
  uniqBracket: uniqueIndex("tax_brackets_table_status_order_uniq").on(t.taxTableId, t.filingStatus, t.bracketOrder),
}));

/* Standard deduction types */
export const deductionTypes = pgTable("deduction_types", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  jurisdictionId: uuid("jurisdiction_id").references(() => jurisdictions.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  isPretaxFederal: boolean("is_pretax_federal").default(false),
  isPretaxState: boolean("is_pretax_state").default(false),
  isPretaxFica: boolean("is_pretax_fica").default(false),
  annualLimitEmployee: numeric("annual_limit_employee", { precision: 12, scale: 2 }),
  annualLimitEmployer: numeric("annual_limit_employer", { precision: 12, scale: 2 }),
  catchUpAge: integer("catch_up_age"),
  catchUpLimit: numeric("catch_up_limit", { precision: 12, scale: 2 }),
  defaultCalcMethod: deductionCalcMethod("default_calc_method"),
  isActive: boolean("is_active").notNull().default(true),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxCode: index("idx_deduction_types_code").on(t.code),
}));

/* Standard earning types */
export const earningTypes = pgTable("earning_types", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  jurisdictionId: uuid("jurisdiction_id").references(() => jurisdictions.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  isTaxableFederal: boolean("is_taxable_federal").default(true),
  isTaxableState: boolean("is_taxable_state").default(true),
  isTaxableFica: boolean("is_taxable_fica").default(true),
  multiplier: numeric("multiplier", { precision: 4, scale: 2 }).default("1.00"),
  defaultExpenseAccountCode: text("default_expense_account_code"),
  isActive: boolean("is_active").notNull().default(true),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxCode: index("idx_earning_types_code").on(t.code),
}));

/* Tenant compliance profile (AI-generated during setup) */
export const tenantComplianceProfiles = pgTable("tenant_compliance_profiles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id).unique(),
  legalName: text("legal_name").notNull(),
  registrationNumber: text("registration_number"),
  federalTaxId: text("federal_tax_id"),
  stateTaxId: text("state_tax_id"),
  localTaxId: text("local_tax_id"),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  stateProvince: text("state_province"),
  postalCode: text("postal_code"),
  countryCode: text("country_code").notNull(),
  primaryJurisdictionId: uuid("primary_jurisdiction_id").notNull().references(() => jurisdictions.id),
  stateJurisdictionId: uuid("state_jurisdiction_id").references(() => jurisdictions.id),
  localJurisdictionId: uuid("local_jurisdiction_id").references(() => jurisdictions.id),
  entityType: text("entity_type"),
  industryCode: text("industry_code"),
  employeeCountTier: text("employee_count_tier"),
  complianceSummary: jsonb("compliance_summary").notNull().default({}),
  aiGeneratedAt: timestamp("ai_generated_at", { withTimezone: true }),
  aiModelVersion: text("ai_model_version"),
  lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
  reviewedByActorId: uuid("reviewed_by_actor_id").references(() => actors.id),
  createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxTenant: index("idx_tenant_compliance_tenant").on(t.tenantId),
}));

/* Tenant tax registrations per jurisdiction */
export const tenantTaxRegistrations = pgTable("tenant_tax_registrations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  jurisdictionId: uuid("jurisdiction_id").notNull().references(() => jurisdictions.id),
  taxType: text("tax_type").notNull(),
  registrationNumber: text("registration_number"),
  registrationDate: date("registration_date"),
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to"),
  employerRateOverride: numeric("employer_rate_override", { precision: 8, scale: 6 }),
  status: taxRegistrationStatus("status").notNull().default("pending"),
  metadata: jsonb("metadata").default({}),
  createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxTenant: index("idx_tenant_tax_reg_tenant").on(t.tenantId),
  uniqTenantJurisdictionType: uniqueIndex("tenant_tax_reg_tenant_jurisdiction_type_uniq").on(t.tenantId, t.jurisdictionId, t.taxType),
}));

/* Tenant deduction configurations */
export const tenantDeductionConfigs = pgTable("tenant_deduction_configs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  deductionTypeId: uuid("deduction_type_id").notNull().references(() => deductionTypes.id),
  isEnabled: boolean("is_enabled").notNull().default(true),
  employerMatchRate: numeric("employer_match_rate", { precision: 6, scale: 4 }),
  employerMatchLimit: numeric("employer_match_limit", { precision: 12, scale: 2 }),
  liabilityAccountId: uuid("liability_account_id").references(() => accounts.id),
  expenseAccountId: uuid("expense_account_id").references(() => accounts.id),
  metadata: jsonb("metadata").default({}),
  createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqTenantDeductionType: uniqueIndex("tenant_deduction_config_tenant_type_uniq").on(t.tenantId, t.deductionTypeId),
}));

/* Employees (extends people table) */
export const employees = pgTable("employees", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  personId: uuid("person_id").notNull().references(() => people.id),
  employeeNumber: text("employee_number").notNull(),
  hireDate: date("hire_date").notNull(),
  terminationDate: date("termination_date"),
  employmentStatus: employmentStatus("employment_status").notNull().default("active"),
  employmentType: employmentType("employment_type").notNull(),
  flsaStatus: flsaStatus("flsa_status").notNull().default("non_exempt"),
  workerCompClass: text("worker_comp_class"),
  workJurisdictionId: uuid("work_jurisdiction_id").references(() => jurisdictions.id),
  workLocation: text("work_location"),
  isRemote: boolean("is_remote").default(false),
  federalFilingStatus: text("federal_filing_status").default("single"),
  stateFilingStatus: text("state_filing_status"),
  federalAllowances: integer("federal_allowances").default(0),
  stateAllowances: integer("state_allowances").default(0),
  additionalFederalWithholding: numeric("additional_federal_withholding", { precision: 10, scale: 2 }).default("0"),
  additionalStateWithholding: numeric("additional_state_withholding", { precision: 10, scale: 2 }).default("0"),
  isExemptFromFederal: boolean("is_exempt_from_federal").default(false),
  isExemptFromState: boolean("is_exempt_from_state").default(false),
  isExemptFromFica: boolean("is_exempt_from_fica").default(false),
  w4Step2Checkbox: boolean("w4_step2_checkbox").default(false),
  w4DependentsAmount: numeric("w4_dependents_amount", { precision: 10, scale: 2 }).default("0"),
  w4OtherIncome: numeric("w4_other_income", { precision: 10, scale: 2 }).default("0"),
  w4Deductions: numeric("w4_deductions", { precision: 10, scale: 2 }).default("0"),
  paymentMethod: text("payment_method").default("check"),
  managerEmployeeId: uuid("manager_employee_id").references((): AnyPgColumn => employees.id),
  createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxTenant: index("idx_employees_tenant").on(t.tenantId),
  idxPerson: index("idx_employees_person").on(t.personId),
  idxStatus: index("idx_employees_status").on(t.tenantId, t.employmentStatus),
  uniqTenantEmployeeNumber: uniqueIndex("employees_tenant_employee_number_uniq").on(t.tenantId, t.employeeNumber),
  uniqTenantPerson: uniqueIndex("employees_tenant_person_uniq").on(t.tenantId, t.personId),
}));

/* Employee bank accounts for direct deposit */
export const employeeBankAccounts = pgTable("employee_bank_accounts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  employeeId: uuid("employee_id").notNull().references(() => employees.id),
  accountType: bankAccountTypeEnum("account_type").notNull(),
  routingNumber: text("routing_number").notNull(),
  accountNumberEncrypted: text("account_number_encrypted").notNull(),
  accountNumberLast4: text("account_number_last4").notNull(),
  bankName: text("bank_name"),
  depositType: depositType("deposit_type").notNull(),
  depositAmount: numeric("deposit_amount", { precision: 10, scale: 2 }),
  priority: integer("priority").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  isPrenoteSent: boolean("is_prenote_sent").default(false),
  prenoteDate: date("prenote_date"),
  createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxEmployee: index("idx_employee_bank_accounts").on(t.employeeId),
}));

/* Compensation records (effective-dated) */
export const compensationRecords = pgTable("compensation_records", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  employeeId: uuid("employee_id").notNull().references(() => employees.id),
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to"),
  payType: payType("pay_type").notNull(),
  payRate: numeric("pay_rate", { precision: 12, scale: 4 }).notNull(),
  payFrequency: payFrequency("pay_frequency").notNull(),
  commissionRate: numeric("commission_rate", { precision: 6, scale: 4 }),
  commissionBasis: text("commission_basis"),
  standardHoursPerWeek: numeric("standard_hours_per_week", { precision: 5, scale: 2 }).default("40.00"),
  changeReason: compensationChangeReason("change_reason"),
  changeNotes: text("change_notes"),
  approvedByActorId: uuid("approved_by_actor_id").references(() => actors.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxEmployee: index("idx_compensation_employee").on(t.employeeId),
  idxEffective: index("idx_compensation_effective").on(t.effectiveFrom, t.effectiveTo),
}));

/* Employee deductions */
export const employeeDeductions = pgTable("employee_deductions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  employeeId: uuid("employee_id").notNull().references(() => employees.id),
  deductionTypeId: uuid("deduction_type_id").notNull().references(() => deductionTypes.id),
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to"),
  calcMethod: deductionCalcMethod("calc_method").notNull(),
  amount: numeric("amount", { precision: 10, scale: 4 }).notNull(),
  perPeriodLimit: numeric("per_period_limit", { precision: 10, scale: 2 }),
  annualLimit: numeric("annual_limit", { precision: 12, scale: 2 }),
  ytdAmount: numeric("ytd_amount", { precision: 12, scale: 2 }).default("0"),
  caseNumber: text("case_number"),
  garnishmentType: text("garnishment_type"),
  garnishmentPriority: integer("garnishment_priority"),
  isActive: boolean("is_active").notNull().default(true),
  createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxEmployee: index("idx_employee_deductions").on(t.employeeId),
}));

/* Employee leave balances */
export const employeeLeaveBalances = pgTable("employee_leave_balances", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  employeeId: uuid("employee_id").notNull().references(() => employees.id),
  leaveType: text("leave_type").notNull(),
  accrualRate: numeric("accrual_rate", { precision: 8, scale: 4 }),
  accrualFrequency: text("accrual_frequency"),
  accrualCap: numeric("accrual_cap", { precision: 8, scale: 2 }),
  balanceHours: numeric("balance_hours", { precision: 8, scale: 2 }).notNull().default("0"),
  usedYtd: numeric("used_ytd", { precision: 8, scale: 2 }).notNull().default("0"),
  accruedYtd: numeric("accrued_ytd", { precision: 8, scale: 2 }).notNull().default("0"),
  carryoverLimit: numeric("carryover_limit", { precision: 8, scale: 2 }),
  carryoverExpiryDate: date("carryover_expiry_date"),
  asOfDate: date("as_of_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqEmployeeLeaveType: uniqueIndex("employee_leave_balances_employee_type_uniq").on(t.tenantId, t.employeeId, t.leaveType),
}));

/* =============================================================================
   LEAVE MANAGEMENT
   ============================================================================= */

export const leaveAccrualType = pgEnum("leave_accrual_type", [
  "manual",     // Manually adjusted
  "monthly",    // Accrues monthly
  "annual",     // Granted annually
  "per_period", // Accrues per pay period
]);

export const leaveRequestStatus = pgEnum("leave_request_status", [
  "pending",    // Awaiting approval
  "approved",   // Approved by manager
  "rejected",   // Rejected by manager
  "cancelled",  // Cancelled by employee
  "taken",      // Leave completed
]);

/* Leave Types (vacation, sick, personal, etc.) */
export const leaveTypes = pgTable("leave_types", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  code: text("code").notNull(),
  description: text("description"),
  accrualType: leaveAccrualType("accrual_type").notNull().default("manual"),
  defaultAnnualAllowance: numeric("default_annual_allowance", { precision: 6, scale: 2 }),
  maxCarryoverDays: numeric("max_carryover_days", { precision: 6, scale: 2 }),
  requiresApproval: boolean("requires_approval").notNull().default(true),
  isPaid: boolean("is_paid").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqTenantCode: uniqueIndex("leave_types_tenant_code_uniq").on(t.tenantId, t.code),
  idxActive: index("idx_leave_types_active").on(t.tenantId, t.isActive),
}));

/* Leave Requests */
export const leaveRequests = pgTable("leave_requests", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  employeeId: uuid("employee_id").notNull().references(() => employees.id),
  leaveTypeId: uuid("leave_type_id").notNull().references(() => leaveTypes.id),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  daysRequested: numeric("days_requested", { precision: 5, scale: 2 }).notNull(),
  halfDayStart: boolean("half_day_start").default(false),
  halfDayEnd: boolean("half_day_end").default(false),
  reason: text("reason"),
  status: leaveRequestStatus("status").notNull().default("pending"),
  approvedByUserId: uuid("approved_by_user_id").references(() => users.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  affectsPayroll: boolean("affects_payroll").default(true),
  notes: text("notes"),
  createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxEmployee: index("idx_leave_requests_employee").on(t.employeeId),
  idxStatus: index("idx_leave_requests_status").on(t.tenantId, t.status),
  idxDates: index("idx_leave_requests_dates").on(t.startDate, t.endDate),
}));

/* Leave Balance Adjustments (manual adjustments) */
export const leaveBalanceAdjustments = pgTable("leave_balance_adjustments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  employeeId: uuid("employee_id").notNull().references(() => employees.id),
  leaveTypeId: uuid("leave_type_id").notNull().references(() => leaveTypes.id),
  adjustmentDate: date("adjustment_date").notNull(),
  daysAdjusted: numeric("days_adjusted", { precision: 6, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  adjustedByActorId: uuid("adjusted_by_actor_id").references(() => actors.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxEmployee: index("idx_leave_adjustments_employee").on(t.employeeId),
  idxType: index("idx_leave_adjustments_type").on(t.leaveTypeId),
}));

/* Pay schedules */
export const paySchedules = pgTable("pay_schedules", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  frequency: payFrequency("frequency").notNull(),
  anchorDate: date("anchor_date"),
  firstPayDay: integer("first_pay_day"),
  secondPayDay: integer("second_pay_day"),
  payDayOfMonth: integer("pay_day_of_month"),
  daysBeforePayToProcess: integer("days_before_pay_to_process").default(3),
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqTenantName: uniqueIndex("pay_schedules_tenant_name_uniq").on(t.tenantId, t.name),
}));

/* Pay periods */
export const payPeriods = pgTable("pay_periods", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  payScheduleId: uuid("pay_schedule_id").notNull().references(() => paySchedules.id),
  periodNumber: integer("period_number").notNull(),
  year: integer("year").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  payDate: date("pay_date").notNull(),
  timesheetCutoff: date("timesheet_cutoff"),
  processingDate: date("processing_date"),
  status: text("status").notNull().default("upcoming"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxSchedule: index("idx_pay_periods_schedule").on(t.payScheduleId),
  idxDates: index("idx_pay_periods_dates").on(t.startDate, t.endDate),
  uniqScheduleYearPeriod: uniqueIndex("pay_periods_schedule_year_period_uniq").on(t.tenantId, t.payScheduleId, t.year, t.periodNumber),
}));

/* Payroll runs */
export const payrollRuns = pgTable("payroll_runs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  payPeriodId: uuid("pay_period_id").notNull().references(() => payPeriods.id),
  runNumber: integer("run_number").notNull().default(1),
  runType: payrollRunType("run_type").notNull().default("regular"),
  status: payrollRunStatus("status").notNull().default("draft"),
  totalGrossPay: numeric("total_gross_pay", { precision: 14, scale: 2 }),
  totalEmployeeTaxes: numeric("total_employee_taxes", { precision: 14, scale: 2 }),
  totalEmployeeDeductions: numeric("total_employee_deductions", { precision: 14, scale: 2 }),
  totalNetPay: numeric("total_net_pay", { precision: 14, scale: 2 }),
  totalEmployerTaxes: numeric("total_employer_taxes", { precision: 14, scale: 2 }),
  totalEmployerContributions: numeric("total_employer_contributions", { precision: 14, scale: 2 }),
  employeeCount: integer("employee_count"),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }),
  calculatedByActorId: uuid("calculated_by_actor_id").references(() => actors.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedByActorId: uuid("approved_by_actor_id").references(() => actors.id),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  postedByActorId: uuid("posted_by_actor_id").references(() => actors.id),
  journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  voidedByActorId: uuid("voided_by_actor_id").references(() => actors.id),
  voidReason: text("void_reason"),
  notes: text("notes"),
  createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxTenant: index("idx_payroll_runs_tenant").on(t.tenantId),
  idxPeriod: index("idx_payroll_runs_period").on(t.payPeriodId),
  idxStatus: index("idx_payroll_runs_status").on(t.status),
}));

/* Payroll run employees (individual employee payroll) */
export const payrollRunEmployees = pgTable("payroll_run_employees", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  payrollRunId: uuid("payroll_run_id").notNull().references(() => payrollRuns.id, { onDelete: "cascade" }),
  employeeId: uuid("employee_id").notNull().references(() => employees.id),
  payType: payType("pay_type").notNull(),
  payRate: numeric("pay_rate", { precision: 12, scale: 4 }).notNull(),
  grossPay: numeric("gross_pay", { precision: 12, scale: 2 }).notNull().default("0"),
  totalTaxes: numeric("total_taxes", { precision: 12, scale: 2 }).notNull().default("0"),
  totalDeductions: numeric("total_deductions", { precision: 12, scale: 2 }).notNull().default("0"),
  netPay: numeric("net_pay", { precision: 12, scale: 2 }).notNull().default("0"),
  employerTaxes: numeric("employer_taxes", { precision: 12, scale: 2 }).notNull().default("0"),
  employerContributions: numeric("employer_contributions", { precision: 12, scale: 2 }).notNull().default("0"),
  totalEmployerCost: numeric("total_employer_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  ytdGross: numeric("ytd_gross", { precision: 14, scale: 2 }).notNull().default("0"),
  ytdFederalTax: numeric("ytd_federal_tax", { precision: 14, scale: 2 }).notNull().default("0"),
  ytdStateTax: numeric("ytd_state_tax", { precision: 14, scale: 2 }).notNull().default("0"),
  ytdSocialSecurity: numeric("ytd_social_security", { precision: 14, scale: 2 }).notNull().default("0"),
  ytdMedicare: numeric("ytd_medicare", { precision: 14, scale: 2 }).notNull().default("0"),
  paymentMethod: text("payment_method"),
  checkNumber: text("check_number"),
  checkDate: date("check_date"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxPayrollRun: index("idx_payroll_run_employees").on(t.payrollRunId),
  idxEmployee: index("idx_payroll_run_employees_emp").on(t.employeeId),
  uniqRunEmployee: uniqueIndex("payroll_run_employees_run_emp_uniq").on(t.payrollRunId, t.employeeId),
}));

/* Payroll earnings (line items) */
export const payrollEarnings = pgTable("payroll_earnings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  payrollRunEmployeeId: uuid("payroll_run_employee_id").notNull().references(() => payrollRunEmployees.id, { onDelete: "cascade" }),
  earningTypeId: uuid("earning_type_id").notNull().references(() => earningTypes.id),
  hours: numeric("hours", { precision: 8, scale: 2 }),
  rate: numeric("rate", { precision: 12, scale: 4 }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxPayrollRunEmployee: index("idx_payroll_earnings").on(t.payrollRunEmployeeId),
}));

/* Payroll taxes (calculated withholdings) */
export const payrollTaxes = pgTable("payroll_taxes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  payrollRunEmployeeId: uuid("payroll_run_employee_id").notNull().references(() => payrollRunEmployees.id, { onDelete: "cascade" }),
  taxTableId: uuid("tax_table_id").references(() => taxTables.id),
  jurisdictionId: uuid("jurisdiction_id").references(() => jurisdictions.id),
  taxType: text("tax_type").notNull(),
  taxableWages: numeric("taxable_wages", { precision: 12, scale: 2 }).notNull(),
  taxRate: numeric("tax_rate", { precision: 8, scale: 6 }),
  employeeAmount: numeric("employee_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  employerAmount: numeric("employer_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  ytdTaxableWages: numeric("ytd_taxable_wages", { precision: 14, scale: 2 }),
  wageBaseRemaining: numeric("wage_base_remaining", { precision: 14, scale: 2 }),
  calculationDetails: jsonb("calculation_details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxPayrollRunEmployee: index("idx_payroll_taxes").on(t.payrollRunEmployeeId),
}));

/* Payroll deductions (calculated deductions) */
export const payrollDeductions = pgTable("payroll_deductions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  payrollRunEmployeeId: uuid("payroll_run_employee_id").notNull().references(() => payrollRunEmployees.id, { onDelete: "cascade" }),
  employeeDeductionId: uuid("employee_deduction_id").references(() => employeeDeductions.id),
  deductionTypeId: uuid("deduction_type_id").notNull().references(() => deductionTypes.id),
  employeeAmount: numeric("employee_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  employerAmount: numeric("employer_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  ytdEmployeeAmount: numeric("ytd_employee_amount", { precision: 14, scale: 2 }),
  ytdEmployerAmount: numeric("ytd_employer_amount", { precision: 14, scale: 2 }),
  annualLimitRemaining: numeric("annual_limit_remaining", { precision: 14, scale: 2 }),
  calculationDetails: jsonb("calculation_details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxPayrollRunEmployee: index("idx_payroll_deductions").on(t.payrollRunEmployeeId),
}));

/* Payroll GL mappings */
export const payrollGlMappings = pgTable("payroll_gl_mappings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  mappingType: text("mapping_type").notNull(),
  departmentId: uuid("department_id").references(() => departments.id),
  earningTypeId: uuid("earning_type_id").references(() => earningTypes.id),
  deductionTypeId: uuid("deduction_type_id").references(() => deductionTypes.id),
  taxType: text("tax_type"),
  debitAccountId: uuid("debit_account_id").references(() => accounts.id),
  creditAccountId: uuid("credit_account_id").references(() => accounts.id),
  priority: integer("priority").default(100),
  isActive: boolean("is_active").notNull().default(true),
  createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxTenantType: index("idx_payroll_gl_mappings").on(t.tenantId, t.mappingType),
}));

/* Tax filing schedules */
export const taxFilingSchedules = pgTable("tax_filing_schedules", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  jurisdictionId: uuid("jurisdiction_id").notNull().references(() => jurisdictions.id),
  filingType: text("filing_type").notNull(),
  frequency: filingFrequency("frequency").notNull(),
  dueDayOfMonth: integer("due_day_of_month"),
  dueDaysAfterQuarter: integer("due_days_after_quarter"),
  dueDateAnnual: date("due_date_annual"),
  depositFrequency: text("deposit_frequency"),
  depositThreshold: numeric("deposit_threshold", { precision: 14, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxTenant: index("idx_tax_filing_schedules").on(t.tenantId),
}));

/* Tax filings (actual submissions) */
export const taxFilings = pgTable("tax_filings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  filingScheduleId: uuid("filing_schedule_id").references(() => taxFilingSchedules.id),
  filingType: text("filing_type").notNull(),
  jurisdictionId: uuid("jurisdiction_id").notNull().references(() => jurisdictions.id),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  dueDate: date("due_date").notNull(),
  wagesReported: numeric("wages_reported", { precision: 14, scale: 2 }),
  taxWithheld: numeric("tax_withheld", { precision: 14, scale: 2 }),
  employerTax: numeric("employer_tax", { precision: 14, scale: 2 }),
  totalLiability: numeric("total_liability", { precision: 14, scale: 2 }),
  amountDeposited: numeric("amount_deposited", { precision: 14, scale: 2 }),
  balanceDue: numeric("balance_due", { precision: 14, scale: 2 }),
  status: taxFilingStatus("status").notNull().default("pending"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  submittedByActorId: uuid("submitted_by_actor_id").references(() => actors.id),
  confirmationNumber: text("confirmation_number"),
  formData: jsonb("form_data"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxTenant: index("idx_tax_filings_tenant").on(t.tenantId),
  idxPeriod: index("idx_tax_filings_period").on(t.periodStart, t.periodEnd),
  idxDue: index("idx_tax_filings_due").on(t.dueDate),
}));

/* Tax deposits */
export const taxDeposits = pgTable("tax_deposits", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  jurisdictionId: uuid("jurisdiction_id").notNull().references(() => jurisdictions.id),
  taxType: text("tax_type").notNull(),
  depositDate: date("deposit_date").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  paymentMethod: text("payment_method"),
  confirmationNumber: text("confirmation_number"),
  payrollRunIds: jsonb("payroll_run_ids").$type<string[]>().default([]),
  status: taxDepositStatus("status").notNull().default("pending"),
  createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxTenant: index("idx_tax_deposits_tenant").on(t.tenantId),
  idxDate: index("idx_tax_deposits_date").on(t.depositDate),
}));

/* ============================================================================
   GRC CONTROLS
   Internal controls and policies for governance, risk & compliance
   ============================================================================ */

export const grcControlCategory = pgEnum("grc_control_category", [
  "preventive",   // Prevents issues before they occur
  "detective",    // Detects issues that have occurred
  "corrective",   // Corrects issues after detection
  "directive",    // Provides guidance/direction
]);

export const grcControlStatus = pgEnum("grc_control_status", [
  "active",       // Control is active and enforced
  "inactive",     // Control is not currently enforced
  "draft",        // Control is being developed
  "under_review", // Control is being reviewed
  "deprecated",   // Control has been replaced/retired
]);

export const grcControlTestResult = pgEnum("grc_control_test_result", [
  "passed",       // Control test passed
  "failed",       // Control test failed
  "partial",      // Partial compliance
  "not_tested",   // Not yet tested
]);

/**
 * GRC Controls - Internal controls and policies
 */
export const grcControls = pgTable(
  "grc_controls",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Core fields
    name: text("name").notNull(),
    description: text("description"),
    category: grcControlCategory("category").notNull(),
    status: grcControlStatus("status").notNull().default("draft"),

    // Ownership
    ownerId: uuid("owner_id").references(() => users.id),
    ownerName: text("owner_name"), // Fallback if no user assigned

    // Testing
    testingFrequency: text("testing_frequency"), // monthly, quarterly, annually
    lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
    lastTestResult: grcControlTestResult("last_test_result").default("not_tested"),
    nextTestDue: date("next_test_due"),

    // Compliance mapping
    complianceFrameworks: jsonb("compliance_frameworks").$type<string[]>().default([]), // SOC2, ISO27001, etc.
    linkedRiskIds: jsonb("linked_risk_ids").$type<string[]>().default([]),

    // Effectiveness
    effectivenessScore: numeric("effectiveness_score", { precision: 5, scale: 2 }), // 0-100

    // Metadata
    metadata: jsonb("metadata").notNull().default({}),

    // Audit
    createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantStatus: index("grc_controls_tenant_status_idx").on(t.tenantId, t.status),
    idxTenantCategory: index("grc_controls_tenant_category_idx").on(t.tenantId, t.category),
    idxTenantOwner: index("grc_controls_tenant_owner_idx").on(t.tenantId, t.ownerId),
    idxTenantNextTest: index("grc_controls_tenant_next_test_idx").on(t.tenantId, t.nextTestDue),
  })
);

/**
 * GRC Control Tests - Testing history for controls
 */
export const grcControlTests = pgTable(
  "grc_control_tests",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    controlId: uuid("control_id").notNull().references(() => grcControls.id),

    // Test details
    testDate: date("test_date").notNull(),
    result: grcControlTestResult("result").notNull(),
    testerId: uuid("tester_id").references(() => users.id),
    testerName: text("tester_name"),

    // Findings
    findings: text("findings"),
    recommendations: text("recommendations"),
    evidenceLinks: jsonb("evidence_links").$type<string[]>().default([]),

    // Remediation
    remediationRequired: boolean("remediation_required").default(false),
    remediationDueDate: date("remediation_due_date"),
    remediationCompletedAt: timestamp("remediation_completed_at", { withTimezone: true }),

    // Audit
    createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantControl: index("grc_control_tests_tenant_control_idx").on(t.tenantId, t.controlId),
    idxTenantDate: index("grc_control_tests_tenant_date_idx").on(t.tenantId, t.testDate),
  })
);

/* ============================================================================
   GRC RISKS
   Risk register for tracking organizational risks
   ============================================================================ */

export const grcRiskCategory = pgEnum("grc_risk_category", [
  "operational",  // Day-to-day business operations
  "financial",    // Financial impacts
  "compliance",   // Regulatory/legal compliance
  "strategic",    // Strategic initiatives
  "reputational", // Brand/reputation
  "technology",   // IT/cyber risks
  "fraud",        // Fraud/misappropriation
]);

export const grcRiskSeverity = pgEnum("grc_risk_severity", [
  "critical",   // Immediate attention required
  "high",       // Urgent attention needed
  "medium",     // Should be addressed soon
  "low",        // Minor risk
]);

export const grcRiskStatus = pgEnum("grc_risk_status", [
  "open",       // Risk is active
  "mitigating", // Mitigation in progress
  "monitoring", // Being monitored
  "closed",     // Risk resolved/accepted
  "escalated",  // Escalated to management
]);

/**
 * GRC Risks - Risk register
 */
export const grcRisks = pgTable(
  "grc_risks",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Core fields
    title: text("title").notNull(),
    description: text("description"),
    category: grcRiskCategory("category").notNull(),
    severity: grcRiskSeverity("severity").notNull(),
    status: grcRiskStatus("status").notNull().default("open"),

    // Assessment
    likelihood: integer("likelihood"), // 1-5 scale
    impact: integer("impact"), // 1-5 scale
    riskScore: numeric("risk_score", { precision: 5, scale: 2 }), // likelihood * impact

    // Ownership
    ownerId: uuid("owner_id").references(() => users.id),
    ownerName: text("owner_name"),

    // Mitigation
    mitigationPlan: text("mitigation_plan"),
    mitigationDueDate: date("mitigation_due_date"),
    residualRiskLevel: grcRiskSeverity("residual_risk_level"),

    // Linked entities
    linkedControlIds: jsonb("linked_control_ids").$type<string[]>().default([]),
    linkedIncidentIds: jsonb("linked_incident_ids").$type<string[]>().default([]),

    // Review
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    nextReviewDate: date("next_review_date"),

    // Metadata
    metadata: jsonb("metadata").notNull().default({}),

    // Audit
    createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantStatus: index("grc_risks_tenant_status_idx").on(t.tenantId, t.status),
    idxTenantCategory: index("grc_risks_tenant_category_idx").on(t.tenantId, t.category),
    idxTenantSeverity: index("grc_risks_tenant_severity_idx").on(t.tenantId, t.severity),
    idxTenantOwner: index("grc_risks_tenant_owner_idx").on(t.tenantId, t.ownerId),
  })
);

/* ============================================================================
   GRC INCIDENTS
   Incident tracking for security, compliance, and operational events
   ============================================================================ */

export const grcIncidentCategory = pgEnum("grc_incident_category", [
  "security",   // Security breach/incident
  "data",       // Data incident (loss, exposure)
  "fraud",      // Fraud attempt/discovery
  "system",     // System failure
  "physical",   // Physical security
  "compliance", // Compliance violation
  "safety",     // Workplace safety
  "other",      // Other incidents
]);

export const grcIncidentSeverity = pgEnum("grc_incident_severity", [
  "critical",   // Major incident - immediate response
  "high",       // Significant impact - urgent
  "medium",     // Moderate impact
  "low",        // Minor incident
]);

export const grcIncidentStatus = pgEnum("grc_incident_status", [
  "reported",     // Initial report
  "investigating",// Under investigation
  "contained",    // Incident contained
  "resolved",     // Fully resolved
  "closed",       // Case closed
]);

/**
 * GRC Incidents - Incident tracking
 */
export const grcIncidents = pgTable(
  "grc_incidents",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Core fields
    title: text("title").notNull(),
    description: text("description"),
    category: grcIncidentCategory("category").notNull(),
    severity: grcIncidentSeverity("severity").notNull(),
    status: grcIncidentStatus("status").notNull().default("reported"),

    // Timing
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
    reportedAt: timestamp("reported_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),

    // Reporter and owner
    reporterId: uuid("reporter_id").references(() => users.id),
    reporterName: text("reporter_name"),
    ownerId: uuid("owner_id").references(() => users.id),
    ownerName: text("owner_name"),

    // Investigation
    rootCause: text("root_cause"),
    immediateActions: text("immediate_actions"),
    correctiveActions: text("corrective_actions"),

    // Impact assessment
    affectedSystems: jsonb("affected_systems").$type<string[]>().default([]),
    affectedPeople: integer("affected_people"),
    financialImpact: numeric("financial_impact", { precision: 12, scale: 2 }),

    // Regulatory
    regulatoryReportRequired: boolean("regulatory_report_required").default(false),
    regulatoryReportFiled: boolean("regulatory_report_filed").default(false),
    regulatoryReportDate: date("regulatory_report_date"),

    // Linked entities
    linkedRiskIds: jsonb("linked_risk_ids").$type<string[]>().default([]),
    linkedControlIds: jsonb("linked_control_ids").$type<string[]>().default([]),

    // Evidence
    evidenceLinks: jsonb("evidence_links").$type<string[]>().default([]),

    // Metadata
    metadata: jsonb("metadata").notNull().default({}),

    // Audit
    createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantStatus: index("grc_incidents_tenant_status_idx").on(t.tenantId, t.status),
    idxTenantCategory: index("grc_incidents_tenant_category_idx").on(t.tenantId, t.category),
    idxTenantSeverity: index("grc_incidents_tenant_severity_idx").on(t.tenantId, t.severity),
    idxTenantReportedAt: index("grc_incidents_tenant_reported_idx").on(t.tenantId, t.reportedAt),
  })
);

/* ============================================================================
   GRC REQUIREMENTS (Compliance Management)
   Requirements-driven compliance with deterministic closure logic
   ============================================================================ */

export const grcRequirementStatus = pgEnum("grc_requirement_status", [
  "satisfied",    // All closure criteria met
  "unsatisfied",  // Missing evidence or criteria
  "at_risk",      // Approaching deadline or issues
  "unknown",      // Not yet evaluated
]);

export const grcRequirementCategory = pgEnum("grc_requirement_category", [
  "tax",
  "labor",
  "licensing",
  "environmental",
  "data_privacy",
  "financial",
  "health_safety",
  "insurance",
  "corporate_governance",
]);

export const grcRequirementRiskLevel = pgEnum("grc_requirement_risk_level", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const grcTaskStatus = pgEnum("grc_task_status", [
  "open",
  "blocked",
  "completed",
]);

export const grcAlertStatus = pgEnum("grc_alert_status", [
  "active",
  "resolved",
]);

export const grcAlertSeverity = pgEnum("grc_alert_severity", [
  "info",
  "warning",
  "critical",
]);

export const grcLicenseStatus = pgEnum("grc_license_status", [
  "active",
  "expired",
  "suspended",
  "pending_renewal",
  "cancelled",
]);

export const grcTaxFilingStatus = pgEnum("grc_tax_filing_status", [
  "pending",
  "filed",
  "paid",
  "overdue",
  "amended",
]);

/**
 * Business Profiles - Comprehensive business information for compliance assessment
 */
export const businessProfiles = pgTable(
  "business_profiles",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Legal Identity
    legalName: text("legal_name").notNull(),
    tradeName: text("trade_name"),
    legalStructure: text("legal_structure"),
    incorporationDate: date("incorporation_date"),
    jurisdiction: text("jurisdiction"),
    taxId: text("tax_id"),

    // Operational Details
    primaryIndustry: text("primary_industry"),
    naicsCodes: jsonb("naics_codes").$type<string[]>().default([]),
    businessDescription: text("business_description"),
    annualRevenue: numeric("annual_revenue", { precision: 15, scale: 2 }),
    employeeCount: integer("employee_count"),

    // Locations
    headquartersAddress: jsonb("headquarters_address").$type<{
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
    }>(),
    operatingLocations: jsonb("operating_locations").$type<{
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
    }[]>().default([]),

    // Activities
    businessActivities: jsonb("business_activities").$type<string[]>().default([]),
    licensesHeld: jsonb("licenses_held").$type<string[]>().default([]),
    regulatedActivities: jsonb("regulated_activities").$type<string[]>().default([]),

    // AI Analysis
    aiAnalysis: jsonb("ai_analysis"),
    confidenceScore: numeric("confidence_score", { precision: 3, scale: 2 }),
    lastAnalyzedAt: timestamp("last_analyzed_at", { withTimezone: true }),

    // Audit
    createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
    updatedByActorId: uuid("updated_by_actor_id").references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenant: index("business_profiles_tenant_idx").on(t.tenantId),
  })
);

/**
 * GRC Requirements - Source of truth for compliance obligations
 */
export const grcRequirements = pgTable(
  "grc_requirements",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Identification
    requirementCode: text("requirement_code").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    category: grcRequirementCategory("category").notNull(),

    // Applicability Rules
    appliesToJurisdictions: jsonb("applies_to_jurisdictions").$type<string[]>().default([]),
    appliesToIndustries: jsonb("applies_to_industries").$type<string[]>().default([]),
    appliesToActivities: jsonb("applies_to_activities").$type<string[]>().default([]),
    appliesToStructure: jsonb("applies_to_structure").$type<string[]>().default([]),
    thresholdRules: jsonb("threshold_rules"),

    // Status & Risk
    status: grcRequirementStatus("status").notNull().default("unknown"),
    riskLevel: grcRequirementRiskLevel("risk_level").notNull().default("medium"),
    priority: integer("priority").default(5),

    // Closure Criteria (Deterministic)
    closureCriteria: jsonb("closure_criteria").$type<{
      required_documents?: string[];
      required_fields?: string[];
      validity_rules?: {
        expiration_check?: boolean;
        renewal_days_before?: number;
        auto_expire?: boolean;
      };
    }>().notNull(),

    // Evidence
    evidenceDocuments: jsonb("evidence_documents").$type<string[]>().default([]),
    evidenceData: jsonb("evidence_data"),
    evidenceUpdatedAt: timestamp("evidence_updated_at", { withTimezone: true }),

    // AI Narrative
    aiExplanation: text("ai_explanation"),
    aiInterpretation: jsonb("ai_interpretation"),
    aiConfidence: numeric("ai_confidence", { precision: 3, scale: 2 }),

    // Compliance Tracking
    satisfiedAt: timestamp("satisfied_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    nextActionDue: date("next_action_due"),

    // Metadata
    isActive: boolean("is_active").default(true),
    createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
    updatedByActorId: uuid("updated_by_actor_id").references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenant: index("grc_requirements_tenant_idx").on(t.tenantId),
    idxTenantStatus: index("grc_requirements_tenant_status_idx").on(t.tenantId, t.status),
    idxTenantRisk: index("grc_requirements_tenant_risk_idx").on(t.tenantId, t.riskLevel),
    idxTenantCategory: index("grc_requirements_tenant_category_idx").on(t.tenantId, t.category),
    uniqCode: uniqueIndex("grc_requirements_tenant_code_uniq").on(t.tenantId, t.requirementCode),
  })
);

/**
 * GRC Requirement Evaluations - Audit trail of every evaluation
 */
export const grcRequirementEvaluations = pgTable(
  "grc_requirement_evaluations",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    requirementId: uuid("requirement_id").notNull().references(() => grcRequirements.id, { onDelete: "cascade" }),

    // Evaluation Context
    triggeredBy: text("triggered_by"),
    triggerSourceId: uuid("trigger_source_id"),

    // Input State
    businessProfileSnapshot: jsonb("business_profile_snapshot"),
    evidenceSnapshot: jsonb("evidence_snapshot"),

    // AI Analysis
    aiFindings: jsonb("ai_findings"),
    aiExplanation: text("ai_explanation"),
    aiConfidence: numeric("ai_confidence", { precision: 3, scale: 2 }),

    // Deterministic Outcome
    previousStatus: text("previous_status"),
    newStatus: text("new_status"),
    previousRiskLevel: text("previous_risk_level"),
    newRiskLevel: text("new_risk_level"),
    closureCheckPassed: boolean("closure_check_passed"),
    closureCheckDetails: jsonb("closure_check_details"),

    // Audit
    evaluatedByActorId: uuid("evaluated_by_actor_id").references(() => actors.id),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxRequirement: index("grc_req_evaluations_requirement_idx").on(t.requirementId),
    idxTenant: index("grc_req_evaluations_tenant_idx").on(t.tenantId),
  })
);

/**
 * GRC Tasks - Human actions linked to requirements
 */
export const grcTasks = pgTable(
  "grc_tasks",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    requirementId: uuid("requirement_id").notNull().references(() => grcRequirements.id, { onDelete: "cascade" }),

    // Task Details
    title: text("title").notNull(),
    description: text("description"),
    actionType: text("action_type"), // register, file, renew, upload_document

    // Status
    status: grcTaskStatus("status").notNull().default("open"),
    blockedReason: text("blocked_reason"),

    // Assignment
    assignedTo: uuid("assigned_to").references(() => users.id),
    dueDate: date("due_date"),

    // Evidence & Feedback
    completionEvidence: jsonb("completion_evidence"),
    uploadedDocuments: jsonb("uploaded_documents").$type<string[]>().default([]),
    userFeedback: text("user_feedback"),

    // Completion (Deterministic)
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedByActorId: uuid("completed_by_actor_id").references(() => actors.id),
    autoClosed: boolean("auto_closed").default(false),

    // Audit
    createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenant: index("grc_tasks_tenant_idx").on(t.tenantId),
    idxRequirement: index("grc_tasks_requirement_idx").on(t.requirementId),
    idxTenantStatus: index("grc_tasks_tenant_status_idx").on(t.tenantId, t.status),
    idxAssigned: index("grc_tasks_assigned_idx").on(t.assignedTo),
  })
);

/**
 * GRC Alerts - Risk signals linked to requirements
 */
export const grcAlerts = pgTable(
  "grc_alerts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    requirementId: uuid("requirement_id").references(() => grcRequirements.id, { onDelete: "cascade" }),

    // Alert Details
    title: text("title").notNull(),
    message: text("message"),
    alertType: text("alert_type"), // deadline_approaching, requirement_unsatisfied, risk_elevated
    severity: grcAlertSeverity("severity").notNull(),

    // Status
    status: grcAlertStatus("status").notNull().default("active"),

    // Resolution (Automatic)
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    autoResolved: boolean("auto_resolved").default(false),
    resolutionReason: text("resolution_reason"),

    // Metadata
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenant: index("grc_alerts_tenant_idx").on(t.tenantId),
    idxRequirement: index("grc_alerts_requirement_idx").on(t.requirementId),
    idxTenantStatus: index("grc_alerts_tenant_status_idx").on(t.tenantId, t.status),
    idxTenantSeverity: index("grc_alerts_tenant_severity_idx").on(t.tenantId, t.severity),
  })
);

/**
 * GRC Document Links - Links documents to requirements
 */
export const grcDocumentLinks = pgTable(
  "grc_document_links",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    requirementId: uuid("requirement_id").notNull().references(() => grcRequirements.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),

    // Classification
    documentType: text("document_type"),
    validityStart: date("validity_start"),
    validityEnd: date("validity_end"),

    // AI Analysis
    aiExtractedData: jsonb("ai_extracted_data"),
    aiConfidence: numeric("ai_confidence", { precision: 3, scale: 2 }),

    // Audit
    uploadedByActorId: uuid("uploaded_by_actor_id").references(() => actors.id),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxRequirement: index("grc_doc_links_requirement_idx").on(t.requirementId),
    idxTenant: index("grc_doc_links_tenant_idx").on(t.tenantId),
    uniqLink: uniqueIndex("grc_doc_links_req_doc_uniq").on(t.requirementId, t.documentId),
  })
);

/**
 * GRC Audit Log - Complete audit trail for GRC actions
 */
export const grcAuditLog = pgTable(
  "grc_audit_log",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Event Details
    eventType: text("event_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),

    // Changes
    oldValues: jsonb("old_values"),
    newValues: jsonb("new_values"),

    // Context
    actorId: uuid("actor_id").references(() => actors.id),
    actorType: text("actor_type"),
    reason: text("reason"),

    // Metadata
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
  },
  (t) => ({
    idxTenant: index("grc_audit_log_tenant_idx").on(t.tenantId),
    idxEntity: index("grc_audit_log_entity_idx").on(t.entityType, t.entityId),
    idxOccurred: index("grc_audit_log_occurred_idx").on(t.occurredAt),
  })
);

/**
 * GRC Tax Filings - Tax filing history tracking
 */
export const grcTaxFilings = pgTable(
  "grc_tax_filings",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    requirementId: uuid("requirement_id").references(() => grcRequirements.id),

    // Filing Details
    filingType: text("filing_type").notNull(),
    jurisdiction: text("jurisdiction").notNull(),
    taxYear: integer("tax_year"),
    taxPeriod: text("tax_period"),

    // Amounts
    taxLiability: numeric("tax_liability", { precision: 15, scale: 2 }),
    taxPaid: numeric("tax_paid", { precision: 15, scale: 2 }),
    penalties: numeric("penalties", { precision: 15, scale: 2 }),
    interest: numeric("interest", { precision: 15, scale: 2 }),

    // Dates
    dueDate: date("due_date").notNull(),
    filedDate: date("filed_date"),
    paidDate: date("paid_date"),

    // Status
    status: grcTaxFilingStatus("status").notNull(),

    // Evidence
    filingDocuments: jsonb("filing_documents").$type<string[]>().default([]),
    paymentReference: text("payment_reference"),

    // Metadata
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenant: index("grc_tax_filings_tenant_idx").on(t.tenantId),
    idxRequirement: index("grc_tax_filings_requirement_idx").on(t.requirementId),
    idxTenantType: index("grc_tax_filings_tenant_type_idx").on(t.tenantId, t.filingType),
    idxTenantStatus: index("grc_tax_filings_tenant_status_idx").on(t.tenantId, t.status),
  })
);

/**
 * GRC Licenses - License and permit tracking
 */
export const grcLicenses = pgTable(
  "grc_licenses",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    requirementId: uuid("requirement_id").references(() => grcRequirements.id),

    // License Details
    licenseType: text("license_type").notNull(),
    licenseNumber: text("license_number"),
    issuingAuthority: text("issuing_authority").notNull(),
    jurisdiction: text("jurisdiction"),

    // Validity
    issueDate: date("issue_date").notNull(),
    expirationDate: date("expiration_date"),
    renewalFrequency: text("renewal_frequency"),

    // Status
    status: grcLicenseStatus("status").notNull(),

    // Documents
    licenseDocuments: jsonb("license_documents").$type<string[]>().default([]),

    // Metadata
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenant: index("grc_licenses_tenant_idx").on(t.tenantId),
    idxRequirement: index("grc_licenses_requirement_idx").on(t.requirementId),
    idxTenantStatus: index("grc_licenses_tenant_status_idx").on(t.tenantId, t.status),
  })
);

/**
 * GRC Compliance Calendar - Scheduled compliance events
 */
export const grcComplianceCalendar = pgTable(
  "grc_compliance_calendar",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    requirementId: uuid("requirement_id").references(() => grcRequirements.id),

    // Event Details
    eventType: text("event_type").notNull(),
    title: text("title").notNull(),
    description: text("description"),

    // Dates
    dueDate: date("due_date").notNull(),
    reminderDate: date("reminder_date"),
    completedDate: date("completed_date"),

    // Recurrence
    isRecurring: boolean("is_recurring").default(false),
    recurrencePattern: text("recurrence_pattern"),

    // Status
    status: text("status").notNull(),

    // Metadata
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenant: index("grc_calendar_tenant_idx").on(t.tenantId),
    idxDue: index("grc_calendar_due_idx").on(t.dueDate),
  })
);

// GRC Requirements Relations
export const grcRequirementsRelations = relations(grcRequirements, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [grcRequirements.tenantId],
    references: [tenants.id],
  }),
  tasks: many(grcTasks),
  alerts: many(grcAlerts),
  documents: many(grcDocumentLinks),
  evaluations: many(grcRequirementEvaluations),
  taxFilings: many(grcTaxFilings),
  licenses: many(grcLicenses),
}));

export const grcTasksRelations = relations(grcTasks, ({ one }) => ({
  tenant: one(tenants, {
    fields: [grcTasks.tenantId],
    references: [tenants.id],
  }),
  requirement: one(grcRequirements, {
    fields: [grcTasks.requirementId],
    references: [grcRequirements.id],
  }),
  assignedToUser: one(users, {
    fields: [grcTasks.assignedTo],
    references: [users.id],
  }),
}));

export const grcAlertsRelations = relations(grcAlerts, ({ one }) => ({
  tenant: one(tenants, {
    fields: [grcAlerts.tenantId],
    references: [tenants.id],
  }),
  requirement: one(grcRequirements, {
    fields: [grcAlerts.requirementId],
    references: [grcRequirements.id],
  }),
}));

// Type exports for GRC Requirements module
export type BusinessProfile = typeof businessProfiles.$inferSelect;
export type NewBusinessProfile = typeof businessProfiles.$inferInsert;
export type GrcRequirement = typeof grcRequirements.$inferSelect;
export type NewGrcRequirement = typeof grcRequirements.$inferInsert;
export type GrcTask = typeof grcTasks.$inferSelect;
export type NewGrcTask = typeof grcTasks.$inferInsert;
export type GrcAlert = typeof grcAlerts.$inferSelect;
export type NewGrcAlert = typeof grcAlerts.$inferInsert;
export type GrcTaxFiling = typeof grcTaxFilings.$inferSelect;
export type NewGrcTaxFiling = typeof grcTaxFilings.$inferInsert;
export type GrcLicense = typeof grcLicenses.$inferSelect;
export type NewGrcLicense = typeof grcLicenses.$inferInsert;

/* ============================================================================
   GROWTH PLAYBOOKS
   Repeatable growth strategies and execution frameworks
   ============================================================================ */

export const playbookCategory = pgEnum("playbook_category", [
  "market_expansion",      // Entering new markets
  "product_launch",        // Launching new products
  "cost_optimization",     // Reducing costs
  "digital_transformation",// Digital initiatives
  "customer_acquisition",  // Growing customer base
  "revenue_growth",        // Increasing revenue
  "operational_efficiency",// Improving operations
  "talent_development",    // Growing team capabilities
]);

export const playbookDifficulty = pgEnum("playbook_difficulty", [
  "easy",     // Quick wins, 1-2 weeks
  "medium",   // Moderate effort, 1-2 months
  "hard",     // Significant effort, 3-6 months
  "expert",   // Major transformation, 6+ months
]);

export const playbookStatus = pgEnum("playbook_status", [
  "draft",    // Being developed
  "active",   // Available for use
  "archived", // No longer in use
]);

export const playbookInitiationStatus = pgEnum("playbook_initiation_status", [
  "in_progress", // Currently executing
  "completed",   // Successfully completed
  "abandoned",   // Stopped before completion
  "paused",      // Temporarily paused
]);

/**
 * Growth Playbooks - Repeatable growth strategies
 */
export const growthPlaybooks = pgTable(
  "growth_playbooks",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Core fields
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    category: playbookCategory("category").notNull(),
    difficulty: playbookDifficulty("difficulty").notNull().default("medium"),
    status: playbookStatus("status").notNull().default("draft"),

    // Planning
    estimatedDurationDays: integer("estimated_duration_days"),
    expectedOutcome: text("expected_outcome"),
    targetHorizon: text("target_horizon"), // run, improve, grow

    // Metrics
    timesLaunched: integer("times_launched").notNull().default(0),
    timesCompleted: integer("times_completed").notNull().default(0),

    // Metadata
    tags: jsonb("tags").$type<string[]>().default([]),
    metadata: jsonb("metadata").notNull().default({}),

    // Audit
    createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqCode: uniqueIndex("growth_playbooks_tenant_code_uniq").on(t.tenantId, t.code),
    idxTenantCategory: index("growth_playbooks_tenant_category_idx").on(t.tenantId, t.category),
    idxTenantStatus: index("growth_playbooks_tenant_status_idx").on(t.tenantId, t.status),
  })
);

/**
 * Playbook Steps - Sequential steps within a playbook
 */
export const playbookSteps = pgTable(
  "playbook_steps",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    playbookId: uuid("playbook_id").notNull().references(() => growthPlaybooks.id, { onDelete: "cascade" }),

    // Step details
    sequenceNo: integer("sequence_no").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    estimatedDays: integer("estimated_days"),

    // Action items (array of tasks to complete)
    actionItems: jsonb("action_items").$type<string[]>().default([]),

    // Resources/links
    resources: jsonb("resources").$type<{ title: string; url: string }[]>().default([]),

    // Audit
    createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxPlaybookSeq: index("playbook_steps_playbook_seq_idx").on(t.playbookId, t.sequenceNo),
  })
);

/**
 * Playbook Initiations - Track when playbooks are launched
 */
export const playbookInitiations = pgTable(
  "playbook_initiations",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    playbookId: uuid("playbook_id").notNull().references(() => growthPlaybooks.id),

    // Status tracking
    status: playbookInitiationStatus("status").notNull().default("in_progress"),
    currentStepNo: integer("current_step_no").notNull().default(1),

    // Timing
    initiatedAt: timestamp("initiated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    targetCompletionDate: date("target_completion_date"),

    // Progress notes
    notes: text("notes"),

    // Link to planner initiative (if created)
    plannerInitiativeId: uuid("planner_initiative_id"),

    // Audit
    initiatedByActorId: uuid("initiated_by_actor_id").references(() => actors.id),
  },
  (t) => ({
    idxPlaybookStatus: index("playbook_initiations_playbook_status_idx").on(t.playbookId, t.status),
    idxTenantStatus: index("playbook_initiations_tenant_status_idx").on(t.tenantId, t.status),
  })
);

/* =========================================================================
   PERFORMANCE MANAGEMENT
   ========================================================================= */

/* Performance cycle frequency enum */
export const performanceCycleFrequency = pgEnum("performance_cycle_frequency", [
  "quarterly",
  "semi_annual",
  "annual",
  "custom",
]);

/* Performance cycle status enum */
export const performanceCycleStatus = pgEnum("performance_cycle_status", [
  "planned",
  "active",
  "completed",
  "cancelled",
]);

/* Performance review status enum */
export const performanceReviewStatus = pgEnum("performance_review_status", [
  "not_started",
  "in_progress",
  "submitted",
  "approved",
  "cancelled",
]);

/* Performance goal status enum */
export const performanceGoalStatus = pgEnum("performance_goal_status", [
  "not_started",
  "in_progress",
  "completed",
  "deferred",
  "cancelled",
]);

/* Performance cycles (quarterly, semi-annual, annual reviews) */
export const performanceCycles = pgTable("performance_cycles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  frequency: performanceCycleFrequency("frequency").notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  dueDate: date("due_date").notNull(),
  assignedToRole: text("assigned_to_role"), // 'hr', 'manager', 'owner'
  status: performanceCycleStatus("status").notNull().default("planned"),
  notes: text("notes"),
  createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxTenant: index("idx_perf_cycles_tenant").on(t.tenantId),
  idxStatus: index("idx_perf_cycles_status").on(t.tenantId, t.status),
  idxDates: index("idx_perf_cycles_dates").on(t.tenantId, t.periodStart, t.periodEnd),
}));

/* Performance reviews (individual review records) */
export const performanceReviews = pgTable("performance_reviews", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  cycleId: uuid("cycle_id").notNull().references(() => performanceCycles.id, { onDelete: "cascade" }),
  employeeId: uuid("employee_id").notNull().references(() => employees.id),
  reviewerEmployeeId: uuid("reviewer_employee_id").references(() => employees.id),
  status: performanceReviewStatus("status").notNull().default("not_started"),
  overallRating: integer("overall_rating"),
  strengths: text("strengths"),
  areasForImprovement: text("areas_for_improvement"),
  goalsForNextPeriod: text("goals_for_next_period"),
  managerComments: text("manager_comments"),
  employeeComments: text("employee_comments"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  approvedByActorId: uuid("approved_by_actor_id").references(() => actors.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxCycle: index("idx_perf_reviews_cycle").on(t.cycleId),
  idxEmployee: index("idx_perf_reviews_employee").on(t.employeeId),
  idxReviewer: index("idx_perf_reviews_reviewer").on(t.reviewerEmployeeId),
  idxStatus: index("idx_perf_reviews_status").on(t.tenantId, t.status),
  uniqCycleEmployee: uniqueIndex("perf_reviews_cycle_employee_uniq").on(t.cycleId, t.employeeId),
}));

/* Performance review ratings (detailed ratings by category) */
export const performanceReviewRatings = pgTable("performance_review_ratings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  reviewId: uuid("review_id").notNull().references(() => performanceReviews.id, { onDelete: "cascade" }),
  category: text("category").notNull(), // 'job_knowledge', 'quality_of_work', 'communication', 'teamwork', 'initiative', 'attendance', 'custom'
  categoryLabel: text("category_label").notNull(),
  rating: integer("rating"),
  weight: numeric("weight", { precision: 5, scale: 2 }).default("1.0"),
  comments: text("comments"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxReview: index("idx_perf_ratings_review").on(t.reviewId),
}));

/* Performance goals */
export const performanceGoals = pgTable("performance_goals", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  employeeId: uuid("employee_id").notNull().references(() => employees.id),
  cycleId: uuid("cycle_id").references(() => performanceCycles.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  targetDate: date("target_date"),
  status: performanceGoalStatus("status").notNull().default("not_started"),
  progressPercent: integer("progress_percent").default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  idxEmployee: index("idx_perf_goals_employee").on(t.employeeId),
  idxCycle: index("idx_perf_goals_cycle").on(t.cycleId),
  idxStatus: index("idx_perf_goals_status").on(t.tenantId, t.status),
}));

/* ============================================================================
   HR & PEOPLE MODULE V2
   Comprehensive remodel for payroll, performance reviews, and documents
   ============================================================================ */

/**
 * AI Outcome category for performance reviews
 */
export const aiOutcomeCategory = pgEnum("ai_outcome_category", [
  "outstanding_contribution",
  "strong_performance",
  "solid_on_track",
  "below_expectations",
  "critical_concerns",
]);

/**
 * Payroll run status v2
 */
export const payrollRunStatusV2 = pgEnum("payroll_run_status_v2", [
  "draft",
  "posted",
  "voided",
]);

/**
 * Performance review visibility
 */
export const reviewVisibility = pgEnum("review_visibility", [
  "visible_to_employee",
  "manager_only",
  "hr_only",
]);

/**
 * HR Document categories
 */
export const hrDocumentCategory = pgEnum("hr_document_category", [
  "contract",
  "id_proof",
  "qualification",
  "certification",
  "visa_work_permit",
  "insurance",
  "tax_form",
  "bank_details",
  "other",
]);

/**
 * HR Document access scope
 */
export const hrDocumentAccessScope = pgEnum("hr_document_access_scope", [
  "employee_self",
  "manager",
  "hr_only",
  "public",
]);

/**
 * People Addresses - Contact addresses for people
 */
export const peopleAddresses = pgTable(
  "people_addresses",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    personId: uuid("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),

    // Address fields
    addressType: text("address_type").notNull().default("primary"), // primary, secondary, emergency
    country: text("country"),
    region: text("region"),
    city: text("city"),
    addressLine1: text("address_line_1"),
    addressLine2: text("address_line_2"),
    postalCode: text("postal_code"),

    isCurrent: boolean("is_current").default(true),

    // Audit
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
    updatedByActorId: uuid("updated_by_actor_id").references(() => actors.id),
  },
  (t) => ({
    idxTenant: index("people_addresses_tenant_idx").on(t.tenantId),
    idxPerson: index("people_addresses_person_idx").on(t.personId),
  })
);

/**
 * Payroll Runs V2 - Unified payroll run headers
 */
export const payrollRunsV2 = pgTable(
  "payroll_runs_v2",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Period info
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    payDate: date("pay_date").notNull(),
    currency: text("currency").notNull().default("USD"),

    // Status
    status: payrollRunStatusV2("status").notNull().default("draft"),

    // Preload metadata
    preloadOption: text("preload_option"), // staff, interns, both, custom

    // Posting link
    journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedByActorId: uuid("posted_by_actor_id").references(() => actors.id),

    // Voided info
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedByActorId: uuid("voided_by_actor_id").references(() => actors.id),
    voidReason: text("void_reason"),

    // Audit
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
    updatedByActorId: uuid("updated_by_actor_id").references(() => actors.id),
  },
  (t) => ({
    idxTenant: index("payroll_runs_v2_tenant_idx").on(t.tenantId),
    idxPeriod: index("payroll_runs_v2_period_idx").on(t.tenantId, t.periodStart, t.periodEnd),
    idxStatus: index("payroll_runs_v2_status_idx").on(t.tenantId, t.status),
  })
);

/**
 * Payroll Run Lines - Employees in payroll run with embedded JSONB for earnings/deductions
 */
export const payrollRunLines = pgTable(
  "payroll_run_lines",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    payrollRunId: uuid("payroll_run_id").notNull().references(() => payrollRunsV2.id, { onDelete: "cascade" }),

    // Employee reference
    employeeId: uuid("employee_id").notNull().references(() => employees.id),
    personId: uuid("person_id").notNull().references(() => people.id),

    // Inclusion
    isIncluded: boolean("is_included").default(true),
    excludeReason: text("exclude_reason"),

    // Identity snapshot (for audit trail)
    personName: text("person_name").notNull(),
    personType: text("person_type"), // staff, intern, contractor
    jurisdiction: text("jurisdiction"),

    // Base pay
    basePay: numeric("base_pay", { precision: 15, scale: 2 }).default("0"),
    basePayType: text("base_pay_type"), // salary, hourly, etc

    // Earnings (stored as JSONB arrays)
    allowances: jsonb("allowances").$type<Array<{ name: string; amount: number; percent?: number; basis?: number }>>().default([]),
    otherEarnings: jsonb("other_earnings").$type<Array<{ name: string; amount: number }>>().default([]),

    // Deductions & Taxes (stored as JSONB arrays)
    employeeTaxes: jsonb("employee_taxes").$type<Array<{ name: string; amount: number; percent?: number; basis?: number }>>().default([]),
    employeeDeductions: jsonb("employee_deductions").$type<Array<{ name: string; amount: number; percent?: number; basis?: number }>>().default([]),
    employerContributions: jsonb("employer_contributions").$type<Array<{ name: string; amount: number; percent?: number; basis?: number }>>().default([]),

    // Calculated totals
    grossPay: numeric("gross_pay", { precision: 15, scale: 2 }).default("0"),
    totalDeductions: numeric("total_deductions", { precision: 15, scale: 2 }).default("0"),
    totalTaxes: numeric("total_taxes", { precision: 15, scale: 2 }).default("0"),
    netPay: numeric("net_pay", { precision: 15, scale: 2 }).default("0"),
    totalEmployerCost: numeric("total_employer_cost", { precision: 15, scale: 2 }).default("0"),

    // Notes
    rowNotes: text("row_notes"),
    flags: jsonb("flags").$type<Record<string, boolean>>().default({}),

    // Audit
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenant: index("payroll_run_lines_tenant_idx").on(t.tenantId),
    idxRun: index("payroll_run_lines_run_idx").on(t.payrollRunId),
    idxEmployee: index("payroll_run_lines_employee_idx").on(t.employeeId),
  })
);

/**
 * Performance Reviews V2 - Guided performance reviews with AI outcomes
 */
export const performanceReviewsV2 = pgTable(
  "performance_reviews_v2",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Context
    employeeId: uuid("employee_id").notNull().references(() => employees.id),
    personId: uuid("person_id").notNull().references(() => people.id),
    reviewerId: uuid("reviewer_id").references(() => users.id),

    periodType: text("period_type"), // monthly, quarterly, annual, probation, project, other
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),

    // Guided sections
    strengths: text("strengths"),
    strengthsExamples: text("strengths_examples"),

    improvements: text("improvements"),
    improvementsExamples: text("improvements_examples"),

    fairnessConstraints: text("fairness_constraints"),
    fairnessSupport: text("fairness_support"),
    fairnessOutsideControl: text("fairness_outside_control"),

    goals: text("goals"),
    goalsSupportPlan: text("goals_support_plan"),
    followUpDate: date("follow_up_date"),

    // Visibility
    visibility: reviewVisibility("visibility").default("visible_to_employee"),
    employeeAcknowledgedAt: timestamp("employee_acknowledged_at", { withTimezone: true }),
    privateNotes: text("private_notes"),

    // AI Outcome (locked once generated)
    aiOutcomeCategory: aiOutcomeCategory("ai_outcome_category"),
    aiOutcomeReasons: text("ai_outcome_reasons"),
    aiOutcomeNextStep: text("ai_outcome_next_step"),
    aiOutcomeGeneratedAt: timestamp("ai_outcome_generated_at", { withTimezone: true }),
    aiOutcomeInputHash: text("ai_outcome_input_hash"), // Hash of input text to detect changes

    // Status
    status: text("status").notNull().default("draft"), // draft, completed, acknowledged

    // Audit
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
    updatedByActorId: uuid("updated_by_actor_id").references(() => actors.id),
  },
  (t) => ({
    idxTenant: index("performance_reviews_v2_tenant_idx").on(t.tenantId),
    idxEmployee: index("performance_reviews_v2_employee_idx").on(t.employeeId),
    idxPeriod: index("performance_reviews_v2_period_idx").on(t.tenantId, t.periodStart, t.periodEnd),
    uniqReview: uniqueIndex("performance_reviews_v2_uniq").on(t.tenantId, t.employeeId, t.periodStart, t.periodEnd),
  })
);

/**
 * HR Documents - Document metadata (external storage)
 */
export const hrDocuments = pgTable(
  "hr_documents",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Storage (external object storage)
    storageKey: text("storage_key").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    checksum: text("checksum"),

    // Classification
    category: hrDocumentCategory("category"),

    // Expiry tracking
    expiryDate: date("expiry_date"),
    verificationStatus: documentVerificationStatus("verification_status").default("pending"),

    // Metadata
    description: text("description"),
    tags: jsonb("tags").$type<string[]>().default([]),

    // Audit
    uploadedByActorId: uuid("uploaded_by_actor_id").notNull().references(() => actors.id),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
    verifiedByUserId: uuid("verified_by_user_id").references(() => users.id),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
  },
  (t) => ({
    idxTenant: index("hr_documents_tenant_idx").on(t.tenantId),
    idxCategory: index("hr_documents_category_idx").on(t.tenantId, t.category),
    idxExpiry: index("hr_documents_expiry_idx").on(t.tenantId, t.expiryDate),
    uniqStorageKey: uniqueIndex("hr_documents_storage_key_uniq").on(t.storageKey),
  })
);

/**
 * HR Document Links - Link documents to entities
 */
export const hrDocumentLinks = pgTable(
  "hr_document_links",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    documentId: uuid("document_id").notNull().references(() => hrDocuments.id, { onDelete: "cascade" }),

    // Link to entity
    entityType: text("entity_type").notNull(), // person, employee, payroll_run, performance_review
    entityId: uuid("entity_id").notNull(),

    // Access control
    accessScope: hrDocumentAccessScope("access_scope").default("hr_only"),

    // Audit
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdByActorId: uuid("created_by_actor_id").references(() => actors.id),
  },
  (t) => ({
    idxTenant: index("hr_document_links_tenant_idx").on(t.tenantId),
    idxDocument: index("hr_document_links_document_idx").on(t.documentId),
    idxEntity: index("hr_document_links_entity_idx").on(t.tenantId, t.entityType, t.entityId),
  })
);

/**
 * HR Audit Log - Comprehensive audit trail for HR actions
 */
export const hrAuditLog = pgTable(
  "hr_audit_log",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Who & When
    actorId: uuid("actor_id").references(() => actors.id),
    actorName: text("actor_name"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),

    // What
    entityType: text("entity_type").notNull(), // payroll_run, performance_review, employee, etc
    entityId: uuid("entity_id").notNull(),
    action: text("action").notNull(), // created, updated, posted, voided, ai_outcome_generated, etc

    // Before & After
    beforeSnapshot: jsonb("before_snapshot").$type<Record<string, unknown>>(),
    afterSnapshot: jsonb("after_snapshot").$type<Record<string, unknown>>(),

    // AI outcome tracking
    aiOutcomeSnapshot: jsonb("ai_outcome_snapshot").$type<Record<string, unknown>>(),

    // Metadata
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    notes: text("notes"),
  },
  (t) => ({
    idxTenant: index("hr_audit_log_tenant_idx").on(t.tenantId),
    idxEntity: index("hr_audit_log_entity_idx").on(t.tenantId, t.entityType, t.entityId),
    idxOccurred: index("hr_audit_log_occurred_idx").on(t.tenantId, t.occurredAt),
  })
);

// Type exports for HR v2
export type PeopleAddress = typeof peopleAddresses.$inferSelect;
export type NewPeopleAddress = typeof peopleAddresses.$inferInsert;
export type PayrollRunV2 = typeof payrollRunsV2.$inferSelect;
export type NewPayrollRunV2 = typeof payrollRunsV2.$inferInsert;
export type PayrollRunLine = typeof payrollRunLines.$inferSelect;
export type NewPayrollRunLine = typeof payrollRunLines.$inferInsert;
export type PerformanceReviewV2 = typeof performanceReviewsV2.$inferSelect;
export type NewPerformanceReviewV2 = typeof performanceReviewsV2.$inferInsert;
export type HrDocument = typeof hrDocuments.$inferSelect;
export type NewHrDocument = typeof hrDocuments.$inferInsert;
export type HrDocumentLink = typeof hrDocumentLinks.$inferSelect;
export type NewHrDocumentLink = typeof hrDocumentLinks.$inferInsert;
export type HrAuditLogEntry = typeof hrAuditLog.$inferSelect;
export type NewHrAuditLogEntry = typeof hrAuditLog.$inferInsert;

/* ============================================================================
 * HR & PEOPLE REMODEL 2 - Clean, Simple HR Module
 * ============================================================================ */

/**
 * HR Persons - All persons in the organization (staff, interns, contractors, etc.)
 */
export const hrPersons = pgTable(
  "hr_persons",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Basic Information
    fullName: text("full_name").notNull(),
    preferredName: text("preferred_name"),
    email: text("email"),
    phone: text("phone"),

    // Employment Details
    employmentType: text("employment_type"), // staff, intern, part_time, contractor, consultant, other
    jobTitle: text("job_title"),
    department: text("department"),
    managerId: uuid("manager_id").references((): AnyPgColumn => hrPersons.id),

    // Dates
    hireDate: date("hire_date"),
    endDate: date("end_date"),

    // Personal Details
    dateOfBirth: date("date_of_birth"),
    nationality: text("nationality"),
    gender: text("gender"),

    // Address
    addressLine1: text("address_line_1"),
    addressLine2: text("address_line_2"),
    city: text("city"),
    region: text("region"),
    country: text("country"),
    postalCode: text("postal_code"),

    // Emergency Contact
    emergencyContactName: text("emergency_contact_name"),
    emergencyContactPhone: text("emergency_contact_phone"),
    emergencyContactRelationship: text("emergency_contact_relationship"),

    // Banking (for payroll)
    bankName: text("bank_name"),
    bankAccountNumber: text("bank_account_number"),
    bankRoutingNumber: text("bank_routing_number"),

    // Tax & Legal
    taxId: text("tax_id"),
    socialSecurityNumber: text("social_security_number"),
    workPermitNumber: text("work_permit_number"),
    workPermitExpiry: date("work_permit_expiry"),

    // Compensation
    grossSalary: numeric("gross_salary", { precision: 15, scale: 2 }),
    payFrequency: text("pay_frequency"), // weekly, biweekly, monthly, annual
    currency: text("currency").default("USD"),

    // Benefits & Deductions
    healthInsurance: boolean("health_insurance").default(false),
    pensionContributionPercent: numeric("pension_contribution_percent", { precision: 5, scale: 2 }),
    otherDeductions: jsonb("other_deductions").$type<Record<string, unknown>[]>().default([]),

    // Platform Access
    platformUserId: uuid("platform_user_id").references(() => users.id),
    canAccessPlatform: boolean("can_access_platform").default(false),
    platformRole: text("platform_role"),

    // Status
    status: text("status").default("active"), // active, inactive, terminated

    // Notes
    notes: text("notes"),

    // Audit
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => actors.id),
    updatedBy: uuid("updated_by").references(() => actors.id),
  },
  (t) => ({
    idxTenant: index("hr_persons_tenant_idx").on(t.tenantId),
    idxStatus: index("hr_persons_status_idx").on(t.tenantId, t.status),
    idxType: index("hr_persons_type_idx").on(t.tenantId, t.employmentType),
    idxManager: index("hr_persons_manager_idx").on(t.managerId),
  })
);

/**
 * HR Payroll Runs - Payroll run headers
 */
export const hrPayrollRuns = pgTable(
  "hr_payroll_runs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Period
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    payDate: date("pay_date").notNull(),

    // Filters used
    employmentTypes: text("employment_types").array(), // Which types were included

    // Status
    status: text("status").default("draft"), // draft, confirmed, posted_to_finance

    // Financial Posting
    journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedBy: uuid("posted_by").references(() => actors.id),

    // Metadata
    currency: text("currency").default("USD"),
    totalGross: numeric("total_gross", { precision: 15, scale: 2 }).default("0"),
    totalNet: numeric("total_net", { precision: 15, scale: 2 }).default("0"),
    totalTax: numeric("total_tax", { precision: 15, scale: 2 }).default("0"),
    totalDeductions: numeric("total_deductions", { precision: 15, scale: 2 }).default("0"),

    // Audit
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => actors.id),
    updatedBy: uuid("updated_by").references(() => actors.id),
  },
  (t) => ({
    idxTenant: index("hr_payroll_runs_tenant_idx").on(t.tenantId),
    idxPeriod: index("hr_payroll_runs_period_idx").on(t.tenantId, t.periodStart, t.periodEnd),
    idxStatus: index("hr_payroll_runs_status_idx").on(t.tenantId, t.status),
  })
);

/**
 * HR Payroll Lines - Individual person entries in a payroll run
 */
export const hrPayrollLines = pgTable(
  "hr_payroll_lines",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    payrollRunId: uuid("payroll_run_id").notNull().references(() => hrPayrollRuns.id, { onDelete: "cascade" }),
    personId: uuid("person_id").notNull().references(() => hrPersons.id),

    // Person snapshot
    personName: text("person_name").notNull(),
    employmentType: text("employment_type").notNull(),

    // Earnings
    grossSalary: numeric("gross_salary", { precision: 15, scale: 2 }).default("0"),
    overtime: numeric("overtime", { precision: 15, scale: 2 }).default("0"),
    bonus: numeric("bonus", { precision: 15, scale: 2 }).default("0"),
    allowances: numeric("allowances", { precision: 15, scale: 2 }).default("0"),

    // Deductions
    incomeTax: numeric("income_tax", { precision: 15, scale: 2 }).default("0"),
    socialSecurity: numeric("social_security", { precision: 15, scale: 2 }).default("0"),
    pension: numeric("pension", { precision: 15, scale: 2 }).default("0"),
    healthInsurance: numeric("health_insurance", { precision: 15, scale: 2 }).default("0"),
    otherDeductions: numeric("other_deductions", { precision: 15, scale: 2 }).default("0"),

    // Totals
    totalGross: numeric("total_gross", { precision: 15, scale: 2 }).default("0"),
    totalDeductions: numeric("total_deductions", { precision: 15, scale: 2 }).default("0"),
    netPay: numeric("net_pay", { precision: 15, scale: 2 }).default("0"),

    // AI Compliance Check
    aiAnalyzed: boolean("ai_analyzed").default(false),
    aiSuggestions: jsonb("ai_suggestions").$type<Record<string, unknown>>(),
    complianceIssues: jsonb("compliance_issues").$type<Record<string, unknown>>(),

    // Notes
    notes: text("notes"),

    // Audit
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenant: index("hr_payroll_lines_tenant_idx").on(t.tenantId),
    idxRun: index("hr_payroll_lines_run_idx").on(t.payrollRunId),
    idxPerson: index("hr_payroll_lines_person_idx").on(t.personId),
  })
);

/**
 * HR Performance Reviews - Performance reviews with dual acceptance locking
 */
export const hrPerformanceReviews = pgTable(
  "hr_performance_reviews",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Who is being reviewed
    personId: uuid("person_id").notNull().references(() => hrPersons.id),
    personName: text("person_name").notNull(),

    // Who is reviewing
    reviewerId: uuid("reviewer_id").references(() => users.id),
    reviewerName: text("reviewer_name"),

    // Period
    reviewPeriodStart: date("review_period_start").notNull(),
    reviewPeriodEnd: date("review_period_end").notNull(),
    reviewDate: date("review_date").default(sql`CURRENT_DATE`),

    // Review Content
    strengths: text("strengths"),
    areasForImprovement: text("areas_for_improvement"),
    goalsSet: text("goals_set"),
    overallRating: text("overall_rating"), // outstanding, exceeds_expectations, meets_expectations, needs_improvement, unsatisfactory

    // Comments
    reviewerComments: text("reviewer_comments"),
    employeeComments: text("employee_comments"),

    // Status & Acceptance
    status: text("status").default("draft"), // draft, submitted, acknowledged, completed
    reviewerAccepted: boolean("reviewer_accepted").default(false),
    reviewerAcceptedAt: timestamp("reviewer_accepted_at", { withTimezone: true }),
    employeeAccepted: boolean("employee_accepted").default(false),
    employeeAcceptedAt: timestamp("employee_accepted_at", { withTimezone: true }),

    // Note: is_locked is computed as (reviewer_accepted AND employee_accepted)
    // We'll handle this in application logic since Drizzle doesn't support generated columns

    // Notes
    privateNotes: text("private_notes"), // Only visible to reviewer and HR

    // Audit
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => actors.id),
    updatedBy: uuid("updated_by").references(() => actors.id),
  },
  (t) => ({
    idxTenant: index("hr_performance_reviews_tenant_idx").on(t.tenantId),
    idxPerson: index("hr_performance_reviews_person_idx").on(t.personId),
    idxStatus: index("hr_performance_reviews_status_idx").on(t.tenantId, t.status),
  })
);

// Type exports for HR Remodel 2
export type HrPerson = typeof hrPersons.$inferSelect;
export type NewHrPerson = typeof hrPersons.$inferInsert;
export type HrPayrollRun = typeof hrPayrollRuns.$inferSelect;
export type NewHrPayrollRun = typeof hrPayrollRuns.$inferInsert;
export type HrPayrollLine = typeof hrPayrollLines.$inferSelect;
export type NewHrPayrollLine = typeof hrPayrollLines.$inferInsert;
export type HrPerformanceReview = typeof hrPerformanceReviews.$inferSelect;
export type NewHrPerformanceReview = typeof hrPerformanceReviews.$inferInsert;

/* =============================================================================
   OPERATIONS REMODEL - NEW TABLES
   ============================================================================= */

/**
 * Offices - Physical or virtual office locations
 */
export const officeType = pgEnum("office_type", ["physical", "virtual", "hybrid"]);
export const officeStatus = pgEnum("office_status", ["active", "inactive", "closed"]);

export const offices = pgTable(
  "offices",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Basic Info
    code: text("code").notNull(),
    name: text("name").notNull(),
    type: officeType("type").notNull().default("physical"),
    status: officeStatus("status").notNull().default("active"),

    // Address
    address: text("address"),
    city: text("city"),
    state: text("state"),
    postalCode: text("postal_code"),
    country: text("country"),

    // Capacity
    capacity: integer("capacity"), // number of seats/desks
    currentOccupancy: integer("current_occupancy").default(0),

    // Management
    managerId: uuid("manager_id").references(() => users.id),

    // Financials
    monthlyCost: numeric("monthly_cost", { precision: 15, scale: 2 }),
    currency: text("currency").default("USD"),

    // Lease Info
    leaseStartDate: date("lease_start_date"),
    leaseEndDate: date("lease_end_date"),

    // Metadata
    metadata: jsonb("metadata").default({}),

    // Audit
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => actors.id),
  },
  (t) => ({
    idxTenant: index("offices_tenant_idx").on(t.tenantId),
    idxStatus: index("offices_status_idx").on(t.tenantId, t.status),
    uniqCode: uniqueIndex("offices_tenant_code_uniq").on(t.tenantId, t.code),
  })
);

/**
 * Office Assets - Linking table between offices and assets
 */
export const officeAssets = pgTable(
  "office_assets",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    officeId: uuid("office_id").notNull().references(() => offices.id),
    itemId: uuid("item_id").notNull().references(() => items.id), // references items table for assets

    // Assignment Info
    assignedDate: date("assigned_date").notNull().default(sql`CURRENT_DATE`),
    removedDate: date("removed_date"),

    // Status
    isActive: boolean("is_active").notNull().default(true),

    // Notes
    notes: text("notes"),

    // Audit
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => actors.id),
  },
  (t) => ({
    idxTenant: index("office_assets_tenant_idx").on(t.tenantId),
    idxOffice: index("office_assets_office_idx").on(t.officeId),
    idxItem: index("office_assets_item_idx").on(t.itemId),
  })
);

/**
 * Asset Transfers - Track asset location and assignment changes
 */
export const assetTransferType = pgEnum("asset_transfer_type", [
  "location_change",
  "assignment_change",
  "location_and_assignment",
]);
export const assetCondition = pgEnum("asset_condition", [
  "excellent",
  "good",
  "fair",
  "poor",
  "needs_repair",
]);

export const assetTransfers = pgTable(
  "asset_transfers",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Asset being transferred
    itemId: uuid("item_id").notNull().references(() => items.id),

    // Transfer Type
    transferType: assetTransferType("transfer_type").notNull(),

    // From Location
    fromLocationType: text("from_location_type"), // warehouse, office
    fromLocationId: uuid("from_location_id"),
    fromAssigneeId: uuid("from_assignee_id").references(() => users.id),

    // To Location
    toLocationType: text("to_location_type"), // warehouse, office
    toLocationId: uuid("to_location_id"),
    toAssigneeId: uuid("to_assignee_id").references(() => users.id),

    // Transfer Details
    transferDate: date("transfer_date").notNull().default(sql`CURRENT_DATE`),
    transferReason: text("transfer_reason"), // employee_transfer, department_change, workspace_reorganization, repair_maintenance, other
    condition: assetCondition("condition"),

    // Approval
    approvedBy: uuid("approved_by").notNull().references(() => users.id),

    // Notes & Metadata
    notes: text("notes"),
    metadata: jsonb("metadata").default({}),

    // Audit
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").notNull().references(() => actors.id),
  },
  (t) => ({
    idxTenant: index("asset_transfers_tenant_idx").on(t.tenantId),
    idxItem: index("asset_transfers_item_idx").on(t.itemId),
    idxDate: index("asset_transfers_date_idx").on(t.tenantId, t.transferDate),
  })
);

/**
 * Asset Maintenance Schedules - Schedule and track asset maintenance
 */
export const maintenanceType = pgEnum("maintenance_type", [
  "preventive",
  "corrective",
  "emergency",
  "inspection",
]);
export const maintenancePriority = pgEnum("maintenance_priority", [
  "low",
  "medium",
  "high",
  "critical",
]);
export const maintenanceStatus = pgEnum("maintenance_status", [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
  "overdue",
]);

export const assetMaintenanceSchedules = pgTable(
  "asset_maintenance_schedules",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Asset
    itemId: uuid("item_id").notNull().references(() => items.id),

    // Maintenance Info
    maintenanceType: maintenanceType("maintenance_type").notNull(),
    priority: maintenancePriority("priority").notNull().default("medium"),
    status: maintenanceStatus("status").notNull().default("scheduled"),

    // Schedule
    scheduledDate: date("scheduled_date").notNull(),
    completedDate: date("completed_date"),

    // Duration
    estimatedDuration: integer("estimated_duration"), // hours
    actualDuration: integer("actual_duration"),

    // Assignment
    assignedToId: uuid("assigned_to_id").references(() => users.id), // person or contractor

    // Description & Notes
    description: text("description").notNull(),
    workPerformed: text("work_performed"),
    notes: text("notes"),

    // Parts & Cost
    requiredParts: jsonb("required_parts").default([]), // array of item IDs
    estimatedCost: numeric("estimated_cost", { precision: 15, scale: 2 }),
    actualCost: numeric("actual_cost", { precision: 15, scale: 2 }),

    // Audit
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => actors.id),
  },
  (t) => ({
    idxTenant: index("asset_maintenance_tenant_idx").on(t.tenantId),
    idxItem: index("asset_maintenance_item_idx").on(t.itemId),
    idxStatus: index("asset_maintenance_status_idx").on(t.tenantId, t.status),
    idxScheduled: index("asset_maintenance_scheduled_idx").on(t.tenantId, t.scheduledDate),
  })
);

// Type exports for Operations Remodel
export type Office = typeof offices.$inferSelect;
export type NewOffice = typeof offices.$inferInsert;
export type OfficeAsset = typeof officeAssets.$inferSelect;
export type NewOfficeAsset = typeof officeAssets.$inferInsert;
export type AssetTransfer = typeof assetTransfers.$inferSelect;
export type NewAssetTransfer = typeof assetTransfers.$inferInsert;
export type AssetMaintenanceSchedule = typeof assetMaintenanceSchedules.$inferSelect;
export type NewAssetMaintenanceSchedule = typeof assetMaintenanceSchedules.$inferInsert;

/* ============================================================================
   SALES & CUSTOMERS MODULE - Activity Recording & Customer Health
   ============================================================================ */

// Activity type enum for classification
export const salesActivityType = pgEnum("sales_activity_type", [
  "phone_call",
  "email_sent",
  "email_received",
  "meeting",
  "site_visit",
  "quote_sent",
  "quote_followed_up",
  "order_received",
  "order_confirmed",
  "delivery_scheduled",
  "delivery_completed",
  "payment_reminder_sent",
  "customer_issue",
  "deal_won",
  "deal_lost",
  "note",
]);

// Activity outcome enum
export const activityOutcome = pgEnum("activity_outcome", [
  "connected_successful",
  "connected_needs_followup",
  "voicemail",
  "no_answer",
  "wrong_number",
  "very_positive",
  "positive",
  "neutral",
  "negative",
  "resolved",
  "escalated",
  "investigating",
  "pending_followup",
]);

// Risk level enum for customer health
export const riskLevel = pgEnum("risk_level", [
  "low",
  "medium",
  "high",
  "critical",
]);

// Score trend enum
export const scoreTrend = pgEnum("score_trend", [
  "improving",
  "stable",
  "declining",
]);

/**
 * Sales Activities - Log all customer interactions
 * Every call, meeting, email, issue, etc. is recorded here
 */
export const salesActivities = pgTable(
  "sales_activities",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Activity classification
    activityType: salesActivityType("activity_type").notNull(),
    activityDate: timestamp("activity_date", { withTimezone: true }).notNull().defaultNow(),

    // Related entities
    personId: uuid("person_id").references(() => people.id),
    customerId: uuid("customer_id").references(() => parties.id),
    leadId: uuid("lead_id").references(() => leads.id),
    salesDocId: uuid("sales_doc_id").references(() => salesDocs.id),

    // Activity details
    outcome: activityOutcome("outcome"),
    durationMinutes: integer("duration_minutes"),

    // Discussion/content
    discussionPoints: jsonb("discussion_points").$type<string[]>().default([]),
    notes: text("notes"),
    internalNotes: text("internal_notes"),

    // Commitments
    ourCommitments: jsonb("our_commitments").$type<Array<{ commitment: string; dueDate: string }>>().default([]),
    theirCommitments: jsonb("their_commitments").$type<Array<{ commitment: string; dueDate: string }>>().default([]),

    // Follow-up
    nextAction: text("next_action"),
    followUpDate: date("follow_up_date"),
    followUpNote: text("follow_up_note"),

    // Metadata & attachments
    metadata: jsonb("metadata").default({}),
    attachments: jsonb("attachments").$type<Array<{ documentId: string; filename: string; url: string }>>().default([]),

    // Audit
    performedByActorId: uuid("performed_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenant: index("sales_activities_tenant_idx").on(t.tenantId),
    idxType: index("sales_activities_type_idx").on(t.tenantId, t.activityType),
    idxPerson: index("sales_activities_person_idx").on(t.personId),
    idxCustomer: index("sales_activities_customer_idx").on(t.customerId),
    idxLead: index("sales_activities_lead_idx").on(t.leadId),
    idxSalesDoc: index("sales_activities_sales_doc_idx").on(t.salesDocId),
    idxDate: index("sales_activities_date_idx").on(t.tenantId, t.activityDate),
    idxFollowUp: index("sales_activities_follow_up_idx").on(t.tenantId, t.followUpDate),
  })
);

/**
 * Customer Health Scores - Track customer engagement and risk
 * Calculated based on payment history, activity, orders, growth, issues
 */
export const customerHealthScores = pgTable(
  "customer_health_scores",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    customerId: uuid("customer_id").notNull().references(() => parties.id),

    // Score components (0-100 each)
    paymentScore: integer("payment_score").default(50),
    engagementScore: integer("engagement_score").default(50),
    orderFrequencyScore: integer("order_frequency_score").default(50),
    growthScore: integer("growth_score").default(50),
    issueScore: integer("issue_score").default(100),

    // Calculated overall
    overallScore: integer("overall_score").default(50),
    trend: scoreTrend("score_trend").default("stable"),

    // Risk flags
    riskLevelValue: riskLevel("risk_level").default("low"),
    riskFactors: jsonb("risk_factors").$type<string[]>().default([]),

    // Metrics
    totalOrders: integer("total_orders").default(0),
    totalRevenue: numeric("total_revenue", { precision: 15, scale: 2 }).default("0"),
    averageOrderValue: numeric("average_order_value", { precision: 15, scale: 2 }).default("0"),
    daysSinceLastOrder: integer("days_since_last_order"),
    paymentDelayDaysAvg: integer("payment_delay_days_avg").default(0),
    issueCount30d: integer("issue_count_30d").default(0),

    // Timestamps
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqCustomer: uniqueIndex("customer_health_scores_tenant_customer_uniq").on(t.tenantId, t.customerId),
    idxTenant: index("customer_health_scores_tenant_idx").on(t.tenantId),
    idxScore: index("customer_health_scores_score_idx").on(t.tenantId, t.overallScore),
    idxRisk: index("customer_health_scores_risk_idx").on(t.tenantId, t.riskLevelValue),
  })
);

/**
 * AI Sales Task Priority
 */
export const aiSalesTaskPriority = pgEnum("ai_sales_task_priority", ["low", "medium", "high", "critical"]);

/**
 * AI Sales Task Status
 */
export const aiSalesTaskStatus = pgEnum("ai_sales_task_status", ["pending", "in_progress", "completed", "dismissed", "snoozed"]);

/**
 * AI Sales Task Type
 */
export const aiSalesTaskType = pgEnum("ai_sales_task_type", [
  "follow_up_lead",           // Lead hasn't been contacted in X days
  "follow_up_quote",          // Quote sent but no response
  "follow_up_customer",       // Customer hasn't ordered in X days
  "payment_reminder",         // Invoice overdue
  "at_risk_customer",         // Customer health score declining
  "hot_lead",                 // High-value lead needs attention
  "quote_expiring",           // Quote about to expire
  "reactivate_customer",      // Dormant customer with past orders
  "upsell_opportunity",       // Customer might benefit from additional products
  "churn_prevention",         // Customer showing signs of leaving
]);

/**
 * AI Sales Tasks - AI-generated tasks to help improve sales
 * Generated by daily AI scan of sales data
 */
export const aiSalesTasks = pgTable(
  "ai_sales_tasks",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Task classification
    taskType: aiSalesTaskType("task_type").notNull(),
    priority: aiSalesTaskPriority("priority").notNull().default("medium"),
    status: aiSalesTaskStatus("status").notNull().default("pending"),

    // Task content
    title: text("title").notNull(),
    description: text("description").notNull(),
    aiRationale: text("ai_rationale"), // Why AI thinks this is important

    // Related entities
    customerId: uuid("customer_id").references(() => parties.id),
    leadId: uuid("lead_id").references(() => leads.id),
    salesDocId: uuid("sales_doc_id").references(() => salesDocs.id),
    personId: uuid("person_id").references(() => people.id),

    // Suggested actions
    suggestedActions: jsonb("suggested_actions").$type<Array<{
      action: string;
      type: "call" | "email" | "meeting" | "quote" | "reminder" | "other";
    }>>().default([]),

    // Financial impact
    potentialValue: numeric("potential_value", { precision: 15, scale: 2 }),
    riskLevel: riskLevel("risk_level"),

    // Due date and reminders
    dueDate: date("due_date"),
    snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),

    // Completion tracking
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedByActorId: uuid("completed_by_actor_id").references(() => actors.id),
    completionNote: text("completion_note"),

    // AI scan metadata
    lastScanId: text("last_scan_id"), // ID of the AI scan that created/updated this
    scanScore: integer("scan_score"), // AI confidence score 0-100

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenant: index("ai_sales_tasks_tenant_idx").on(t.tenantId),
    idxStatus: index("ai_sales_tasks_status_idx").on(t.tenantId, t.status),
    idxPriority: index("ai_sales_tasks_priority_idx").on(t.tenantId, t.priority),
    idxType: index("ai_sales_tasks_type_idx").on(t.tenantId, t.taskType),
    idxCustomer: index("ai_sales_tasks_customer_idx").on(t.customerId),
    idxLead: index("ai_sales_tasks_lead_idx").on(t.leadId),
    idxSalesDoc: index("ai_sales_tasks_sales_doc_idx").on(t.salesDocId),
    idxDueDate: index("ai_sales_tasks_due_date_idx").on(t.tenantId, t.dueDate),
    // Unique constraint to prevent duplicate tasks for same entity
    uniqEntityTask: uniqueIndex("ai_sales_tasks_entity_uniq").on(t.tenantId, t.taskType, t.customerId, t.leadId, t.salesDocId),
  })
);

/**
 * AI Sales Scan Log - Track when AI scans run
 */
export const aiSalesScanLogs = pgTable(
  "ai_sales_scan_logs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),

    // Scan metadata
    scanId: text("scan_id").notNull(), // Unique scan identifier
    triggerType: text("trigger_type").notNull(), // "scheduled" | "manual" | "webhook"

    // Results
    tasksCreated: integer("tasks_created").notNull().default(0),
    tasksUpdated: integer("tasks_updated").notNull().default(0),
    tasksClosed: integer("tasks_closed").notNull().default(0),

    // Processing details
    entitiesScanned: jsonb("entities_scanned").$type<{
      customers: number;
      leads: number;
      quotes: number;
      invoices: number;
    }>().default({ customers: 0, leads: 0, quotes: 0, invoices: 0 }),

    // Status
    status: text("status").notNull().default("running"), // "running" | "completed" | "failed"
    errorMessage: text("error_message"),

    // Timestamps
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    idxTenant: index("ai_sales_scan_logs_tenant_idx").on(t.tenantId),
    idxScanId: uniqueIndex("ai_sales_scan_logs_scan_id_uniq").on(t.scanId),
  })
);

// Type exports for Sales & Customers Module
export type SalesActivity = typeof salesActivities.$inferSelect;
export type NewSalesActivity = typeof salesActivities.$inferInsert;
export type CustomerHealthScore = typeof customerHealthScores.$inferSelect;
export type NewCustomerHealthScore = typeof customerHealthScores.$inferInsert;
export type AISalesTask = typeof aiSalesTasks.$inferSelect;
export type NewAISalesTask = typeof aiSalesTasks.$inferInsert;
export type AISalesScanLog = typeof aiSalesScanLogs.$inferSelect;
export type NewAISalesScanLog = typeof aiSalesScanLogs.$inferInsert;
