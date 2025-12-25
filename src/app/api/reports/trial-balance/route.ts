/**
 * /api/reports/trial-balance
 *
 * GET: Trial balance report as of a given date
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";
import { db } from "@/db";
import { accounts, journalLines, journalEntries } from "@/db/schema";
import { eq, and, lte, sql } from "drizzle-orm";

interface TrialBalanceRow {
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
}

/**
 * GET /api/reports/trial-balance
 * Query params: asOf=YYYY-MM-DD (defaults to today)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { searchParams } = new URL(req.url);

    const asOf = searchParams.get("asOf") || new Date().toISOString().split("T")[0];

    // Get account balances from journal lines up to asOf date
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

    // Get active accounts
    const activeAccounts = await db
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
          eq(accounts.isActive, true)
        )
      )
      .orderBy(accounts.code);

    // Map balances to accounts
    const balanceMap = new Map(
      balances.map((b) => [b.accountId, { debit: parseFloat(b.totalDebit), credit: parseFloat(b.totalCredit) }])
    );

    const rows: TrialBalanceRow[] = [];
    let totalDebit = 0;
    let totalCredit = 0;

    for (const account of activeAccounts) {
      const bal = balanceMap.get(account.id) || { debit: 0, credit: 0 };

      // Only include accounts with activity
      if (bal.debit > 0 || bal.credit > 0) {
        const balance = bal.debit - bal.credit;
        rows.push({
          code: account.code,
          name: account.name,
          type: account.type,
          debit: bal.debit,
          credit: bal.credit,
          balance,
        });
        totalDebit += bal.debit;
        totalCredit += bal.credit;
      }
    }

    return NextResponse.json({
      asOf,
      rows,
      totals: {
        debit: totalDebit,
        credit: totalCredit,
        balanced: Math.abs(totalDebit - totalCredit) < 0.01,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/reports/trial-balance error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
