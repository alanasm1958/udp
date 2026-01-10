/**
 * /api/payroll/runs/[id]/approve
 *
 * Approve a calculated payroll run.
 * Sets status to 'approved' after validation.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  payrollRuns,
  payrollRunEmployees,
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

interface ApproveRequest {
  comment?: string;
  acknowledgeAnomalies?: boolean;
}

/**
 * POST /api/payroll/runs/[id]/approve
 * Approve a calculated payroll run
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

    const body: ApproveRequest = await req.json().catch(() => ({}));

    // Get the payroll run
    const [run] = await db
      .select({
        id: payrollRuns.id,
        status: payrollRuns.status,
        employeeCount: payrollRuns.employeeCount,
        totalGrossPay: payrollRuns.totalGrossPay,
        totalNetPay: payrollRuns.totalNetPay,
        notes: payrollRuns.notes,
      })
      .from(payrollRuns)
      .where(
        and(
          eq(payrollRuns.id, id),
          eq(payrollRuns.tenantId, tenantId)
        )
      );

    if (!run) {
      return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    }

    // Check status - must be calculated or reviewing to approve
    if (!["calculated", "reviewing"].includes(run.status)) {
      return NextResponse.json(
        { error: `Cannot approve payroll run in ${run.status} status. Only calculated or reviewing runs can be approved.` },
        { status: 400 }
      );
    }

    // Verify there are employees in the run
    const [employeeStats] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(payrollRunEmployees)
      .where(eq(payrollRunEmployees.payrollRunId, id));

    if (!employeeStats || employeeStats.count === 0) {
      return NextResponse.json(
        { error: "Cannot approve payroll run with no employees. Run calculation first." },
        { status: 400 }
      );
    }

    // Check for negative net pay employees (anomaly)
    const [negativeNetPay] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(payrollRunEmployees)
      .where(
        and(
          eq(payrollRunEmployees.payrollRunId, id),
          sql`${payrollRunEmployees.netPay}::numeric < 0`
        )
      );

    if (negativeNetPay && negativeNetPay.count > 0 && !body.acknowledgeAnomalies) {
      return NextResponse.json(
        {
          error: `${negativeNetPay.count} employee(s) have negative net pay. Set acknowledgeAnomalies: true to approve anyway.`,
          anomalyType: "negative_net_pay",
          count: negativeNetPay.count,
        },
        { status: 400 }
      );
    }

    // Update status to approved
    await db
      .update(payrollRuns)
      .set({
        status: "approved",
        approvedAt: sql`now()`,
        approvedByActorId: actor.actorId,
        notes: body.comment ? `${run.notes || ""}\nApproval comment: ${body.comment}`.trim() : run.notes,
        updatedAt: sql`now()`,
      })
      .where(eq(payrollRuns.id, id));

    await audit.log("payroll_run", id, "payroll_approved", {
      employeeCount: employeeStats.count,
      totalGrossPay: run.totalGrossPay,
      totalNetPay: run.totalNetPay,
      comment: body.comment,
      acknowledgedAnomalies: body.acknowledgeAnomalies,
    });

    return NextResponse.json({
      success: true,
      status: "approved",
      employeeCount: employeeStats.count,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/payroll/runs/[id]/approve error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
