/**
 * /api/finance/reconciliation/[id]
 *
 * GET: Get reconciliation session details with lines
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";
import { db } from "@/db";
import {
  bankReconciliationSessions,
  bankStatementLines,
  accounts,
  journalLines,
  journalEntries,
} from "@/db/schema";
import { eq, and, lte } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/finance/reconciliation/[id]
 * Returns session details with statement lines and book transactions
 */
export async function GET(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await params;

    // Fetch session
    const [session] = await db
      .select()
      .from(bankReconciliationSessions)
      .where(
        and(
          eq(bankReconciliationSessions.id, id),
          eq(bankReconciliationSessions.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Get account info
    const [account] = await db
      .select({ id: accounts.id, code: accounts.code, name: accounts.name })
      .from(accounts)
      .where(eq(accounts.id, session.accountId))
      .limit(1);

    // Get statement lines (imported from bank)
    const statementLines = await db
      .select()
      .from(bankStatementLines)
      .where(
        and(
          eq(bankStatementLines.tenantId, tenantId),
          eq(bankStatementLines.reconciliationSessionId, id)
        )
      )
      .orderBy(bankStatementLines.transactionDate);

    // Get book transactions (journal lines for this account up to statement date)
    const bookTransactions = await db
      .select({
        id: journalLines.id,
        journalEntryId: journalLines.journalEntryId,
        postingDate: journalEntries.postingDate,
        memo: journalEntries.memo,
        debit: journalLines.debit,
        credit: journalLines.credit,
        description: journalLines.description,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(journalLines.tenantId, tenantId),
          eq(journalLines.accountId, session.accountId),
          lte(journalEntries.postingDate, session.statementDate)
        )
      )
      .orderBy(journalEntries.postingDate);

    // Calculate book balance (for bank accounts: debits increase, credits decrease)
    const bookBalance = bookTransactions.reduce((sum, tx) => {
      const debit = parseFloat(tx.debit);
      const credit = parseFloat(tx.credit);
      return sum + debit - credit;
    }, 0);

    // Get matched line IDs - based on the schema, lines match to journal entries not journal lines
    const matchedJournalEntryIds = new Set(
      statementLines
        .filter((line) => line.matchedJournalEntryId)
        .map((line) => line.matchedJournalEntryId)
    );

    // Calculate reconciled balance (book balance - unmatched book transactions)
    const unmatchedBookAmount = bookTransactions
      .filter((tx) => !matchedJournalEntryIds.has(tx.journalEntryId))
      .reduce((sum, tx) => {
        const debit = parseFloat(tx.debit);
        const credit = parseFloat(tx.credit);
        return sum + debit - credit;
      }, 0);

    const reconciledBalance = bookBalance - unmatchedBookAmount;

    // Calculate statistics
    const matchedStatementCount = statementLines.filter((l) => l.matchedJournalEntryId || l.matchedPaymentId).length;
    const unmatchedStatementCount = statementLines.length - matchedStatementCount;
    const unmatchedBookCount = bookTransactions.filter((tx) => !matchedJournalEntryIds.has(tx.journalEntryId)).length;

    return NextResponse.json({
      session: {
        ...session,
        account,
      },
      statementLines: statementLines.map((line) => ({
        id: line.id,
        transactionDate: line.transactionDate,
        description: line.description,
        reference: line.reference,
        amount: parseFloat(line.amount),
        transactionType: line.transactionType,
        status: line.status,
        matchedPaymentId: line.matchedPaymentId,
        matchedJournalEntryId: line.matchedJournalEntryId,
        matchConfidence: line.matchConfidence ? parseFloat(line.matchConfidence) : null,
        isMatched: line.status === "matched",
      })),
      bookTransactions: bookTransactions.map((tx) => ({
        id: tx.id,
        journalEntryId: tx.journalEntryId,
        postingDate: tx.postingDate,
        memo: tx.memo,
        description: tx.description,
        debit: parseFloat(tx.debit),
        credit: parseFloat(tx.credit),
        amount: parseFloat(tx.debit) - parseFloat(tx.credit),
        isMatched: matchedJournalEntryIds.has(tx.journalEntryId),
      })),
      summary: {
        statementEndingBalance: parseFloat(session.statementEndingBalance),
        bookBalance,
        reconciledBalance,
        difference: parseFloat(session.statementEndingBalance) - reconciledBalance,
        matchedStatementCount,
        unmatchedStatementCount,
        unmatchedBookCount,
        totalStatementLines: statementLines.length,
        totalBookTransactions: bookTransactions.length,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/finance/reconciliation/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
