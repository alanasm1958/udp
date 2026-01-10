/**
 * Audit logging
 * All significant actions must be recorded in audit_events.
 */

import { db } from "@/db";
import { auditEvents } from "@/db/schema";

export type AuditAction =
  | "transaction_set_created"
  | "transaction_set_submitted"
  | "transaction_set_posted"
  | "business_transaction_created"
  | "document_uploaded"
  | "document_linked"
  | "document_extraction_saved"
  | "posting_intent_saved"
  | "validation_issues_created"
  | "approval_requested"
  | "approval_decided"
  | "journal_entry_created"
  | "journal_reversal_requested"
  | "journal_reversed"
  | "reversal_created"
  // Master data - Parties
  | "party_created"
  | "party_updated"
  | "party_profile_created"
  | "party_profile_updated"
  | "party_identifier_created"
  // Master data - Dimensions
  | "dimension_definition_created"
  | "dimension_value_created"
  | "dimension_value_updated"
  | "entity_dimension_tagged"
  | "entity_dimension_untagged"
  // Master data - Products and Warehouses
  | "uom_created"
  | "tax_category_created"
  | "product_created"
  | "product_updated"
  | "product_identifier_created"
  | "warehouse_created"
  | "warehouse_updated"
  | "warehouse_deleted"
  | "storage_location_created"
  // Inventory
  | "inventory_movement_drafted"
  | "inventory_movement_posted"
  | "inventory_movement_reversed"
  | "inventory_balance_updated"
  | "adjustment_created"
  | "transfer_created"
  | "receipt_created"
  | "return_created"
  | "ops_payment_created"
  // Strategy - Budgets
  | "budget_created"
  | "budget_updated"
  | "budget_version_created"
  | "budget_line_created"
  | "budget_line_updated"
  // Strategy - Objectives
  | "objective_created"
  | "objective_updated"
  // Strategy - Initiatives
  | "initiative_created"
  | "initiative_updated"
  // Strategy - KPIs
  | "kpi_definition_created"
  | "kpi_definition_updated"
  | "kpi_target_created"
  | "kpi_measurement_created"
  // Commercial - Sales
  | "sales_doc_created"
  | "sales_doc_updated"
  | "sales_doc_line_created"
  | "sales_doc_line_updated"
  // Commercial - Procurement
  | "purchase_doc_created"
  | "purchase_doc_updated"
  | "purchase_doc_line_created"
  | "purchase_doc_line_updated"
  // Commercial - Sales Fulfillment
  | "sales_fulfillment_created"
  // Commercial - Procurement Receiving
  | "purchase_receipt_created"
  // Commercial - Document Posting
  | "sales_doc_posted"
  | "purchase_doc_posted"
  // Finance - Payments
  | "payment_created"
  | "payment_updated"
  | "payment_allocation_created"
  | "payment_posted"
  | "payment_voided"
  | "payment_unallocated"
  // User management
  | "user_created"
  | "user_updated"
  | "user_deactivated"
  | "user_activated"
  | "user_roles_changed"
  // Planner
  | "planner_initiative_created"
  | "planner_initiative_updated"
  | "planner_initiative_status_changed"
  | "planner_alert_dismissed"
  // Company
  | "company_legal_profile_updated"
  | "department_created"
  | "department_updated"
  | "user_org_profile_updated"
  // Categories
  | "category_created"
  | "category_updated"
  // Tasks
  | "task_created"
  | "task_updated"
  // Settings
  | "settings_updated"
  | "finance_settings_updated"
  // AI Cards
  | "ai_card_created"
  | "ai_card_updated"
  // Sales & Customers
  | "lead_created"
  | "lead_updated"
  | "salesperson_created"
  | "salesperson_updated"
  // People
  | "person_created"
  | "person_updated"
  | "person_deactivated"
  | "person_deleted"
  | "person_linked_to_user"
  | "time_off_recorded"
  | "payroll_recorded"
  | "performance_note_added"
  // Items
  | "item_created"
  | "item_updated"
  | "item_discontinued"
  | "initial_stock_created"
  // Service Jobs
  | "service_job_created"
  | "service_job_updated"
  // AI Tasks
  | "ai_task_created"
  | "ai_task_updated"
  // Settings OAuth
  | "oauth_credentials_updated"
  | "oauth_credentials_removed"
  // Marketing
  | "marketing_channel_created"
  | "marketing_channel_updated"
  | "marketing_plan_created"
  | "marketing_plan_updated"
  | "marketing_plan_generated"
  | "marketing_plan_deleted"
  | "marketing_campaign_created"
  | "marketing_campaign_updated"
  | "marketing_scenario_created"
  // Marketing - Channel Connections
  | "oauth_initiated"
  | "oauth_connected"
  | "api_key_connected"
  | "channel_updated"
  | "channel_disconnected"
  // Finance - Additional
  | "expense_recorded"
  | "transfer_recorded"
  | "capital_recorded"
  // Payroll
  | "employee_created"
  | "employee_updated"
  | "employee_terminated"
  | "compensation_created"
  | "compensation_updated"
  | "employee_deduction_created"
  | "employee_deduction_updated"
  | "employee_deduction_ended"
  | "payroll_run_created"
  | "payroll_run_updated"
  | "payroll_run_deleted"
  | "payroll_run_calculated"
  | "payroll_run_approved"
  | "payroll_run_posted"
  | "payroll_run_voided"
  | "payroll_calculated"
  | "payroll_approved"
  | "payroll_posted"
  | "compliance_profile_created"
  | "compliance_profile_updated"
  | "tax_registration_created"
  | "tax_registration_updated"
  | "tax_filing_created"
  | "tax_deposit_created"
  | "tax_deposit_paid"
  // Performance Management
  | "performance_cycle_created"
  | "performance_cycle_updated"
  | "performance_cycle_deleted"
  | "performance_review_created"
  | "performance_review_updated"
  | "performance_goal_created"
  | "performance_goal_updated"
  // HR Documents
  | "document_verified"
  | "document_rejected"
  | "document_expired"
  // Leave Management
  | "leave_type_created"
  | "leave_type_updated"
  | "leave_request_created"
  | "leave_request_approved"
  | "leave_request_rejected"
  | "leave_request_cancelled"
  | "leave_balance_adjusted";

