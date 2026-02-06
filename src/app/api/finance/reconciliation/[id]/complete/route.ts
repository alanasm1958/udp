/**
 * /api/finance/reconciliation/[id]/complete
 *
 * POST: Complete a reconciliation session
 */

import { NextRequest, NextResponse } from "next/server";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { db } from "@/db";
import {
  bankReconciliationSessions,
  bankStatementLines,
  journalLines,
  journalEntries,
} from "@/db/schema";
import { eq, and, lte, sql } from "drizzle-orm";
import { createAuditContext } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/finance/reconciliation/[id]/complete
 * Body:
 *   - force?: boolean (complete even if difference is not zero)
 */
export async function POST(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const { force = false } = body;

    // Verify session exists and is in progress
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

    if (session.status !== "in_progress") {
      return NextResponse.json(
        { error: "Session is not in progress" },
        { status: 400 }
      );
    }

    // Get statement lines
    const statementLines = await db
      .select()
      .from(bankStatementLines)
      .where(
        and(
          eq(bankStatementLines.tenantId, tenantId),
          eq(bankStatementLines.reconciliationSessionId, id)
        )
      );

    // Get matched entry IDs
    const matchedJournalEntryIds = new Set(
      statementLines
        .filter((line) => line.matchedJournalEntryId)
        .map((line) => line.matchedJournalEntryId)
    );

    // Get book transactions
    const bookTransactions = await db
      .select({
        journalEntryId: journalLines.journalEntryId,
        debit: journalLines.debit,
        credit: journalLines.credit,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(journalLines.tenantId, tenantId),
          eq(journalLines.accountId, session.accountId),
          lte(journalEntries.postingDate, session.statementDate)
        )
      );

    // Calculate book balance
    const bookBalance = bookTransactions.reduce((sum, tx) => {
      const debit = parseFloat(tx.debit);
      const credit = parseFloat(tx.credit);
      return sum + debit - credit;
    }, 0);

    // Calculate reconciled balance (matched transactions only)
    const matchedBookAmount = bookTransactions
      .filter((tx) => matchedJournalEntryIds.has(tx.journalEntryId))
      .reduce((sum, tx) => {
        const debit = parseFloat(tx.debit);
        const credit = parseFloat(tx.credit);
        return sum + debit - credit;
      }, 0);

    // Reconciled balance = matched book transactions
    const reconciledBalance = matchedBookAmount;
    const statementEndingBalance = parseFloat(session.statementEndingBalance);
    const difference = statementEndingBalance - reconciledBalance;

    // Check if balanced (allow small tolerance for rounding)
    if (Math.abs(difference) > 0.01 && !force) {
      return NextResponse.json(
        {
          error: "Reconciliation is not balanced",
          statementEndingBalance,
          bookBalance,
          reconciledBalance,
          difference,
          hint: "Use force: true to complete anyway, or match remaining items",
        },
        { status: 400 }
      );
    }

    // Update session to completed
    await db
      .update(bankReconciliationSessions)
      .set({
        status: "completed",
        difference: difference.toFixed(6),
        completedAt: sql`now()`,
        completedByActorId: actor.actorId,
      })
      .where(eq(bankReconciliationSessions.id, id));

    await audit.log(
      "bank_reconciliation_session",
      id,
      "reconciliation_completed",
      {
        statementEndingBalance,
        bookBalance,
        reconciledBalance,
        difference,
        matchedStatementLines: statementLines.filter((l) => l.status === "matched").length,
        totalStatementLines: statementLines.length,
        totalBookTransactions: bookTransactions.length,
        forced: force && Math.abs(difference) > 0.01,
      }
    );

    return NextResponse.json({
      completed: true,
      statementEndingBalance,
      bookBalance,
      reconciledBalance,
      difference,
      balanced: Math.abs(difference) <= 0.01,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/finance/reconciliation/[id]/complete error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
