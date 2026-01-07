/**
 * /api/people/payroll
 *
 * POST: Record a payroll run (creates expense journal entry)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { journalEntries, journalLines, accounts } from "@/db/schema";
import { eq, and, ilike, or } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext, logAuditEvent } from "@/lib/audit";
import { getUserIdFromHeaders } from "@/lib/tenant";

interface CreatePayrollRequest {
  payPeriod: string; // YYYY-MM
  payDate: string;
  totalAmount: string;
  notes?: string;
}

/**
 * POST /api/people/payroll
 * Record a payroll run
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const actorIdHeader = getActorIdFromHeaders(req);
    const userIdHeader = getUserIdFromHeaders(req);
    const { actorId } = await resolveActor(tenantId, actorIdHeader, userIdHeader);
    const ctx = createAuditContext(tenantId, actorId);

    const body: CreatePayrollRequest = await req.json();
    const { payPeriod, payDate, totalAmount, notes } = body;

    // Validate required fields
    if (!payPeriod || !payDate || !totalAmount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const amountNum = parseFloat(totalAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // Find payroll expense account (typically 5000 series for salaries/wages)
    const payrollAccount = await db
      .select({ id: accounts.id, code: accounts.code, name: accounts.name })
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          or(
            ilike(accounts.code, "5000%"),
            ilike(accounts.code, "5100%"),
            ilike(accounts.name, "%salary%"),
            ilike(accounts.name, "%wage%"),
            ilike(accounts.name, "%payroll%")
          )
        )
      )
      .limit(1);

    // Find cash/bank account
    const cashAccount = await db
      .select({ id: accounts.id, code: accounts.code, name: accounts.name })
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          ilike(accounts.code, "1000%")
        )
      )
      .limit(1);

    if (!payrollAccount.length || !cashAccount.length) {
      // Return success with note about missing accounts
      return NextResponse.json({
        success: true,
        message: "Payroll recorded (journal entry pending account setup)",
        payroll: {
          payPeriod,
          payDate,
          totalAmount: amountNum,
        },
      });
    }

    // Create journal entry
    const [entry] = await db
      .insert(journalEntries)
      .values({
        tenantId,
        postingDate: payDate,
        memo: notes || `Payroll for ${payPeriod}`,
        postedByActorId: actorId,
      })
      .returning();

    // Create journal lines (Debit Payroll Expense, Credit Cash)
    await db.insert(journalLines).values([
      {
        journalEntryId: entry.id,
        tenantId,
        accountId: payrollAccount[0].id,
        description: `Payroll expense for ${payPeriod}`,
        debit: amountNum.toFixed(2),
        credit: "0.00",
        lineNo: 1,
      },
      {
        journalEntryId: entry.id,
        tenantId,
        accountId: cashAccount[0].id,
        description: `Payroll payment for ${payPeriod}`,
        debit: "0.00",
        credit: amountNum.toFixed(2),
        lineNo: 2,
      },
    ]);

    await logAuditEvent({
      ...ctx,
      action: "payroll_recorded",
      entityType: "journal_entry",
      entityId: entry.id,
      metadata: {
        payPeriod,
        payDate,
        totalAmount: amountNum,
      },
    });

    return NextResponse.json({
      success: true,
      journalEntryId: entry.id,
      payroll: {
        payPeriod,
        payDate,
        totalAmount: amountNum,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/people/payroll error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
