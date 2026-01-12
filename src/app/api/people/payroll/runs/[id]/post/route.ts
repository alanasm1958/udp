/**
 * /api/people/payroll/runs/[id]/post
 *
 * Post payroll run to the general ledger
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { payrollRunsV2, payrollRunLines, journalEntries, journalLines, accounts, hrAuditLog } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

/**
 * POST /api/people/payroll/runs/[id]/post
 * Post payroll run to general ledger
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const userIdFromHeader = getUserIdFromHeaders(request);
    const actorIdFromHeader = getActorIdFromHeaders(request);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const { id: runId } = await params;

    // Check run status
    const [run] = await db
      .select()
      .from(payrollRunsV2)
      .where(and(eq(payrollRunsV2.id, runId), eq(payrollRunsV2.tenantId, tenantId)));

    if (!run) {
      return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    }

    if (run.status !== "draft") {
      return NextResponse.json(
        { error: "Payroll run is already posted or voided" },
        { status: 400 }
      );
    }

    // Fetch included lines
    const lines = await db
      .select()
      .from(payrollRunLines)
      .where(
        and(
          eq(payrollRunLines.payrollRunId, runId),
          eq(payrollRunLines.isIncluded, true)
        )
      );

    if (lines.length === 0) {
      return NextResponse.json(
        { error: "No payroll lines to post" },
        { status: 400 }
      );
    }

    // Calculate totals
    const totals = lines.reduce(
      (acc, line) => ({
        grossPay: acc.grossPay + parseFloat(String(line.grossPay || 0)),
        totalTaxes: acc.totalTaxes + parseFloat(String(line.totalTaxes || 0)),
        totalDeductions: acc.totalDeductions + parseFloat(String(line.totalDeductions || 0)),
        netPay: acc.netPay + parseFloat(String(line.netPay || 0)),
        totalEmployerCost: acc.totalEmployerCost + parseFloat(String(line.totalEmployerCost || 0)),
      }),
      { grossPay: 0, totalTaxes: 0, totalDeductions: 0, netPay: 0, totalEmployerCost: 0 }
    );

    // Get payroll accounts (default codes, configurable via settings)
    const accountCodes = {
      salaryExpense: "5100", // Salary Expense
      taxPayable: "2100", // Payroll Tax Payable
      deductionsPayable: "2110", // Deductions Payable
      cashOrPayable: "1000", // Cash (or Wages Payable)
    };

    // Look up account IDs
    const accountsResult = await db
      .select({ id: accounts.id, code: accounts.code })
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          sql`${accounts.code} IN (${accountCodes.salaryExpense}, ${accountCodes.taxPayable}, ${accountCodes.deductionsPayable}, ${accountCodes.cashOrPayable})`
        )
      );

    const accountMap = Object.fromEntries(accountsResult.map(a => [a.code, a.id]));

    // Create journal entry
    const [journalEntry] = await db
      .insert(journalEntries)
      .values({
        tenantId,
        postingDate: run.payDate,
        memo: `Payroll for ${run.periodStart} to ${run.periodEnd}`,
        postedByActorId: actor.actorId,
      })
      .returning();

    // Create journal lines
    const journalLinesData = [];
    let lineNo = 1;

    // Debit: Salary Expense (gross pay + employer contributions)
    if (accountMap[accountCodes.salaryExpense]) {
      journalLinesData.push({
        tenantId,
        journalEntryId: journalEntry.id,
        lineNo: lineNo++,
        accountId: accountMap[accountCodes.salaryExpense],
        debit: String(totals.totalEmployerCost),
        credit: "0",
        description: "Payroll - Gross Pay & Employer Costs",
      });
    }

    // Credit: Payroll Tax Payable (employee taxes + employer tax contributions)
    if (accountMap[accountCodes.taxPayable] && totals.totalTaxes > 0) {
      journalLinesData.push({
        tenantId,
        journalEntryId: journalEntry.id,
        lineNo: lineNo++,
        accountId: accountMap[accountCodes.taxPayable],
        debit: "0",
        credit: String(totals.totalTaxes),
        description: "Payroll - Tax Withholdings",
      });
    }

    // Credit: Deductions Payable (benefits, etc.)
    if (accountMap[accountCodes.deductionsPayable] && totals.totalDeductions > 0) {
      journalLinesData.push({
        tenantId,
        journalEntryId: journalEntry.id,
        lineNo: lineNo++,
        accountId: accountMap[accountCodes.deductionsPayable],
        debit: "0",
        credit: String(totals.totalDeductions),
        description: "Payroll - Deductions",
      });
    }

    // Credit: Cash/Bank (net pay + employer contributions that aren't tax)
    if (accountMap[accountCodes.cashOrPayable]) {
      const employerNonTax = totals.totalEmployerCost - totals.grossPay;
      const cashCredit = totals.netPay + employerNonTax;
      journalLinesData.push({
        tenantId,
        journalEntryId: journalEntry.id,
        lineNo: lineNo++,
        accountId: accountMap[accountCodes.cashOrPayable],
        debit: "0",
        credit: String(cashCredit),
        description: "Payroll - Net Pay",
      });
    }

    if (journalLinesData.length > 0) {
      await db.insert(journalLines).values(journalLinesData);
    }

    // Update payroll run status
    await db
      .update(payrollRunsV2)
      .set({
        status: "posted",
        journalEntryId: journalEntry.id,
        postedAt: new Date(),
        postedByActorId: actor.actorId,
        updatedAt: new Date(),
        updatedByActorId: actor.actorId,
      })
      .where(eq(payrollRunsV2.id, runId));

    // Add to HR audit log
    await db.insert(hrAuditLog).values({
      tenantId,
      actorId: actor.actorId,
      entityType: "payroll_run",
      entityId: runId,
      action: "posted",
      afterSnapshot: {
        journalEntryId: journalEntry.id,
        totals,
        linesPosted: lines.length,
      },
    });

    await audit.log("payroll_run", runId, "payroll_run_posted", {
      journalEntryId: journalEntry.id,
      totals,
      linesPosted: lines.length,
    });

    return NextResponse.json({
      success: true,
      message: `Payroll posted successfully with ${lines.length} employees`,
      journalEntryId: journalEntry.id,
      summary: {
        employeeCount: lines.length,
        ...totals,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error posting payroll:", error);
    return NextResponse.json(
      { error: "Failed to post payroll" },
      { status: 500 }
    );
  }
}
