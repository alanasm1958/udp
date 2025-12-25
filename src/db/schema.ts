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
