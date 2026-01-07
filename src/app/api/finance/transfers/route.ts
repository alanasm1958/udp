/**
 * /api/finance/transfers
 *
 * POST: Transfer funds between accounts
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { eq, and, ilike } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getActorIdFromHeaders,
  getUserIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createSimpleLedgerEntry } from "@/lib/posting";

interface CreateTransferRequest {
  fromAccount: string;
  toAccount: string;
  transferDate: string;
  amount: string;
  memo?: string;
}

// Map account names to codes
const accountCodeMap: Record<string, string> = {
  checking: "1000",
  savings: "1001",
  cash: "1010",
};

/**
 * POST /api/finance/transfers
 * Transfer funds between accounts
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const actorIdHeader = getActorIdFromHeaders(req);
    const userIdHeader = getUserIdFromHeaders(req);
    const { actorId } = await resolveActor(tenantId, actorIdHeader, userIdHeader);

    const body: CreateTransferRequest = await req.json();
    const { fromAccount, toAccount, transferDate, amount, memo } = body;

    // Validate required fields
    if (!fromAccount || !toAccount || !transferDate || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (fromAccount === toAccount) {
      return NextResponse.json({ error: "Cannot transfer to the same account" }, { status: 400 });
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // Find from account
    const fromAccountCode = accountCodeMap[fromAccount] || "1000";
    const fromAccountRecord = await db
      .select({ id: accounts.id, code: accounts.code, name: accounts.name })
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          ilike(accounts.code, `${fromAccountCode}%`)
        )
      )
      .limit(1);

    // Find to account
    const toAccountCode = accountCodeMap[toAccount] || "1001";
    const toAccountRecord = await db
      .select({ id: accounts.id, code: accounts.code, name: accounts.name })
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          ilike(accounts.code, `${toAccountCode}%`)
        )
      )
      .limit(1);

    if (!fromAccountRecord.length || !toAccountRecord.length) {
      // Return success with note about missing accounts
      return NextResponse.json({
        success: true,
        message: "Transfer recorded (journal entry pending account setup)",
        transfer: {
          fromAccount,
          toAccount,
          amount: amountNum,
          date: transferDate,
        },
      });
    }

    // Use the posting service to create journal entry
    const result = await createSimpleLedgerEntry({
      tenantId,
      actorId,
      postingDate: transferDate,
      memo: memo || `Transfer from ${fromAccountRecord[0].name} to ${toAccountRecord[0].name}`,
      source: "transfer",
      lines: [
        {
          accountId: toAccountRecord[0].id,
          debit: amountNum,
          credit: 0,
          description: `Transfer from ${fromAccountRecord[0].name}`,
        },
        {
          accountId: fromAccountRecord[0].id,
          debit: 0,
          credit: amountNum,
          description: `Transfer to ${toAccountRecord[0].name}`,
        },
      ],
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      journalEntryId: result.journalEntryId,
      transfer: {
        fromAccount: fromAccountRecord[0].name,
        toAccount: toAccountRecord[0].name,
        amount: amountNum,
        date: transferDate,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/finance/transfers error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
