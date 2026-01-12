/**
 * GRC MODULE - DRIZZLE SCHEMA
 * Requirements-driven compliance management
 */

import { pgTable, uuid, varchar, text, decimal, integer, boolean, timestamp, date, jsonb, inet, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants, users, documents } from './schema';

// ============================================================================
// ENUMS
// ============================================================================

export const requirementStatusEnum = pgEnum('requirement_status', [
  'satisfied',
  'unsatisfied',
  'at_risk',
  'unknown'
]);

export const riskLevelEnum = pgEnum('risk_level', [
  'low',
  'medium',
  'high',
  'critical'
]);

export const requirementCategoryEnum = pgEnum('requirement_category', [
  'tax',
  'labor',
  'licensing',
  'environmental',
  'data_privacy',
  'financial',
  'health_safety',
  'insurance',
  'corporate_governance'
]);

export const taskStatusEnum = pgEnum('task_status', [
  'open',
  'blocked',
  'completed'
]);

export const alertStatusEnum = pgEnum('alert_status', [
  'active',
  'resolved'
]);

export const alertSeverityEnum = pgEnum('alert_severity', [
  'info',
  'warning',
  'critical'
]);

export const licenseStatusEnum = pgEnum('license_status', [
  'active',
  'expired',
  'suspended',
  'pending_renewal',
  'cancelled'
]);

export const taxFilingStatusEnum = pgEnum('tax_filing_status', [
  'pending',
  'filed',
  'paid',
  'overdue',
  'amended'
]);

// ============================================================================
// TABLES
// ============================================================================

// Business Profile
export const businessProfiles = pgTable('business_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  
  // Legal Identity
  legalName: varchar('legal_name', { length: 500 }).notNull(),
  tradeName: varchar('trade_name', { length: 500 }),
  legalStructure: varchar('legal_structure', { length: 100 }),
  incorporationDate: date('incorporation_date'),
  jurisdiction: varchar('jurisdiction', { length: 100 }),
  taxId: varchar('tax_id', { length: 100 }),
  
  // Operational Details
  primaryIndustry: varchar('primary_industry', { length: 200 }),
  naicsCodes: text('naics_codes').array(),
  businessDescription: text('business_description'),
  annualRevenue: decimal('annual_revenue', { precision: 15, scale: 2 }),
  employeeCount: integer('employee_count'),
  
  // Locations
  headquartersAddress: jsonb('headquarters_address'),
  operatingLocations: jsonb('operating_locations').array(),
  
  // Activities
  businessActivities: text('business_activities').array(),
  licensesHeld: text('licenses_held').array(),
  regulatedActivities: text('regulated_activities').array(),
  
  // AI Analysis
  aiAnalysis: jsonb('ai_analysis'),
  confidenceScore: decimal('confidence_score', { precision: 3, scale: 2 }),
  lastAnalyzedAt: timestamp('last_analyzed_at'),
  
  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
  updatedBy: uuid('updated_by').references(() => users.id),
}, (table) => ({
  tenantIdx: index('idx_business_profiles_tenant').on(table.tenantId),
}));

