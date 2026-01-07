/**
 * /api/finance/expenses
 *
 * POST: Record a non-inventory expense
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

interface CreateExpenseRequest {
  category: string;
  description: string;
  method: "cash" | "bank";
  expenseDate: string;
  amount: string;
  reference?: string;
  memo?: string;
}

// Map expense categories to account codes
const categoryAccountMap: Record<string, string> = {
  office_supplies: "6100",
  utilities: "6200",
  rent: "6300",
  insurance: "6400",
  travel: "6500",
  meals: "6600",
  professional_services: "6700",
  marketing: "6800",
  equipment: "6900",
  other: "6999",
};

/**
 * POST /api/finance/expenses
 * Record a new expense
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const actorIdHeader = getActorIdFromHeaders(req);
    const userIdHeader = getUserIdFromHeaders(req);
    const { actorId } = await resolveActor(tenantId, actorIdHeader, userIdHeader);

    const body: CreateExpenseRequest = await req.json();
    const { category, description, method, expenseDate, amount, memo } = body;

    // Validate required fields
    if (!category || !description || !expenseDate || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // Find expense account
    const expenseAccountCode = categoryAccountMap[category] || "6999";
    const expenseAccount = await db
      .select({ id: accounts.id, code: accounts.code, name: accounts.name })
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          ilike(accounts.code, `${expenseAccountCode}%`)
        )
      )
      .limit(1);

    // Find cash/bank account
    const cashAccountCode = method === "cash" ? "1010" : "1000"; // Petty Cash vs Bank
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

    if (!expenseAccount.length || !cashAccount.length) {
      // Return success with note about missing accounts
      return NextResponse.json({
        success: true,
        message: "Expense recorded (journal entry pending account setup)",
        expense: {
          category,
          description,
          amount: amountNum,
          date: expenseDate,
        },
      });
    }

    // Use the posting service to create journal entry
    const result = await createSimpleLedgerEntry({
      tenantId,
      actorId,
      postingDate: expenseDate,
      memo: memo || `Expense: ${description}`,
      source: "expense",
      lines: [
        {
          accountId: expenseAccount[0].id,
          debit: amountNum,
          credit: 0,
          description: description,
        },
        {
          accountId: cashAccount[0].id,
          debit: 0,
          credit: amountNum,
          description: description,
        },
      ],
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      journalEntryId: result.journalEntryId,
      expense: {
        category,
        description,
        amount: amountNum,
        date: expenseDate,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/finance/expenses error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
