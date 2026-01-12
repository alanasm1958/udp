// /api/people/analytics/route.ts
// Dashboard analytics cards for HR & People module

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const headersList = await headers();
    const tenantId = headersList.get("x-tenant-id");

    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Headcount - Active staff and interns
    const headcountResult = await db.execute(sql`
      SELECT 
        COUNT(DISTINCT e.id) as total_active,
        COUNT(DISTINCT CASE WHEN e.person_type = 'staff' THEN e.id END) as active_staff,
        COUNT(DISTINCT CASE WHEN e.person_type = 'intern' THEN e.id END) as active_interns
      FROM employees e
      JOIN people p ON p.id = e.person_id
      WHERE e.tenant_id = ${tenantId}
        AND p.status = 'active'
        AND (e.end_date IS NULL OR e.end_date >= CURRENT_DATE)
    `);

    const headcount = headcountResult.rows[0];

    // 2. New hires - People started in last 30 days
    const newHiresResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM employees e
      JOIN people p ON p.id = e.person_id
      WHERE e.tenant_id = ${tenantId}
        AND p.status = 'active'
        AND e.hire_date >= CURRENT_DATE - INTERVAL '30 days'
    `);

    const newHires = parseInt(newHiresResult.rows[0]?.count || "0");

    // 3. Contracts ending - Within 30 days
    const contractsEndingResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM employees e
      JOIN people p ON p.id = e.person_id
      WHERE e.tenant_id = ${tenantId}
        AND p.status = 'active'
        AND e.end_date IS NOT NULL
        AND e.end_date >= CURRENT_DATE
        AND e.end_date <= CURRENT_DATE + INTERVAL '30 days'
    `);

    const contractsEnding = parseInt(contractsEndingResult.rows[0]?.count || "0");

    // 4. Payroll status - Current period
    const currentPeriodResult = await db.execute(sql`
      SELECT 
        status,
        period_start,
        period_end,
        pay_date
      FROM payroll_runs_v2
      WHERE tenant_id = ${tenantId}
        AND period_end >= CURRENT_DATE - INTERVAL '15 days'
      ORDER BY period_end DESC
      LIMIT 1
    `);

    const payrollStatus = currentPeriodResult.rows[0] || null;

    // 5. Open alerts - HR related tasks and alerts
    const openAlertsResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM tasks
      WHERE tenant_id = ${tenantId}
        AND domain = 'hr'
        AND status = 'open'
    `);

    const openAlerts = parseInt(openAlertsResult.rows[0]?.count || "0");

    // Format response
    const analytics = {
      headcount: {
        label: "Active Headcount",
        value: headcount.total_active,
        detail: `${headcount.active_staff} staff, ${headcount.active_interns} interns`,
        variant: "default" as const,
      },
      newHires: {
        label: "New Hires (30d)",
        value: newHires,
        variant: newHires > 0 ? ("success" as const) : ("default" as const),
      },
      contractsEnding: {
        label: "Contracts Ending Soon",
        value: contractsEnding,
        variant: contractsEnding > 0 ? ("warning" as const) : ("default" as const),
      },
      payrollStatus: {
        label: "Payroll Status",
        value: payrollStatus
          ? payrollStatus.status === "posted"
            ? "Processed"
            : payrollStatus.status === "draft"
            ? "In Progress"
            : "Pending"
          : "Not Started",
        detail: payrollStatus
          ? `Period: ${payrollStatus.period_start} - ${payrollStatus.period_end}`
          : undefined,
        variant: payrollStatus?.status === "posted"
          ? ("success" as const)
          : payrollStatus?.status === "draft"
          ? ("info" as const)
          : ("warning" as const),
      },
      openAlerts: {
        label: "Open HR Tasks",
        value: openAlerts,
        variant: openAlerts > 5 ? ("danger" as const) : ("default" as const),
      },
    };

    return NextResponse.json({ analytics });
  } catch (error) {
    console.error("Error fetching people analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
