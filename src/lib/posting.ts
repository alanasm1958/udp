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
  salesDocs,
  salesFulfillments,
  salesPostingLinks,
  purchaseDocs,
  purchaseDocLines,
  purchasePostingLinks,
  payments,
  paymentAllocations,
  paymentPostingLinks,
} from "@/db/schema";
import { eq, and, sql, asc } from "drizzle-orm";
import { logAuditEvent } from "./audit";
import { checkAndCreatePromotionTask } from "./sales-customers/lead-promotion";

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

/* ─────────────────────────────────────────────────────────────────────────────
   Sales Document Posting
   ───────────────────────────────────────────────────────────────────────────── */

export interface SalesDocPostingContext {
  tenantId: string;
  actorId: string;
  salesDocId: string;
  memo?: string;
  arAccountCode?: string;
  revenueAccountCode?: string;
  cogsAccountCode?: string;
  inventoryAccountCode?: string;
}

export interface SalesDocPostingResult {
  success: boolean;
  salesDocId: string;
  journalEntryId: string | null;
  transactionSetId: string | null;
  idempotent: boolean;
  error?: string;
}

/**
 * Post a sales document (invoice) to the ledger.
 *
 * Creates journal entries:
 * - Dr Accounts Receivable (totalAmount)
 * - Cr Revenue (totalAmount)
 * - If shipped goods with cost: Dr COGS, Cr Inventory
 *
 * THIS FUNCTION WRITES TO LEDGER TABLES (journal_entries, journal_lines).
 */
