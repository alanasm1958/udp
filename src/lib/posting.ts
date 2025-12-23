/**
 * Posting service placeholder
 *
 * THIS IS THE ONLY FILE ALLOWED TO WRITE TO journal_entries AND journal_lines.
 *
 * Layer 1 does not implement posting. This file exists to:
 * 1. Mark the allowed location for future ledger writes
 * 2. Allow the guardrail script to verify no other files write to ledger tables
 *
 * Future implementation will include:
 * - postTransactionSet(transactionSetId): Creates journal entries from posted transaction set
 * - Validation that transaction_set is in "posted" status
 * - Atomic creation of journal_entry + journal_lines
 * - Audit logging for posting actions
 */

// Placeholder types for future implementation
export interface PostingResult {
  journalEntryId: string;
  journalLineIds: string[];
}

// Future: This function will be implemented to post transaction sets to the ledger
// export async function postTransactionSet(
//   tenantId: string,
//   actorId: string,
//   transactionSetId: string
// ): Promise<PostingResult> {
//   // Will insert into journalEntries and journalLines here
//   throw new Error("Not implemented in Layer 1");
// }
