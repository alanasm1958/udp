/**
 * /api/people/analytics
 *
 * Dashboard analytics cards for HR & People module
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  TenantError,
} from "@/lib/tenant";

export async function GET(request: NextRequest) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);

    // 1. Headcount - Active staff and interns
    const headcountResult = await db.execute(sql`
      SELECT
        COUNT(DISTINCT e.id) as total_active,
        COUNT(DISTINCT CASE WHEN p.types @> '["staff"]'::jsonb THEN e.id END) as active_staff,
        COUNT(DISTINCT CASE WHEN p.types @> '["contractor"]'::jsonb THEN e.id END) as active_contractors
      FROM employees e
      JOIN people p ON p.id = e.person_id
      WHERE e.tenant_id = ${tenantId}
        AND p.is_active = true
        AND e.employment_status = 'active'
    `);

    const headcount = headcountResult.rows[0] || { total_active: 0, active_staff: 0, active_contractors: 0 };

    // 2. New hires - People started in last 30 days
    const newHiresResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM employees e
      JOIN people p ON p.id = e.person_id
      WHERE e.tenant_id = ${tenantId}
        AND p.is_active = true
        AND e.hire_date >= CURRENT_DATE - INTERVAL '30 days'
    `);

    const newHires = parseInt(String(newHiresResult.rows[0]?.count || "0"));

    // 3. Contracts ending - Within 30 days
    const contractsEndingResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM employees e
      JOIN people p ON p.id = e.person_id
      WHERE e.tenant_id = ${tenantId}
        AND p.is_active = true
        AND e.termination_date IS NOT NULL
        AND e.termination_date >= CURRENT_DATE
        AND e.termination_date <= CURRENT_DATE + INTERVAL '30 days'
    `);

    const contractsEnding = parseInt(String(contractsEndingResult.rows[0]?.count || "0"));

    // 4. Payroll status - Current period (check both v1 and v2 tables)
    const payrollStatusV2Result = await db.execute(sql`
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

    let payrollStatus = payrollStatusV2Result.rows[0];

    // Fallback to v1 table if no v2 runs
    if (!payrollStatus) {
      const payrollStatusV1Result = await db.execute(sql`
        SELECT
          status,
          period_start,
          period_end,
          pay_date
        FROM payroll_runs
        WHERE tenant_id = ${tenantId}
          AND period_end >= CURRENT_DATE - INTERVAL '15 days'
        ORDER BY period_end DESC
        LIMIT 1
      `);
      payrollStatus = payrollStatusV1Result.rows[0];
    }

    // 5. Open alerts - HR related tasks and alerts
    const openAlertsResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM tasks
      WHERE tenant_id = ${tenantId}
        AND domain = 'hr'
        AND status = 'open'
    `);

    const openAlerts = parseInt(String(openAlertsResult.rows[0]?.count || "0"));

    // 6. Pending leave requests
    const pendingLeaveResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM leave_requests
      WHERE tenant_id = ${tenantId}
        AND status = 'pending'
    `);

    const pendingLeave = parseInt(String(pendingLeaveResult.rows[0]?.count || "0"));

    // 7. Expiring documents (within 30 days)
    const expiringDocsResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM documents
      WHERE tenant_id = ${tenantId}
        AND expiry_date IS NOT NULL
        AND expiry_date >= CURRENT_DATE
        AND expiry_date <= CURRENT_DATE + INTERVAL '30 days'
    `);

    const expiringDocs = parseInt(String(expiringDocsResult.rows[0]?.count || "0"));

    // Format response
    const analytics = {
      headcount: {
        label: "Active Headcount",
        value: parseInt(String(headcount.total_active || 0)),
        detail: `${headcount.active_staff || 0} staff, ${headcount.active_contractors || 0} contractors`,
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
      pendingLeave: {
        label: "Pending Leave Requests",
        value: pendingLeave,
        variant: pendingLeave > 0 ? ("info" as const) : ("default" as const),
      },
      expiringDocs: {
        label: "Expiring Documents",
        value: expiringDocs,
        variant: expiringDocs > 0 ? ("warning" as const) : ("default" as const),
      },
    };

    return NextResponse.json({ analytics });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error fetching people analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
