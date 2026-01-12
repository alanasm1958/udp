/**
 * /api/hr-people/payroll/[id]
 *
 * Get and delete payroll runs
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { hrPayrollRuns, hrPayrollLines } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

/**
 * GET /api/hr-people/payroll/[id]
 * Get a payroll run with its lines
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await params;

    const [run] = await db
      .select()
      .from(hrPayrollRuns)
      .where(and(eq(hrPayrollRuns.id, id), eq(hrPayrollRuns.tenantId, tenantId)));

    if (!run) {
      return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    }

    const lines = await db
      .select()
      .from(hrPayrollLines)
      .where(eq(hrPayrollLines.payrollRunId, id));

    const formattedLines = lines.map((line) => ({
      person_id: line.personId,
      person_name: line.personName,
      employment_type: line.employmentType,
      gross_salary: parseFloat(line.grossSalary || "0"),
      overtime: parseFloat(line.overtime || "0"),
      bonus: parseFloat(line.bonus || "0"),
      allowances: parseFloat(line.allowances || "0"),
      income_tax: parseFloat(line.incomeTax || "0"),
      social_security: parseFloat(line.socialSecurity || "0"),
      pension: parseFloat(line.pension || "0"),
      health_insurance: parseFloat(line.healthInsurance || "0"),
      other_deductions: parseFloat(line.otherDeductions || "0"),
      total_gross: parseFloat(line.totalGross || "0"),
      total_deductions: parseFloat(line.totalDeductions || "0"),
      net_pay: parseFloat(line.netPay || "0"),
      ai_analyzed: line.aiAnalyzed,
      ai_suggestions: line.aiSuggestions,
      compliance_issues: line.complianceIssues,
    }));

    return NextResponse.json({
      run: {
        id: run.id,
        period_start: run.periodStart,
        period_end: run.periodEnd,
        pay_date: run.payDate,
        employment_types: run.employmentTypes,
        status: run.status,
        currency: run.currency,
        total_gross: parseFloat(run.totalGross || "0"),
        total_net: parseFloat(run.totalNet || "0"),
        total_deductions: parseFloat(run.totalDeductions || "0"),
        created_at: run.createdAt,
      },
      lines: formattedLines,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/hr-people/payroll/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/hr-people/payroll/[id]
 * Delete a draft payroll run
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await params;

    const [run] = await db
      .select()
      .from(hrPayrollRuns)
      .where(and(eq(hrPayrollRuns.id, id), eq(hrPayrollRuns.tenantId, tenantId)));

    if (!run) {
      return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    }

    if (run.status === "posted_to_finance") {
      return NextResponse.json(
        { error: "Cannot delete a payroll run that has been posted to finance" },
        { status: 400 }
      );
    }

    // Delete lines first (cascade should handle this, but being explicit)
    await db.delete(hrPayrollLines).where(eq(hrPayrollLines.payrollRunId, id));

    // Delete the run
    await db.delete(hrPayrollRuns).where(eq(hrPayrollRuns.id, id));

    return NextResponse.json({ success: true, message: "Payroll run deleted" });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("DELETE /api/hr-people/payroll/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