export async function postSalesDoc(ctx: SalesDocPostingContext): Promise<SalesDocPostingResult> {
  const { tenantId, actorId, salesDocId, memo } = ctx;

  // 1. Check for existing posting link (idempotency)
  const existingLink = await db
    .select({
      journalEntryId: salesPostingLinks.journalEntryId,
      transactionSetId: salesPostingLinks.transactionSetId,
    })
    .from(salesPostingLinks)
    .where(
      and(
        eq(salesPostingLinks.tenantId, tenantId),
        eq(salesPostingLinks.salesDocId, salesDocId)
      )
    )
    .limit(1);

  if (existingLink.length > 0) {
    return {
      success: true,
      salesDocId,
      journalEntryId: existingLink[0].journalEntryId,
      transactionSetId: existingLink[0].transactionSetId,
      idempotent: true,
    };
  }

  // 2. Fetch sales document
  const [doc] = await db
    .select()
    .from(salesDocs)
    .where(
      and(
        eq(salesDocs.id, salesDocId),
        eq(salesDocs.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!doc) {
    return {
      success: false,
      salesDocId,
      journalEntryId: null,
      transactionSetId: null,
      idempotent: false,
      error: "Sales document not found",
    };
  }

  // Only post invoices
  if (doc.docType !== "invoice") {
    return {
      success: false,
      salesDocId,
      journalEntryId: null,
      transactionSetId: null,
      idempotent: false,
      error: `Cannot post document type: ${doc.docType}. Only invoices can be posted.`,
    };
  }

  try {
    // 3. Resolve accounts
    const arAccountCode = ctx.arAccountCode || "1100";
    const revenueAccountCode = ctx.revenueAccountCode || "4000";
    const cogsAccountCode = ctx.cogsAccountCode || "5100";
    const inventoryAccountCode = ctx.inventoryAccountCode || "1400";

    const [arAccount] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          eq(accounts.code, arAccountCode),
          eq(accounts.isActive, true)
        )
      );

    const [revenueAccount] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          eq(accounts.code, revenueAccountCode),
          eq(accounts.isActive, true)
        )
      );

    if (!arAccount || !revenueAccount) {
      return {
        success: false,
        salesDocId,
        journalEntryId: null,
        transactionSetId: null,
        idempotent: false,
        error: `Required accounts not found. AR: ${arAccountCode}, Revenue: ${revenueAccountCode}`,
      };
    }

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

    // 4. Calculate COGS from shipped fulfillments
    let totalCogs = 0;
    const cogsMetadata: Array<{ productId: string; quantity: number; unitCost: number }> = [];

    // Find all "ship" fulfillments for this doc
    const fulfillments = await db
      .select({
        fulfillmentId: salesFulfillments.id,
        salesDocLineId: salesFulfillments.salesDocLineId,
        movementId: salesFulfillments.movementId,
        fulfillmentType: salesFulfillments.fulfillmentType,
        quantity: salesFulfillments.quantity,
      })
      .from(salesFulfillments)
      .where(
        and(
          eq(salesFulfillments.tenantId, tenantId),
          eq(salesFulfillments.salesDocId, salesDocId)
        )
      );

    const shipFulfillments = fulfillments.filter((f) => f.fulfillmentType === "ship");

    for (const fulfillment of shipFulfillments) {
      // Get movement to find cost
      const [movement] = await db
        .select({
          unitCost: inventoryMovements.unitCost,
          productId: inventoryMovements.productId,
        })
        .from(inventoryMovements)
        .where(eq(inventoryMovements.id, fulfillment.movementId))
        .limit(1);

      if (movement) {
        let unitCost = movement.unitCost ? parseFloat(movement.unitCost) : 0;

        // Fallback to product default cost
        if (unitCost === 0) {
          const [product] = await db
            .select({ defaultPurchaseCost: products.defaultPurchaseCost })
            .from(products)
            .where(eq(products.id, movement.productId))
            .limit(1);

          if (product && product.defaultPurchaseCost) {
            unitCost = parseFloat(product.defaultPurchaseCost);
          }
        }

        if (unitCost > 0) {
          const qty = parseFloat(fulfillment.quantity);
          totalCogs += qty * unitCost;
          cogsMetadata.push({
            productId: movement.productId,
            quantity: qty,
            unitCost,
          });
        }
      }
    }

    // 5. Build journal lines
    const docTotal = parseFloat(doc.totalAmount);
    const lines: Array<{
      accountId: string;
      debit: string;
      credit: string;
      description: string | null;
    }> = [];

    // Dr AR
    lines.push({
      accountId: arAccount.id,
      debit: docTotal.toFixed(6),
      credit: "0",
      description: `AR: ${doc.docNumber}`,
    });

    // Cr Revenue
    lines.push({
      accountId: revenueAccount.id,
      debit: "0",
      credit: docTotal.toFixed(6),
      description: `Revenue: ${doc.docNumber}`,
    });

    // COGS entries if we have cost info and accounts
    if (totalCogs > 0 && cogsAccount && inventoryAccount) {
      // Dr COGS
      lines.push({
        accountId: cogsAccount.id,
        debit: totalCogs.toFixed(6),
        credit: "0",
        description: `COGS: ${doc.docNumber}`,
      });

      // Cr Inventory
      lines.push({
        accountId: inventoryAccount.id,
        debit: "0",
        credit: totalCogs.toFixed(6),
        description: `Inventory reduction: ${doc.docNumber}`,
      });
    }

    // 6. Create transaction set
    const [txSet] = await db
      .insert(transactionSets)
      .values({
        tenantId,
        status: "posted",
        source: "sales_posting",
        createdByActorId: actorId,
        businessDate: doc.docDate,
        notes: memo || `Sales posting: ${doc.docNumber}`,
      })
      .returning();

    // 7. Create journal entry - THIS IS THE LEDGER WRITE
    const [journalEntry] = await db
      .insert(journalEntries)
      .values({
        tenantId,
        postingDate: doc.docDate,
        memo: memo || `Sales invoice: ${doc.docNumber}`,
        sourceTransactionSetId: txSet.id,
        postedByActorId: actorId,
      })
      .returning();

    // 8. Create journal lines - THIS IS THE LEDGER WRITE
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

    // 9. Create posting link
    await db.insert(salesPostingLinks).values({
      tenantId,
      salesDocId,
      journalEntryId: journalEntry.id,
      transactionSetId: txSet.id,
    });

    // 10. Update document status to posted if not already
    await db
      .update(salesDocs)
      .set({
        status: "posted",
        updatedAt: sql`now()`,
      })
      .where(eq(salesDocs.id, salesDocId));

    // 11. Create audit event
    await logAuditEvent({
      tenantId,
      actorId,
      entityType: "sales_doc",
      entityId: salesDocId,
      action: "sales_doc_posted",
      metadata: {
        journalEntryId: journalEntry.id,
        transactionSetId: txSet.id,
        docNumber: doc.docNumber,
        totalAmount: docTotal,
        totalCogs,
        cogsDetails: cogsMetadata,
        lineCount: lines.length,
      },
    });

    // 12. Check for lead promotion task (async, non-blocking)
    checkAndCreatePromotionTask(tenantId, doc.partyId, actorId).catch((err) => {
      console.error("Lead promotion check failed:", err);
    });

    return {
      success: true,
      salesDocId,
      journalEntryId: journalEntry.id,
      transactionSetId: txSet.id,
      idempotent: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      salesDocId,
      journalEntryId: null,
      transactionSetId: null,
      idempotent: false,
      error: errorMessage,
    };
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Purchase Document Posting
   ───────────────────────────────────────────────────────────────────────────── */

