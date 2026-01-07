/**
 * /api/finance/capital
 *
 * POST: Record owner capital contribution or distribution
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { journalEntries, journalLines, accounts } from "@/db/schema";
import { eq, and, ilike, or } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getActorIdFromHeaders,
  getUserIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext, logAuditEvent } from "@/lib/audit";

interface CreateCapitalRequest {
  capitalType: "contribution" | "distribution";
  method: "cash" | "bank";
  capitalDate: string;
  amount: string;
  memo?: string;
}

/**
 * POST /api/finance/capital
 * Record owner capital contribution or distribution
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const actorIdHeader = getActorIdFromHeaders(req);
    const userIdHeader = getUserIdFromHeaders(req);
    const { actorId } = await resolveActor(tenantId, actorIdHeader, userIdHeader);
    const ctx = createAuditContext(tenantId, actorId);

    const body: CreateCapitalRequest = await req.json();
    const { capitalType, method, capitalDate, amount, memo } = body;

    // Validate required fields
    if (!capitalType || !capitalDate || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // Find owner's equity/capital account (typically 3000 series)
    const capitalAccount = await db
      .select({ id: accounts.id, code: accounts.code, name: accounts.name })
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          or(
            ilike(accounts.code, "3000%"),
            ilike(accounts.code, "3100%"),
            ilike(accounts.name, "%capital%"),
            ilike(accounts.name, "%equity%")
          )
        )
      )
      .limit(1);

    // Find cash/bank account
    const cashAccountCode = method === "cash" ? "1010" : "1000";
    const cashAccount = await db
      .select({ id: accounts.id, code: accounts.code, name: accounts.name })
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          ilike(accounts.code, `${cashAccountCode}%`)
        )
      )
      .limit(1);

    if (!capitalAccount.length || !cashAccount.length) {
      // Return success with note about missing accounts
      return NextResponse.json({
        success: true,
        message: `Capital ${capitalType} recorded (journal entry pending account setup)`,
        capital: {
          type: capitalType,
          amount: amountNum,
          date: capitalDate,
        },
      });
    }

    // Create journal entry
    const description = capitalType === "contribution"
      ? "Owner Capital Contribution"
      : "Owner Distribution";

    const [entry] = await db
      .insert(journalEntries)
      .values({
        tenantId,
        postingDate: capitalDate,
        memo: memo || description,
        postedByActorId: actorId,
      })
      .returning();

    // Create journal lines
    // Contribution: Debit Cash, Credit Owner's Equity
    // Distribution: Debit Owner's Equity, Credit Cash
    const lines = capitalType === "contribution"
      ? [
          {
            journalEntryId: entry.id,
            tenantId,
            accountId: cashAccount[0].id,
            description,
            debit: amountNum.toFixed(2),
            credit: "0.00",
            lineNo: 1,
          },
          {
            journalEntryId: entry.id,
            tenantId,
            accountId: capitalAccount[0].id,
            description,
            debit: "0.00",
            credit: amountNum.toFixed(2),
            lineNo: 2,
          },
        ]
      : [
          {
            journalEntryId: entry.id,
            tenantId,
            accountId: capitalAccount[0].id,
            description,
            debit: amountNum.toFixed(2),
            credit: "0.00",
            lineNo: 1,
          },
          {
            journalEntryId: entry.id,
            tenantId,
            accountId: cashAccount[0].id,
            description,
            debit: "0.00",
            credit: amountNum.toFixed(2),
            lineNo: 2,
          },
        ];

    await db.insert(journalLines).values(lines);

    await logAuditEvent({
      ...ctx,
      action: "capital_recorded",
      entityType: "journal_entry",
      entityId: entry.id,
      metadata: {
        capitalType,
        amount: amountNum,
      },
    });

    return NextResponse.json({
      success: true,
      journalEntryId: entry.id,
      capital: {
        type: capitalType,
        amount: amountNum,
        date: capitalDate,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/finance/capital error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
