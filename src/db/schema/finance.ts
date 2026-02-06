/**
 * Finance domain schema - re-exports finance-related tables from the main schema.
 *
 * Includes: Chart of Accounts, Journal Entries, Payments, Prepaid/Deferred,
 * Fixed Assets, Bank Reconciliation, Recurring Transactions, Invoice Follow-ups.
 */
export {
  // Chart of Accounts
  chartOfAccounts,
  accounts,
  // Journal Entries
  journalEntries,
  journalLines,
  reversalLinks,
  // Posting
  postingRuns,
  // Payments
  payments,
  paymentAllocations,
  paymentPostingLinks,
  // Prepaid Expenses
  prepaidExpenses,
  prepaidAmortizationSchedule,
  // Deferred Revenue
  deferredRevenue,
  deferredRevenueRecognition,
  // Fixed Assets
  fixedAssets,
  depreciationSchedule,
  // Accounting Periods
  accountingPeriods,
  // Bank Reconciliation
  bankReconciliationSessions,
  bankStatementLines,
  transactionReconciliation,
  // Expense Accruals
  expenseAccruals,
  // Recurring Transactions
  recurringTransactions,
  recurringTransactionInstances,
  // Invoice Follow-ups
  invoiceFollowUps,
  invoiceFollowUpActivities,
  // Billing & Subscriptions
  subscriptionPlans,
  tenantSubscriptions,
  subscriptionEvents,
  // Transaction Framework
  transactionSets,
  businessTransactions,
  businessTransactionLines,
  postingIntents,
  approvals,
  // Enums
  accountType,
  transactionSetStatus,
  approvalStatus,
  subscriptionStatus,
  billingType,
} from "../schema";
