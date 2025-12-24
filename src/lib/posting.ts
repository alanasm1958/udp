/**
 * Posting Service
 *
 * THIS IS THE ONLY FILE ALLOWED TO WRITE TO journal_entries AND journal_lines.
 *
 * The posting service:
 * 1. Validates posting preconditions (status, approvals, validations, documents)
 * 2. Creates posting_runs for idempotency tracking
 * 3. Parses posting_intents and resolves accounts
 * 4. Validates double-entry balance
 * 5. Creates journal_entries and journal_lines
 * 6. Updates transaction_set status to 'posted'
 * 7. Creates audit events
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
  reversalLinks,
  inventoryMovements,
  inventoryBalances,
  inventoryPostingLinks,
  products,
} from "@/db/schema";
import { eq, and, sql, asc } from "drizzle-orm";
import { logAuditEvent } from "./audit";

// Types for posting intent structure
export interface PostingIntentLine {
  accountCode?: string;
  accountId?: string;
  debit: string | number;
  credit: string | number;
  description?: string;
}

export interface PostingIntent {
  postingDate: string;
  memo?: string;
  lines: PostingIntentLine[];
}

export interface PostingResult {
  success: boolean;
  journalEntryId?: string;
  journalLineIds?: string[];
  postingRunId: string;
  error?: string;
}

export interface PostingContext {
  tenantId: string;
  actorId: string;
  transactionSetId: string;
}

/**
 * Main posting function - THE ONLY place that writes to ledger tables.
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

    // 8. Fetch posting intent
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

    // 9. Validate and resolve accounts
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

    // 10. Validate double-entry balance
    if (Math.abs(totalDebit - totalCredit) > 0.000001) {
      throw new PostingError(
        `Entry is not balanced: debits (${totalDebit.toFixed(6)}) ≠ credits (${totalCredit.toFixed(6)})`
      );
    }

    // 11. Create journal entry - THIS IS THE LEDGER WRITE
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

    // 12. Create journal lines - THIS IS THE LEDGER WRITE
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

    // 13. Update transaction set to posted
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

    // 14. Update posting run to succeeded
    await db
      .update(postingRuns)
      .set({
        status: "succeeded",
        journalEntryId: journalEntry.id,
        finishedAt: sql`now()`,
      })
      .where(eq(postingRuns.id, postingRun.id));

    // 15. Create audit events
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
 * Custom error class for posting failures.
 */
export class PostingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PostingError";
  }
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

/* ─────────────────────────────────────────────────────────────────────────────
   Journal Entry Reversal
   ───────────────────────────────────────────────────────────────────────────── */

export interface ReversalInput {
  tenantId: string;
  actorId: string;
  originalJournalEntryId: string;
  reason: string;
  postingDate?: string; // YYYY-MM-DD, defaults to today
  memo?: string;
}

export interface ReversalResult {
  success: boolean;
  originalJournalEntryId: string;
  reversalJournalEntryId?: string;
  transactionSetId?: string;
  idempotent: boolean;
  error?: string;
}

/**
 * Reverse a posted journal entry.
 *
 * Creates a new journal entry with inverted lines (debits become credits, credits become debits).
 * Uses reversal_links for idempotency - if already reversed, returns existing reversal.
 *
 * THIS FUNCTION WRITES TO LEDGER TABLES (journal_entries, journal_lines).
 */
