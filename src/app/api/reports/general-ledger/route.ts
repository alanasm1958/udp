/**
 * /api/reports/general-ledger
 *
 * GET: General ledger report for a specific account
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";
import { db } from "@/db";
import { accounts, journalLines, journalEntries } from "@/db/schema";
import { eq, and, gte, lte, asc } from "drizzle-orm";

interface LedgerLine {
  journalEntryId: string;
  postingDate: string;
  memo: string | null;
  lineDescription: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
}

/**
 * GET /api/reports/general-ledger
 * Query params: accountCode, from?, to?, limit?, offset?
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { searchParams } = new URL(req.url);

    const accountCode = searchParams.get("accountCode");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    if (!accountCode) {
      return NextResponse.json({ error: "accountCode is required" }, { status: 400 });
    }

    // Find the account
    const [account] = await db
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
          eq(accounts.code, accountCode)
        )
      )
      .limit(1);

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Build query conditions
    const conditions = [
      eq(journalLines.tenantId, tenantId),
      eq(journalLines.accountId, account.id),
    ];

    if (from) {
      conditions.push(gte(journalEntries.postingDate, from));
    }
    if (to) {
      conditions.push(lte(journalEntries.postingDate, to));
    }

    // Get journal lines
    const lines = await db
      .select({
        journalEntryId: journalEntries.id,
        postingDate: journalEntries.postingDate,
        memo: journalEntries.memo,
        lineDescription: journalLines.description,
        debit: journalLines.debit,
        credit: journalLines.credit,
        entryDate: journalEntries.entryDate,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .where(and(...conditions))
      .orderBy(asc(journalEntries.postingDate), asc(journalEntries.entryDate))
      .limit(limit)
      .offset(offset);

    // Calculate running balance
    let runningBalance = 0;
    const items: LedgerLine[] = lines.map((line) => {
      const debit = parseFloat(line.debit);
      const credit = parseFloat(line.credit);
      runningBalance += debit - credit;
      return {
        journalEntryId: line.journalEntryId,
        postingDate: line.postingDate,
        memo: line.memo,
        lineDescription: line.lineDescription,
        debit,
        credit,
        runningBalance,
      };
    });

    return NextResponse.json({
      account: {
        code: account.code,
        name: account.name,
        type: account.type,
      },
      dateRange: { from, to },
      items,
      pagination: {
        limit,
        offset,
        hasMore: items.length === limit,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/reports/general-ledger error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
