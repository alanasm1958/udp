/**
 * /api/payroll/pay-periods
 *
 * List pay periods for creating payroll runs.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { payPeriods, paySchedules } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

/**
 * GET /api/payroll/pay-periods
 * List pay periods with optional filters
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status"); // upcoming, in_progress, completed
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const includeWithRuns = searchParams.get("includeWithRuns") === "true";

    // Base query
    const conditions = [eq(payPeriods.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(payPeriods.status, status));
    }

    // Get pay periods with schedule info and run count
    const periods = await db
      .select({
        id: payPeriods.id,
        payScheduleId: payPeriods.payScheduleId,
        scheduleName: paySchedules.name,
        frequency: paySchedules.frequency,
        periodNumber: payPeriods.periodNumber,
        year: payPeriods.year,
        startDate: payPeriods.startDate,
        endDate: payPeriods.endDate,
        payDate: payPeriods.payDate,
        timesheetCutoff: payPeriods.timesheetCutoff,
        processingDate: payPeriods.processingDate,
        status: payPeriods.status,
        runCount: sql<number>`(
          SELECT COUNT(*)::int FROM payroll_runs
          WHERE pay_period_id = ${payPeriods.id}
        )`,
        hasPostedRun: sql<boolean>`EXISTS(
          SELECT 1 FROM payroll_runs
          WHERE pay_period_id = ${payPeriods.id}
          AND status IN ('posted', 'paid')
        )`,
      })
      .from(payPeriods)
      .leftJoin(paySchedules, eq(payPeriods.payScheduleId, paySchedules.id))
      .where(and(...conditions))
      .orderBy(desc(payPeriods.payDate))
      .limit(limit);

    // Filter out periods that already have runs if requested
    const items = includeWithRuns
      ? periods
      : periods.filter(p => p.runCount === 0 || !p.hasPostedRun);

    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/payroll/pay-periods error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
