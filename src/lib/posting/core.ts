/**
 * Posting Service - Core Functions
 *
 * THIS IS THE ONLY MODULE ALLOWED TO WRITE TO journal_entries AND journal_lines
 * (along with the domain posting modules that import from this package).
 *
 * Core functions:
 * - postTransactionSet: Main posting function for the review workflow
 * - submitForReview: Transition draft -> review
 * - createSimpleLedgerEntry: Simplified posting for one-off transactions
 * - parseNumeric: Utility for parsing numeric values
 * - updateInventoryBalance: Utility for updating inventory balances
 */

import { db } from "@/db";
import {
  transactionSets,
  postingIntents,
  postingRuns,
  journalEntries,
  journalLines,
  accounts,
  documentLinks,
  validationIssues,
  overrides,
  approvals,
  inventoryBalances,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { logAuditEvent } from "../audit";
import { validatePeriodForPosting } from "../periods";

import type {
  PostingContext,
  PostingIntent,
  PostingResult,
  SimpleLedgerEntryInput,
  SimpleLedgerEntryResult,
} from "./types";
import { PostingError } from "./types";

/**
 * Main posting function - THE ONLY place that writes to ledger tables
 * through the standard review workflow.
 */
export async function postTransactionSet(ctx: PostingContext): Promise<PostingResult> {
  const { tenantId, actorId, transactionSetId } = ctx;

  // 1. Check for existing posting run (idempotency)
  const existingRun = await db
    .select()
    .from(postingRuns)
    .where(
      and(
        eq(postingRuns.tenantId, tenantId),
        eq(postingRuns.transactionSetId, transactionSetId)
      )
    )
    .limit(1);

  if (existingRun.length > 0) {
    const run = existingRun[0];
    if (run.status === "succeeded") {
      return {
        success: true,
        journalEntryId: run.journalEntryId ?? undefined,
        postingRunId: run.id,
      };
    }
    if (run.status === "started") {
      return {
        success: false,
        postingRunId: run.id,
        error: "Posting already in progress",
      };
    }
    // If failed, we'll create a new run below by deleting the old one
    await db
      .delete(postingRuns)
      .where(eq(postingRuns.id, run.id));
  }

  // 2. Create posting run
  const [postingRun] = await db
    .insert(postingRuns)
    .values({
      tenantId,
      transactionSetId,
      status: "started",
      startedByActorId: actorId,
    })
    .returning();

  try {
    // 3. Fetch transaction set
    const [txSet] = await db
      .select()
      .from(transactionSets)
      .where(
        and(
          eq(transactionSets.id, transactionSetId),
          eq(transactionSets.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!txSet) {
      throw new PostingError("Transaction set not found");
    }

    // 4. Check status - must be 'review' to post
    if (txSet.status === "posted") {
      throw new PostingError("Transaction set already posted");
    }
    if (txSet.status === "draft") {
      throw new PostingError("Transaction set must be submitted for review before posting");
    }

    // 5. Check for pending approvals
    const pendingApprovals = await db
      .select({ id: approvals.id })
      .from(approvals)
      .where(
        and(
          eq(approvals.tenantId, tenantId),
          eq(approvals.entityType, "transaction_set"),
          eq(approvals.entityId, transactionSetId),
          eq(approvals.status, "pending")
        )
      )
      .limit(1);

    if (pendingApprovals.length > 0) {
      throw new PostingError("Cannot post: pending approval required");
    }

    // 6. Check for unresolved error-severity validation issues without overrides
    const openErrorIssues = await db
      .select({ id: validationIssues.id })
      .from(validationIssues)
      .where(
        and(
          eq(validationIssues.tenantId, tenantId),
          eq(validationIssues.entityType, "transaction_set"),
          eq(validationIssues.entityId, transactionSetId),
          eq(validationIssues.severity, "error"),
          eq(validationIssues.status, "open")
        )
      );

    // Check if these issues have overrides
    for (const issue of openErrorIssues) {
      const hasOverride = await db
        .select({ id: overrides.id })
        .from(overrides)
        .where(
          and(
            eq(overrides.tenantId, tenantId),
            eq(overrides.validationIssueId, issue.id)
          )
        )
        .limit(1);

      if (hasOverride.length === 0) {
        throw new PostingError(`Cannot post: unresolved validation error (issue ${issue.id})`);
      }
    }

    // 7. Check for document evidence (unless overridden)
    const docLinks = await db
      .select({ id: documentLinks.id })
      .from(documentLinks)
      .where(
        and(
          eq(documentLinks.tenantId, tenantId),
          eq(documentLinks.entityType, "transaction_set"),
          eq(documentLinks.entityId, transactionSetId)
        )
      )
      .limit(1);

    if (docLinks.length === 0) {
      // Check for document override
      const docOverride = await db
        .select({ id: overrides.id })
        .from(overrides)
        .where(
          and(
            eq(overrides.tenantId, tenantId),
            eq(overrides.entityType, "transaction_set"),
            eq(overrides.entityId, transactionSetId)
          )
        )
        .limit(1);

      if (docOverride.length === 0) {
        throw new PostingError("Cannot post: missing document evidence. Add a document or create an override.");
      }
    }

    // 8. Fetch posting intent first to get posting date for period validation
    const [intent] = await db
      .select()
      .from(postingIntents)
      .where(
        and(
          eq(postingIntents.tenantId, tenantId),
          eq(postingIntents.transactionSetId, transactionSetId)
        )
      )
      .limit(1);

    if (!intent) {
      throw new PostingError("No posting intent found for transaction set");
    }

    const postingIntent = intent.intent as PostingIntent;

    if (!postingIntent.lines || postingIntent.lines.length === 0) {
      throw new PostingError("Posting intent has no lines");
    }

    // 9. Validate accounting period is open for posting date
    const periodValidation = await validatePeriodForPosting(tenantId, postingIntent.postingDate);
    if (!periodValidation.allowed) {
      throw new PostingError(periodValidation.error || "Cannot post to closed accounting period");
    }
    // Log warning if posting to soft-closed period
    if (periodValidation.warning) {
      await logAuditEvent({
        tenantId,
        actorId,
        entityType: "transaction_set",
        entityId: transactionSetId,
        action: "soft_closed_period_posting",
        metadata: {
          postingDate: postingIntent.postingDate,
          warning: periodValidation.warning,
        },
      });
    }

    // 10. Validate and resolve accounts
    const resolvedLines: Array<{
      accountId: string;
      debit: string;
      credit: string;
      description: string | null;
    }> = [];

    let totalDebit = 0;
    let totalCredit = 0;

    for (let i = 0; i < postingIntent.lines.length; i++) {
      const line = postingIntent.lines[i];
      const debit = parseNumeric(line.debit);
      const credit = parseNumeric(line.credit);

      // Validate: cannot have both debit and credit > 0
      if (debit > 0 && credit > 0) {
        throw new PostingError(`Line ${i + 1}: cannot have both debit and credit > 0`);
      }

      // Validate: must have at least one non-zero
      if (debit === 0 && credit === 0) {
        throw new PostingError(`Line ${i + 1}: both debit and credit are zero`);
      }

      // Resolve account
      let accountId: string;
      if (line.accountId) {
        const [account] = await db
          .select({ id: accounts.id })
          .from(accounts)
          .where(
            and(
              eq(accounts.id, line.accountId),
              eq(accounts.tenantId, tenantId),
              eq(accounts.isActive, true)
            )
          )
          .limit(1);

        if (!account) {
          throw new PostingError(`Line ${i + 1}: account not found (id: ${line.accountId})`);
        }
        accountId = account.id;
      } else if (line.accountCode) {
        const [account] = await db
          .select({ id: accounts.id })
          .from(accounts)
          .where(
            and(
              eq(accounts.code, line.accountCode),
              eq(accounts.tenantId, tenantId),
              eq(accounts.isActive, true)
            )
          )
          .limit(1);

        if (!account) {
          throw new PostingError(`Line ${i + 1}: account not found (code: ${line.accountCode})`);
        }
        accountId = account.id;
      } else {
        throw new PostingError(`Line ${i + 1}: must specify accountCode or accountId`);
      }

      resolvedLines.push({
        accountId,
        debit: debit.toFixed(6),
        credit: credit.toFixed(6),
        description: line.description ?? null,
      });

      totalDebit += debit;
      totalCredit += credit;
    }

    // 11. Validate double-entry balance
    if (Math.abs(totalDebit - totalCredit) > 0.000001) {
      throw new PostingError(
        `Entry is not balanced: debits (${totalDebit.toFixed(6)}) ≠ credits (${totalCredit.toFixed(6)})`
      );
    }

    // 12. Create journal entry - THIS IS THE LEDGER WRITE
    const [journalEntry] = await db
      .insert(journalEntries)
      .values({
        tenantId,
        postingDate: postingIntent.postingDate,
        memo: postingIntent.memo ?? null,
        sourceTransactionSetId: transactionSetId,
        postedByActorId: actorId,
      })
      .returning();

    // 13. Create journal lines - THIS IS THE LEDGER WRITE
    const createdLines = await db
      .insert(journalLines)
      .values(
        resolvedLines.map((line, index) => ({
          tenantId,
          journalEntryId: journalEntry.id,
          lineNo: index + 1,
          accountId: line.accountId,
          debit: line.debit,
          credit: line.credit,
          description: line.description,
        }))
      )
      .returning({ id: journalLines.id });

    // 14. Update transaction set to posted
    await db
      .update(transactionSets)
      .set({
        status: "posted",
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(transactionSets.id, transactionSetId),
          eq(transactionSets.tenantId, tenantId)
        )
      );

    // 15. Update posting run to succeeded
    await db
      .update(postingRuns)
      .set({
        status: "succeeded",
        journalEntryId: journalEntry.id,
        finishedAt: sql`now()`,
      })
      .where(eq(postingRuns.id, postingRun.id));

    // 16. Create audit events
    await logAuditEvent({
      tenantId,
      actorId,
      entityType: "journal_entry",
      entityId: journalEntry.id,
      action: "journal_entry_created",
      metadata: {
        sourceTransactionSetId: transactionSetId,
        lineCount: resolvedLines.length,
        totalDebit: totalDebit.toFixed(6),
        totalCredit: totalCredit.toFixed(6),
      },
    });

    await logAuditEvent({
      tenantId,
      actorId,
      entityType: "transaction_set",
      entityId: transactionSetId,
      action: "transaction_set_posted",
      metadata: {
        journalEntryId: journalEntry.id,
        postingRunId: postingRun.id,
      },
    });

    return {
      success: true,
      journalEntryId: journalEntry.id,
      journalLineIds: createdLines.map((l) => l.id),
      postingRunId: postingRun.id,
    };
  } catch (error) {
    // Update posting run to failed
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await db
      .update(postingRuns)
      .set({
        status: "failed",
        error: errorMessage,
        finishedAt: sql`now()`,
      })
      .where(eq(postingRuns.id, postingRun.id));

    // Delete the failed run so retry is possible
    await db.delete(postingRuns).where(eq(postingRuns.id, postingRun.id));

    if (error instanceof PostingError) {
      return {
        success: false,
        postingRunId: postingRun.id,
        error: error.message,
      };
    }

    throw error;
  }
}

/**
 * Submit a transaction set for review (draft -> review).
 */
export async function submitForReview(
  tenantId: string,
  actorId: string,
  transactionSetId: string
): Promise<{ success: boolean; error?: string }> {
  const [txSet] = await db
    .select()
    .from(transactionSets)
    .where(
      and(
        eq(transactionSets.id, transactionSetId),
        eq(transactionSets.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!txSet) {
    return { success: false, error: "Transaction set not found" };
  }

  if (txSet.status === "posted") {
    return { success: false, error: "Transaction set already posted" };
  }

  if (txSet.status === "review") {
    return { success: true }; // Already in review, idempotent
  }

  await db
    .update(transactionSets)
    .set({
      status: "review",
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(transactionSets.id, transactionSetId),
        eq(transactionSets.tenantId, tenantId)
      )
    );

  await logAuditEvent({
    tenantId,
    actorId,
    entityType: "transaction_set",
    entityId: transactionSetId,
    action: "transaction_set_submitted",
    metadata: { previousStatus: "draft", newStatus: "review" },
  });

  return { success: true };
}

/**
 * Create a simple ledger entry for one-off transactions like expenses, transfers, etc.
 *
 * This is a simplified posting function that:
 * 1. Creates a transaction set (posted status)
 * 2. Creates a journal entry
 * 3. Creates journal lines
 *
 * Use this for simple transactions that don't need the full review workflow.
 *
 * THIS FUNCTION WRITES TO LEDGER TABLES (journal_entries, journal_lines).
 */
export async function createSimpleLedgerEntry(
  input: SimpleLedgerEntryInput
): Promise<SimpleLedgerEntryResult> {
  const { tenantId, actorId, postingDate, memo, source, lines } = input;

  // Validate lines
  if (!lines || lines.length === 0) {
    return {
      success: false,
      error: "At least one line is required",
    };
  }

  // Calculate totals and validate balance
  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of lines) {
    if (line.debit > 0 && line.credit > 0) {
      return {
        success: false,
        error: "A line cannot have both debit and credit > 0",
      };
    }
    totalDebit += line.debit;
    totalCredit += line.credit;
  }

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return {
      success: false,
      error: `Entry is not balanced: debits (${totalDebit.toFixed(2)}) ≠ credits (${totalCredit.toFixed(2)})`,
    };
  }

  try {
    // 1. Create transaction set
    const [txSet] = await db
      .insert(transactionSets)
      .values({
        tenantId,
        status: "posted",
        source: `simple_${source}`,
        createdByActorId: actorId,
        businessDate: postingDate,
        notes: memo,
      })
      .returning();

    // 2. Create journal entry - THIS IS THE LEDGER WRITE
    const [journalEntry] = await db
      .insert(journalEntries)
      .values({
        tenantId,
        postingDate,
        memo,
        sourceTransactionSetId: txSet.id,
        postedByActorId: actorId,
      })
      .returning();

    // 3. Create journal lines - THIS IS THE LEDGER WRITE
    await db.insert(journalLines).values(
      lines.map((line, index) => ({
        tenantId,
        journalEntryId: journalEntry.id,
        lineNo: index + 1,
        accountId: line.accountId,
        debit: line.debit.toFixed(6),
        credit: line.credit.toFixed(6),
        description: line.description ?? null,
      }))
    );

    // 4. Create audit event
    await logAuditEvent({
      tenantId,
      actorId,
      entityType: "journal_entry",
      entityId: journalEntry.id,
      action: "journal_entry_created",
      metadata: {
        source: `simple_${source}`,
        transactionSetId: txSet.id,
        lineCount: lines.length,
        totalDebit: totalDebit.toFixed(2),
        totalCredit: totalCredit.toFixed(2),
      },
    });

    return {
      success: true,
      journalEntryId: journalEntry.id,
      transactionSetId: txSet.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Parse a numeric value from string or number input.
 */
export function parseNumeric(value: string | number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") return value;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Update inventory balance for a product at a location.
 * Creates balance record if it doesn't exist.
 */
export async function updateInventoryBalance(
  tenantId: string,
  productId: string,
  warehouseId: string,
  locationId: string | null,
  quantityDelta: number
): Promise<void> {
  // Try to find existing balance
  const [existing] = await db
    .select()
    .from(inventoryBalances)
    .where(
      and(
        eq(inventoryBalances.tenantId, tenantId),
        eq(inventoryBalances.productId, productId),
        eq(inventoryBalances.warehouseId, warehouseId),
        locationId
          ? eq(inventoryBalances.locationId, locationId)
          : sql`${inventoryBalances.locationId} IS NULL`
      )
    );

  if (existing) {
    const newOnHand = parseFloat(existing.onHand) + quantityDelta;
    const newAvailable = newOnHand - parseFloat(existing.reserved);

    await db
      .update(inventoryBalances)
      .set({
        onHand: newOnHand.toFixed(6),
        available: newAvailable.toFixed(6),
        updatedAt: sql`now()`,
      })
      .where(eq(inventoryBalances.id, existing.id));
  } else {
    // Create new balance record
    const onHand = Math.max(0, quantityDelta);
    await db.insert(inventoryBalances).values({
      tenantId,
      productId,
      warehouseId,
      locationId: locationId ?? null,
      onHand: onHand.toFixed(6),
      reserved: "0",
      available: onHand.toFixed(6),
    });
  }
}
