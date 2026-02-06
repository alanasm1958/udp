/**
 * /api/finance/reconciliation/[id]/match
 *
 * POST: Match a statement line to a journal entry
 * DELETE: Unmatch a statement line
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
  journalEntries,
  journalLines,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { createAuditContext } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/finance/reconciliation/[id]/match
 * Body:
 *   - statementLineId: UUID of bank statement line
 *   - journalEntryId: UUID of journal entry to match
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
    const body = await req.json();

    const { statementLineId, journalEntryId } = body;

    if (!statementLineId) {
      return NextResponse.json({ error: "statementLineId is required" }, { status: 400 });
    }
    if (!journalEntryId) {
      return NextResponse.json({ error: "journalEntryId is required" }, { status: 400 });
    }

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
        { error: "Cannot match in a completed or abandoned session" },
        { status: 400 }
      );
    }

    // Verify statement line exists and belongs to this session
    const [statementLine] = await db
      .select()
      .from(bankStatementLines)
      .where(
        and(
          eq(bankStatementLines.id, statementLineId),
          eq(bankStatementLines.tenantId, tenantId),
          eq(bankStatementLines.reconciliationSessionId, id)
        )
      )
      .limit(1);

    if (!statementLine) {
      return NextResponse.json({ error: "Statement line not found" }, { status: 404 });
    }

    if (statementLine.status === "matched") {
      return NextResponse.json(
        { error: "Statement line is already matched" },
        { status: 400 }
      );
    }

    // Verify journal entry exists and has lines for this account
    const [journalEntry] = await db
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.id, journalEntryId),
          eq(journalEntries.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!journalEntry) {
      return NextResponse.json({ error: "Journal entry not found" }, { status: 404 });
    }

    // Check that the journal entry has lines for the reconciliation account
    const [journalLine] = await db
      .select({ id: journalLines.id })
      .from(journalLines)
      .where(
        and(
          eq(journalLines.journalEntryId, journalEntryId),
          eq(journalLines.tenantId, tenantId),
          eq(journalLines.accountId, session.accountId)
        )
      )
      .limit(1);

    if (!journalLine) {
      return NextResponse.json(
        { error: "Journal entry does not have lines for the reconciliation account" },
        { status: 400 }
      );
    }

    // Check if journal entry is already matched in this session
    const existingMatch = await db
      .select({ id: bankStatementLines.id })
      .from(bankStatementLines)
      .where(
        and(
          eq(bankStatementLines.tenantId, tenantId),
          eq(bankStatementLines.reconciliationSessionId, id),
          eq(bankStatementLines.matchedJournalEntryId, journalEntryId)
        )
      )
      .limit(1);

    if (existingMatch.length > 0) {
      return NextResponse.json(
        { error: "Journal entry is already matched to another statement line" },
        { status: 400 }
      );
    }

    // Create the match
    await db
      .update(bankStatementLines)
      .set({
        matchedJournalEntryId: journalEntryId,
        status: "matched",
        matchedAt: sql`now()`,
        matchedByActorId: actor.actorId,
      })
      .where(eq(bankStatementLines.id, statementLineId));

    await audit.log(
      "bank_statement_line",
      statementLineId,
      "reconciliation_match_created",
      {
        sessionId: id,
        journalEntryId,
        statementAmount: statementLine.amount,
      }
    );

    return NextResponse.json({
      matched: true,
      statementLineId,
      journalEntryId,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/finance/reconciliation/[id]/match error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/finance/reconciliation/[id]/match
 * Body:
 *   - statementLineId: UUID of bank statement line to unmatch
 */
export async function DELETE(
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

    // Support both query params and body for statementLineId
    const { searchParams } = new URL(req.url);
    let statementLineId = searchParams.get("statementLineId");

    if (!statementLineId) {
      try {
        const body = await req.json();
        statementLineId = body.statementLineId;
      } catch {
        // No body provided
      }
    }

    if (!statementLineId) {
      return NextResponse.json({ error: "statementLineId is required" }, { status: 400 });
    }

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
        { error: "Cannot unmatch in a completed or abandoned session" },
        { status: 400 }
      );
    }

    // Verify statement line exists
    const [statementLine] = await db
      .select()
      .from(bankStatementLines)
      .where(
        and(
          eq(bankStatementLines.id, statementLineId),
          eq(bankStatementLines.tenantId, tenantId),
          eq(bankStatementLines.reconciliationSessionId, id)
        )
      )
      .limit(1);

    if (!statementLine) {
      return NextResponse.json({ error: "Statement line not found" }, { status: 404 });
    }

    const previousMatchId = statementLine.matchedJournalEntryId;

    // Remove the match
    await db
      .update(bankStatementLines)
      .set({
        matchedJournalEntryId: null,
        matchedPaymentId: null,
        status: "unmatched",
        matchedAt: null,
        matchedByActorId: null,
        matchConfidence: null,
      })
      .where(eq(bankStatementLines.id, statementLineId));

    if (previousMatchId) {
      await audit.log(
        "bank_statement_line",
        statementLineId,
        "reconciliation_match_removed",
        {
          sessionId: id,
          previousJournalEntryId: previousMatchId,
        }
      );
    }

    return NextResponse.json({
      unmatched: true,
      statementLineId,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("DELETE /api/finance/reconciliation/[id]/match error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
