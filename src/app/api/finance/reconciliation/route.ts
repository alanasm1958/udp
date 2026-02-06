/**
 * /api/finance/reconciliation
 *
 * GET: List reconciliation sessions for an account
 * POST: Create a new reconciliation session
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
import { bankReconciliationSessions, accounts, journalLines, journalEntries } from "@/db/schema";
import { eq, and, desc, lte } from "drizzle-orm";
import { createAuditContext } from "@/lib/audit";

/**
 * GET /api/finance/reconciliation
 * Query params:
 *   - accountId: UUID of bank account (required)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    // Verify account exists and is a bank account
    const [account] = await db
      .select({ id: accounts.id, name: accounts.name, code: accounts.code })
      .from(accounts)
      .where(
        and(
          eq(accounts.id, accountId),
          eq(accounts.tenantId, tenantId),
          eq(accounts.isActive, true)
        )
      )
      .limit(1);

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Fetch reconciliation sessions
    const sessions = await db
      .select({
        id: bankReconciliationSessions.id,
        accountId: bankReconciliationSessions.accountId,
        accountCode: bankReconciliationSessions.accountCode,
        statementDate: bankReconciliationSessions.statementDate,
        statementEndingBalance: bankReconciliationSessions.statementEndingBalance,
        bookBalance: bankReconciliationSessions.bookBalance,
        status: bankReconciliationSessions.status,
        difference: bankReconciliationSessions.difference,
        completedAt: bankReconciliationSessions.completedAt,
        createdAt: bankReconciliationSessions.createdAt,
      })
      .from(bankReconciliationSessions)
      .where(
        and(
          eq(bankReconciliationSessions.tenantId, tenantId),
          eq(bankReconciliationSessions.accountId, accountId)
        )
      )
      .orderBy(desc(bankReconciliationSessions.statementDate));

    return NextResponse.json({
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
      },
      sessions,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/finance/reconciliation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/finance/reconciliation
 * Body:
 *   - accountId: UUID of bank account (required)
 *   - statementDate: YYYY-MM-DD (required)
 *   - statementEndingBalance: number (required)
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);
    const body = await req.json();

    const { accountId, statementDate, statementEndingBalance } = body;

    if (!accountId) {
      return NextResponse.json({ error: "accountId is required" }, { status: 400 });
    }
    if (!statementDate) {
      return NextResponse.json({ error: "statementDate is required" }, { status: 400 });
    }
    if (statementEndingBalance === undefined || statementEndingBalance === null) {
      return NextResponse.json({ error: "statementEndingBalance is required" }, { status: 400 });
    }

    // Verify account exists
    const [account] = await db
      .select({ id: accounts.id, name: accounts.name, code: accounts.code })
      .from(accounts)
      .where(
        and(
          eq(accounts.id, accountId),
          eq(accounts.tenantId, tenantId),
          eq(accounts.isActive, true)
        )
      )
      .limit(1);

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Check for existing in_progress session for this account
    const existingSession = await db
      .select({ id: bankReconciliationSessions.id })
      .from(bankReconciliationSessions)
      .where(
        and(
          eq(bankReconciliationSessions.tenantId, tenantId),
          eq(bankReconciliationSessions.accountId, accountId),
          eq(bankReconciliationSessions.status, "in_progress")
        )
      )
      .limit(1);

    if (existingSession.length > 0) {
      return NextResponse.json(
        { error: "An in-progress reconciliation session already exists for this account" },
        { status: 409 }
      );
    }

    // Calculate current book balance for the account up to statement date
    const bookTransactions = await db
      .select({
        debit: journalLines.debit,
        credit: journalLines.credit,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(journalLines.tenantId, tenantId),
          eq(journalLines.accountId, accountId),
          lte(journalEntries.postingDate, statementDate)
        )
      );

    const bookBalance = bookTransactions.reduce((sum, tx) => {
      const debit = parseFloat(tx.debit);
      const credit = parseFloat(tx.credit);
      return sum + debit - credit;
    }, 0);

    // Create session
    const [session] = await db
      .insert(bankReconciliationSessions)
      .values({
        tenantId,
        accountId,
        accountCode: account.code,
        statementDate,
        statementEndingBalance: statementEndingBalance.toFixed(6),
        bookBalance: bookBalance.toFixed(6),
        status: "in_progress",
        createdByActorId: actor.actorId,
      })
      .returning();

    await audit.log(
      "bank_reconciliation_session",
      session.id,
      "reconciliation_session_created",
      {
        accountId,
        accountName: account.name,
        statementDate,
        statementEndingBalance,
      }
    );

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/finance/reconciliation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
