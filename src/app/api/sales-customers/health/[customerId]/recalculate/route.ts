/**
 * /api/sales-customers/health/[customerId]/recalculate
 *
 * Health Score Recalculation endpoint
 * POST: Manually trigger health score recalculation for a customer
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customerHealthScores, parties, salesActivities, salesDocs } from "@/db/schema";
import { eq, and, sql, count, max } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  TenantError,
} from "@/lib/tenant";

/**
 * POST /api/sales-customers/health/[customerId]/recalculate
 * Manually trigger health score recalculation
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { customerId } = await params;

    // Verify customer exists
    const [customer] = await db
      .select({ id: parties.id, name: parties.name })
      .from(parties)
      .where(and(eq(parties.id, customerId), eq(parties.tenantId, tenantId)));

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Calculate payment score (based on invoice payment timing)
    // For now, use a simple calculation based on overdue invoices
    const invoiceStats = await db
      .select({
        totalInvoices: count(),
        paidInvoices: sql<number>`count(*) filter (where ${salesDocs.paymentStatus} = 'paid')`,
        overdueInvoices: sql<number>`count(*) filter (where ${salesDocs.paymentStatus} = 'overdue')`,
      })
      .from(salesDocs)
      .where(
        and(
          eq(salesDocs.partyId, customerId),
          eq(salesDocs.tenantId, tenantId),
          eq(salesDocs.docType, "invoice")
        )
      );

    const { totalInvoices, paidInvoices, overdueInvoices } = invoiceStats[0] || {
      totalInvoices: 0,
      paidInvoices: 0,
      overdueInvoices: 0,
    };

    let paymentScore = 50;
    if (totalInvoices > 0) {
      const paidRatio = paidInvoices / totalInvoices;
      const overdueRatio = overdueInvoices / totalInvoices;
      paymentScore = Math.round(paidRatio * 100 - overdueRatio * 50);
      paymentScore = Math.max(0, Math.min(100, paymentScore));
    }

    // Calculate engagement score (based on recent activities)
    const [activityStats] = await db
      .select({
        totalActivities: count(),
        recentActivities: sql<number>`count(*) filter (where ${salesActivities.activityDate} > ${thirtyDaysAgo})`,
        lastActivityDate: max(salesActivities.activityDate),
      })
      .from(salesActivities)
      .where(
        and(
          eq(salesActivities.customerId, customerId),
          eq(salesActivities.tenantId, tenantId)
        )
      );

    let engagementScore = 50;
    if (activityStats.lastActivityDate) {
      const daysSinceActivity = Math.floor(
        (now.getTime() - new Date(activityStats.lastActivityDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceActivity <= 7) engagementScore = 100;
      else if (daysSinceActivity <= 30) engagementScore = 80;
      else if (daysSinceActivity <= 90) engagementScore = 60;
      else engagementScore = 40;
    }

    // Calculate order frequency score
    const [orderStats] = await db
      .select({
        totalOrders: count(),
        recentOrders: sql<number>`count(*) filter (where ${salesDocs.docDate} > ${thirtyDaysAgo}::date)`,
        lastOrderDate: max(salesDocs.docDate),
        totalRevenue: sql<number>`coalesce(sum(${salesDocs.totalAmount}::numeric), 0)`,
        avgOrderValue: sql<number>`coalesce(avg(${salesDocs.totalAmount}::numeric), 0)`,
      })
      .from(salesDocs)
      .where(
        and(
          eq(salesDocs.partyId, customerId),
          eq(salesDocs.tenantId, tenantId),
          eq(salesDocs.docType, "invoice")
        )
      );

    let orderFrequencyScore = 50;
    const recentOrders = orderStats.recentOrders || 0;
    if (recentOrders >= 4) orderFrequencyScore = 100;
    else if (recentOrders >= 2) orderFrequencyScore = 80;
    else if (recentOrders >= 1) orderFrequencyScore = 60;
    else orderFrequencyScore = 40;

    // Calculate days since last order
    let daysSinceLastOrder: number | null = null;
    if (orderStats.lastOrderDate) {
      daysSinceLastOrder = Math.floor(
        (now.getTime() - new Date(orderStats.lastOrderDate).getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    // Calculate growth score (simplified - comparing recent vs older orders)
    const growthScore = 50;

    // Calculate issue score (fewer issues = higher score)
    const [issueStats] = await db
      .select({
        totalIssues: count(),
        recentIssues: sql<number>`count(*) filter (where ${salesActivities.activityDate} > ${thirtyDaysAgo})`,
      })
      .from(salesActivities)
      .where(
        and(
          eq(salesActivities.customerId, customerId),
          eq(salesActivities.tenantId, tenantId),
          eq(salesActivities.activityType, "customer_issue")
        )
      );

    let issueScore = 100;
    const recentIssues = issueStats.recentIssues || 0;
    if (recentIssues === 0) issueScore = 100;
    else if (recentIssues <= 2) issueScore = 60;
    else issueScore = 40;

    // Calculate weighted overall score
    const overallScore = Math.round(
      paymentScore * 0.3 +
      engagementScore * 0.2 +
      orderFrequencyScore * 0.2 +
      growthScore * 0.15 +
      issueScore * 0.15
    );

    // Determine risk level
    let riskLevelValue: "low" | "medium" | "high" | "critical" = "low";
    if (overallScore >= 70) riskLevelValue = "low";
    else if (overallScore >= 50) riskLevelValue = "medium";
    else if (overallScore >= 30) riskLevelValue = "high";
    else riskLevelValue = "critical";

    // Generate risk factors
    const riskFactors: string[] = [];
    if (paymentScore < 50) riskFactors.push("payment_delays");
    if (engagementScore < 50) riskFactors.push("low_engagement");
    if (orderFrequencyScore < 50) riskFactors.push("declining_orders");
    if (issueScore < 70) riskFactors.push("multiple_issues");

    // Determine trend (simplified - would need historical data)
    const trend: "improving" | "stable" | "declining" = "stable";

    // Upsert health score
    const healthScoreData = {
      tenantId,
      customerId,
      paymentScore,
      engagementScore,
      orderFrequencyScore,
      growthScore,
      issueScore,
      overallScore,
      trend,
      riskLevelValue,
      riskFactors,
      totalOrders: orderStats.totalOrders || 0,
      totalRevenue: orderStats.totalRevenue?.toString() || "0",
      averageOrderValue: orderStats.avgOrderValue?.toString() || "0",
      daysSinceLastOrder,
      paymentDelayDaysAvg: 0, // Would need more data to calculate
      issueCount30d: recentIssues,
      calculatedAt: now,
      updatedAt: now,
    };

    // Check if record exists
    const [existing] = await db
      .select({ id: customerHealthScores.id })
      .from(customerHealthScores)
      .where(
        and(
          eq(customerHealthScores.customerId, customerId),
          eq(customerHealthScores.tenantId, tenantId)
        )
      );

    let healthScore;
    if (existing) {
      [healthScore] = await db
        .update(customerHealthScores)
        .set(healthScoreData)
        .where(eq(customerHealthScores.id, existing.id))
        .returning();
    } else {
      [healthScore] = await db
        .insert(customerHealthScores)
        .values(healthScoreData)
        .returning();
    }

    return NextResponse.json({
      healthScore: {
        customerId: healthScore.customerId,
        customerName: customer.name,
        overall: healthScore.overallScore,
        payment: healthScore.paymentScore,
        engagement: healthScore.engagementScore,
        orderFrequency: healthScore.orderFrequencyScore,
        growth: healthScore.growthScore,
        issues: healthScore.issueScore,
        riskLevel: healthScore.riskLevelValue,
        riskFactors: healthScore.riskFactors,
        trend: healthScore.trend,
        metrics: {
          totalOrders: healthScore.totalOrders,
          totalRevenue: healthScore.totalRevenue ? parseFloat(healthScore.totalRevenue) : 0,
          avgOrderValue: healthScore.averageOrderValue ? parseFloat(healthScore.averageOrderValue) : 0,
          daysSinceLastOrder: healthScore.daysSinceLastOrder,
        },
        calculatedAt: healthScore.calculatedAt,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/sales-customers/health/[customerId]/recalculate error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
