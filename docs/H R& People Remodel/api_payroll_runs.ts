// /api/people/payroll/runs/route.ts
// Payroll run management - create and list

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { sql, eq, and, desc } from "drizzle-orm";
import { payrollRunsV2, payrollRunLines } from "@/db/schema";

// GET - List payroll runs
export async function GET(request: NextRequest) {
  try {
    const headersList = await headers();
    const tenantId = headersList.get("x-tenant-id");

    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = db
      .select()
      .from(payrollRunsV2)
      .where(eq(payrollRunsV2.tenantId, tenantId))
      .orderBy(desc(payrollRunsV2.periodEnd));

    if (status) {
      query = query.where(
        and(
          eq(payrollRunsV2.tenantId, tenantId),
          eq(payrollRunsV2.status, status)
        )
      );
    }

    const runs = await query;

    return NextResponse.json({ runs });
  } catch (error) {
    console.error("Error fetching payroll runs:", error);
    return NextResponse.json(
      { error: "Failed to fetch payroll runs" },
      { status: 500 }
    );
  }
}

// POST - Create new payroll run with preload
export async function POST(request: NextRequest) {
  try {
    const headersList = await headers();
    const tenantId = headersList.get("x-tenant-id");
    const userId = headersList.get("x-user-id");

    if (!tenantId || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      periodStart,
      periodEnd,
      payDate,
      currency = "USD",
      preloadOption = "both", // staff, interns, both, custom
    } = body;

    // Validation
    if (!periodStart || !periodEnd || !payDate) {
      return NextResponse.json(
        { error: "Period start, end, and pay date are required" },
        { status: 400 }
      );
    }

    // Check for duplicate runs
    const existingRun = await db.execute(sql`
      SELECT id FROM payroll_runs_v2
      WHERE tenant_id = ${tenantId}
        AND period_start = ${periodStart}
        AND period_end = ${periodEnd}
    `);

    if (existingRun.rows.length > 0) {
      return NextResponse.json(
        { error: "Payroll run already exists for this period" },
        { status: 409 }
      );
    }

    // Create run
    const runId = `prun_${crypto.randomUUID()}`;
    
    await db.execute(sql`
      INSERT INTO payroll_runs_v2 (
        id, tenant_id, period_start, period_end, pay_date,
        currency, status, preload_option, created_by, updated_by
      )
      VALUES (
        ${runId}, ${tenantId}, ${periodStart}, ${periodEnd}, ${payDate},
        ${currency}, 'draft', ${preloadOption}, ${userId}, ${userId}
      )
    `);

    // Preload eligible employees
    let whereClause = "";
    if (preloadOption === "staff") {
      whereClause = "AND e.person_type = 'staff'";
    } else if (preloadOption === "interns") {
      whereClause = "AND e.person_type = 'intern'";
    } else if (preloadOption === "both") {
      whereClause = "AND e.person_type IN ('staff', 'intern')";
    }
    // custom = no preload

    if (preloadOption !== "custom") {
      await db.execute(sql`
        INSERT INTO payroll_run_lines (
          id, tenant_id, payroll_run_id, employee_id, person_id,
          is_included, person_name, person_type, jurisdiction,
          base_pay, base_pay_type
        )
        SELECT 
          'pline_' || gen_random_uuid()::text,
          ${tenantId},
          ${runId},
          e.id,
          e.person_id,
          true,
          p.first_name || ' ' || p.last_name,
          e.person_type,
          COALESCE(addr.country, 'Unknown'),
          COALESCE(comp.salary, 0),
          COALESCE(comp.pay_type, 'salary')
        FROM employees e
        JOIN people p ON p.id = e.person_id
        LEFT JOIN LATERAL (
          SELECT country
          FROM people_addresses
          WHERE person_id = e.person_id
            AND is_current = true
          LIMIT 1
        ) addr ON true
        LEFT JOIN LATERAL (
          SELECT salary, pay_type
          FROM compensation_records
          WHERE employee_id = e.id
          ORDER BY effective_date DESC
          LIMIT 1
        ) comp ON true
        WHERE e.tenant_id = ${tenantId}
          AND p.status = 'active'
          AND e.hire_date <= ${periodEnd}
          AND (e.end_date IS NULL OR e.end_date >= ${periodStart})
          ${sql.raw(whereClause)}
      `);
    }

    // Fetch created run with lines
    const run = await db.execute(sql`
      SELECT * FROM payroll_runs_v2
      WHERE id = ${runId}
    `);

    const lines = await db.execute(sql`
      SELECT * FROM payroll_run_lines
      WHERE payroll_run_id = ${runId}
      ORDER BY person_name
    `);

    return NextResponse.json({
      run: run.rows[0],
      lines: lines.rows,
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating payroll run:", error);
    return NextResponse.json(
      { error: "Failed to create payroll run" },
      { status: 500 }
    );
  }
}