// GRC Requirements (Source of Truth)
export const grcRequirements = pgTable('grc_requirements', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  
  // Identification
  requirementCode: varchar('requirement_code', { length: 100 }).notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  category: requirementCategoryEnum('category').notNull(),
  
  // Applicability Rules
  appliesToJurisdictions: text('applies_to_jurisdictions').array(),
  appliesToIndustries: text('applies_to_industries').array(),
  appliesToActivities: text('applies_to_activities').array(),
  appliesToStructure: text('applies_to_structure').array(),
  thresholdRules: jsonb('threshold_rules'),
  
  // Status & Risk
  status: requirementStatusEnum('status').notNull().default('unknown'),
  riskLevel: riskLevelEnum('risk_level').notNull().default('medium'),
  priority: integer('priority').default(5),
  
  // Closure Criteria (Deterministic)
  closureCriteria: jsonb('closure_criteria').notNull(),
  
  // Evidence
  evidenceDocuments: uuid('evidence_documents').array(),
  evidenceData: jsonb('evidence_data'),
  evidenceUpdatedAt: timestamp('evidence_updated_at'),
  
  // AI Narrative
  aiExplanation: text('ai_explanation'),
  aiInterpretation: jsonb('ai_interpretation'),
  aiConfidence: decimal('ai_confidence', { precision: 3, scale: 2 }),
  
  // Compliance Tracking
  satisfiedAt: timestamp('satisfied_at'),
  expiresAt: timestamp('expires_at'),
  nextActionDue: date('next_action_due'),
  
  // Metadata
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
  updatedBy: uuid('updated_by').references(() => users.id),
}, (table) => ({
  tenantIdx: index('idx_grc_requirements_tenant').on(table.tenantId),
  statusIdx: index('idx_grc_requirements_status').on(table.tenantId, table.status),
  riskIdx: index('idx_grc_requirements_risk').on(table.tenantId, table.riskLevel),
  categoryIdx: index('idx_grc_requirements_category').on(table.tenantId, table.category),
  uniqueCode: uniqueIndex('unique_requirement_code').on(table.tenantId, table.requirementCode),
}));

// Requirement Evaluation History
export const grcRequirementEvaluations = pgTable('grc_requirement_evaluations', {
  id: uuid('id').defaultRandom().primaryKey(),
  requirementId: uuid('requirement_id').notNull().references(() => grcRequirements.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  
  // Evaluation Context
  triggeredBy: varchar('triggered_by', { length: 100 }),
  triggerSourceId: uuid('trigger_source_id'),
  
  // Input State
  businessProfileSnapshot: jsonb('business_profile_snapshot'),
  evidenceSnapshot: jsonb('evidence_snapshot'),
  
  // AI Analysis
  aiFindings: jsonb('ai_findings'),
  aiExplanation: text('ai_explanation'),
  aiConfidence: decimal('ai_confidence', { precision: 3, scale: 2 }),
  
  // Deterministic Outcome
  previousStatus: varchar('previous_status', { length: 50 }),
  newStatus: varchar('new_status', { length: 50 }),
  previousRiskLevel: varchar('previous_risk_level', { length: 50 }),
  newRiskLevel: varchar('new_risk_level', { length: 50 }),
  closureCheckPassed: boolean('closure_check_passed'),
  closureCheckDetails: jsonb('closure_check_details'),
  
  // Metadata
  evaluatedAt: timestamp('evaluated_at').defaultNow(),
  evaluatedBy: uuid('evaluated_by').references(() => users.id),
}, (table) => ({
  requirementIdx: index('idx_grc_evaluations_requirement').on(table.requirementId),
  tenantIdx: index('idx_grc_evaluations_tenant').on(table.tenantId),
}));

// GRC Tasks (Linked to Requirements)
export const grcTasks = pgTable('grc_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  requirementId: uuid('requirement_id').notNull().references(() => grcRequirements.id, { onDelete: 'cascade' }),
  
  // Task Details
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  actionType: varchar('action_type', { length: 100 }),
  
  // Status
  status: taskStatusEnum('status').notNull().default('open'),
  blockedReason: text('blocked_reason'),
  
  // Assignment
  assignedTo: uuid('assigned_to').references(() => users.id),
  dueDate: date('due_date'),
  
  // Evidence & Feedback
  completionEvidence: jsonb('completion_evidence'),
  uploadedDocuments: uuid('uploaded_documents').array(),
  userFeedback: text('user_feedback'),
  
  // Completion (Deterministic)
  completedAt: timestamp('completed_at'),
  completedBy: uuid('completed_by').references(() => users.id),
  autoClosed: boolean('auto_closed').default(false),
  
  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
}, (table) => ({
  tenantIdx: index('idx_grc_tasks_tenant').on(table.tenantId),
  requirementIdx: index('idx_grc_tasks_requirement').on(table.requirementId),
  statusIdx: index('idx_grc_tasks_status').on(table.tenantId, table.status),
  assignedIdx: index('idx_grc_tasks_assigned').on(table.assignedTo),
}));