export interface PurchaseDocPostingContext {
  tenantId: string;
  actorId: string;
  purchaseDocId: string;
  memo?: string;
  apAccountCode?: string;
  inventoryAccountCode?: string;
  expenseAccountCode?: string;
}

export interface PurchaseDocPostingResult {
  success: boolean;
  purchaseDocId: string;
  journalEntryId: string | null;
  transactionSetId: string | null;
  idempotent: boolean;
  error?: string;
}

/**
 * Post a purchase document (invoice) to the ledger.
 *
 * Creates journal entries:
 * - Dr Inventory (for goods) or Expense (for services)
 * - Cr Accounts Payable
 *
 * THIS FUNCTION WRITES TO LEDGER TABLES (journal_entries, journal_lines).
 */
export async function postPurchaseDoc(ctx: PurchaseDocPostingContext): Promise<PurchaseDocPostingResult> {
  const { tenantId, actorId, purchaseDocId, memo } = ctx;

  // 1. Check for existing posting link (idempotency)
  const existingLink = await db
    .select({
      journalEntryId: purchasePostingLinks.journalEntryId,
      transactionSetId: purchasePostingLinks.transactionSetId,
    })
    .from(purchasePostingLinks)
    .where(
      and(
        eq(purchasePostingLinks.tenantId, tenantId),
        eq(purchasePostingLinks.purchaseDocId, purchaseDocId)
      )
    )
    .limit(1);

  if (existingLink.length > 0) {
    return {
      success: true,
      purchaseDocId,
      journalEntryId: existingLink[0].journalEntryId,
      transactionSetId: existingLink[0].transactionSetId,
      idempotent: true,
    };
  }

  // 2. Fetch purchase document
  const [doc] = await db
    .select()
    .from(purchaseDocs)
    .where(
      and(
        eq(purchaseDocs.id, purchaseDocId),
        eq(purchaseDocs.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!doc) {
    return {
      success: false,
      purchaseDocId,
      journalEntryId: null,
      transactionSetId: null,
      idempotent: false,
      error: "Purchase document not found",
    };
  }

  // Only post invoices
  if (doc.docType !== "invoice") {
    return {
      success: false,
      purchaseDocId,
      journalEntryId: null,
      transactionSetId: null,
      idempotent: false,
      error: `Cannot post document type: ${doc.docType}. Only invoices can be posted.`,
    };
  }

  try {
    // 3. Resolve accounts
    const apAccountCode = ctx.apAccountCode || "2000";
    const inventoryAccountCode = ctx.inventoryAccountCode || "1400";
    const expenseAccountCode = ctx.expenseAccountCode || "6000";

    const [apAccount] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          eq(accounts.code, apAccountCode),
          eq(accounts.isActive, true)
        )
      );

    if (!apAccount) {
      return {
        success: false,
        purchaseDocId,
        journalEntryId: null,
        transactionSetId: null,
        idempotent: false,
        error: `AP account not found: ${apAccountCode}`,
      };
    }

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

    const [expenseAccount] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          eq(accounts.code, expenseAccountCode),
          eq(accounts.isActive, true)
        )
      );

    // 4. Fetch purchase doc lines with product info
    const docLines = await db
      .select({
        id: purchaseDocLines.id,
        productId: purchaseDocLines.productId,
        quantity: purchaseDocLines.quantity,
        unitPrice: purchaseDocLines.unitPrice,
        lineTotal: purchaseDocLines.lineTotal,
      })
      .from(purchaseDocLines)
      .where(
        and(
          eq(purchaseDocLines.tenantId, tenantId),
          eq(purchaseDocLines.purchaseDocId, purchaseDocId)
        )
      );

    // 5. Calculate inventory vs expense amounts based on product type
    let inventoryTotal = 0;
    let expenseTotal = 0;

    for (const line of docLines) {
      const lineAmount = parseFloat(line.quantity) * parseFloat(line.unitPrice);

      if (line.productId) {
        const [product] = await db
          .select({ type: products.type })
          .from(products)
          .where(eq(products.id, line.productId))
          .limit(1);

        if (product && product.type === "service") {
          expenseTotal += lineAmount;
        } else {
          inventoryTotal += lineAmount;
        }
      } else {
        // No product, treat as expense
        expenseTotal += lineAmount;
      }
    }

    // 6. Build journal lines
    const docTotal = parseFloat(doc.totalAmount);
    const lines: Array<{
      accountId: string;
      debit: string;
      credit: string;
      description: string | null;
    }> = [];

    // Dr Inventory (for goods)
    if (inventoryTotal > 0 && inventoryAccount) {
      lines.push({
        accountId: inventoryAccount.id,
        debit: inventoryTotal.toFixed(6),
        credit: "0",
        description: `Inventory: ${doc.docNumber}`,
      });
    }

    // Dr Expense (for services)
    if (expenseTotal > 0 && expenseAccount) {
      lines.push({
        accountId: expenseAccount.id,
        debit: expenseTotal.toFixed(6),
        credit: "0",
        description: `Expense: ${doc.docNumber}`,
      });
    }

    // If neither account exists but we have amounts, fallback to AP balance only
    if (lines.length === 0) {
      // Fallback: put everything to expense if available
      if (expenseAccount) {
        lines.push({
          accountId: expenseAccount.id,
          debit: docTotal.toFixed(6),
          credit: "0",
          description: `Purchase: ${doc.docNumber}`,
        });
      } else if (inventoryAccount) {
        lines.push({
          accountId: inventoryAccount.id,
          debit: docTotal.toFixed(6),
          credit: "0",
          description: `Purchase: ${doc.docNumber}`,
        });
      } else {
        return {
          success: false,
          purchaseDocId,
          journalEntryId: null,
          transactionSetId: null,
          idempotent: false,
          error: "No inventory or expense account available for debit entry",
        };
      }
    }

    // Cr AP
    lines.push({
      accountId: apAccount.id,
      debit: "0",
      credit: docTotal.toFixed(6),
      description: `AP: ${doc.docNumber}`,
    });

    // 7. Create transaction set
    const [txSet] = await db
      .insert(transactionSets)
      .values({
        tenantId,
        status: "posted",
        source: "purchase_posting",
        createdByActorId: actorId,
        businessDate: doc.docDate,
        notes: memo || `Purchase posting: ${doc.docNumber}`,
      })
      .returning();

    // 8. Create journal entry - THIS IS THE LEDGER WRITE
    const [journalEntry] = await db
      .insert(journalEntries)
      .values({
        tenantId,
        postingDate: doc.docDate,
        memo: memo || `Purchase invoice: ${doc.docNumber}`,
        sourceTransactionSetId: txSet.id,
        postedByActorId: actorId,
      })
      .returning();

    // 9. Create journal lines - THIS IS THE LEDGER WRITE
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

    // 10. Create posting link
    await db.insert(purchasePostingLinks).values({
      tenantId,
      purchaseDocId,
      journalEntryId: journalEntry.id,
      transactionSetId: txSet.id,
    });

    // 11. Update document status to posted if not already
    await db
      .update(purchaseDocs)
      .set({
        status: "posted",
        updatedAt: sql`now()`,
      })
      .where(eq(purchaseDocs.id, purchaseDocId));

    // 12. Create audit event
    await logAuditEvent({
      tenantId,
      actorId,
      entityType: "purchase_doc",
      entityId: purchaseDocId,
      action: "purchase_doc_posted",
      metadata: {
        journalEntryId: journalEntry.id,
        transactionSetId: txSet.id,
        docNumber: doc.docNumber,
        totalAmount: docTotal,
        inventoryTotal,
        expenseTotal,
        lineCount: lines.length,
      },
    });

    return {
      success: true,
      purchaseDocId,
      journalEntryId: journalEntry.id,
      transactionSetId: txSet.id,
      idempotent: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      purchaseDocId,
      journalEntryId: null,
      transactionSetId: null,
      idempotent: false,
      error: errorMessage,
    };
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Payment Posting
   ───────────────────────────────────────────────────────────────────────────── */