export async function reverseJournalEntry(input: ReversalInput): Promise<ReversalResult> {
  const { tenantId, actorId, originalJournalEntryId, reason, postingDate, memo } = input;

  // 1. Log reversal request
  await logAuditEvent({
    tenantId,
    actorId,
    entityType: "journal_entry",
    entityId: originalJournalEntryId,
    action: "journal_reversal_requested",
    metadata: { reason },
  });

  // 2. Check for existing reversal (idempotency)
  const existingReversal = await db
    .select({
      reversalJournalEntryId: reversalLinks.reversalJournalEntryId,
    })
    .from(reversalLinks)
    .where(
      and(
        eq(reversalLinks.tenantId, tenantId),
        eq(reversalLinks.originalJournalEntryId, originalJournalEntryId)
      )
    )
    .limit(1);

  if (existingReversal.length > 0) {
    // Already reversed, return existing reversal
    const reversalId = existingReversal[0].reversalJournalEntryId;

    // Get the transaction set for the reversal
    const [reversalEntry] = await db
      .select({ sourceTransactionSetId: journalEntries.sourceTransactionSetId })
      .from(journalEntries)
      .where(eq(journalEntries.id, reversalId))
      .limit(1);

    return {
      success: true,
      originalJournalEntryId,
      reversalJournalEntryId: reversalId,
      transactionSetId: reversalEntry?.sourceTransactionSetId ?? undefined,
      idempotent: true,
    };
  }

  // 3. Fetch original journal entry
  const [originalEntry] = await db
    .select()
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.id, originalJournalEntryId),
        eq(journalEntries.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!originalEntry) {
    return {
      success: false,
      originalJournalEntryId,
      idempotent: false,
      error: "Original journal entry not found",
    };
  }

  // 4. Fetch original journal lines
  const originalLines = await db
    .select()
    .from(journalLines)
    .where(
      and(
        eq(journalLines.journalEntryId, originalJournalEntryId),
        eq(journalLines.tenantId, tenantId)
      )
    )
    .orderBy(asc(journalLines.lineNo));

  if (originalLines.length === 0) {
    return {
      success: false,
      originalJournalEntryId,
      idempotent: false,
      error: "Original journal entry has no lines",
    };
  }

  // 5. Determine posting date (use provided or today)
  const reversalPostingDate = postingDate || new Date().toISOString().split("T")[0];

  // 6. Create transaction set for the reversal
  const [reversalTxSet] = await db
    .insert(transactionSets)
    .values({
      tenantId,
      status: "posted", // Reversals go directly to posted
      source: "reversal",
      createdByActorId: actorId,
      businessDate: reversalPostingDate,
      notes: `Reversal of journal entry ${originalJournalEntryId}: ${reason}`,
    })
    .returning();

  // 7. Create reversal journal entry - THIS IS THE LEDGER WRITE
  const reversalMemo =
    memo || `Reversal of ${originalJournalEntryId}: ${reason}`;

  const [reversalEntry] = await db
    .insert(journalEntries)
    .values({
      tenantId,
      postingDate: reversalPostingDate,
      memo: reversalMemo,
      sourceTransactionSetId: reversalTxSet.id,
      postedByActorId: actorId,
    })
    .returning();

  // 8. Create inverted journal lines - THIS IS THE LEDGER WRITE
  const reversalLines = await db
    .insert(journalLines)
    .values(
      originalLines.map((line) => ({
        tenantId,
        journalEntryId: reversalEntry.id,
        lineNo: line.lineNo,
        accountId: line.accountId,
        // Invert: debit becomes credit, credit becomes debit
        debit: line.credit,
        credit: line.debit,
        description: line.description ? `Reversal: ${line.description}` : "Reversal",
      }))
    )
    .returning({ id: journalLines.id });

  // 9. Create reversal link for traceability and idempotency
  await db.insert(reversalLinks).values({
    tenantId,
    originalJournalEntryId,
    reversalJournalEntryId: reversalEntry.id,
    reason,
    createdByActorId: actorId,
  });

  // 10. Create audit events
  await logAuditEvent({
    tenantId,
    actorId,
    entityType: "journal_entry",
    entityId: reversalEntry.id,
    action: "journal_reversed",
    metadata: {
      originalJournalEntryId,
      reversalJournalEntryId: reversalEntry.id,
      transactionSetId: reversalTxSet.id,
      reason,
      lineCount: reversalLines.length,
    },
  });

  await logAuditEvent({
    tenantId,
    actorId,
    entityType: "reversal_link",
    entityId: reversalEntry.id,
    action: "reversal_created",
    metadata: {
      originalJournalEntryId,
      reversalJournalEntryId: reversalEntry.id,
      reason,
    },
  });

  return {
    success: true,
    originalJournalEntryId,
    reversalJournalEntryId: reversalEntry.id,
    transactionSetId: reversalTxSet.id,
    idempotent: false,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Inventory Movement Posting
   ───────────────────────────────────────────────────────────────────────────── */

export interface InventoryPostingContext {
  tenantId: string;
  actorId: string;
  transactionSetId: string;
  memo?: string;
  inventoryAssetAccountCode?: string;
  cogsAccountCode?: string;
}

export interface InventoryPostingResult {
  success: boolean;
  transactionSetId: string;
  movementIds: string[];
  journalEntryId: string | null;
  status: "posted" | "failed";
  error?: string;
  idempotent: boolean;
}

/**
 * Post inventory movements from a transaction set.
 *
 * This function:
 * 1. Fetches draft movements for the transaction set
 * 2. Updates inventory balances
 * 3. Creates journal entries if cost information is available
 * 4. Marks movements as posted
 * 5. Updates transaction set status
 *
 * THIS FUNCTION WRITES TO LEDGER TABLES (journal_entries, journal_lines)
 * AND INVENTORY TABLES (inventory_movements, inventory_balances, inventory_posting_links).
 */
export async function postInventoryMovements(
  ctx: InventoryPostingContext
): Promise<InventoryPostingResult> {
  const { tenantId, actorId, transactionSetId, memo } = ctx;

  // 1. Check transaction set status for idempotency
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
    return {
      success: false,
      transactionSetId,
      movementIds: [],
      journalEntryId: null,
      status: "failed",
      error: "Transaction set not found",
      idempotent: false,
    };
  }

  // Idempotency: if already posted, return existing result
  if (txSet.status === "posted") {
    const existingMovements = await db
      .select({ id: inventoryMovements.id })
      .from(inventoryMovements)
      .where(
        and(
          eq(inventoryMovements.tenantId, tenantId),
          eq(inventoryMovements.transactionSetId, transactionSetId),
          eq(inventoryMovements.movementStatus, "posted")
        )
      );

    const existingLinks = await db
      .select({ journalEntryId: inventoryPostingLinks.journalEntryId })
      .from(inventoryPostingLinks)
      .where(
        and(
          eq(inventoryPostingLinks.tenantId, tenantId),
          eq(inventoryPostingLinks.transactionSetId, transactionSetId)
        )
      )
      .limit(1);

    return {
      success: true,
      transactionSetId,
      movementIds: existingMovements.map((m) => m.id),
      journalEntryId: existingLinks[0]?.journalEntryId ?? null,
      status: "posted",
      idempotent: true,
    };
  }

  // 2. Fetch draft movements
  const movements = await db
    .select()
    .from(inventoryMovements)
    .where(
      and(
        eq(inventoryMovements.tenantId, tenantId),
        eq(inventoryMovements.transactionSetId, transactionSetId),
        eq(inventoryMovements.movementStatus, "draft")
      )
    );

  if (movements.length === 0) {
    return {
      success: false,
      transactionSetId,
      movementIds: [],
      journalEntryId: null,
      status: "failed",
      error: "No draft movements found for transaction set",
      idempotent: false,
    };
  }

  try {
    // 3. Process each movement - update balances
    for (const movement of movements) {
      const quantity = parseFloat(movement.quantity);

      // Handle "from" side (decrease balance)
      if (movement.fromWarehouseId) {
        await updateInventoryBalance(
          tenantId,
          movement.productId,
          movement.fromWarehouseId,
          movement.fromLocationId,
          -quantity
        );
      }

      // Handle "to" side (increase balance)
      if (movement.toWarehouseId) {
        await updateInventoryBalance(
          tenantId,
          movement.productId,
          movement.toWarehouseId,
          movement.toLocationId,
          quantity
        );
      }

      // Mark movement as posted
      await db
        .update(inventoryMovements)
        .set({ movementStatus: "posted" })
        .where(eq(inventoryMovements.id, movement.id));

      await logAuditEvent({
        tenantId,
        actorId,
        entityType: "inventory_movement",
        entityId: movement.id,
        action: "inventory_movement_posted",
        metadata: {
          transactionSetId,
          movementType: movement.movementType,
          quantity: movement.quantity,
        },
      });
    }

    // 4. Create journal entry if any movement has unit cost
    let journalEntryId: string | null = null;

    const _movementsWithCost = movements.filter(
      (m) => m.unitCost !== null && parseFloat(m.unitCost) > 0
    );


    // Also check if product has default_purchase_cost for receipts/adjustments
    const movementsNeedingCost: Array<{
      movement: typeof movements[0];
      cost: number;
    }> = [];

    for (const movement of movements) {
      let cost = movement.unitCost ? parseFloat(movement.unitCost) : 0;

      if (cost === 0 && (movement.movementType === "receipt" || movement.movementType === "adjustment")) {
        // Try to get default cost from product
        const [product] = await db
          .select({ defaultPurchaseCost: products.defaultPurchaseCost })
          .from(products)
          .where(eq(products.id, movement.productId));

        if (product && product.defaultPurchaseCost) {
          cost = parseFloat(product.defaultPurchaseCost);
        }
      }

      if (cost > 0) {
        movementsNeedingCost.push({ movement, cost });
      }
    }

    if (movementsNeedingCost.length > 0) {
      // Find or default inventory asset account and COGS account
      const inventoryAccountCode = ctx.inventoryAssetAccountCode || "1400"; // Default: Inventory
      const cogsAccountCode = ctx.cogsAccountCode || "5100"; // Default: COGS

      const [inventoryAccount] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(
          and(
            eq(accounts.tenantId, tenantId),
            eq(accounts.code, inventoryAccountCode),
            eq(accounts.isActive, true)
          )
        );

      const [cogsAccount] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(
          and(
            eq(accounts.tenantId, tenantId),
            eq(accounts.code, cogsAccountCode),
            eq(accounts.isActive, true)
          )
        );

      // Only create journal entry if we have the required accounts
      if (inventoryAccount && cogsAccount) {
        const lines: Array<{
          accountId: string;
          debit: string;
          credit: string;
          description: string | null;
        }> = [];

        for (const { movement, cost } of movementsNeedingCost) {
          const quantity = parseFloat(movement.quantity);
          const totalCost = (quantity * cost).toFixed(6);

          if (movement.movementType === "receipt") {
            // Receipt: Dr Inventory, Cr Clearing (we'll use COGS as placeholder)
            lines.push({
              accountId: inventoryAccount.id,
              debit: totalCost,
              credit: "0",
              description: `Receipt: ${movement.reference || movement.productId}`,
            });
            lines.push({
              accountId: cogsAccount.id,
              debit: "0",
              credit: totalCost,
              description: `Receipt clearing: ${movement.reference || movement.productId}`,
            });
          } else if (movement.movementType === "issue") {
            // Issue: Dr COGS, Cr Inventory
            lines.push({
              accountId: cogsAccount.id,
              debit: totalCost,
              credit: "0",
              description: `Issue: ${movement.reference || movement.productId}`,
            });
            lines.push({
              accountId: inventoryAccount.id,
              debit: "0",
              credit: totalCost,
              description: `Issue: ${movement.reference || movement.productId}`,
            });
          } else if (movement.movementType === "adjustment") {
            // Adjustment: depends on direction
            if (movement.toWarehouseId && !movement.fromWarehouseId) {
              // Positive adjustment
              lines.push({
                accountId: inventoryAccount.id,
                debit: totalCost,
                credit: "0",
                description: `Adjustment (+): ${movement.reference || movement.productId}`,
              });
              lines.push({
                accountId: cogsAccount.id,
                debit: "0",
                credit: totalCost,
                description: `Adjustment clearing: ${movement.reference || movement.productId}`,
              });
            } else if (movement.fromWarehouseId && !movement.toWarehouseId) {
              // Negative adjustment
              lines.push({
                accountId: cogsAccount.id,
                debit: totalCost,
                credit: "0",
                description: `Adjustment (-): ${movement.reference || movement.productId}`,
              });
              lines.push({
                accountId: inventoryAccount.id,
                debit: "0",
                credit: totalCost,
                description: `Adjustment: ${movement.reference || movement.productId}`,
              });
            }
          }
          // Transfer movements don't affect P&L, only location
        }

        if (lines.length > 0) {
          // Create journal entry - THIS IS THE LEDGER WRITE
          const [journalEntry] = await db
            .insert(journalEntries)
            .values({
              tenantId,
              postingDate: movements[0].movementDate,
              memo: memo || `Inventory posting for ${transactionSetId}`,
              sourceTransactionSetId: transactionSetId,
              postedByActorId: actorId,
            })
            .returning();

          journalEntryId = journalEntry.id;

          // Create journal lines - THIS IS THE LEDGER WRITE
          await db.insert(journalLines).values(
            lines.map((line, index) => ({
              tenantId,
              journalEntryId: journalEntry.id,
              lineNo: index + 1,
              accountId: line.accountId,
              debit: line.debit,
              credit: line.credit,
              description: line.description,
            }))
          );

          // Create posting links
          for (const { movement } of movementsNeedingCost) {
            await db.insert(inventoryPostingLinks).values({
              tenantId,
              transactionSetId,
              journalEntryId: journalEntry.id,
              movementId: movement.id,
            });
          }

          await logAuditEvent({
            tenantId,
            actorId,
            entityType: "journal_entry",
            entityId: journalEntry.id,
            action: "journal_entry_created",
            metadata: {
              source: "inventory_posting",
              transactionSetId,
              lineCount: lines.length,
            },
          });
        }
      }
    }

    // 5. Update transaction set status to posted
    await db
      .update(transactionSets)
      .set({
        status: "posted",
        updatedAt: sql`now()`,
      })
      .where(eq(transactionSets.id, transactionSetId));

    await logAuditEvent({
      tenantId,
      actorId,
      entityType: "transaction_set",
      entityId: transactionSetId,
      action: "transaction_set_posted",
      metadata: {
        source: "inventory",
        movementCount: movements.length,
        journalEntryId,
      },
    });

    return {
      success: true,
      transactionSetId,
      movementIds: movements.map((m) => m.id),
      journalEntryId,
      status: "posted",
      idempotent: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      transactionSetId,
      movementIds: [],
      journalEntryId: null,
      status: "failed",
      error: errorMessage,
      idempotent: false,
    };
  }
}

/**
 * Update inventory balance for a product at a location.
 * Creates balance record if it doesn't exist.
 */
async function updateInventoryBalance(
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
