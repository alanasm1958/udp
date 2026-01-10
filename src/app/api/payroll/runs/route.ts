/**
 * /api/payroll/runs
 *
 * List and create payroll runs.
 * Payroll runs are batch processing records that calculate earnings, taxes,
 * and deductions for a pay period.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  payrollRuns,
  payPeriods,
  paySchedules,
} from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface CreatePayrollRunRequest {
  payPeriodId: string;
  runType?: "regular" | "bonus" | "correction" | "final";
  notes?: string;
}

function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * GET /api/payroll/runs
 * List payroll runs with optional filters
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const url = new URL(req.url);

    const statusFilter = url.searchParams.get("status");
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 200);

    const conditions = [eq(payrollRuns.tenantId, tenantId)];

    if (statusFilter) {
      conditions.push(eq(payrollRuns.status, statusFilter as any));
    }

    const runs = await db
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
        notes: payrollRuns.notes,
        createdAt: payrollRuns.createdAt,
        // Pay period info
        periodStart: payPeriods.startDate,
        periodEnd: payPeriods.endDate,
        payDate: payPeriods.payDate,
        periodNumber: payPeriods.periodNumber,
        year: payPeriods.year,
      })
      .from(payrollRuns)
      .innerJoin(payPeriods, eq(payrollRuns.payPeriodId, payPeriods.id))
      .where(and(...conditions))
      .orderBy(desc(payrollRuns.createdAt))
      .limit(limit);

    return NextResponse.json({ items: runs });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/payroll/runs error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/payroll/runs
 * Create a new payroll run (draft status)
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: CreatePayrollRunRequest = await req.json();

    // Validate required fields
    if (!body.payPeriodId) {
      return NextResponse.json({ error: "payPeriodId is required" }, { status: 400 });
    }
    if (!isValidUuid(body.payPeriodId)) {
      return NextResponse.json({ error: "Invalid payPeriodId format" }, { status: 400 });
    }

    // Validate pay period exists
    const [payPeriod] = await db
      .select({
        id: payPeriods.id,
        startDate: payPeriods.startDate,
        endDate: payPeriods.endDate,
        payDate: payPeriods.payDate,
        periodNumber: payPeriods.periodNumber,
        year: payPeriods.year,
        scheduleName: paySchedules.name,
      })
      .from(payPeriods)
      .innerJoin(paySchedules, eq(payPeriods.payScheduleId, paySchedules.id))
      .where(
        and(
          eq(payPeriods.id, body.payPeriodId),
          eq(paySchedules.tenantId, tenantId)
        )
      );

    if (!payPeriod) {
      return NextResponse.json({ error: "Pay period not found" }, { status: 404 });
    }

    // Get the next run number for this period
    const [maxRun] = await db
      .select({ maxRunNumber: sql<number>`COALESCE(MAX(${payrollRuns.runNumber}), 0)` })
      .from(payrollRuns)
      .where(
        and(
          eq(payrollRuns.tenantId, tenantId),
          eq(payrollRuns.payPeriodId, body.payPeriodId)
        )
      );

    const runNumber = (maxRun?.maxRunNumber ?? 0) + 1;

    // Create the payroll run
    const [run] = await db
      .insert(payrollRuns)
      .values({
        tenantId,
        payPeriodId: body.payPeriodId,
        runNumber,
        runType: body.runType ?? "regular",
        status: "draft",
        notes: body.notes ?? null,
        createdByActorId: actor.actorId,
      })
      .returning();

    await audit.log("payroll_run", run.id, "payroll_run_created", {
      payPeriodId: body.payPeriodId,
      runNumber,
      runType: body.runType ?? "regular",
      periodStart: payPeriod.startDate,
      periodEnd: payPeriod.endDate,
      payDate: payPeriod.payDate,
    });

    return NextResponse.json({
      id: run.id,
      runNumber,
      status: run.status,
      payPeriod: {
        id: payPeriod.id,
        startDate: payPeriod.startDate,
        endDate: payPeriod.endDate,
        payDate: payPeriod.payDate,
        periodNumber: payPeriod.periodNumber,
        year: payPeriod.year,
        scheduleName: payPeriod.scheduleName,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/payroll/runs error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
