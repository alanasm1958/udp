/**
 * Posting Service - Shared Types
 *
 * All interfaces, types, and error classes used across the posting modules.
 */

// ─── Core posting types ─────────────────────────────────────────────────────

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

// ─── Journal reversal types ─────────────────────────────────────────────────

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

// ─── Inventory posting types ────────────────────────────────────────────────

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

// ─── Sales posting types ────────────────────────────────────────────────────

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

// ─── Purchase posting types ─────────────────────────────────────────────────

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

// ─── Payment posting types ──────────────────────────────────────────────────

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

// ─── Simple ledger entry types ──────────────────────────────────────────────

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

// ─── Error class ────────────────────────────────────────────────────────────

/**
 * Custom error class for posting failures.
 */
export class PostingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PostingError";
  }
}
