// /api/people/payroll/runs/[id]/calculate/route.ts
// Payroll calculation engine - recalculates all lines in a run

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { sql } from "drizzle-orm";

interface PayrollLine {
  id: string;
  base_pay: number;
  allowances: Array<{ name: string; amount: number; percent?: number }>;
  other_earnings: Array<{ name: string; amount: number }>;
  employee_taxes: Array<{ name: string; amount: number; percent?: number; basis?: number }>;
  employee_deductions: Array<{ name: string; amount: number; percent?: number; basis?: number }>;
  employer_contributions: Array<{ name: string; amount: number; percent?: number; basis?: number }>;
}

function calculatePayrollLine(line: PayrollLine) {
  // Calculate gross pay
  const allowancesTotal = line.allowances.reduce((sum, a) => sum + a.amount, 0);
  const otherEarningsTotal = line.other_earnings.reduce((sum, e) => sum + e.amount, 0);
  const grossPay = line.base_pay + allowancesTotal + otherEarningsTotal;

  // Calculate taxes (apply percentage to basis or gross)
  let totalTaxes = 0;
  const updatedTaxes = line.employee_taxes.map(tax => {
    const basis = tax.basis || grossPay;
    if (tax.percent) {
      const amount = (basis * tax.percent) / 100;
      totalTaxes += amount;
      return { ...tax, amount, basis };
    }
    totalTaxes += tax.amount;
    return tax;
  });

  // Calculate deductions (apply percentage to basis or gross)
  let totalDeductions = 0;
  const updatedDeductions = line.employee_deductions.map(ded => {
    const basis = ded.basis || grossPay;
    if (ded.percent) {
      const amount = (basis * ded.percent) / 100;
      totalDeductions += amount;
      return { ...ded, amount, basis };
    }
    totalDeductions += ded.amount;
    return ded;
  });

  // Calculate net pay
  const netPay = grossPay - totalTaxes - totalDeductions;

  // Calculate employer contributions
  let totalEmployerCost = grossPay;
  const updatedContributions = line.employer_contributions.map(contrib => {
    const basis = contrib.basis || grossPay;
    if (contrib.percent) {
      const amount = (basis * contrib.percent) / 100;
      totalEmployerCost += amount;
      return { ...contrib, amount, basis };
    }
    totalEmployerCost += contrib.amount;
    return contrib;
  });

  return {
    gross_pay: grossPay,
    total_taxes: totalTaxes,
    total_deductions: totalDeductions,
    net_pay: netPay,
    total_employer_cost: totalEmployerCost,
    employee_taxes: updatedTaxes,
    employee_deductions: updatedDeductions,
    employer_contributions: updatedContributions,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const headersList = await headers();
    const tenantId = headersList.get("x-tenant-id");
    const userId = headersList.get("x-user-id");

    if (!tenantId || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: runId } = await params;

    // Check run status
    const runCheck = await db.execute(sql`
      SELECT status FROM payroll_runs_v2
      WHERE id = ${runId} AND tenant_id = ${tenantId}
    `);

    if (runCheck.rows.length === 0) {
      return NextResponse.json(
        { error: "Payroll run not found" },
        { status: 404 }
      );
    }

    if (runCheck.rows[0].status !== "draft") {
      return NextResponse.json(
        { error: "Cannot calculate a posted or voided payroll run" },
        { status: 400 }
      );
    }

    // Fetch all lines
    const linesResult = await db.execute(sql`
      SELECT 
        id, base_pay, allowances, other_earnings,
        employee_taxes, employee_deductions, employer_contributions
      FROM payroll_run_lines
      WHERE payroll_run_id = ${runId}
        AND is_included = true
    `);

    const lines = linesResult.rows as PayrollLine[];

    // Calculate each line
    const updates = lines.map(line => {
      const calculated = calculatePayrollLine(line);
      return {
        id: line.id,
        ...calculated,
      };
    });

    // Update all lines
    for (const update of updates) {
      await db.execute(sql`
        UPDATE payroll_run_lines
        SET 
          gross_pay = ${update.gross_pay},
          total_taxes = ${update.total_taxes},
          total_deductions = ${update.total_deductions},
          net_pay = ${update.net_pay},
          total_employer_cost = ${update.total_employer_cost},
          employee_taxes = ${JSON.stringify(update.employee_taxes)}::jsonb,
          employee_deductions = ${JSON.stringify(update.employee_deductions)}::jsonb,
          employer_contributions = ${JSON.stringify(update.employer_contributions)}::jsonb,
          updated_at = NOW()
        WHERE id = ${update.id}
      `);
    }

    // Update run timestamp
    await db.execute(sql`
      UPDATE payroll_runs_v2
      SET updated_at = NOW(), updated_by = ${userId}
      WHERE id = ${runId}
    `);

    // Fetch updated lines
    const updatedLines = await db.execute(sql`
      SELECT * FROM payroll_run_lines
      WHERE payroll_run_id = ${runId}
      ORDER BY person_name
    `);

    return NextResponse.json({
      success: true,
      message: `Calculated ${updates.length} payroll lines`,
      lines: updatedLines.rows,
    });
  } catch (error) {
    console.error("Error calculating payroll:", error);
    return NextResponse.json(
      { error: "Failed to calculate payroll" },
      { status: 500 }
    );
  }
}