export interface PaymentPostingContext {
  tenantId: string;
  actorId: string;
  paymentId: string;
  memo?: string;
  arAccountCode?: string;
  apAccountCode?: string;
}

export interface PaymentPostingResult {
  success: boolean;
  paymentId: string;
  journalEntryId: string | null;
  transactionSetId: string | null;
  idempotent: boolean;
  error?: string;
}

/**
 * Post a payment (receipt or vendor payment) to the ledger.
 *
 * Creates journal entries:
 * - Receipt: Dr Cash/Bank, Cr AR
 * - Payment: Dr AP, Cr Cash/Bank
 *
 * THIS FUNCTION WRITES TO LEDGER TABLES (journal_entries, journal_lines).
 */
export async function postPayment(ctx: PaymentPostingContext): Promise<PaymentPostingResult> {
  const { tenantId, actorId, paymentId, memo } = ctx;

  // 1. Check for existing posting link (idempotency)
  const existingLink = await db
    .select({
      journalEntryId: paymentPostingLinks.journalEntryId,
      transactionSetId: paymentPostingLinks.transactionSetId,
    })
    .from(paymentPostingLinks)
    .where(
      and(
        eq(paymentPostingLinks.tenantId, tenantId),
        eq(paymentPostingLinks.paymentId, paymentId)
      )
    )
    .limit(1);

  if (existingLink.length > 0) {
    return {
      success: true,
      paymentId,
      journalEntryId: existingLink[0].journalEntryId,
      transactionSetId: existingLink[0].transactionSetId,
      idempotent: true,
    };
  }

  // 2. Fetch payment
  const [payment] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.id, paymentId),
        eq(payments.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!payment) {
    return {
      success: false,
      paymentId,
      journalEntryId: null,
      transactionSetId: null,
      idempotent: false,
      error: "Payment not found",
    };
  }

  if (payment.status !== "draft") {
    return {
      success: false,
      paymentId,
      journalEntryId: null,
      transactionSetId: null,
      idempotent: false,
      error: "Payment must be in draft status to post",
    };
  }

  // 3. Get allocations
  const allocations = await db
    .select()
    .from(paymentAllocations)
    .where(
      and(
        eq(paymentAllocations.tenantId, tenantId),
        eq(paymentAllocations.paymentId, paymentId)
      )
    );

  if (allocations.length === 0) {
    return {
      success: false,
      paymentId,
      journalEntryId: null,
      transactionSetId: null,
      idempotent: false,
      error: "Payment must have at least one allocation to post",
    };
  }

  // 4. Calculate total allocated
  const totalAllocated = allocations.reduce(
    (sum, alloc) => sum + parseFloat(alloc.amount),
    0
  );

  if (totalAllocated <= 0) {
    return {
      success: false,
      paymentId,
      journalEntryId: null,
      transactionSetId: null,
      idempotent: false,
      error: "Total allocated amount must be greater than zero",
    };
  }

  try {
    // 5. Resolve accounts - use codes stored on the payment record
    const cashBankAccountCode = payment.method === "cash"
      ? payment.cashAccountCode
      : payment.bankAccountCode;
    const arAccountCode = ctx.arAccountCode || "1100";
    const apAccountCode = ctx.apAccountCode || "2000";

    const [cashBankAccount] = await db
      .select({ id: accounts.id, code: accounts.code, name: accounts.name })
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          eq(accounts.code, cashBankAccountCode),
          eq(accounts.isActive, true)
        )
      )
      .limit(1);

    if (!cashBankAccount) {
      return {
        success: false,
        paymentId,
        journalEntryId: null,
        transactionSetId: null,
        idempotent: false,
        error: `${payment.method === "cash" ? "Cash" : "Bank"} account not found (${cashBankAccountCode})`,
      };
    }

    // Get AR or AP account based on payment type
    const arApAccountCode = payment.type === "receipt" ? arAccountCode : apAccountCode;
    const [arApAccount] = await db
      .select({ id: accounts.id, code: accounts.code, name: accounts.name })
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          eq(accounts.code, arApAccountCode),
          eq(accounts.isActive, true)
        )
      )
      .limit(1);

    if (!arApAccount) {
      return {
        success: false,
        paymentId,
        journalEntryId: null,
        transactionSetId: null,
        idempotent: false,
        error: `${payment.type === "receipt" ? "AR" : "AP"} account not found (${arApAccountCode})`,
      };
    }

    // 6. Build journal lines
    const lines: Array<{
      accountId: string;
      debit: string;
      credit: string;
      description: string | null;
    }> = [];

    if (payment.type === "receipt") {
      // Receipt: Dr Cash/Bank, Cr AR
      lines.push({
        accountId: cashBankAccount.id,
        debit: totalAllocated.toFixed(6),
        credit: "0",
        description: `Receipt: ${payment.reference || paymentId}`,
      });
      lines.push({
        accountId: arApAccount.id,
        debit: "0",
        credit: totalAllocated.toFixed(6),
        description: `AR payment: ${payment.reference || paymentId}`,
      });
    } else {
      // Payment: Dr AP, Cr Cash/Bank
      lines.push({
        accountId: arApAccount.id,
        debit: totalAllocated.toFixed(6),
        credit: "0",
        description: `AP payment: ${payment.reference || paymentId}`,
      });
      lines.push({
        accountId: cashBankAccount.id,
        debit: "0",
        credit: totalAllocated.toFixed(6),
        description: `Payment: ${payment.reference || paymentId}`,
      });
    }

    // 7. Create transaction set
    const [txSet] = await db
      .insert(transactionSets)
      .values({
        tenantId,
        status: "posted",
        source: "payment_posting",
        createdByActorId: actorId,
        businessDate: payment.paymentDate,
        notes: memo || `Payment posting: ${payment.reference || paymentId}`,
      })
      .returning();

    // 8. Create journal entry - THIS IS THE LEDGER WRITE
    const [journalEntry] = await db
      .insert(journalEntries)
      .values({
        tenantId,
        postingDate: payment.paymentDate,
        memo: memo || `${payment.type === "receipt" ? "Customer receipt" : "Vendor payment"}: ${payment.reference || paymentId}`,
        sourceTransactionSetId: txSet.id,
        postedByActorId: actorId,
      })
      .returning();

    // 9. Create journal lines - THIS IS THE LEDGER WRITE
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

    // 10. Create posting link
    await db.insert(paymentPostingLinks).values({
      tenantId,
      paymentId,
      journalEntryId: journalEntry.id,
      transactionSetId: txSet.id,
    });

    // 11. Update payment status to posted
    await db
      .update(payments)
      .set({
        status: "posted",
        updatedAt: sql`now()`,
      })
      .where(eq(payments.id, paymentId));

    // 12. Create audit event
    await logAuditEvent({
      tenantId,
      actorId,
      entityType: "payment",
      entityId: paymentId,
      action: "payment_posted",
      metadata: {
        journalEntryId: journalEntry.id,
        transactionSetId: txSet.id,
        totalAllocated,
        allocationCount: allocations.length,
        method: payment.method,
        type: payment.type,
      },
    });

    return {
      success: true,
      paymentId,
      journalEntryId: journalEntry.id,
      transactionSetId: txSet.id,
      idempotent: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      paymentId,
      journalEntryId: null,
      transactionSetId: null,
      idempotent: false,
      error: errorMessage,
    };
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Payment Void
   ───────────────────────────────────────────────────────────────────────────── */

