/**
 * Audit logging
 * All significant actions must be recorded in audit_events.
 */

import { db } from "@/db";
import { auditEvents } from "@/db/schema";

export type AuditAction =
  | "transaction_set_created"
  | "business_transaction_created"
  | "document_uploaded"
  | "document_linked"
  | "document_extraction_saved"
  | "posting_intent_saved"
  | "validation_issues_created"
  | "approval_requested"
  | "approval_decided"
  | "transaction_set_posted"
  | "journal_entry_created"
  | "reversal_created";

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
