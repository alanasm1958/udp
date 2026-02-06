/**
 * /api/finance/reconciliation/[id]/auto-match
 *
 * POST: Automatically match statement lines to journal entries
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
 * POST /api/finance/reconciliation/[id]/auto-match
 * Attempts to automatically match unmatched statement lines to journal entries
 * Matching criteria: amount and date (within 3 days tolerance)
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
        { error: "Cannot auto-match in a completed or abandoned session" },
        { status: 400 }
      );
    }

    // Get unmatched statement lines
    const unmatchedStatementLines = await db
      .select()
      .from(bankStatementLines)
      .where(
        and(
          eq(bankStatementLines.tenantId, tenantId),
          eq(bankStatementLines.reconciliationSessionId, id),
          eq(bankStatementLines.status, "unmatched")
        )
      );

    if (unmatchedStatementLines.length === 0) {
      return NextResponse.json({
        matched: 0,
        message: "No unmatched statement lines",
      });
    }

    // Get journal entries and their lines for this account up to statement date
    const alreadyMatchedEntryIds = await db
      .select({ matchedJournalEntryId: bankStatementLines.matchedJournalEntryId })
      .from(bankStatementLines)
      .where(
        and(
          eq(bankStatementLines.tenantId, tenantId),
          eq(bankStatementLines.reconciliationSessionId, id),
          sql`${bankStatementLines.matchedJournalEntryId} IS NOT NULL`
        )
      );

    const matchedEntryIds = new Set(
      alreadyMatchedEntryIds.map((r) => r.matchedJournalEntryId).filter(Boolean)
    );

    // Get journal entries with their account-specific amounts
    const journalEntriesForAccount = await db
      .select({
        journalEntryId: journalEntries.id,
        postingDate: journalEntries.postingDate,
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
      );

    // Filter out already matched entries
    const availableEntries = journalEntriesForAccount.filter(
      (je) => !matchedEntryIds.has(je.journalEntryId)
    );

    // Try to match each unmatched statement line
    const matches: Array<{ statementLineId: string; journalEntryId: string; confidence: number }> = [];

    for (const stmtLine of unmatchedStatementLines) {
      const stmtAmount = parseFloat(stmtLine.amount);
      const stmtDate = new Date(stmtLine.transactionDate);

      // Find matching journal entry by amount and date
      const match = availableEntries.find((je) => {
        // Calculate journal line amount for this account
        const jeDebit = parseFloat(je.debit);
        const jeCredit = parseFloat(je.credit);
        const jeNetAmount = jeDebit - jeCredit; // Positive = debit, negative = credit

        // Statement line amount: positive = deposit, negative = withdrawal
        // Check amount match (within 0.01 tolerance)
        const amountMatch = Math.abs(stmtAmount - jeNetAmount) < 0.01;
        if (!amountMatch) return false;

        // Check date match (within 3 days tolerance)
        const jeDate = new Date(je.postingDate);
        const daysDiff = Math.abs(
          (stmtDate.getTime() - jeDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const dateMatch = daysDiff <= 3;

        return dateMatch;
      });

      if (match) {
        // Remove from available list to prevent double-matching
        const matchIndex = availableEntries.findIndex(
          (je) => je.journalEntryId === match.journalEntryId
        );
        if (matchIndex > -1) {
          availableEntries.splice(matchIndex, 1);
        }

        // Calculate confidence based on date proximity
        const jeDate = new Date(match.postingDate);
        const daysDiff = Math.abs(
          (stmtDate.getTime() - jeDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const confidence = daysDiff === 0 ? 100 : daysDiff <= 1 ? 90 : daysDiff <= 2 ? 80 : 70;

        matches.push({
          statementLineId: stmtLine.id,
          journalEntryId: match.journalEntryId,
          confidence,
        });
      }
    }

    // Apply matches
    for (const match of matches) {
      await db
        .update(bankStatementLines)
        .set({
          matchedJournalEntryId: match.journalEntryId,
          status: "matched",
          matchConfidence: match.confidence.toFixed(2),
          matchedAt: sql`now()`,
          matchedByActorId: actor.actorId,
        })
        .where(eq(bankStatementLines.id, match.statementLineId));
    }

    if (matches.length > 0) {
      await audit.log(
        "bank_reconciliation_session",
        id,
        "reconciliation_auto_matched",
        {
          matchCount: matches.length,
          matches: matches.map((m) => ({
            statementLineId: m.statementLineId,
            journalEntryId: m.journalEntryId,
            confidence: m.confidence,
          })),
        }
      );
    }

    return NextResponse.json({
      matched: matches.length,
      matches: matches.map((m) => ({
        statementLineId: m.statementLineId,
        journalEntryId: m.journalEntryId,
        confidence: m.confidence,
      })),
      remaining: unmatchedStatementLines.length - matches.length,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/finance/reconciliation/[id]/auto-match error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
