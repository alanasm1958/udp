/**
 * /api/people/payroll/runs/[id]/calculate
 *
 * Payroll calculation engine - recalculates all lines in a run
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { payrollRunsV2, payrollRunLines } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface EarningDeduction {
  name: string;
  amount: number;
  percent?: number;
  basis?: number;
}

interface PayrollLineData {
  id: string;
  basePay: string | number;
  allowances: EarningDeduction[];
  otherEarnings: EarningDeduction[];
  employeeTaxes: EarningDeduction[];
  employeeDeductions: EarningDeduction[];
  employerContributions: EarningDeduction[];
}

function calculatePayrollLine(line: PayrollLineData) {
  const basePay = parseFloat(String(line.basePay)) || 0;
  const allowances = line.allowances || [];
  const otherEarnings = line.otherEarnings || [];
  const employeeTaxes = line.employeeTaxes || [];
  const employeeDeductions = line.employeeDeductions || [];
  const employerContributions = line.employerContributions || [];

  // Calculate gross pay
  const allowancesTotal = allowances.reduce((sum, a) => sum + (a.amount || 0), 0);
  const otherEarningsTotal = otherEarnings.reduce((sum, e) => sum + (e.amount || 0), 0);
  const grossPay = basePay + allowancesTotal + otherEarningsTotal;

  // Calculate taxes (apply percentage to basis or gross)
  let totalTaxes = 0;
  const updatedTaxes = employeeTaxes.map(tax => {
    const basis = tax.basis || grossPay;
    if (tax.percent) {
      const amount = (basis * tax.percent) / 100;
      totalTaxes += amount;
      return { ...tax, amount: Math.round(amount * 100) / 100, basis };
    }
    totalTaxes += tax.amount || 0;
    return tax;
  });

  // Calculate deductions (apply percentage to basis or gross)
  let totalDeductions = 0;
  const updatedDeductions = employeeDeductions.map(ded => {
    const basis = ded.basis || grossPay;
    if (ded.percent) {
      const amount = (basis * ded.percent) / 100;
      totalDeductions += amount;
      return { ...ded, amount: Math.round(amount * 100) / 100, basis };
    }
    totalDeductions += ded.amount || 0;
    return ded;
  });

  // Calculate net pay
  const netPay = grossPay - totalTaxes - totalDeductions;

  // Calculate employer contributions
  let totalEmployerContributions = 0;
  const updatedContributions = employerContributions.map(contrib => {
    const basis = contrib.basis || grossPay;
    if (contrib.percent) {
      const amount = (basis * contrib.percent) / 100;
      totalEmployerContributions += amount;
      return { ...contrib, amount: Math.round(amount * 100) / 100, basis };
    }
    totalEmployerContributions += contrib.amount || 0;
    return contrib;
  });

  const totalEmployerCost = grossPay + totalEmployerContributions;

  return {
    grossPay: Math.round(grossPay * 100) / 100,
    totalTaxes: Math.round(totalTaxes * 100) / 100,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    netPay: Math.round(netPay * 100) / 100,
    totalEmployerCost: Math.round(totalEmployerCost * 100) / 100,
    employeeTaxes: updatedTaxes,
    employeeDeductions: updatedDeductions,
    employerContributions: updatedContributions,
  };
}

/**
 * POST /api/people/payroll/runs/[id]/calculate
 * Calculate all payroll lines
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
        { error: "Cannot calculate a posted or voided payroll run" },
        { status: 400 }
      );
    }

    // Fetch all included lines
    const lines = await db
      .select()
      .from(payrollRunLines)
      .where(
        and(
          eq(payrollRunLines.payrollRunId, runId),
          eq(payrollRunLines.isIncluded, true)
        )
      );

    // Calculate each line
    const updates = lines.map(line => {
      const calculated = calculatePayrollLine({
        id: line.id,
        basePay: line.basePay || "0",
        allowances: (line.allowances as EarningDeduction[]) || [],
        otherEarnings: (line.otherEarnings as EarningDeduction[]) || [],
        employeeTaxes: (line.employeeTaxes as EarningDeduction[]) || [],
        employeeDeductions: (line.employeeDeductions as EarningDeduction[]) || [],
        employerContributions: (line.employerContributions as EarningDeduction[]) || [],
      });
      return {
        id: line.id,
        ...calculated,
      };
    });

    // Update all lines
    for (const update of updates) {
      await db
        .update(payrollRunLines)
        .set({
          grossPay: String(update.grossPay),
          totalTaxes: String(update.totalTaxes),
          totalDeductions: String(update.totalDeductions),
          netPay: String(update.netPay),
          totalEmployerCost: String(update.totalEmployerCost),
          employeeTaxes: update.employeeTaxes,
          employeeDeductions: update.employeeDeductions,
          employerContributions: update.employerContributions,
          updatedAt: new Date(),
        })
        .where(eq(payrollRunLines.id, update.id));
    }

    // Update run timestamp
    await db
      .update(payrollRunsV2)
      .set({
        updatedAt: new Date(),
        updatedByActorId: actor.actorId,
      })
      .where(eq(payrollRunsV2.id, runId));

    await audit.log("payroll_run", runId, "payroll_calculated", {
      linesCalculated: updates.length,
    });

    // Fetch updated lines
    const updatedLines = await db
      .select()
      .from(payrollRunLines)
      .where(eq(payrollRunLines.payrollRunId, runId))
      .orderBy(payrollRunLines.personName);

    // Calculate totals
    const totals = updates.reduce(
      (acc, line) => ({
        totalGross: acc.totalGross + line.grossPay,
        totalNet: acc.totalNet + line.netPay,
        totalTaxes: acc.totalTaxes + line.totalTaxes,
        totalDeductions: acc.totalDeductions + line.totalDeductions,
        totalEmployerCost: acc.totalEmployerCost + line.totalEmployerCost,
      }),
      { totalGross: 0, totalNet: 0, totalTaxes: 0, totalDeductions: 0, totalEmployerCost: 0 }
    );

    return NextResponse.json({
      success: true,
      message: `Calculated ${updates.length} payroll lines`,
      lines: updatedLines,
      summary: {
        linesCalculated: updates.length,
        ...totals,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error calculating payroll:", error);
    return NextResponse.json(
      { error: "Failed to calculate payroll" },
      { status: 500 }
    );
  }
}
