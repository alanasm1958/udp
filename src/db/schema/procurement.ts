/**
 * Procurement domain schema - re-exports procurement-related tables from the main schema.
 *
 * Includes: Purchase Documents, Lines, Receipts, Receipt Details, Landed Costs.
 */
export {
  // Purchase Documents
  purchaseDocs,
  purchaseDocLines,
  purchaseReceipts,
  purchasePostingLinks,
  // Receipt Details
  purchaseReceiptDetails,
  // Landed Costs
  landedCosts,
  landedCostAllocations,
  // Enums
  purchaseReceiptType,
} from "../schema";
