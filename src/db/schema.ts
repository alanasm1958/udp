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
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  baseCurrency: text("base_currency").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  storageKey: text("storage_key").notNull(),
  sha256: text("sha256").notNull(),
  mimeType: text("mime_type").notNull(),
  originalFilename: text("original_filename").notNull(),
  uploadedByActorId: uuid("uploaded_by_actor_id").notNull().references(() => actors.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqCode: uniqueIndex("parties_tenant_code_uniq").on(t.tenantId, t.code),
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
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqDocNumber: uniqueIndex("sales_docs_tenant_docnumber_uniq").on(t.tenantId, t.docNumber),
    idxParty: index("sales_docs_tenant_party_idx").on(t.tenantId, t.partyId),
    idxStatus: index("sales_docs_tenant_status_idx").on(t.tenantId, t.status),
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
    // Audit
    createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTenantStatus: index("leads_tenant_status_idx").on(t.tenantId, t.status),
    idxTenantAssignee: index("leads_tenant_assignee_idx").on(t.tenantId, t.assignedToUserId),
    idxTenantParty: index("leads_tenant_party_idx").on(t.tenantId, t.partyId),
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
  "link_person_to_user",       // Overlap detected between Person and User
  "merge_duplicate_people",    // Duplicate people records detected
  "complete_quick_add",        // Quick-add record needs completion
  "assign_item_to_warehouse",  // Item needs initial warehouse assignment
  "approve_purchase_variance", // Price variance exceeds threshold
  "low_stock_reorder",         // Suggest reorder for low stock
  "service_job_unassigned",    // Service job needs assignment
  "service_job_overdue",       // Service job past acknowledgement window
  "supplier_delay_impact",     // Supplier delay impacts sales/service jobs
  "review_substitution",       // Supplier substitution needs confirmation
  "landed_cost_allocation",    // Landed costs need allocation
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
