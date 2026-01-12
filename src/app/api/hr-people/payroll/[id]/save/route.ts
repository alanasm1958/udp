/**
 * /api/hr-people/payroll/[id]/save
 *
 * Save payroll run as draft
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { hrPayrollRuns, hrPayrollLines } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";

interface PayrollLine {
  person_id: string;
  gross_salary: number;
  overtime: number;
  bonus: number;
  allowances: number;
  income_tax: number;
  social_security: number;
  pension: number;
  health_insurance: number;
  other_deductions: number;
  total_gross: number;
  total_deductions: number;
  net_pay: number;
}

interface SaveRequest {
  lines: PayrollLine[];
  status?: "draft";
}

/**
 * PATCH /api/hr-people/payroll/[id]/save
 * Save payroll run as draft
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const { id } = await params;

    const [run] = await db
      .select()
      .from(hrPayrollRuns)
      .where(and(eq(hrPayrollRuns.id, id), eq(hrPayrollRuns.tenantId, tenantId)));

    if (!run) {
      return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    }

    if (run.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft payroll runs can be saved" },
        { status: 400 }
      );
    }

    const body: SaveRequest = await req.json();

    // Update each line
    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    for (const line of body.lines) {
      await db
        .update(hrPayrollLines)
        .set({
          grossSalary: line.gross_salary.toFixed(2),
          overtime: line.overtime.toFixed(2),
          bonus: line.bonus.toFixed(2),
          allowances: line.allowances.toFixed(2),
          incomeTax: line.income_tax.toFixed(2),
          socialSecurity: line.social_security.toFixed(2),
          pension: line.pension.toFixed(2),
          healthInsurance: line.health_insurance.toFixed(2),
          otherDeductions: line.other_deductions.toFixed(2),
          totalGross: line.total_gross.toFixed(2),
          totalDeductions: line.total_deductions.toFixed(2),
          netPay: line.net_pay.toFixed(2),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(hrPayrollLines.payrollRunId, id),
            eq(hrPayrollLines.personId, line.person_id)
          )
        );

      totalGross += line.total_gross;
      totalDeductions += line.total_deductions;
      totalNet += line.net_pay;
    }

    // Update run totals
    await db
      .update(hrPayrollRuns)
      .set({
        totalGross: totalGross.toFixed(2),
        totalDeductions: totalDeductions.toFixed(2),
        totalNet: totalNet.toFixed(2),
        updatedAt: new Date(),
        updatedBy: actor.actorId,
      })
      .where(eq(hrPayrollRuns.id, id));

    return NextResponse.json({
      success: true,
      message: "Payroll saved as draft",
      totals: {
        total_gross: totalGross,
        total_deductions: totalDeductions,
        total_net: totalNet,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/hr-people/payroll/[id]/save error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