// GRC Alerts (Linked to Requirements)
export const grcAlerts = pgTable('grc_alerts', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  requirementId: uuid('requirement_id').notNull().references(() => grcRequirements.id, { onDelete: 'cascade' }),
  
  // Alert Details
  title: varchar('title', { length: 500 }).notNull(),
  message: text('message'),
  alertType: varchar('alert_type', { length: 100 }),
  severity: alertSeverityEnum('severity').notNull(),
  
  // Status
  status: alertStatusEnum('status').notNull().default('active'),
  
  // Resolution (Automatic)
  resolvedAt: timestamp('resolved_at'),
  autoResolved: boolean('auto_resolved').default(false),
  resolutionReason: text('resolution_reason'),
  
  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at'),
}, (table) => ({
  tenantIdx: index('idx_grc_alerts_tenant').on(table.tenantId),
  requirementIdx: index('idx_grc_alerts_requirement').on(table.requirementId),
  statusIdx: index('idx_grc_alerts_status').on(table.tenantId, table.status),
  severityIdx: index('idx_grc_alerts_severity').on(table.tenantId, table.severity),
}));

// GRC Document Links
export const grcDocumentLinks = pgTable('grc_document_links', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  requirementId: uuid('requirement_id').notNull().references(() => grcRequirements.id, { onDelete: 'cascade' }),
  documentId: uuid('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  
  // Classification
  documentType: varchar('document_type', { length: 100 }),
  validityStart: date('validity_start'),
  validityEnd: date('validity_end'),
  
  // AI Analysis
  aiExtractedData: jsonb('ai_extracted_data'),
  aiConfidence: decimal('ai_confidence', { precision: 3, scale: 2 }),
  
  // Metadata
  uploadedAt: timestamp('uploaded_at').defaultNow(),
  uploadedBy: uuid('uploaded_by').references(() => users.id),
}, (table) => ({
  requirementIdx: index('idx_grc_doc_links_requirement').on(table.requirementId),
  tenantIdx: index('idx_grc_doc_links_tenant').on(table.tenantId),
  uniqueLink: uniqueIndex('unique_requirement_document').on(table.requirementId, table.documentId),
}));

// GRC Audit Log
export const grcAuditLog = pgTable('grc_audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  
  // Event Details
  eventType: varchar('event_type', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  
  // Changes
  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),
  
  // Context
  actorId: uuid('actor_id').references(() => users.id),
  actorType: varchar('actor_type', { length: 50 }),
  reason: text('reason'),
  
  // Metadata
  occurredAt: timestamp('occurred_at').defaultNow(),
  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
}, (table) => ({
  tenantIdx: index('idx_grc_audit_tenant').on(table.tenantId),
  entityIdx: index('idx_grc_audit_entity').on(table.entityType, table.entityId),
  occurredIdx: index('idx_grc_audit_occurred').on(table.occurredAt),
}));

// Tax Filing History
export const grcTaxFilings = pgTable('grc_tax_filings', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  requirementId: uuid('requirement_id').references(() => grcRequirements.id),
  
  // Filing Details
  filingType: varchar('filing_type', { length: 100 }).notNull(),
  jurisdiction: varchar('jurisdiction', { length: 100 }).notNull(),
  taxYear: integer('tax_year'),
  taxPeriod: varchar('tax_period', { length: 50 }),
  
  // Amounts
  taxLiability: decimal('tax_liability', { precision: 15, scale: 2 }),
  taxPaid: decimal('tax_paid', { precision: 15, scale: 2 }),
  penalties: decimal('penalties', { precision: 15, scale: 2 }),
  interest: decimal('interest', { precision: 15, scale: 2 }),
  
  // Dates
  dueDate: date('due_date').notNull(),
  filedDate: date('filed_date'),
  paidDate: date('paid_date'),
  
  // Status
  status: taxFilingStatusEnum('status').notNull(),
  
  // Evidence
  filingDocuments: uuid('filing_documents').array(),
  paymentReference: varchar('payment_reference', { length: 200 }),
  
  // Metadata
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  tenantIdx: index('idx_grc_tax_filings_tenant').on(table.tenantId),
  requirementIdx: index('idx_grc_tax_filings_requirement').on(table.requirementId),
  typeIdx: index('idx_grc_tax_filings_type').on(table.tenantId, table.filingType),
  statusIdx: index('idx_grc_tax_filings_status').on(table.tenantId, table.status),
}));