export interface VoidPaymentInput {
  tenantId: string;
  actorId: string;
  paymentId: string;
  reason?: string;
}

export interface VoidPaymentResult {
  success: boolean;
  paymentId: string;
  status: "void" | "draft" | "posted";
  idempotent: boolean;
  originalJournalEntryId?: string;
  reversalJournalEntryId?: string;
  error?: string;
}

/**
 * Void a payment.
 *
 * For draft payments: simply sets status to void.
 * For posted payments: creates a reversal journal entry and then sets status to void.
 *
 * THIS FUNCTION MAY WRITE TO LEDGER TABLES (journal_entries, journal_lines) for posted payment reversals.
 */
export async function voidPayment(input: VoidPaymentInput): Promise<VoidPaymentResult> {
  const { tenantId, actorId, paymentId, reason } = input;

  return await db.transaction(async (tx) => {
    // 1. Load payment
    const [payment] = await tx
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.id, paymentId),
          eq(payments.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!payment) {
      return {
        success: false,
        paymentId,
        status: "draft" as const,
        idempotent: false,
        error: "Payment not found",
      };
    }

    // 2. Idempotency: if already void, return success
    if (payment.status === "void") {
      return {
        success: true,
        paymentId,
        status: "void" as const,
        idempotent: true,
      };
    }

    // 3. Check for allocations
    const allocations = await tx
      .select({ id: paymentAllocations.id })
      .from(paymentAllocations)
      .where(
        and(
          eq(paymentAllocations.tenantId, tenantId),
          eq(paymentAllocations.paymentId, paymentId)
        )
      )
      .limit(1);

    if (allocations.length > 0) {
      return {
        success: false,
        paymentId,
        status: payment.status as "draft" | "posted",
        idempotent: false,
        error: "Payment has allocations. Unallocate before voiding.",
      };
    }

    // 4. Handle draft payment - just set to void
    if (payment.status === "draft") {
      await tx
        .update(payments)
        .set({
          status: "void",
          updatedAt: sql`now()`,
        })
        .where(eq(payments.id, paymentId));

      await logAuditEvent({
        tenantId,
        actorId,
        entityType: "payment",
        entityId: paymentId,
        action: "payment_voided",
        metadata: {
          previousStatus: "draft",
          reason: reason || "No reason provided",
        },
      });

      return {
        success: true,
        paymentId,
        status: "void" as const,
        idempotent: false,
      };
    }

    // 5. Handle posted payment - create reversal
    if (payment.status === "posted") {
      // Find the posting link to get original journal entry
      const [postingLink] = await tx
        .select({ journalEntryId: paymentPostingLinks.journalEntryId })
        .from(paymentPostingLinks)
        .where(
          and(
            eq(paymentPostingLinks.tenantId, tenantId),
            eq(paymentPostingLinks.paymentId, paymentId)
          )
        )
        .limit(1);

      if (!postingLink || !postingLink.journalEntryId) {
        return {
          success: false,
          paymentId,
          status: "posted" as const,
          idempotent: false,
          error: "Payment is posted but has no posting link (journal entry missing).",
        };
      }

      const originalJournalEntryId = postingLink.journalEntryId;

      // Check if already reversed (idempotency for partial completion)
      const existingReversal = await tx
        .select({ reversalJournalEntryId: reversalLinks.reversalJournalEntryId })
        .from(reversalLinks)
        .where(
          and(
            eq(reversalLinks.tenantId, tenantId),
            eq(reversalLinks.originalJournalEntryId, originalJournalEntryId)
          )
        )
        .limit(1);

      let reversalJournalEntryId: string;

      if (existingReversal.length > 0) {
        // Already reversed, use existing
        reversalJournalEntryId = existingReversal[0].reversalJournalEntryId;
      } else {
        // Create reversal journal entry
        // Fetch original journal lines
        const originalLines = await tx
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
            paymentId,
            status: "posted" as const,
            idempotent: false,
            error: "Original journal entry has no lines to reverse.",
          };
        }

        // Create transaction set for reversal
        const [reversalTxSet] = await tx
          .insert(transactionSets)
          .values({
            tenantId,
            status: "posted",
            source: "payment_void",
            createdByActorId: actorId,
            businessDate: new Date().toISOString().split("T")[0],
            notes: `Payment void reversal: ${payment.reference || paymentId}`,
          })
          .returning();

        // Create reversal journal entry - THIS IS THE LEDGER WRITE
        const [reversalEntry] = await tx
          .insert(journalEntries)
          .values({
            tenantId,
            postingDate: new Date().toISOString().split("T")[0],
            memo: `Payment void reversal: ${payment.reference || paymentId}${reason ? ` - ${reason}` : ""}`,
            sourceTransactionSetId: reversalTxSet.id,
            postedByActorId: actorId,
          })
          .returning();

        reversalJournalEntryId = reversalEntry.id;

        // Create inverted journal lines - THIS IS THE LEDGER WRITE
        await tx.insert(journalLines).values(
          originalLines.map((line) => ({
            tenantId,
            journalEntryId: reversalEntry.id,
            lineNo: line.lineNo,
            accountId: line.accountId,
            // Invert: debit becomes credit, credit becomes debit
            debit: line.credit,
            credit: line.debit,
            description: line.description ? `Void reversal: ${line.description}` : "Void reversal",
          }))
        );

        // Create reversal link
        await tx.insert(reversalLinks).values({
          tenantId,
          originalJournalEntryId,
          reversalJournalEntryId: reversalEntry.id,
          reason: reason || "Payment voided",
          createdByActorId: actorId,
        });
      }

      // Set payment status to void
      await tx
        .update(payments)
        .set({
          status: "void",
          updatedAt: sql`now()`,
        })
        .where(eq(payments.id, paymentId));

      await logAuditEvent({
        tenantId,
        actorId,
        entityType: "payment",
        entityId: paymentId,
        action: "payment_voided",
        metadata: {
          previousStatus: "posted",
          reason: reason || "No reason provided",
          originalJournalEntryId,
          reversalJournalEntryId,
        },
      });

      return {
        success: true,
        paymentId,
        status: "void" as const,
        idempotent: existingReversal.length > 0,
        originalJournalEntryId,
        reversalJournalEntryId,
      };
    }

    // Unhandled status
    return {
      success: false,
      paymentId,
      status: payment.status as "draft" | "posted",
      idempotent: false,
      error: `Cannot void payment with status: ${payment.status}`,
    };
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   Simple Ledger Entry (for expenses, transfers, capital, payroll, etc.)
   ───────────────────────────────────────────────────────────────────────────── */