export interface AuditEventInput {
  tenantId: string;
  actorId: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  metadata?: Record<string, unknown>;
}

/**
 * Log a single audit event.
 */
export async function logAuditEvent(event: AuditEventInput): Promise<string> {
  const result = await db
    .insert(auditEvents)
    .values({
      tenantId: event.tenantId,
      actorId: event.actorId,
      entityType: event.entityType,
      entityId: event.entityId,
      action: event.action,
      metadata: event.metadata ?? {},
    })
    .returning({ id: auditEvents.id });

  return result[0].id;
}

/**
 * Log multiple audit events in a batch.
 */
export async function logAuditEvents(events: AuditEventInput[]): Promise<string[]> {
  if (events.length === 0) return [];

  const result = await db
    .insert(auditEvents)
    .values(
      events.map((e) => ({
        tenantId: e.tenantId,
        actorId: e.actorId,
        entityType: e.entityType,
        entityId: e.entityId,
        action: e.action,
        metadata: e.metadata ?? {},
      }))
    )
    .returning({ id: auditEvents.id });

  return result.map((r) => r.id);
}

/**
 * Helper to create audit context for the Omni draft flow.
 */
export function createAuditContext(tenantId: string, actorId: string) {
  return {
    tenantId,
    actorId,
    log: (entityType: string, entityId: string, action: AuditAction, metadata?: Record<string, unknown>) =>
      logAuditEvent({
        tenantId,
        actorId,
        entityType,
        entityId,
        action,
        metadata,
      }),
  };
}
