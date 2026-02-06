/**
 * /api/reports/profit-loss
 *
 * GET: Profit & Loss (Income Statement) report for a date range
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";
import { db } from "@/db";
import { accounts, journalLines, journalEntries } from "@/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

interface AccountLine {
  code: string;
  name: string;
  amount: number;
}

interface ProfitLossSection {
  accounts: AccountLine[];
  total: number;
}

interface ProfitLossResult {
  startDate: string;
  endDate: string;
  revenue: ProfitLossSection;
  costOfSales: ProfitLossSection;
  grossProfit: number;
  operatingExpenses: ProfitLossSection;
  operatingIncome: number;
  otherIncome: ProfitLossSection;
  otherExpenses: ProfitLossSection;
  netIncome: number;
  comparison?: {
    startDate: string;
    endDate: string;
    revenue: ProfitLossSection;
    costOfSales: ProfitLossSection;
    grossProfit: number;
    operatingExpenses: ProfitLossSection;
    operatingIncome: number;
    otherIncome: ProfitLossSection;
    otherExpenses: ProfitLossSection;
    netIncome: number;
  };
}

/**
 * Calculate P&L for a specific date range
 */
async function calculateProfitLoss(
  tenantId: string,
  startDate: string,
  endDate: string
): Promise<Omit<ProfitLossResult, "comparison">> {
  // Get all account balances within the date range
  const balances = await db
    .select({
      accountId: journalLines.accountId,
      totalDebit: sql<string>`COALESCE(SUM(${journalLines.debit}), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .where(
      and(
        eq(journalLines.tenantId, tenantId),
        gte(journalEntries.postingDate, startDate),
        lte(journalEntries.postingDate, endDate)
      )
    )
    .groupBy(journalLines.accountId);

  // Get income and expense accounts
  const incomeExpenseAccounts = await db
    .select({
      id: accounts.id,
      code: accounts.code,
      name: accounts.name,
      type: accounts.type,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.tenantId, tenantId),
        eq(accounts.isActive, true),
        sql`${accounts.type} IN ('income', 'expense')`
      )
    )
    .orderBy(accounts.code);

  // Map balances
  const balanceMap = new Map(
    balances.map((b) => [
      b.accountId,
      { debit: parseFloat(b.totalDebit), credit: parseFloat(b.totalCredit) },
    ])
  );

  // Categorize accounts
  // Revenue: income accounts (credit balances are positive)
  // Cost of Sales: expense accounts starting with 5xxx
  // Operating Expenses: expense accounts starting with 6xxx
  // Other Income: income accounts starting with 7xxx or 8xxx
  // Other Expenses: expense accounts starting with 7xxx, 8xxx, or 9xxx

  const revenue: AccountLine[] = [];
  const costOfSales: AccountLine[] = [];
  const operatingExpenses: AccountLine[] = [];
  const otherIncome: AccountLine[] = [];
  const otherExpenses: AccountLine[] = [];

  for (const account of incomeExpenseAccounts) {
    const bal = balanceMap.get(account.id);
    if (!bal || (bal.debit === 0 && bal.credit === 0)) continue;

    // For income accounts: amount = credits - debits (positive = revenue)
    // For expense accounts: amount = debits - credits (positive = expense)
    const amount =
      account.type === "income"
        ? bal.credit - bal.debit
        : bal.debit - bal.credit;

    if (Math.abs(amount) < 0.01) continue;

    const line: AccountLine = {
      code: account.code,
      name: account.name,
      amount: Math.abs(amount),
    };

    const codePrefix = account.code.substring(0, 1);

    if (account.type === "income") {
      // Income accounts
      if (codePrefix === "7" || codePrefix === "8") {
        otherIncome.push(line);
      } else {
        revenue.push(line);
      }
    } else {
      // Expense accounts
      if (codePrefix === "5") {
        costOfSales.push(line);
      } else if (codePrefix === "6") {
        operatingExpenses.push(line);
      } else {
        otherExpenses.push(line);
      }
    }
  }

  // Calculate totals
  const revenueTotal = revenue.reduce((sum, a) => sum + a.amount, 0);
  const costOfSalesTotal = costOfSales.reduce((sum, a) => sum + a.amount, 0);
  const grossProfit = revenueTotal - costOfSalesTotal;
  const operatingExpensesTotal = operatingExpenses.reduce((sum, a) => sum + a.amount, 0);
  const operatingIncome = grossProfit - operatingExpensesTotal;
  const otherIncomeTotal = otherIncome.reduce((sum, a) => sum + a.amount, 0);
  const otherExpensesTotal = otherExpenses.reduce((sum, a) => sum + a.amount, 0);
  const netIncome = operatingIncome + otherIncomeTotal - otherExpensesTotal;

  return {
    startDate,
    endDate,
    revenue: { accounts: revenue, total: revenueTotal },
    costOfSales: { accounts: costOfSales, total: costOfSalesTotal },
    grossProfit,
    operatingExpenses: { accounts: operatingExpenses, total: operatingExpensesTotal },
    operatingIncome,
    otherIncome: { accounts: otherIncome, total: otherIncomeTotal },
    otherExpenses: { accounts: otherExpenses, total: otherExpensesTotal },
    netIncome,
  };
}

/**
 * GET /api/reports/profit-loss
 * Query params:
 *   - startDate: YYYY-MM-DD (defaults to first day of current month)
 *   - endDate: YYYY-MM-DD (defaults to today)
 *   - compareStartDate: YYYY-MM-DD (optional, for comparison period)
 *   - compareEndDate: YYYY-MM-DD (optional, for comparison period)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { searchParams } = new URL(req.url);

    // Default to current month
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const startDate =
      searchParams.get("startDate") || firstOfMonth.toISOString().split("T")[0];
    const endDate =
      searchParams.get("endDate") || today.toISOString().split("T")[0];

    // Calculate main period
    const result = await calculateProfitLoss(tenantId, startDate, endDate);

    // Calculate comparison period if requested
    const compareStartDate = searchParams.get("compareStartDate");
    const compareEndDate = searchParams.get("compareEndDate");

    if (compareStartDate && compareEndDate) {
      const comparison = await calculateProfitLoss(
        tenantId,
        compareStartDate,
        compareEndDate
      );
      return NextResponse.json({
        ...result,
        comparison: {
          startDate: comparison.startDate,
          endDate: comparison.endDate,
          revenue: comparison.revenue,
          costOfSales: comparison.costOfSales,
          grossProfit: comparison.grossProfit,
          operatingExpenses: comparison.operatingExpenses,
          operatingIncome: comparison.operatingIncome,
          otherIncome: comparison.otherIncome,
          otherExpenses: comparison.otherExpenses,
          netIncome: comparison.netIncome,
        },
      } as ProfitLossResult);
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/reports/profit-loss error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
