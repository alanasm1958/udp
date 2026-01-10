/**
 * /api/payroll/runs/[id]/post
 *
 * Post a payroll run to the general ledger.
 * Creates journal entries using payroll GL mappings.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  payrollRuns,
  payrollGlMappings,
  payPeriods,
  accounts,
  journalEntries,
  journalLines,
  transactionSets,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/payroll/runs/[id]/post
 * Post payroll run to general ledger
 */
export async function POST(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);
    const { id } = await context.params;

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid payroll run ID format" }, { status: 400 });
    }

    // Get the payroll run with period info
    const [run] = await db
      .select({
        id: payrollRuns.id,
        status: payrollRuns.status,
        journalEntryId: payrollRuns.journalEntryId,
        totalGrossPay: payrollRuns.totalGrossPay,
        totalEmployeeTaxes: payrollRuns.totalEmployeeTaxes,
        totalEmployeeDeductions: payrollRuns.totalEmployeeDeductions,
        totalNetPay: payrollRuns.totalNetPay,
        totalEmployerTaxes: payrollRuns.totalEmployerTaxes,
        totalEmployerContributions: payrollRuns.totalEmployerContributions,
        employeeCount: payrollRuns.employeeCount,
        payDate: payPeriods.payDate,
        periodStart: payPeriods.startDate,
        periodEnd: payPeriods.endDate,
      })
      .from(payrollRuns)
      .innerJoin(payPeriods, eq(payrollRuns.payPeriodId, payPeriods.id))
      .where(
        and(
          eq(payrollRuns.id, id),
          eq(payrollRuns.tenantId, tenantId)
        )
      );

    if (!run) {
      return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    }

    // Idempotency: if already posted, return existing journal entry
    if (run.status === "posted" && run.journalEntryId) {
      return NextResponse.json({
        success: true,
        status: "posted",
        journalEntryId: run.journalEntryId,
        idempotent: true,
      });
    }

    // Check status - must be approved to post
    if (run.status !== "approved") {
      return NextResponse.json(
        { error: `Cannot post payroll run in ${run.status} status. Only approved runs can be posted.` },
        { status: 400 }
      );
    }

    // Update status to posting
    await db
      .update(payrollRuns)
      .set({ status: "posting", updatedAt: sql`now()` })
      .where(eq(payrollRuns.id, id));

    try {
      // Get GL mappings or use defaults
      const mappings = await db
        .select({
          mappingType: payrollGlMappings.mappingType,
          debitAccountId: payrollGlMappings.debitAccountId,
          creditAccountId: payrollGlMappings.creditAccountId,
        })
        .from(payrollGlMappings)
        .where(
          and(
            eq(payrollGlMappings.tenantId, tenantId),
            eq(payrollGlMappings.isActive, true)
          )
        );

      // Build mapping lookup
      const mappingLookup: Record<string, { debitAccountId: string | null; creditAccountId: string | null }> = {};
      for (const m of mappings) {
        mappingLookup[m.mappingType] = {
          debitAccountId: m.debitAccountId,
          creditAccountId: m.creditAccountId,
        };
      }

      // Get default accounts if no mappings exist
      const defaultAccounts = await getDefaultPayrollAccounts(tenantId);

      // Build journal lines
      const lines: Array<{
        accountId: string;
        debit: number;
        credit: number;
        description: string;
      }> = [];

      const grossPay = parseFloat(run.totalGrossPay || "0");
      const employeeTaxes = parseFloat(run.totalEmployeeTaxes || "0");
      const employeeDeductions = parseFloat(run.totalEmployeeDeductions || "0");
      const netPay = parseFloat(run.totalNetPay || "0");
      const employerTaxes = parseFloat(run.totalEmployerTaxes || "0");
      const employerContributions = parseFloat(run.totalEmployerContributions || "0");

      // 1. Dr Payroll Expense (gross pay + employer taxes + employer contributions)
      const totalPayrollExpense = grossPay + employerTaxes + employerContributions;
      const payrollExpenseAccountId =
        mappingLookup["payroll_expense"]?.debitAccountId || defaultAccounts.payrollExpense;

      if (payrollExpenseAccountId) {
        lines.push({
          accountId: payrollExpenseAccountId,
          debit: totalPayrollExpense,
          credit: 0,
          description: "Payroll expense",
        });
      }

      // 2. Cr Payroll Taxes Payable (employee taxes + employer taxes)
      const totalTaxesPayable = employeeTaxes + employerTaxes;
      const taxesPayableAccountId =
        mappingLookup["taxes_payable"]?.creditAccountId || defaultAccounts.taxesPayable;

      if (taxesPayableAccountId && totalTaxesPayable > 0) {
        lines.push({
          accountId: taxesPayableAccountId,
          debit: 0,
          credit: totalTaxesPayable,
          description: "Payroll taxes payable",
        });
      }

      // 3. Cr Deductions Payable (employee deductions + employer contributions)
      const totalDeductionsPayable = employeeDeductions + employerContributions;
      const deductionsPayableAccountId =
        mappingLookup["deductions_payable"]?.creditAccountId || defaultAccounts.deductionsPayable;

      if (deductionsPayableAccountId && totalDeductionsPayable > 0) {
        lines.push({
          accountId: deductionsPayableAccountId,
          debit: 0,
          credit: totalDeductionsPayable,
          description: "Payroll deductions payable",
        });
      }

      // 4. Cr Net Pay Payable (what we owe employees)
      const netPayPayableAccountId =
        mappingLookup["net_pay_payable"]?.creditAccountId || defaultAccounts.netPayPayable;

      if (netPayPayableAccountId && netPay > 0) {
        lines.push({
          accountId: netPayPayableAccountId,
          debit: 0,
          credit: netPay,
          description: "Net wages payable",
        });
      }

      // Validate balance
      const totalDebits = lines.reduce((sum, l) => sum + l.debit, 0);
      const totalCredits = lines.reduce((sum, l) => sum + l.credit, 0);

      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        throw new Error(
          `Payroll journal entry is not balanced: debits (${totalDebits.toFixed(2)}) ≠ credits (${totalCredits.toFixed(2)})`
        );
      }

      // Create transaction set
      const [txSet] = await db
        .insert(transactionSets)
        .values({
          tenantId,
          status: "posted",
          source: "payroll_posting",
          createdByActorId: actor.actorId,
          businessDate: run.payDate,
          notes: `Payroll posting: ${run.periodStart} to ${run.periodEnd}`,
        })
        .returning();

      // Create journal entry
      const [journalEntry] = await db
        .insert(journalEntries)
        .values({
          tenantId,
          postingDate: run.payDate,
          memo: `Payroll: ${run.periodStart} to ${run.periodEnd} (${run.employeeCount} employees)`,
          sourceTransactionSetId: txSet.id,
          postedByActorId: actor.actorId,
        })
        .returning();

      // Create journal lines
      await db.insert(journalLines).values(
        lines.map((line, index) => ({
          tenantId,
          journalEntryId: journalEntry.id,
          lineNo: index + 1,
          accountId: line.accountId,
          debit: line.debit.toFixed(6),
          credit: line.credit.toFixed(6),
          description: line.description,
        }))
      );

      // Update payroll run status to posted
      await db
        .update(payrollRuns)
        .set({
          status: "posted",
          postedAt: sql`now()`,
          postedByActorId: actor.actorId,
          journalEntryId: journalEntry.id,
          updatedAt: sql`now()`,
        })
        .where(eq(payrollRuns.id, id));

      await audit.log("payroll_run", id, "payroll_posted", {
        journalEntryId: journalEntry.id,
        transactionSetId: txSet.id,
        totalDebits: totalDebits.toFixed(2),
        totalCredits: totalCredits.toFixed(2),
        lineCount: lines.length,
      });

      return NextResponse.json({
        success: true,
        status: "posted",
        journalEntryId: journalEntry.id,
        transactionSetId: txSet.id,
      });
    } catch (postError) {
      // Revert status on error
      await db
        .update(payrollRuns)
        .set({ status: "approved", updatedAt: sql`now()` })
        .where(eq(payrollRuns.id, id));

      throw postError;
    }
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/payroll/runs/[id]/post error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Get default payroll accounts by code
 */
async function getDefaultPayrollAccounts(tenantId: string): Promise<{
  payrollExpense: string | null;
  taxesPayable: string | null;
  deductionsPayable: string | null;
  netPayPayable: string | null;
}> {
  // Try common account codes
  const accountCodes = {
    payrollExpense: ["6200", "6100", "5200"], // Payroll expense
    taxesPayable: ["2100", "2110", "2200"], // Payroll taxes payable
    deductionsPayable: ["2150", "2160", "2200"], // Payroll deductions payable
    netPayPayable: ["2010", "2100", "2000"], // Wages/salaries payable
  };

  const result: Record<string, string | null> = {
    payrollExpense: null,
    taxesPayable: null,
    deductionsPayable: null,
    netPayPayable: null,
  };

  for (const [key, codes] of Object.entries(accountCodes)) {
    for (const code of codes) {
      const [account] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(
          and(
            eq(accounts.tenantId, tenantId),
            eq(accounts.code, code),
            eq(accounts.isActive, true)
          )
        )
        .limit(1);

      if (account) {
        result[key] = account.id;
        break;
      }
    }
  }

  return result as {
    payrollExpense: string | null;
    taxesPayable: string | null;
    deductionsPayable: string | null;
    netPayPayable: string | null;
  };
}
