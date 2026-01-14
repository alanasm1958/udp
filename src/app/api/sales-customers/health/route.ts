/**
 * /api/sales-customers/health
 *
 * Customer Health Scores endpoints
 * GET: List customer health scores with filters
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customerHealthScores, parties } from "@/db/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  TenantError,
} from "@/lib/tenant";

/**
 * GET /api/sales-customers/health
 * List customer health scores with optional filters
 * Query params: riskLevel, minScore, maxScore, orderBy, limit, offset
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const url = new URL(req.url);

    const riskLevelFilter = url.searchParams.get("riskLevel");
    const minScoreFilter = url.searchParams.get("minScore");
    const maxScoreFilter = url.searchParams.get("maxScore");
    const orderByFilter = url.searchParams.get("orderBy") || "overall_score";
    const limitParam = url.searchParams.get("limit");
    const offsetParam = url.searchParams.get("offset");

    const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 200);
    const offset = Math.max(parseInt(offsetParam || "0", 10) || 0, 0);

    const conditions = [eq(customerHealthScores.tenantId, tenantId)];

    if (riskLevelFilter) {
      conditions.push(eq(customerHealthScores.riskLevelValue, riskLevelFilter as typeof customerHealthScores.riskLevelValue.enumValues[number]));
    }
    if (minScoreFilter) {
      conditions.push(gte(customerHealthScores.overallScore, parseInt(minScoreFilter, 10)));
    }
    if (maxScoreFilter) {
      conditions.push(lte(customerHealthScores.overallScore, parseInt(maxScoreFilter, 10)));
    }

    // Determine order by column
    const orderByColumn = {
      overall_score: desc(customerHealthScores.overallScore),
      payment_score: desc(customerHealthScores.paymentScore),
      risk_level: desc(customerHealthScores.riskLevelValue),
    }[orderByFilter] || desc(customerHealthScores.overallScore);

    const items = await db
      .select({
        id: customerHealthScores.id,
        customerId: customerHealthScores.customerId,
        paymentScore: customerHealthScores.paymentScore,
        engagementScore: customerHealthScores.engagementScore,
        orderFrequencyScore: customerHealthScores.orderFrequencyScore,
        growthScore: customerHealthScores.growthScore,
        issueScore: customerHealthScores.issueScore,
        overallScore: customerHealthScores.overallScore,
        trend: customerHealthScores.trend,
        riskLevel: customerHealthScores.riskLevelValue,
        riskFactors: customerHealthScores.riskFactors,
        totalOrders: customerHealthScores.totalOrders,
        totalRevenue: customerHealthScores.totalRevenue,
        averageOrderValue: customerHealthScores.averageOrderValue,
        daysSinceLastOrder: customerHealthScores.daysSinceLastOrder,
        paymentDelayDaysAvg: customerHealthScores.paymentDelayDaysAvg,
        issueCount30d: customerHealthScores.issueCount30d,
        calculatedAt: customerHealthScores.calculatedAt,
        // Join customer (party)
        customerName: parties.name,
        customerCode: parties.code,
        customerType: parties.type,
        customerIsActive: parties.isActive,
      })
      .from(customerHealthScores)
      .leftJoin(parties, eq(customerHealthScores.customerId, parties.id))
      .where(and(...conditions))
      .orderBy(orderByColumn)
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(customerHealthScores)
      .where(and(...conditions));

    return NextResponse.json({
      customers: items.map((item) => ({
        customerId: item.customerId,
        customerName: item.customerName,
        customerCode: item.customerCode,
        customerType: item.customerType,
        customerIsActive: item.customerIsActive,
        healthScore: {
          overall: item.overallScore,
          payment: item.paymentScore,
          engagement: item.engagementScore,
          orderFrequency: item.orderFrequencyScore,
          growth: item.growthScore,
          issues: item.issueScore,
        },
        riskLevel: item.riskLevel,
        riskFactors: item.riskFactors,
        metrics: {
          totalOrders: item.totalOrders,
          totalRevenue: item.totalRevenue ? parseFloat(item.totalRevenue) : 0,
          avgOrderValue: item.averageOrderValue ? parseFloat(item.averageOrderValue) : 0,
          daysSinceLastOrder: item.daysSinceLastOrder,
          paymentDelayAvg: item.paymentDelayDaysAvg,
        },
        trend: item.trend,
        calculatedAt: item.calculatedAt,
      })),
      total: Number(count),
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/sales-customers/health error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
