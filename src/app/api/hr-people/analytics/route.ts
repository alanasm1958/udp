/**
 * /api/hr-people/analytics
 *
 * Dashboard analytics, todos, and alerts for HR & People module
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { hrPersons, hrPayrollRuns, hrPerformanceReviews, tasks } from "@/db/schema";
import { eq, and, sql, gte, desc } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

/**
 * GET /api/hr-people/analytics
 * Returns analytics cards, todos, and alerts for the HR dashboard
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);

    // Analytics queries
    const [
      totalHeadcount,
      headcountByType,
      newHiresLast30Days,
      currentMonthPayroll,
      pendingReviews,
      avgTenure,
    ] = await Promise.all([
      // Total active headcount
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(hrPersons)
        .where(and(eq(hrPersons.tenantId, tenantId), eq(hrPersons.status, "active"))),

      // Headcount by employment type
      db
        .select({
          employmentType: hrPersons.employmentType,
          count: sql<number>`count(*)::int`,
        })
        .from(hrPersons)
        .where(and(eq(hrPersons.tenantId, tenantId), eq(hrPersons.status, "active")))
        .groupBy(hrPersons.employmentType),

      // New hires last 30 days
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(hrPersons)
        .where(
          and(
            eq(hrPersons.tenantId, tenantId),
            gte(hrPersons.hireDate, sql`CURRENT_DATE - INTERVAL '30 days'`)
          )
        ),

      // Current month payroll status
      db
        .select({
          status: hrPayrollRuns.status,
          periodStart: hrPayrollRuns.periodStart,
        })
        .from(hrPayrollRuns)
        .where(
          and(
            eq(hrPayrollRuns.tenantId, tenantId),
            gte(hrPayrollRuns.periodStart, sql`DATE_TRUNC('month', CURRENT_DATE)`)
          )
        )
        .orderBy(desc(hrPayrollRuns.periodStart))
        .limit(1),

      // Pending performance reviews (not locked)
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(hrPerformanceReviews)
        .where(
          and(
            eq(hrPerformanceReviews.tenantId, tenantId),
            sql`NOT (${hrPerformanceReviews.reviewerAccepted} AND ${hrPerformanceReviews.employeeAccepted})`
          )
        ),

      // Average tenure (in days)
      db
        .select({
          avgDays: sql<number>`AVG(CURRENT_DATE - ${hrPersons.hireDate})::int`,
        })
        .from(hrPersons)
        .where(
          and(
            eq(hrPersons.tenantId, tenantId),
            eq(hrPersons.status, "active"),
            sql`${hrPersons.hireDate} IS NOT NULL`
          )
        ),
    ]);

    // Build analytics cards
    const analytics = [
      {
        label: "Total Headcount",
        value: totalHeadcount[0]?.count || 0,
        variant: "default" as const,
        icon: "users",
      },
      {
        label: "Staff",
        value: headcountByType.find((h) => h.employmentType === "staff")?.count || 0,
        variant: "default" as const,
        icon: "briefcase",
      },
      {
        label: "New Hires (30d)",
        value: newHiresLast30Days[0]?.count || 0,
        change: newHiresLast30Days[0]?.count > 0 ? `+${newHiresLast30Days[0]?.count}` : undefined,
        variant: newHiresLast30Days[0]?.count > 0 ? ("success" as const) : ("default" as const),
        icon: "user-plus",
      },
      {
        label: "Payroll Status",
        value: currentMonthPayroll[0]?.status || "Not Started",
        variant:
          currentMonthPayroll[0]?.status === "posted_to_finance"
            ? ("success" as const)
            : currentMonthPayroll[0]?.status === "confirmed"
            ? ("warning" as const)
            : ("default" as const),
        icon: "dollar-sign",
      },
      {
        label: "Pending Reviews",
        value: pendingReviews[0]?.count || 0,
        variant: (pendingReviews[0]?.count || 0) > 0 ? ("warning" as const) : ("success" as const),
        icon: "clipboard-check",
      },
      {
        label: "Avg Tenure",
        value: avgTenure[0]?.avgDays
          ? `${Math.round((avgTenure[0].avgDays || 0) / 365)} yrs`
          : "N/A",
        variant: "default" as const,
        icon: "calendar",
      },
    ];

    // Get HR-related todos/tasks
    const hrTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.tenantId, tenantId),
          eq(tasks.domain, "hr"),
          eq(tasks.status, "open")
        )
      )
      .orderBy(desc(tasks.priority))
      .limit(10);

    const todos = hrTasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description || "",
      due_at: task.dueAt?.toISOString(),
      priority: task.priority as "low" | "medium" | "high",
    }));

    // Generate alerts based on data
    const alerts: Array<{
      id: string;
      title: string;
      message: string;
      severity: "info" | "warning" | "critical";
      created_at: string;
    }> = [];

    // Check for work permit expirations in next 30 days
    const expiringPermits = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(hrPersons)
      .where(
        and(
          eq(hrPersons.tenantId, tenantId),
          eq(hrPersons.status, "active"),
          sql`${hrPersons.workPermitExpiry} IS NOT NULL`,
          sql`${hrPersons.workPermitExpiry} <= CURRENT_DATE + INTERVAL '30 days'`,
          sql`${hrPersons.workPermitExpiry} >= CURRENT_DATE`
        )
      );

    if ((expiringPermits[0]?.count || 0) > 0) {
      alerts.push({
        id: "work-permit-expiring",
        title: "Work Permits Expiring Soon",
        message: `${expiringPermits[0]?.count} employee(s) have work permits expiring in the next 30 days`,
        severity: "warning",
        created_at: new Date().toISOString(),
      });
    }

    // Check if payroll is overdue (after 5th of month and no payroll run)
    const today = new Date();
    if (today.getDate() > 5 && !currentMonthPayroll[0]) {
      alerts.push({
        id: "payroll-overdue",
        title: "Payroll Not Started",
        message: "This month's payroll has not been started yet",
        severity: "critical",
        created_at: new Date().toISOString(),
      });
    }

    // Check for reviews pending more than 30 days
    const overdueReviews = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(hrPerformanceReviews)
      .where(
        and(
          eq(hrPerformanceReviews.tenantId, tenantId),
          sql`NOT (${hrPerformanceReviews.reviewerAccepted} AND ${hrPerformanceReviews.employeeAccepted})`,
          sql`${hrPerformanceReviews.createdAt} < CURRENT_DATE - INTERVAL '30 days'`
        )
      );

    if ((overdueReviews[0]?.count || 0) > 0) {
      alerts.push({
        id: "reviews-overdue",
        title: "Overdue Performance Reviews",
        message: `${overdueReviews[0]?.count} review(s) have been pending for more than 30 days`,
        severity: "warning",
        created_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      analytics,
      todos,
      alerts,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/hr-people/analytics error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
