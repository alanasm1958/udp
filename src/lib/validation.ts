/**
 * Validation skeleton
 * Creates validation_issues for draft data.
 */

import { db } from "@/db";
import { validationIssues, approvals } from "@/db/schema";
import { isTenantAdmin } from "./actor";

export type IssueSeverity = "error" | "warning" | "info";

export interface ValidationIssueInput {
  tenantId: string;
  entityType: string;
  entityId: string;
  fieldPath: string;
  severity: IssueSeverity;
  message: string;
  createdByActorId: string;
}

export interface CreatedValidationIssue {
  id: string;
  severity: IssueSeverity;
  fieldPath: string;
  message: string;
  status: string;
}

/**
 * Create validation issues in the database.
 */
export async function createValidationIssues(
  issues: ValidationIssueInput[]
): Promise<CreatedValidationIssue[]> {
  if (issues.length === 0) return [];

  const result = await db
    .insert(validationIssues)
    .values(
      issues.map((issue) => ({
        tenantId: issue.tenantId,
        entityType: issue.entityType,
        entityId: issue.entityId,
        fieldPath: issue.fieldPath,
        severity: issue.severity,
        message: issue.message,
        status: "open",
        createdByActorId: issue.createdByActorId,
      }))
    )
    .returning({
      id: validationIssues.id,
      severity: validationIssues.severity,
      fieldPath: validationIssues.fieldPath,
      message: validationIssues.message,
      status: validationIssues.status,
    });

  return result.map((r) => ({
    id: r.id,
    severity: r.severity as IssueSeverity,
    fieldPath: r.fieldPath ?? "",
    message: r.message,
    status: r.status,
  }));
}

export interface TransactionLineInput {
  description: string;
  quantity?: string | number;
  unitPrice?: string | number;
  amount?: string | number;
  metadata?: Record<string, unknown>;
}

export interface TransactionInput {
  type: string;
  occurredOn?: string;
  memo?: string;
  lines?: TransactionLineInput[];
}

export interface DraftValidationInput {
  tenantId: string;
  actorId: string;
  transactionSetId: string;
  transactions: TransactionInput[];
  hasDocument: boolean;
}

/**
 * Validate draft data and create validation issues.
 * Returns the created issues.
 */
export async function validateDraft(
  input: DraftValidationInput
): Promise<CreatedValidationIssue[]> {
  const issues: ValidationIssueInput[] = [];

  // Rule 1: If transactions exist and no document, create error issue
  if (input.transactions.length > 0 && !input.hasDocument) {
    issues.push({
      tenantId: input.tenantId,
      entityType: "transaction_set",
      entityId: input.transactionSetId,
      fieldPath: "document",
      severity: "error",
      message: "Missing supporting document",
      createdByActorId: input.actorId,
    });
  }

  // Rule 2: Check amount = quantity * unitPrice for each line
  input.transactions.forEach((tx, txIndex) => {
    tx.lines?.forEach((line, lineIndex) => {
      const quantity = parseNumeric(line.quantity);
      const unitPrice = parseNumeric(line.unitPrice);
      const amount = parseNumeric(line.amount);

      // Only check if quantity and unitPrice are both provided and non-zero
      if (quantity !== 0 && unitPrice !== 0) {
        const expectedAmount = quantity * unitPrice;
        // Use tolerance for floating point comparison
        if (Math.abs(expectedAmount - amount) > 0.000001) {
          issues.push({
            tenantId: input.tenantId,
            entityType: "transaction_set",
            entityId: input.transactionSetId,
            fieldPath: `transactions[${txIndex}].lines[${lineIndex}].amount`,
            severity: "warning",
            message: `Amount does not match quantity*unitPrice (expected ${expectedAmount.toFixed(6)}, got ${amount.toFixed(6)})`,
            createdByActorId: input.actorId,
          });
        }
      }
    });
  });

  return createValidationIssues(issues);
}

/**
 * Parse a numeric value from string or number input.
 */
function parseNumeric(value: string | number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") return value;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Check if escalation is required and create approval if needed.
 * Escalation is required when:
 * - There is at least one error-severity issue
 * - User is not a Tenant Admin
 * - x-user-id was provided (we know who the user is)
 */
export async function checkEscalation(
  tenantId: string,
  userId: string | null,
  transactionSetId: string,
  issues: CreatedValidationIssue[]
): Promise<string | null> {
  // If no user ID provided, skip escalation
  if (!userId) return null;

  // Check if there are any error-severity issues
  const hasErrors = issues.some((issue) => issue.severity === "error");
  if (!hasErrors) return null;

  // Check if user is Tenant Admin
  const isAdmin = await isTenantAdmin(tenantId, userId);
  if (isAdmin) return null;

  // Create approval request
  const result = await db
    .insert(approvals)
    .values({
      tenantId,
      entityType: "transaction_set",
      entityId: transactionSetId,
      requiredRoleName: "Tenant Admin",
      status: "pending",
    })
    .returning({ id: approvals.id });

  return result[0].id;
}
