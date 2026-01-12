/**
 * /api/grc/analytics
 *
 * GET: Returns GRC analytics and compliance metrics
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";
import { db } from "@/db";
import {
  grcRequirements,
  grcTasks,
  grcAlerts,
} from "@/db/schema";
import { eq, and, sql, lte, gte } from "drizzle-orm";

export interface GrcAnalyticsResponse {
  compliance: {
    overallScore: number;
    satisfiedCount: number;
    unsatisfiedCount: number;
    atRiskCount: number;
    unknownCount: number;
    totalRequirements: number;
  };
  riskProfile: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  upcomingDeadlines: {
    overdue: number;
    thisWeek: number;
    thisMonth: number;
    nextQuarter: number;
  };
  byCategory: Record<
    string,
    {
      satisfied: number;
      unsatisfied: number;
      percentage: number;
    }
  >;
  openTasks: number;
  activeAlerts: number;
}

/**
 * GET /api/grc/analytics
 * Returns GRC compliance analytics and metrics
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);

    // Get compliance metrics by status
    const statusMetrics = await db
      .select({
        status: grcRequirements.status,
        count: sql<number>`count(*)::int`,
      })
      .from(grcRequirements)
      .where(
        and(
          eq(grcRequirements.tenantId, tenantId),
          eq(grcRequirements.isActive, true)
        )
      )
      .groupBy(grcRequirements.status);

    const statusCounts = {
      satisfied: 0,
      unsatisfied: 0,
      at_risk: 0,
      unknown: 0,
    };

    for (const row of statusMetrics) {
      if (row.status in statusCounts) {
        statusCounts[row.status as keyof typeof statusCounts] = row.count;
      }
    }

    const totalRequirements =
      statusCounts.satisfied +
      statusCounts.unsatisfied +
      statusCounts.at_risk +
      statusCounts.unknown;

    const overallScore =
      totalRequirements > 0
        ? Math.round((statusCounts.satisfied / totalRequirements) * 1000) / 10
        : 100;

    // Get risk profile
    const riskMetrics = await db
      .select({
        riskLevel: grcRequirements.riskLevel,
        count: sql<number>`count(*)::int`,
      })
      .from(grcRequirements)
      .where(
        and(
          eq(grcRequirements.tenantId, tenantId),
          eq(grcRequirements.isActive, true)
        )
      )
      .groupBy(grcRequirements.riskLevel);

    const riskProfile = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const row of riskMetrics) {
      if (row.riskLevel in riskProfile) {
        riskProfile[row.riskLevel as keyof typeof riskProfile] = row.count;
      }
    }

    // Get upcoming deadlines
    const today = new Date();
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + 7);
    const endOfMonth = new Date(today);
    endOfMonth.setDate(today.getDate() + 30);
    const endOfQuarter = new Date(today);
    endOfQuarter.setDate(today.getDate() + 90);

    const todayStr = today.toISOString().split("T")[0];
    const weekStr = endOfWeek.toISOString().split("T")[0];
    const monthStr = endOfMonth.toISOString().split("T")[0];
    const quarterStr = endOfQuarter.toISOString().split("T")[0];

    const deadlineMetrics = await db
      .select({
        nextActionDue: grcRequirements.nextActionDue,
      })
      .from(grcRequirements)
      .where(
        and(
          eq(grcRequirements.tenantId, tenantId),
          eq(grcRequirements.isActive, true),
          sql`${grcRequirements.nextActionDue} IS NOT NULL`
        )
      );

    const upcomingDeadlines = {
      overdue: 0,
      thisWeek: 0,
      thisMonth: 0,
      nextQuarter: 0,
    };

    for (const row of deadlineMetrics) {
      if (!row.nextActionDue) continue;
      const due = row.nextActionDue;
      if (due < todayStr) {
        upcomingDeadlines.overdue++;
      } else if (due <= weekStr) {
        upcomingDeadlines.thisWeek++;
      } else if (due <= monthStr) {
        upcomingDeadlines.thisMonth++;
      } else if (due <= quarterStr) {
        upcomingDeadlines.nextQuarter++;
      }
    }

    // Get metrics by category
    const categoryMetrics = await db
      .select({
        category: grcRequirements.category,
        status: grcRequirements.status,
        count: sql<number>`count(*)::int`,
      })
      .from(grcRequirements)
      .where(
        and(
          eq(grcRequirements.tenantId, tenantId),
          eq(grcRequirements.isActive, true)
        )
      )
      .groupBy(grcRequirements.category, grcRequirements.status);

    const byCategory: Record<
      string,
      { satisfied: number; unsatisfied: number; percentage: number }
    > = {};

    for (const row of categoryMetrics) {
      if (!byCategory[row.category]) {
        byCategory[row.category] = { satisfied: 0, unsatisfied: 0, percentage: 0 };
      }
      if (row.status === "satisfied") {
        byCategory[row.category].satisfied += row.count;
      } else {
        byCategory[row.category].unsatisfied += row.count;
      }
    }

    // Calculate percentages
    for (const cat of Object.keys(byCategory)) {
      const total = byCategory[cat].satisfied + byCategory[cat].unsatisfied;
      byCategory[cat].percentage =
        total > 0
          ? Math.round((byCategory[cat].satisfied / total) * 1000) / 10
          : 100;
    }

    // Get open tasks count
    const tasksResult = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(grcTasks)
      .where(
        and(
          eq(grcTasks.tenantId, tenantId),
          eq(grcTasks.status, "open")
        )
      );

    const openTasks = tasksResult[0]?.count || 0;

    // Get active alerts count
    const alertsResult = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(grcAlerts)
      .where(
        and(
          eq(grcAlerts.tenantId, tenantId),
          eq(grcAlerts.status, "active")
        )
      );

    const activeAlerts = alertsResult[0]?.count || 0;

    const response: GrcAnalyticsResponse = {
      compliance: {
        overallScore,
        satisfiedCount: statusCounts.satisfied,
        unsatisfiedCount: statusCounts.unsatisfied,
        atRiskCount: statusCounts.at_risk,
        unknownCount: statusCounts.unknown,
        totalRequirements,
      },
      riskProfile,
      upcomingDeadlines,
      byCategory,
      openTasks,
      activeAlerts,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/grc/analytics error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
