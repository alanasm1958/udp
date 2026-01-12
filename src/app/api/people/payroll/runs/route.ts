/**
 * /api/people/payroll/runs
 *
 * Payroll run management - list and create (v2)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { payrollRunsV2, payrollRunLines, employees, people, compensationRecords } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface CreateRunRequest {
  periodStart: string;
  periodEnd: string;
  payDate: string;
  currency?: string;
  preloadOption?: "staff" | "contractors" | "both" | "custom";
}

interface EligibleEmployee {
  employee_id: string;
  person_id: string;
  person_name: string;
  types: string[] | null;
  jurisdiction: string | null;
  base_pay: string | null;
  base_pay_type: string | null;
}

/**
 * GET /api/people/payroll/runs
 * List payroll runs with optional status filter
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const url = new URL(request.url);

    const status = url.searchParams.get("status");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);

    const conditions = [eq(payrollRunsV2.tenantId, tenantId)];
    if (status) {
      conditions.push(eq(payrollRunsV2.status, status as "draft" | "posted" | "voided"));
    }

    const runs = await db
      .select()
      .from(payrollRunsV2)
      .where(and(...conditions))
      .orderBy(desc(payrollRunsV2.periodEnd))
      .limit(limit);

    // Get line counts for each run
    const runIds = runs.map(r => r.id);
    const lineCounts = runIds.length > 0 ? await db.execute(sql`
      SELECT
        payroll_run_id,
        COUNT(*) as total_lines,
        COUNT(*) FILTER (WHERE is_included = true) as included_lines,
        SUM(CASE WHEN is_included THEN COALESCE(gross_pay::numeric, 0) ELSE 0 END) as total_gross,
        SUM(CASE WHEN is_included THEN COALESCE(net_pay::numeric, 0) ELSE 0 END) as total_net
      FROM payroll_run_lines
      WHERE payroll_run_id = ANY(${runIds})
      GROUP BY payroll_run_id
    `) : { rows: [] };

    const lineCountMap = Object.fromEntries(
      lineCounts.rows.map(r => [r.payroll_run_id, r])
    );

    const enrichedRuns = runs.map(run => ({
      ...run,
      totalLines: parseInt(String(lineCountMap[run.id]?.total_lines || 0)),
      includedLines: parseInt(String(lineCountMap[run.id]?.included_lines || 0)),
      totalGross: parseFloat(String(lineCountMap[run.id]?.total_gross || 0)),
      totalNet: parseFloat(String(lineCountMap[run.id]?.total_net || 0)),
    }));

    return NextResponse.json({ runs: enrichedRuns });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error fetching payroll runs:", error);
    return NextResponse.json(
      { error: "Failed to fetch payroll runs" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/people/payroll/runs
 * Create a new payroll run with preload
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const userIdFromHeader = getUserIdFromHeaders(request);
    const actorIdFromHeader = getActorIdFromHeaders(request);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: CreateRunRequest = await request.json();

    // Validation
    if (!body.periodStart || !body.periodEnd || !body.payDate) {
      return NextResponse.json(
        { error: "Period start, end, and pay date are required" },
        { status: 400 }
      );
    }

    // Check for duplicate runs
    const existingRun = await db
      .select({ id: payrollRunsV2.id })
      .from(payrollRunsV2)
      .where(
        and(
          eq(payrollRunsV2.tenantId, tenantId),
          eq(payrollRunsV2.periodStart, body.periodStart),
          eq(payrollRunsV2.periodEnd, body.periodEnd)
        )
      );

    if (existingRun.length > 0) {
      return NextResponse.json(
        { error: "Payroll run already exists for this period" },
        { status: 409 }
      );
    }

    // Create run
    const [newRun] = await db
      .insert(payrollRunsV2)
      .values({
        tenantId,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        payDate: body.payDate,
        currency: body.currency || "USD",
        status: "draft",
        preloadOption: body.preloadOption || "both",
        createdByActorId: actor.actorId,
        updatedByActorId: actor.actorId,
      })
      .returning();

    // Preload eligible employees
    if (body.preloadOption !== "custom") {
      const typesFilter = body.preloadOption === "staff"
        ? sql`p.types @> '["staff"]'::jsonb`
        : body.preloadOption === "contractors"
        ? sql`p.types @> '["contractor"]'::jsonb`
        : sql`(p.types @> '["staff"]'::jsonb OR p.types @> '["contractor"]'::jsonb)`;

      const eligibleEmployees = await db.execute(sql`
        SELECT
          e.id as employee_id,
          e.person_id,
          p.full_name as person_name,
          p.types,
          j.code as jurisdiction,
          cr.pay_rate as base_pay,
          cr.pay_type as base_pay_type
        FROM employees e
        JOIN people p ON p.id = e.person_id
        LEFT JOIN jurisdictions j ON j.id = e.work_jurisdiction_id
        LEFT JOIN LATERAL (
          SELECT pay_rate, pay_type
          FROM compensation_records
          WHERE employee_id = e.id
            AND effective_from <= ${body.periodEnd}
            AND (effective_to IS NULL OR effective_to >= ${body.periodStart})
          ORDER BY effective_from DESC
          LIMIT 1
        ) cr ON true
        WHERE e.tenant_id = ${tenantId}
          AND p.is_active = true
          AND e.employment_status = 'active'
          AND e.hire_date <= ${body.periodEnd}
          AND (e.termination_date IS NULL OR e.termination_date >= ${body.periodStart})
          AND ${typesFilter}
      `);

      const employees = eligibleEmployees.rows as unknown as EligibleEmployee[];
      if (employees.length > 0) {
        await db.insert(payrollRunLines).values(
          employees.map((emp) => ({
            tenantId,
            payrollRunId: newRun.id,
            employeeId: emp.employee_id,
            personId: emp.person_id,
            isIncluded: true,
            personName: emp.person_name,
            personType: Array.isArray(emp.types) && emp.types.includes("staff") ? "staff" : "contractor",
            jurisdiction: emp.jurisdiction || "Unknown",
            basePay: emp.base_pay || "0",
            basePayType: emp.base_pay_type || "salary",
            allowances: [],
            otherEarnings: [],
            employeeTaxes: [],
            employeeDeductions: [],
            employerContributions: [],
          }))
        );
      }
    }

    await audit.log("payroll_run", newRun.id, "payroll_run_created", {
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      preloadOption: body.preloadOption,
    });

    // Fetch created run with lines
    const lines = await db
      .select()
      .from(payrollRunLines)
      .where(eq(payrollRunLines.payrollRunId, newRun.id))
      .orderBy(payrollRunLines.personName);

    return NextResponse.json(
      {
        run: newRun,
        lines,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error creating payroll run:", error);
    return NextResponse.json(
      { error: "Failed to create payroll run" },
      { status: 500 }
    );
  }
}
