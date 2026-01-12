/**
 * /api/hr-people/payroll
 *
 * List payroll runs
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { hrPayrollRuns, hrPayrollLines } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

/**
 * GET /api/hr-people/payroll
 * List all payroll runs
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const url = new URL(req.url);

    const statusFilter = url.searchParams.get("status");
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 200);

    const conditions = [eq(hrPayrollRuns.tenantId, tenantId)];
    if (statusFilter) {
      conditions.push(eq(hrPayrollRuns.status, statusFilter));
    }

    const runs = await db
      .select({
        id: hrPayrollRuns.id,
        periodStart: hrPayrollRuns.periodStart,
        periodEnd: hrPayrollRuns.periodEnd,
        payDate: hrPayrollRuns.payDate,
        employmentTypes: hrPayrollRuns.employmentTypes,
        status: hrPayrollRuns.status,
        currency: hrPayrollRuns.currency,
        totalGross: hrPayrollRuns.totalGross,
        totalNet: hrPayrollRuns.totalNet,
        totalDeductions: hrPayrollRuns.totalDeductions,
        createdAt: hrPayrollRuns.createdAt,
        lineCount: sql<number>`(
          SELECT COUNT(*) FROM ${hrPayrollLines}
          WHERE ${hrPayrollLines.payrollRunId} = ${hrPayrollRuns.id}
        )::int`,
      })
      .from(hrPayrollRuns)
      .where(sql`${hrPayrollRuns.tenantId} = ${tenantId}${statusFilter ? sql` AND ${hrPayrollRuns.status} = ${statusFilter}` : sql``}`)
      .orderBy(desc(hrPayrollRuns.periodEnd))
      .limit(limit);

    return NextResponse.json({ runs });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/hr-people/payroll error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
