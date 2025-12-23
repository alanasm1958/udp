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
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/* Enums */
export const actorType = pgEnum("actor_type", ["user", "system", "connector"]);
export const transactionSetStatus = pgEnum("transaction_set_status", ["draft", "review", "posted"]);
export const approvalStatus = pgEnum("approval_status", ["pending", "approved", "rejected"]);
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

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("open"), // open, in_progress, completed, cancelled
  priority: text("priority").notNull().default("normal"), // low, normal, high, urgent
  assigneeUserId: uuid("assignee_user_id").references(() => users.id),
  createdByActorId: uuid("created_by_actor_id").notNull().references(() => actors.id),
  dueAt: timestamp("due_at", { withTimezone: true }),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: uuid("related_entity_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

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

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  type: text("type").notNull(),
  severity: text("severity").notNull(), // info, warning, critical
  message: text("message").notNull(),
  status: text("status").notNull().default("active"), // active, acknowledged, resolved, dismissed
  source: text("source").notNull(), // system, ai, connector
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: uuid("related_entity_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
