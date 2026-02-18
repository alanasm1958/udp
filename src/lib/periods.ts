/**
 * Accounting Periods Library
 *
 * Provides period validation, closing logic, and checklist calculations.
 */

import { db } from "@/db";
import {
  accountingPeriods,
  transactionSets,
  payments,
  journalEntries,
  journalLines,
  accounts,
} from "@/db/schema";
import { eq, and, gte, lte, sql, count } from "drizzle-orm";

export interface PeriodValidationResult {
  allowed: boolean;
  warning?: string;
  error?: string;
  periodId?: string;
  periodStatus?: string;
}

export interface ChecklistSnapshot {
  unmatchedPayments: number;
  missingReceipts: number;
  pendingTasks: number;
  draftTransactions: number;
  scheduledDepreciation: number;
  scheduledAmortization: number;
}

export interface PeriodTotals {
  revenue: number;
  expenses: number;
  netIncome: number;
  cashChange: number;
}

/**
 * Get the period start date (first of month) from a posting date
 */
export function getPeriodStart(postingDate: string): string {
  return postingDate.substring(0, 7) + "-01";
}

/**
 * Get the period end date (last day of month) from a posting date
 */
export function getPeriodEnd(postingDate: string): string {
  const date = new Date(postingDate);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return lastDay.toISOString().split("T")[0];
}

/**
 * Get period label (e.g., "January 2025")
 */
export function getPeriodLabel(periodStart: string): string {
  const date = new Date(periodStart);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/**
 * Validate if posting is allowed for a given date
 */
export async function validatePeriodForPosting(
  tenantId: string,
  postingDate: string
): Promise<PeriodValidationResult> {
  const periodStart = getPeriodStart(postingDate);

  const [period] = await db
    .select({
      id: accountingPeriods.id,
      status: accountingPeriods.status,
    })
    .from(accountingPeriods)
    .where(
      and(
        eq(accountingPeriods.tenantId, tenantId),
        eq(accountingPeriods.periodStart, periodStart)
      )
    )
    .limit(1);

  // No period defined = open (auto-create on first post)
  if (!period) {
    return { allowed: true };
  }

  switch (period.status) {
    case "open":
      return { allowed: true, periodId: period.id, periodStatus: period.status };
    case "soft_closed":
      return {
        allowed: true,
        warning: `Period ${getPeriodLabel(periodStart)} is soft-closed. Transaction will be recorded but period should be reviewed.`,
        periodId: period.id,
        periodStatus: period.status,
      };
    case "hard_closed":
      return {
        allowed: false,
        error: `Cannot post to closed period ${getPeriodLabel(periodStart)}. Reopen the period first.`,
        periodId: period.id,
        periodStatus: period.status,
      };
    default:
      return { allowed: true, periodId: period.id, periodStatus: period.status };
  }
}

/**
 * Get or create a period for a given date
 */
export async function getOrCreatePeriod(
  tenantId: string,
  postingDate: string
): Promise<{ id: string; status: string }> {
  const periodStart = getPeriodStart(postingDate);
  const periodEnd = getPeriodEnd(postingDate);
  const periodLabel = getPeriodLabel(periodStart);

  // Check if period exists
  const [existing] = await db
    .select({ id: accountingPeriods.id, status: accountingPeriods.status })
    .from(accountingPeriods)
    .where(
      and(
        eq(accountingPeriods.tenantId, tenantId),
        eq(accountingPeriods.periodStart, periodStart)
      )
    )
    .limit(1);

  if (existing) {
    return existing;
  }

  // Create new period
  const [newPeriod] = await db
    .insert(accountingPeriods)
    .values({
      tenantId,
      periodStart,
      periodEnd,
      periodLabel,
      status: "open",
    })
    .returning({ id: accountingPeriods.id, status: accountingPeriods.status });

  return newPeriod;
}

/**
 * Calculate the checklist snapshot for period soft-close
 */
export async function calculateChecklist(
  tenantId: string,
  periodStart: string,
  periodEnd: string
): Promise<ChecklistSnapshot> {
  // Count draft transaction sets in the period
  const [draftResult] = await db
    .select({ count: count() })
    .from(transactionSets)
    .where(
      and(
        eq(transactionSets.tenantId, tenantId),
        eq(transactionSets.status, "draft"),
        gte(transactionSets.businessDate, periodStart),
        lte(transactionSets.businessDate, periodEnd)
      )
    );

  // Count payments without reconciliation in the period
  const [unmatchedResult] = await db
    .select({ count: count() })
    .from(payments)
    .where(
      and(
        eq(payments.tenantId, tenantId),
        eq(payments.status, "posted"),
        gte(payments.paymentDate, periodStart),
        lte(payments.paymentDate, periodEnd)
        // In a full implementation, we'd also check for missing reconciliation records
      )
    );

  return {
    unmatchedPayments: 0, // Would require reconciliation tracking
    missingReceipts: 0, // Would require receipt tracking
    pendingTasks: 0, // Would require task integration
    draftTransactions: draftResult?.count || 0,
    scheduledDepreciation: 0, // Would require depreciation schedule
    scheduledAmortization: 0, // Would require amortization schedule
  };
}

/**
 * Calculate period totals for hard-close
 */
export async function calculatePeriodTotals(
  tenantId: string,
  periodStart: string,
  periodEnd: string
): Promise<PeriodTotals> {
  // Get income and expense totals for the period
  const results = await db
    .select({
      accountType: accounts.type,
      totalDebit: sql<string>`COALESCE(SUM(${journalLines.debit}), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(
      and(
        eq(journalLines.tenantId, tenantId),
        gte(journalEntries.postingDate, periodStart),
        lte(journalEntries.postingDate, periodEnd),
        sql`${accounts.type} IN ('income', 'expense', 'asset')`
      )
    )
    .groupBy(accounts.type);

  let revenue = 0;
  let expenses = 0;
  const cashChange = 0;

  for (const row of results) {
    const debit = parseFloat(row.totalDebit);
    const credit = parseFloat(row.totalCredit);

    if (row.accountType === "income") {
      revenue = credit - debit;
    } else if (row.accountType === "expense") {
      expenses = debit - credit;
    }
    // Cash change would require filtering to just cash accounts
  }

  return {
    revenue,
    expenses,
    netIncome: revenue - expenses,
    cashChange,
  };
}
