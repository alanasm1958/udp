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
import {
  actorType,
  transactionSetStatus,
  approvalStatus,
  partyType,
  subscriptionStatus,
  billingType,
  documentCategory,
  documentVerificationStatus,
  taskStatus,
  taskPriority,
  taskDomain,
  taskAssignedRole,
  alertSeverity,
  masterTaskCategory,
  masterTaskStatus,
  masterTaskPriority,
  masterAlertCategory,
  masterAlertStatus,
  masterAlertSeverity,
  masterAlertSource,
  categoryDomain,
  aiConversationStatus,
  aiMessageRole,
  aiToolRunStatus,
  plannerHorizon,
  plannerStatus,
  plannerPriority,
  aiTaskType,
  aiTaskStatus,
} from "./enums";

/* ============================================================================
   CORE TABLES - Tenants, Users, Roles, Sessions, Permissions, etc.
   ============================================================================ */

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
   ───────────────────────────────────────────────────────────────────────────── */

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
   AI TASKS (Confirmation-Required Suggestions)
   ============================================================================ */

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
   SUBSCRIPTION & BILLING
   ============================================================================ */

/**
 * Global subscription plans (not tenant-scoped)
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
