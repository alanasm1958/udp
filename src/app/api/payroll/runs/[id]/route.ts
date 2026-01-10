/**
 * /api/payroll/runs/[id]
 *
 * Get, update, and delete individual payroll runs.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  payrollRuns,
  payrollRunEmployees,
  payPeriods,
  paySchedules,
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

interface UpdatePayrollRunRequest {
  notes?: string;
}

function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/payroll/runs/[id]
 * Get a single payroll run with details
 */
export async function GET(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await context.params;

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid payroll run ID format" }, { status: 400 });
    }

    // Get run with pay period info
    const [run] = await db
      .select({
        id: payrollRuns.id,
        payPeriodId: payrollRuns.payPeriodId,
        runNumber: payrollRuns.runNumber,
        runType: payrollRuns.runType,
        status: payrollRuns.status,
        totalGrossPay: payrollRuns.totalGrossPay,
        totalEmployeeTaxes: payrollRuns.totalEmployeeTaxes,
        totalEmployeeDeductions: payrollRuns.totalEmployeeDeductions,
        totalNetPay: payrollRuns.totalNetPay,
        totalEmployerTaxes: payrollRuns.totalEmployerTaxes,
        totalEmployerContributions: payrollRuns.totalEmployerContributions,
        employeeCount: payrollRuns.employeeCount,
        calculatedAt: payrollRuns.calculatedAt,
        approvedAt: payrollRuns.approvedAt,
        postedAt: payrollRuns.postedAt,
        journalEntryId: payrollRuns.journalEntryId,
        voidedAt: payrollRuns.voidedAt,
        voidReason: payrollRuns.voidReason,
        notes: payrollRuns.notes,
        createdAt: payrollRuns.createdAt,
        updatedAt: payrollRuns.updatedAt,
        // Pay period info
        periodStart: payPeriods.startDate,
        periodEnd: payPeriods.endDate,
        payDate: payPeriods.payDate,
        periodNumber: payPeriods.periodNumber,
        year: payPeriods.year,
        scheduleName: paySchedules.name,
      })
      .from(payrollRuns)
      .innerJoin(payPeriods, eq(payrollRuns.payPeriodId, payPeriods.id))
      .innerJoin(paySchedules, eq(payPeriods.payScheduleId, paySchedules.id))
      .where(
        and(
          eq(payrollRuns.id, id),
          eq(payrollRuns.tenantId, tenantId)
        )
      );

    if (!run) {
      return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    }

    // Get employee count from payroll_run_employees
    const [employeeStats] = await db
      .select({
        count: sql<number>`COUNT(*)::int`,
      })
      .from(payrollRunEmployees)
      .where(eq(payrollRunEmployees.payrollRunId, id));

    return NextResponse.json({
      ...run,
      employeeCount: run.employeeCount ?? employeeStats?.count ?? 0,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/payroll/runs/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/payroll/runs/[id]
 * Update a payroll run (only allowed in draft status)
 */
export async function PATCH(
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

    // Check if run exists and is in draft status
    const [existingRun] = await db
      .select({ id: payrollRuns.id, status: payrollRuns.status })
      .from(payrollRuns)
      .where(
        and(
          eq(payrollRuns.id, id),
          eq(payrollRuns.tenantId, tenantId)
        )
      );

    if (!existingRun) {
      return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    }

    if (existingRun.status !== "draft") {
      return NextResponse.json(
        { error: `Cannot update payroll run in ${existingRun.status} status. Only draft runs can be updated.` },
        { status: 400 }
      );
    }

    const body: UpdatePayrollRunRequest = await req.json();

    // Update the run
    const [updated] = await db
      .update(payrollRuns)
      .set({
        notes: body.notes !== undefined ? body.notes : undefined,
        updatedAt: sql`now()`,
      })
      .where(eq(payrollRuns.id, id))
      .returning();

    await audit.log("payroll_run", id, "payroll_run_updated", {
      changes: body,
    });

    return NextResponse.json({ id: updated.id, status: updated.status });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/payroll/runs/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/payroll/runs/[id]
 * Delete a payroll run (only allowed in draft status)
 */
export async function DELETE(
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

    // Check if run exists and is in draft status
    const [existingRun] = await db
      .select({ id: payrollRuns.id, status: payrollRuns.status, runNumber: payrollRuns.runNumber })
      .from(payrollRuns)
      .where(
        and(
          eq(payrollRuns.id, id),
          eq(payrollRuns.tenantId, tenantId)
        )
      );

    if (!existingRun) {
      return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    }

    if (existingRun.status !== "draft") {
      return NextResponse.json(
        { error: `Cannot delete payroll run in ${existingRun.status} status. Only draft runs can be deleted.` },
        { status: 400 }
      );
    }

    // Delete the run (cascade will handle payroll_run_employees)
    await db
      .delete(payrollRuns)
      .where(eq(payrollRuns.id, id));

    await audit.log("payroll_run", id, "payroll_run_deleted", {
      runNumber: existingRun.runNumber,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("DELETE /api/payroll/runs/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
