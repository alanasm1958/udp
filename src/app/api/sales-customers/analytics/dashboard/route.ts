/**
 * /api/sales-customers/analytics/dashboard
 *
 * Dashboard Analytics endpoint
 * GET: Get dashboard analytics cards data
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { salesDocs, leads, customerHealthScores, salesActivities } from "@/db/schema";
import { eq, and, gte, lte, sql, count, inArray, or } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  TenantError,
} from "@/lib/tenant";

/**
 * GET /api/sales-customers/analytics/dashboard
 * Get dashboard analytics cards data
 * Query params: period (mtd|qtd|ytd|last_30d|last_90d, default mtd)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const url = new URL(req.url);

    const period = url.searchParams.get("period") || "mtd";
    const now = new Date();

    // Calculate date range based on period
    let startDate: Date;
    let comparisonStartDate: Date;
    let comparisonEndDate: Date;
    let periodLabel: string;

    switch (period) {
      case "qtd":
        const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
        startDate = new Date(now.getFullYear(), quarterMonth, 1);
        comparisonStartDate = new Date(now.getFullYear(), quarterMonth - 3, 1);
        comparisonEndDate = new Date(now.getFullYear(), quarterMonth, 0);
        periodLabel = "vs last quarter";
        break;
      case "ytd":
        startDate = new Date(now.getFullYear(), 0, 1);
        comparisonStartDate = new Date(now.getFullYear() - 1, 0, 1);
        comparisonEndDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        periodLabel = "vs last year";
        break;
      case "last_30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        comparisonStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        comparisonEndDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        periodLabel = "vs previous 30 days";
        break;
      case "last_90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        comparisonStartDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        comparisonEndDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        periodLabel = "vs previous 90 days";
        break;
      case "mtd":
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        comparisonStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        comparisonEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
        periodLabel = "vs last month";
        break;
    }

    // Revenue MTD/Period - from invoices
    const [revenueStats] = await db
      .select({
        currentRevenue: sql<number>`coalesce(sum(case when ${salesDocs.docDate}::date >= ${startDate.toISOString().split('T')[0]}::date then ${salesDocs.totalAmount}::numeric else 0 end), 0)`,
        previousRevenue: sql<number>`coalesce(sum(case when ${salesDocs.docDate}::date >= ${comparisonStartDate.toISOString().split('T')[0]}::date and ${salesDocs.docDate}::date <= ${comparisonEndDate.toISOString().split('T')[0]}::date then ${salesDocs.totalAmount}::numeric else 0 end), 0)`,
      })
      .from(salesDocs)
      .where(
        and(
          eq(salesDocs.tenantId, tenantId),
          eq(salesDocs.docType, "invoice"),
          inArray(salesDocs.status, ["issued", "approved", "fulfilled", "partially_fulfilled"])
        )
      );

    const currentRevenue = parseFloat(revenueStats.currentRevenue?.toString() || "0");
    const previousRevenue = parseFloat(revenueStats.previousRevenue?.toString() || "0");
    const revenueChange = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

    // Pipeline Value - from quotes
    const [pipelineStats] = await db
      .select({
        pipelineValue: sql<number>`coalesce(sum(${salesDocs.totalAmount}::numeric), 0)`,
        pipelineCount: count(),
      })
      .from(salesDocs)
      .where(
        and(
          eq(salesDocs.tenantId, tenantId),
          eq(salesDocs.docType, "quote"),
          inArray(salesDocs.status, ["draft", "issued"])
        )
      );

    const pipelineValue = parseFloat(pipelineStats.pipelineValue?.toString() || "0");
    const pipelineCount = pipelineStats.pipelineCount || 0;

    // Active Customers - customers with activity/orders in last 90 days
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const [customerStats] = await db
      .select({
        activeCustomers: sql<number>`count(distinct ${salesDocs.partyId})`,
      })
      .from(salesDocs)
      .where(
        and(
          eq(salesDocs.tenantId, tenantId),
          eq(salesDocs.docType, "invoice"),
          gte(salesDocs.docDate, ninetyDaysAgo.toISOString().split('T')[0])
        )
      );

    // Previous period active customers for comparison
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const [prevCustomerStats] = await db
      .select({
        activeCustomers: sql<number>`count(distinct ${salesDocs.partyId})`,
      })
      .from(salesDocs)
      .where(
        and(
          eq(salesDocs.tenantId, tenantId),
          eq(salesDocs.docType, "invoice"),
          gte(salesDocs.docDate, sixMonthsAgo.toISOString().split('T')[0]),
          lte(salesDocs.docDate, ninetyDaysAgo.toISOString().split('T')[0])
        )
      );

    const activeCustomers = Number(customerStats.activeCustomers || 0);
    const prevActiveCustomers = Number(prevCustomerStats.activeCustomers || 0);
    const customerChange = activeCustomers - prevActiveCustomers;

    // Conversion Rate - leads to customers in last 90 days
    const [leadStats] = await db
      .select({
        totalLeads: count(),
        convertedLeads: sql<number>`count(*) filter (where ${leads.status} = 'converted')`,
      })
      .from(leads)
      .where(
        and(
          eq(leads.tenantId, tenantId),
          gte(leads.createdAt, ninetyDaysAgo)
        )
      );

    const totalLeads = leadStats.totalLeads || 0;
    const convertedLeads = leadStats.convertedLeads || 0;
    const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

    // Outstanding AR - unpaid/partial invoices
    const [arStats] = await db
      .select({
        outstandingAR: sql<number>`coalesce(sum(${salesDocs.totalAmount}::numeric - coalesce(${salesDocs.allocatedAmount}::numeric, 0)), 0)`,
        outstandingCount: count(),
        currentAR: sql<number>`coalesce(sum(case when ${salesDocs.dueDate} >= current_date then ${salesDocs.totalAmount}::numeric - coalesce(${salesDocs.allocatedAmount}::numeric, 0) else 0 end), 0)`,
        overdue30AR: sql<number>`coalesce(sum(case when ${salesDocs.dueDate} < current_date and ${salesDocs.dueDate} >= current_date - 30 then ${salesDocs.totalAmount}::numeric - coalesce(${salesDocs.allocatedAmount}::numeric, 0) else 0 end), 0)`,
        overdue60AR: sql<number>`coalesce(sum(case when ${salesDocs.dueDate} < current_date - 30 then ${salesDocs.totalAmount}::numeric - coalesce(${salesDocs.allocatedAmount}::numeric, 0) else 0 end), 0)`,
      })
      .from(salesDocs)
      .where(
        and(
          eq(salesDocs.tenantId, tenantId),
          eq(salesDocs.docType, "invoice"),
          or(
            eq(salesDocs.paymentStatus, "unpaid"),
            eq(salesDocs.paymentStatus, "partial"),
            eq(salesDocs.paymentStatus, "overdue")
          )
        )
      );

    const outstandingAR = parseFloat(arStats.outstandingAR?.toString() || "0");
    const outstandingCount = arStats.outstandingCount || 0;
    const currentAR = parseFloat(arStats.currentAR?.toString() || "0");
    const overdue30AR = parseFloat(arStats.overdue30AR?.toString() || "0");
    const overdue60AR = parseFloat(arStats.overdue60AR?.toString() || "0");

    // At-Risk Customers count
    const [atRiskStats] = await db
      .select({
        atRiskCount: count(),
      })
      .from(customerHealthScores)
      .where(
        and(
          eq(customerHealthScores.tenantId, tenantId),
          or(
            eq(customerHealthScores.riskLevelValue, "high"),
            eq(customerHealthScores.riskLevelValue, "critical")
          )
        )
      );

    // Recent Activities count
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const [activityStats] = await db
      .select({
        recentActivities: count(),
      })
      .from(salesActivities)
      .where(
        and(
          eq(salesActivities.tenantId, tenantId),
          gte(salesActivities.activityDate, sevenDaysAgo)
        )
      );

    // Build response cards
    const cards = [
      {
        id: "revenue_mtd",
        label: period === "mtd" ? "Revenue MTD" : `Revenue (${period.toUpperCase()})`,
        value: currentRevenue,
        formatted: `$${currentRevenue.toLocaleString()}`,
        change: revenueChange,
        changeFormatted: `${revenueChange >= 0 ? "+" : ""}${revenueChange.toFixed(1)}%`,
        trend: revenueChange >= 0 ? "up" : "down",
        status: revenueChange >= 0 ? "on-track" : "warning",
        comparisonPeriod: periodLabel,
      },
      {
        id: "pipeline_value",
        label: "Pipeline Value",
        value: pipelineValue,
        formatted: `$${pipelineValue.toLocaleString()}`,
        subtitle: `${pipelineCount} opportunities`,
        status: pipelineCount > 0 ? "healthy" : "neutral",
      },
      {
        id: "active_customers",
        label: "Active Customers",
        value: activeCustomers,
        change: customerChange,
        changeFormatted: `${customerChange >= 0 ? "+" : ""}${customerChange}`,
        period: "last 90 days",
      },
      {
        id: "conversion_rate",
        label: "Conversion Rate",
        value: conversionRate,
        formatted: `${conversionRate}%`,
        subtitle: "Lead to Customer",
        trend: conversionRate >= 30 ? "up" : "stable",
        period: "last 90 days",
      },
      {
        id: "outstanding_ar",
        label: "Outstanding AR",
        value: outstandingAR,
        formatted: `$${outstandingAR.toLocaleString()}`,
        subtitle: `${outstandingCount} invoices`,
        status: overdue60AR > 0 ? "danger" : overdue30AR > 0 ? "warning" : "healthy",
        breakdown: {
          current: currentAR,
          overdue_30: overdue30AR,
          overdue_60: overdue60AR,
        },
      },
      {
        id: "at_risk_customers",
        label: "At-Risk Customers",
        value: atRiskStats.atRiskCount || 0,
        formatted: `${atRiskStats.atRiskCount || 0}`,
        status: (atRiskStats.atRiskCount || 0) > 5 ? "danger" : (atRiskStats.atRiskCount || 0) > 0 ? "warning" : "healthy",
        subtitle: "need attention",
      },
      {
        id: "recent_activities",
        label: "Recent Activities",
        value: activityStats.recentActivities || 0,
        formatted: `${activityStats.recentActivities || 0}`,
        period: "last 7 days",
      },
    ];

    return NextResponse.json({
      cards,
      calculatedAt: now.toISOString(),
      period,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/sales-customers/analytics/dashboard error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
