/**
 * Audit logging
 * All significant actions must be recorded in audit_events.
 *
 * Uses convention-based action format: "${entity}_${verb}"
 * e.g. "payment_created", "journal_entry_posted", "user_deactivated"
 */

import { db } from "@/db";
import { auditEvents } from "@/db/schema";

/**
 * Valid audit action verbs.
 * Actions follow the pattern: `${entity}_${verb}`
 */
const VALID_VERBS = new Set([
  "created",
  "updated",
  "deleted",
  "posted",
  "voided",
  "reversed",
  "submitted",
  "approved",
  "rejected",
  "cancelled",
  "completed",
  "drafted",
  "uploaded",
  "linked",
  "saved",
  "requested",
  "decided",
  "changed",
  "dismissed",
  "recorded",
  "adjusted",
  "added",
  "deactivated",
  "activated",
  "terminated",
  "ended",
  "calculated",
  "generated",
  "connected",
  "disconnected",
  "initiated",
  "verified",
  "expired",
  "imported",
  "removed",
  "acknowledged",
  "tagged",
  "untagged",
  "unallocated",
  "reopened",
  "discontinued",
  "paid",
] as const);

/**
 * AuditAction is a branded string type following the convention: "${entity}_${verb}"
 * This allows any entity name combined with a valid verb, eliminating the need
 * to manually maintain a 160+ entry union type.
 */
export type AuditAction = string & { readonly __brand?: "AuditAction" };

/**
 * Validate that an audit action follows the convention pattern.
 * Returns true if the action ends with a valid verb.
 */
export function isValidAuditAction(action: string): action is AuditAction {
  const parts = action.split("_");
  if (parts.length < 2) return false;
  const verb = parts[parts.length - 1];
  return VALID_VERBS.has(verb as typeof VALID_VERBS extends Set<infer T> ? T : never);
}

/**
 * Create a type-safe audit action string.
 * Validates at runtime that the action follows the convention.
 */
export function auditAction(action: string): AuditAction {
  if (!isValidAuditAction(action)) {
    const verb = action.split("_").pop();
    throw new Error(
      `Invalid audit action "${action}": verb "${verb}" is not recognized. ` +
      `Valid verbs: ${[...VALID_VERBS].join(", ")}`
    );
  }
  return action;
}

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
 * Helper to create audit context for scoped logging.
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
