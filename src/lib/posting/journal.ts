/**
 * Posting Service - Journal Entry Reversal
 *
 * Reverses a posted journal entry by creating a new journal entry
 * with inverted lines (debits become credits, credits become debits).
 *
 * Uses reversal_links for idempotency - if already reversed, returns existing reversal.
 *
 * THIS MODULE WRITES TO LEDGER TABLES (journal_entries, journal_lines).
 */

import { db } from "@/db";
import {
  transactionSets,
  journalEntries,
  journalLines,
  reversalLinks,
} from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { logAuditEvent } from "../audit";

import type {
  ReversalInput,
  ReversalResult,
} from "./types";

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
