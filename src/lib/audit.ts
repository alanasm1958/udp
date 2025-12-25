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
  | "storage_location_created"
  // Inventory
  | "inventory_movement_drafted"
  | "inventory_movement_posted"
  | "inventory_movement_reversed"
  | "inventory_balance_updated"
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
  | "payment_voided";

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