// Regulatory Licenses & Permits
export const grcLicenses = pgTable('grc_licenses', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  requirementId: uuid('requirement_id').references(() => grcRequirements.id),
  
  // License Details
  licenseType: varchar('license_type', { length: 200 }).notNull(),
  licenseNumber: varchar('license_number', { length: 200 }),
  issuingAuthority: varchar('issuing_authority', { length: 200 }).notNull(),
  jurisdiction: varchar('jurisdiction', { length: 100 }),
  
  // Validity
  issueDate: date('issue_date').notNull(),
  expirationDate: date('expiration_date'),
  renewalFrequency: varchar('renewal_frequency', { length: 50 }),
  
  // Status
  status: licenseStatusEnum('status').notNull(),
  
  // Documents
  licenseDocuments: uuid('license_documents').array(),
  
  // Metadata
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  tenantIdx: index('idx_grc_licenses_tenant').on(table.tenantId),
  requirementIdx: index('idx_grc_licenses_requirement').on(table.requirementId),
  statusIdx: index('idx_grc_licenses_status').on(table.tenantId, table.status),
}));

// Compliance Calendar
export const grcComplianceCalendar = pgTable('grc_compliance_calendar', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  requirementId: uuid('requirement_id').references(() => grcRequirements.id),
  
  // Event Details
  eventType: varchar('event_type', { length: 100 }).notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  
  // Dates
  dueDate: date('due_date').notNull(),
  reminderDate: date('reminder_date'),
  completedDate: date('completed_date'),
  
  // Recurrence
  isRecurring: boolean('is_recurring').default(false),
  recurrencePattern: varchar('recurrence_pattern', { length: 50 }),
  
  // Status
  status: varchar('status', { length: 50 }).notNull(),
  
  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  tenantIdx: index('idx_grc_calendar_tenant').on(table.tenantId),
  dueIdx: index('idx_grc_calendar_due').on(table.dueDate),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const businessProfilesRelations = relations(businessProfiles, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [businessProfiles.tenantId],
    references: [tenants.id],
  }),
}));

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

// ============================================================================
// TYPES
// ============================================================================

export type BusinessProfile = typeof businessProfiles.$inferSelect;
export type NewBusinessProfile = typeof businessProfiles.$inferInsert;

export type GrcRequirement = typeof grcRequirements.$inferSelect;
export type NewGrcRequirement = typeof grcRequirements.$inferInsert;

export type GrcTask = typeof grcTasks.$inferSelect;
export type NewGrcTask = typeof grcTasks.$inferInsert;

export type GrcAlert = typeof grcAlerts.$inferSelect;
export type NewGrcAlert = typeof grcAlerts.$inferInsert;

export type GrcDocumentLink = typeof grcDocumentLinks.$inferSelect;
export type NewGrcDocumentLink = typeof grcDocumentLinks.$inferInsert;

export type GrcTaxFiling = typeof grcTaxFilings.$inferSelect;
export type NewGrcTaxFiling = typeof grcTaxFilings.$inferInsert;

export type GrcLicense = typeof grcLicenses.$inferSelect;
export type NewGrcLicense = typeof grcLicenses.$inferInsert;
