/**
 * /api/sales-customers/health/at-risk
 *
 * At-Risk Customers endpoint
 * GET: Get customers at risk of churn
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customerHealthScores, parties, salesActivities, salesDocs } from "@/db/schema";
import { eq, and, desc, or, max } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  TenantError,
} from "@/lib/tenant";

/**
 * GET /api/sales-customers/health/at-risk
 * Get customers at risk of churn
 * Query params: daysWithoutOrder (default 90), includeDeclineScore (default true)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const url = new URL(req.url);

    const daysWithoutOrder = parseInt(url.searchParams.get("daysWithoutOrder") || "90", 10);
    const includeDeclineScore = url.searchParams.get("includeDeclineScore") !== "false";

    // Get at-risk customers based on health score risk level or declining trend
    const conditions = [
      eq(customerHealthScores.tenantId, tenantId),
    ];

    if (includeDeclineScore) {
      conditions.push(
        or(
          eq(customerHealthScores.riskLevelValue, "high"),
          eq(customerHealthScores.riskLevelValue, "critical"),
          eq(customerHealthScores.trend, "declining")
        )!
      );
    } else {
      conditions.push(
        or(
          eq(customerHealthScores.riskLevelValue, "high"),
          eq(customerHealthScores.riskLevelValue, "critical")
        )!
      );
    }

    const atRiskItems = await db
      .select({
        id: customerHealthScores.id,
        customerId: customerHealthScores.customerId,
        overallScore: customerHealthScores.overallScore,
        trend: customerHealthScores.trend,
        riskLevel: customerHealthScores.riskLevelValue,
        riskFactors: customerHealthScores.riskFactors,
        daysSinceLastOrder: customerHealthScores.daysSinceLastOrder,
        paymentDelayDaysAvg: customerHealthScores.paymentDelayDaysAvg,
        issueCount30d: customerHealthScores.issueCount30d,
        totalOrders: customerHealthScores.totalOrders,
        totalRevenue: customerHealthScores.totalRevenue,
        calculatedAt: customerHealthScores.calculatedAt,
        // Join customer (party)
        customerName: parties.name,
        customerCode: parties.code,
        customerIsActive: parties.isActive,
      })
      .from(customerHealthScores)
      .leftJoin(parties, eq(customerHealthScores.customerId, parties.id))
      .where(and(...conditions))
      .orderBy(desc(customerHealthScores.riskLevelValue), customerHealthScores.overallScore)
      .limit(50);

    // Generate recommendations based on risk factors
    const atRiskCustomers = await Promise.all(
      atRiskItems.map(async (item) => {
        // Get last activity date for this customer
        const [lastActivity] = await db
          .select({
            lastActivityDate: max(salesActivities.activityDate),
          })
          .from(salesActivities)
          .where(
            and(
              eq(salesActivities.customerId, item.customerId),
              eq(salesActivities.tenantId, tenantId)
            )
          );

        // Get last order date
        const [lastOrder] = await db
          .select({
            lastOrderDate: max(salesDocs.docDate),
          })
          .from(salesDocs)
          .where(
            and(
              eq(salesDocs.partyId, item.customerId),
              eq(salesDocs.tenantId, tenantId),
              eq(salesDocs.docType, "invoice")
            )
          );

        // Generate risk factors and recommendations
        const riskFactors: string[] = item.riskFactors || [];
        const recommendations: string[] = [];

        // Add derived risk factors
        if (item.daysSinceLastOrder && item.daysSinceLastOrder > daysWithoutOrder) {
          if (!riskFactors.includes(`No orders in ${item.daysSinceLastOrder} days`)) {
            riskFactors.push(`No orders in ${item.daysSinceLastOrder} days`);
          }
          recommendations.push("Call to check in and understand current needs");
        }

        if (item.trend === "declining") {
          if (!riskFactors.includes("Health score declining")) {
            riskFactors.push("Health score declining");
          }
          recommendations.push("Review account history and schedule meeting");
        }

        if (item.paymentDelayDaysAvg && item.paymentDelayDaysAvg > 30) {
          if (!riskFactors.includes("Payment delays")) {
            riskFactors.push("Payment delays");
          }
          recommendations.push("Discuss payment terms and follow up on outstanding");
        }

        if (item.issueCount30d && item.issueCount30d > 2) {
          if (!riskFactors.includes("Multiple recent issues")) {
            riskFactors.push("Multiple recent issues");
          }
          recommendations.push("Review and resolve outstanding issues");
        }

        // Default recommendations if none generated
        if (recommendations.length === 0) {
          recommendations.push("Schedule a check-in call");
          recommendations.push("Review if relationship is still active");
        }

        const lastActivityDate = lastActivity?.lastActivityDate;
        const daysSinceLastActivity = lastActivityDate
          ? Math.floor((Date.now() - new Date(lastActivityDate).getTime()) / (1000 * 60 * 60 * 24))
          : null;

        if (daysSinceLastActivity && daysSinceLastActivity > 60) {
          if (!riskFactors.includes(`Last interaction ${daysSinceLastActivity} days ago`)) {
            riskFactors.push(`Last interaction ${daysSinceLastActivity} days ago`);
          }
        }

        return {
          customer: {
            id: item.customerId,
            name: item.customerName,
            code: item.customerCode,
            isActive: item.customerIsActive,
          },
          riskLevel: item.riskLevel,
          overallScore: item.overallScore,
          riskFactors,
          recommendations,
          lastOrderDate: lastOrder?.lastOrderDate || null,
          daysSinceLastOrder: item.daysSinceLastOrder,
          lastActivityDate: lastActivityDate || null,
          daysSinceLastActivity,
          scoreTrend: item.trend,
          totalOrders: item.totalOrders,
          totalRevenue: item.totalRevenue ? parseFloat(item.totalRevenue) : 0,
        };
      })
    );

    return NextResponse.json({
      atRiskCustomers,
      total: atRiskCustomers.length,
      filters: {
        daysWithoutOrder,
        includeDeclineScore,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/sales-customers/health/at-risk error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
