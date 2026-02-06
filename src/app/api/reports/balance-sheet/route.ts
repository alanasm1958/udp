/**
 * /api/reports/balance-sheet
 *
 * GET: Balance Sheet report as of a given date
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";
import { db } from "@/db";
import { accounts, journalLines, journalEntries } from "@/db/schema";
import { eq, and, lte, lt, sql } from "drizzle-orm";

interface AccountLine {
  code: string;
  name: string;
  balance: number;
}

interface BalanceSheetSection {
  accounts: AccountLine[];
  total: number;
}

interface BalanceSheetResult {
  asOf: string;
  assets: {
    current: BalanceSheetSection;
    fixed: BalanceSheetSection;
    other: BalanceSheetSection;
    total: number;
  };
  liabilities: {
    current: BalanceSheetSection;
    longTerm: BalanceSheetSection;
    total: number;
  };
  equity: {
    capitalAccounts: BalanceSheetSection;
    retainedEarnings: number;
    currentYearEarnings: number;
    total: number;
  };
  totalLiabilitiesAndEquity: number;
  balanced: boolean;
}

/**
 * GET /api/reports/balance-sheet
 * Query params:
 *   - asOf: YYYY-MM-DD (defaults to today)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { searchParams } = new URL(req.url);

    const asOf = searchParams.get("asOf") || new Date().toISOString().split("T")[0];

    // Get all account balances up to asOf date
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
          lte(journalEntries.postingDate, asOf)
        )
      )
      .groupBy(journalLines.accountId);

    // Get balance sheet accounts (asset, liability, equity)
    const balanceSheetAccounts = await db
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
          sql`${accounts.type} IN ('asset', 'liability', 'equity')`
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

    // Calculate retained earnings from prior years (income - expenses before current year)
    const currentYear = new Date(asOf).getFullYear();
    const yearStart = `${currentYear}-01-01`;

    // Get prior year net income (all income/expense before current year)
    const priorYearBalances = await db
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
          lt(journalEntries.postingDate, yearStart),
          sql`${accounts.type} IN ('income', 'expense')`
        )
      )
      .groupBy(accounts.type);

    let priorYearIncome = 0;
    let priorYearExpenses = 0;
    for (const row of priorYearBalances) {
      const debit = parseFloat(row.totalDebit);
      const credit = parseFloat(row.totalCredit);
      if (row.accountType === "income") {
        priorYearIncome = credit - debit;
      } else if (row.accountType === "expense") {
        priorYearExpenses = debit - credit;
      }
    }
    const retainedEarnings = priorYearIncome - priorYearExpenses;

    // Get current year net income (YTD income - expenses)
    const currentYearBalances = await db
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
          sql`${journalEntries.postingDate} >= ${yearStart}`,
          lte(journalEntries.postingDate, asOf),
          sql`${accounts.type} IN ('income', 'expense')`
        )
      )
      .groupBy(accounts.type);

    let currentYearIncome = 0;
    let currentYearExpenses = 0;
    for (const row of currentYearBalances) {
      const debit = parseFloat(row.totalDebit);
      const credit = parseFloat(row.totalCredit);
      if (row.accountType === "income") {
        currentYearIncome = credit - debit;
      } else if (row.accountType === "expense") {
        currentYearExpenses = debit - credit;
      }
    }
    const currentYearEarnings = currentYearIncome - currentYearExpenses;

    // Categorize balance sheet accounts
    // Assets: code 1xxx (current: 1000-1399, fixed: 1400-1799, other: 1800-1999)
    // Liabilities: code 2xxx (current: 2000-2499, long-term: 2500-2999)
    // Equity: code 3xxx

    const currentAssets: AccountLine[] = [];
    const fixedAssets: AccountLine[] = [];
    const otherAssets: AccountLine[] = [];
    const currentLiabilities: AccountLine[] = [];
    const longTermLiabilities: AccountLine[] = [];
    const capitalAccounts: AccountLine[] = [];

    for (const account of balanceSheetAccounts) {
      const bal = balanceMap.get(account.id);
      if (!bal || (bal.debit === 0 && bal.credit === 0)) continue;

      // Asset balance = debits - credits (positive = asset)
      // Liability/Equity balance = credits - debits (positive = liability/equity)
      let balance: number;
      if (account.type === "asset") {
        balance = bal.debit - bal.credit;
      } else {
        balance = bal.credit - bal.debit;
      }

      if (Math.abs(balance) < 0.01) continue;

      const line: AccountLine = {
        code: account.code,
        name: account.name,
        balance,
      };

      const codeNum = parseInt(account.code.substring(0, 4), 10);

      if (account.type === "asset") {
        if (codeNum < 1400) {
          currentAssets.push(line);
        } else if (codeNum < 1800) {
          fixedAssets.push(line);
        } else {
          otherAssets.push(line);
        }
      } else if (account.type === "liability") {
        if (codeNum < 2500) {
          currentLiabilities.push(line);
        } else {
          longTermLiabilities.push(line);
        }
      } else if (account.type === "equity") {
        capitalAccounts.push(line);
      }
    }

    // Calculate totals
    const currentAssetsTotal = currentAssets.reduce((sum, a) => sum + a.balance, 0);
    const fixedAssetsTotal = fixedAssets.reduce((sum, a) => sum + a.balance, 0);
    const otherAssetsTotal = otherAssets.reduce((sum, a) => sum + a.balance, 0);
    const totalAssets = currentAssetsTotal + fixedAssetsTotal + otherAssetsTotal;

    const currentLiabilitiesTotal = currentLiabilities.reduce((sum, a) => sum + a.balance, 0);
    const longTermLiabilitiesTotal = longTermLiabilities.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = currentLiabilitiesTotal + longTermLiabilitiesTotal;

    const capitalAccountsTotal = capitalAccounts.reduce((sum, a) => sum + a.balance, 0);
    const totalEquity = capitalAccountsTotal + retainedEarnings + currentYearEarnings;

    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
    const balanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;

    const result: BalanceSheetResult = {
      asOf,
      assets: {
        current: { accounts: currentAssets, total: currentAssetsTotal },
        fixed: { accounts: fixedAssets, total: fixedAssetsTotal },
        other: { accounts: otherAssets, total: otherAssetsTotal },
        total: totalAssets,
      },
      liabilities: {
        current: { accounts: currentLiabilities, total: currentLiabilitiesTotal },
        longTerm: { accounts: longTermLiabilities, total: longTermLiabilitiesTotal },
        total: totalLiabilities,
      },
      equity: {
        capitalAccounts: { accounts: capitalAccounts, total: capitalAccountsTotal },
        retainedEarnings,
        currentYearEarnings,
        total: totalEquity,
      },
      totalLiabilitiesAndEquity,
      balanced,
    };

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/reports/balance-sheet error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