export interface SimpleLedgerEntryLine {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface SimpleLedgerEntryInput {
  tenantId: string;
  actorId: string;
  postingDate: string;
  memo: string;
  source: string; // e.g., "expense", "transfer", "capital", "payroll"
  lines: SimpleLedgerEntryLine[];
}

export interface SimpleLedgerEntryResult {
  success: boolean;
  journalEntryId?: string;
  transactionSetId?: string;
  error?: string;
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

/* ─────────────────────────────────────────────────────────────────────────────
   Payment Unallocation
   ───────────────────────────────────────────────────────────────────────────── */

export interface UnallocatePaymentInput {
  tenantId: string;
  actorId: string;
  paymentId: string;
  allocationId?: string;
  targetType?: "sales_doc" | "purchase_doc";
  targetId?: string;
  reason?: string;
}

export interface UnallocatePaymentResult {
  ok: boolean;
  paymentId: string;
  allocationId?: string;
  previousAmount?: number;
  idempotent?: boolean;
  message?: string;
  error?: string;
}

/**
 * Unallocate a payment allocation.
 *
 * Sets the allocation amount to 0 instead of deleting (preserves history, passes guard:nodelete).
 * Only allowed when payment.status is 'draft'.
 */
export async function unallocatePayment(input: UnallocatePaymentInput): Promise<UnallocatePaymentResult> {
  const { tenantId, actorId, paymentId, allocationId, targetType, targetId, reason } = input;

  return await db.transaction(async (tx) => {
    // 1. Load payment
    const [payment] = await tx
      .select({ id: payments.id, status: payments.status })
      .from(payments)
      .where(
        and(
          eq(payments.id, paymentId),
          eq(payments.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!payment) {
      return {
        ok: false,
        paymentId,
        error: "Payment not found",
      };
    }

    // 2. Check payment status - must be draft
    if (payment.status === "posted") {
      return {
        ok: false,
        paymentId,
        error: "Payment is posted. Void the payment and recreate it to change allocations.",
      };
    }

    if (payment.status === "void") {
      return {
        ok: false,
        paymentId,
        error: "Payment is voided. Cannot unallocate.",
      };
    }

    // 3. Find allocation
    let allocation;

    if (allocationId) {
      // Find by allocationId
      const [found] = await tx
        .select()
        .from(paymentAllocations)
        .where(
          and(
            eq(paymentAllocations.id, allocationId),
            eq(paymentAllocations.tenantId, tenantId),
            eq(paymentAllocations.paymentId, paymentId)
          )
        )
        .limit(1);
      allocation = found;
    } else if (targetType && targetId) {
      // Find by targetType + targetId
      const [found] = await tx
        .select()
        .from(paymentAllocations)
        .where(
          and(
            eq(paymentAllocations.tenantId, tenantId),
            eq(paymentAllocations.paymentId, paymentId),
            eq(paymentAllocations.targetType, targetType),
            eq(paymentAllocations.targetId, targetId)
          )
        )
        .limit(1);
      allocation = found;
    } else {
      return {
        ok: false,
        paymentId,
        error: "Must provide either allocationId or (targetType + targetId)",
      };
    }

    // 4. Check if allocation exists
    if (!allocation) {
      return {
        ok: true,
        paymentId,
        idempotent: true,
        message: "Allocation not found or already unallocated",
      };
    }

    // 5. Check if already unallocated (amount is 0)
    const previousAmount = parseFloat(allocation.amount);
    if (previousAmount === 0) {
      return {
        ok: true,
        paymentId,
        allocationId: allocation.id,
        previousAmount: 0,
        idempotent: true,
        message: "Already unallocated",
      };
    }

    // 6. Update allocation amount to 0
    await tx
      .update(paymentAllocations)
      .set({ amount: "0.000000" })
      .where(eq(paymentAllocations.id, allocation.id));

    // 7. Log audit event
    await logAuditEvent({
      tenantId,
      actorId,
      entityType: "payment_allocation",
      entityId: allocation.id,
      action: "payment_unallocated",
      metadata: {
        paymentId,
        allocationId: allocation.id,
        targetType: allocation.targetType,
        targetId: allocation.targetId,
        previousAmount,
        reason: reason || "No reason provided",
      },
    });

    return {
      ok: true,
      paymentId,
      allocationId: allocation.id,
      previousAmount,
    };
  });
}
