/**
 * Posting Service - Barrel File
 *
 * Re-exports everything from all posting modules so that
 * `import { ... } from "@/lib/posting"` continues to work.
 *
 * THIS IS THE ONLY PACKAGE ALLOWED TO WRITE TO journal_entries AND journal_lines.
 */

// Types and error class
export {
  type PostingIntentLine,
  type PostingIntent,
  type PostingResult,
  type PostingContext,
  type ReversalInput,
  type ReversalResult,
  type InventoryPostingContext,
  type InventoryPostingResult,
  type SalesDocPostingContext,
  type SalesDocPostingResult,
  type PurchaseDocPostingContext,
  type PurchaseDocPostingResult,
  type PaymentPostingContext,
  type PaymentPostingResult,
  type VoidPaymentInput,
  type VoidPaymentResult,
  type UnallocatePaymentInput,
  type UnallocatePaymentResult,
  type SimpleLedgerEntryLine,
  type SimpleLedgerEntryInput,
  type SimpleLedgerEntryResult,
  PostingError,
} from "./types";

// Core posting functions
export {
  postTransactionSet,
  submitForReview,
  createSimpleLedgerEntry,
  parseNumeric,
  updateInventoryBalance,
} from "./core";

// Sales document posting
export { postSalesDoc } from "./sales";

// Purchase document posting
export { postPurchaseDoc } from "./purchase";

// Payment posting, voiding, and unallocation
export {
  postPayment,
  voidPayment,
  unallocatePayment,
} from "./payment";

// Inventory movement posting
export { postInventoryMovements } from "./inventory";

// Journal entry reversal
export { reverseJournalEntry } from "./journal";
