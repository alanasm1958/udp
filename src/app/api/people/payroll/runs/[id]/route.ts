/**
 * /api/people/payroll/runs/[id]
 *
 * Individual payroll run management - get, update lines, delete
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

/**
 * GET /api/people/payroll/runs/[id]
 * Get payroll run with all lines
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const { id: runId } = await params;

    const [run] = await db
      .select()
      .from(payrollRunsV2)
      .where(and(eq(payrollRunsV2.id, runId), eq(payrollRunsV2.tenantId, tenantId)));

    if (!run) {
      return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    }

    const lines = await db
      .select()
      .from(payrollRunLines)
      .where(eq(payrollRunLines.payrollRunId, runId))
      .orderBy(payrollRunLines.personName);

    // Calculate totals
    const totals = await db.execute(sql`
      SELECT
        COUNT(*) as total_lines,
        COUNT(*) FILTER (WHERE is_included = true) as included_lines,
        SUM(CASE WHEN is_included THEN COALESCE(gross_pay::numeric, 0) ELSE 0 END) as total_gross,
        SUM(CASE WHEN is_included THEN COALESCE(net_pay::numeric, 0) ELSE 0 END) as total_net,
        SUM(CASE WHEN is_included THEN COALESCE(total_taxes::numeric, 0) ELSE 0 END) as total_taxes,
        SUM(CASE WHEN is_included THEN COALESCE(total_deductions::numeric, 0) ELSE 0 END) as total_deductions,
        SUM(CASE WHEN is_included THEN COALESCE(total_employer_cost::numeric, 0) ELSE 0 END) as total_employer_cost
      FROM payroll_run_lines
      WHERE payroll_run_id = ${runId}
    `);

    return NextResponse.json({
      run,
      lines,
      summary: {
        totalLines: parseInt(String(totals.rows[0]?.total_lines || 0)),
        includedLines: parseInt(String(totals.rows[0]?.included_lines || 0)),
        totalGross: parseFloat(String(totals.rows[0]?.total_gross || 0)),
        totalNet: parseFloat(String(totals.rows[0]?.total_net || 0)),
        totalTaxes: parseFloat(String(totals.rows[0]?.total_taxes || 0)),
        totalDeductions: parseFloat(String(totals.rows[0]?.total_deductions || 0)),
        totalEmployerCost: parseFloat(String(totals.rows[0]?.total_employer_cost || 0)),
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error fetching payroll run:", error);
    return NextResponse.json(
      { error: "Failed to fetch payroll run" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/people/payroll/runs/[id]
 * Update payroll run lines
 */
export async function PATCH(
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
    const body = await request.json();

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
        { error: "Cannot modify a posted or voided payroll run" },
        { status: 400 }
      );
    }

    // Update lines if provided
    if (body.lines && Array.isArray(body.lines)) {
      for (const line of body.lines) {
        if (!line.id) continue;

        await db
          .update(payrollRunLines)
          .set({
            isIncluded: line.isIncluded ?? undefined,
            excludeReason: line.excludeReason ?? undefined,
            basePay: line.basePay ?? undefined,
            allowances: line.allowances ?? undefined,
            otherEarnings: line.otherEarnings ?? undefined,
            employeeTaxes: line.employeeTaxes ?? undefined,
            employeeDeductions: line.employeeDeductions ?? undefined,
            employerContributions: line.employerContributions ?? undefined,
            rowNotes: line.rowNotes ?? undefined,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(payrollRunLines.id, line.id),
              eq(payrollRunLines.payrollRunId, runId)
            )
          );
      }
    }

    // Update run timestamp
    await db
      .update(payrollRunsV2)
      .set({
        updatedAt: new Date(),
        updatedByActorId: actor.actorId,
      })
      .where(eq(payrollRunsV2.id, runId));

    await audit.log("payroll_run", runId, "payroll_run_updated", {
      linesUpdated: body.lines?.length || 0,
    });

    // Fetch updated data
    const updatedLines = await db
      .select()
      .from(payrollRunLines)
      .where(eq(payrollRunLines.payrollRunId, runId))
      .orderBy(payrollRunLines.personName);

    return NextResponse.json({
      success: true,
      lines: updatedLines,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error updating payroll run:", error);
    return NextResponse.json(
      { error: "Failed to update payroll run" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/people/payroll/runs/[id]
 * Delete a draft payroll run
 */
export async function DELETE(
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
        { error: "Cannot delete a posted or voided payroll run" },
        { status: 400 }
      );
    }

    // Delete lines first (cascade should handle this but being explicit)
    await db
      .delete(payrollRunLines)
      .where(eq(payrollRunLines.payrollRunId, runId));

    // Delete run
    await db
      .delete(payrollRunsV2)
      .where(eq(payrollRunsV2.id, runId));

    await audit.log("payroll_run", runId, "payroll_run_deleted", {
      periodStart: run.periodStart,
      periodEnd: run.periodEnd,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error deleting payroll run:", error);
    return NextResponse.json(
      { error: "Failed to delete payroll run" },
      { status: 500 }
    );
  }
}
