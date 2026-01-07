/**
 * /api/sales-customers/ai-analytics-card
 *
 * POST: Generate an AI analytics card based on user requirements
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";
import { db } from "@/db";
import { salesDocs, parties, leads, salespersons, payments, paymentAllocations } from "@/db/schema";
import { eq, and, sql, gte, lte, or, desc } from "drizzle-orm";

interface CreateAIAnalyticsCardRequest {
  outcomeType: string; // e.g., "sales_performance", "customer_engagement", "lead_conversion", "revenue_trends"
  period: string; // e.g., "last_7_days", "last_30_days", "last_90_days", "this_month", "this_quarter", "this_year"
  description?: string; // Additional context from user
}

function getDateRange(period: string): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  
  switch (period) {
    case "last_7_days":
      start.setDate(end.getDate() - 7);
      break;
    case "last_30_days":
      start.setDate(end.getDate() - 30);
      break;
    case "last_90_days":
      start.setDate(end.getDate() - 90);
      break;
    case "this_month":
      start.setDate(1);
      break;
    case "this_quarter":
      const quarter = Math.floor(end.getMonth() / 3);
      start.setMonth(quarter * 3, 1);
      start.setFullYear(end.getFullYear());
      break;
    case "this_year":
      start.setMonth(0, 1);
      start.setFullYear(end.getFullYear());
      break;
    default:
      start.setDate(end.getDate() - 30);
  }
  
  return { start, end };
}

/**
 * POST /api/sales-customers/ai-analytics-card
 * Generate analytics card based on user requirements
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const body: CreateAIAnalyticsCardRequest = await req.json();

    if (!body.outcomeType || !body.period) {
      return NextResponse.json(
        { error: "outcomeType and period are required" },
        { status: 400 }
      );
    }

    const { start, end } = getDateRange(body.period);
    const startDate = start.toISOString().split("T")[0];
    const endDate = end.toISOString().split("T")[0];

    let cardData: {
      title: string;
      value: number | string;
      description: string;
      variant: "default" | "success" | "warning" | "danger";
      trend?: { value: number; direction: "up" | "down" };
    };

    switch (body.outcomeType) {
      case "sales_performance": {
        // Total sales value in period
        const [salesResult] = await db
          .select({
            total: sql<string>`COALESCE(SUM(${salesDocs.totalAmount}), 0)`,
            count: sql<number>`COUNT(*)`,
          })
          .from(salesDocs)
          .where(
            and(
              eq(salesDocs.tenantId, tenantId),
              eq(salesDocs.docType, "invoice"),
              eq(salesDocs.status, "posted"),
              gte(salesDocs.docDate, startDate),
              lte(salesDocs.docDate, endDate)
            )
          );

        const total = parseFloat(salesResult?.total || "0");
        const count = Number(salesResult?.count || 0);

        // Get previous period for comparison
        const prevStart = new Date(start);
        const prevEnd = new Date(end);
        const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        prevStart.setDate(prevStart.getDate() - daysDiff);
        prevEnd.setDate(prevEnd.getDate() - daysDiff);

        const [prevResult] = await db
          .select({
            total: sql<string>`COALESCE(SUM(${salesDocs.totalAmount}), 0)`,
          })
          .from(salesDocs)
          .where(
            and(
              eq(salesDocs.tenantId, tenantId),
              eq(salesDocs.docType, "invoice"),
              eq(salesDocs.status, "posted"),
              gte(salesDocs.docDate, prevStart.toISOString().split("T")[0]),
              lte(salesDocs.docDate, prevEnd.toISOString().split("T")[0])
            )
          );

        const prevTotal = parseFloat(prevResult?.total || "0");
        const trend = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;

        cardData = {
          title: "Sales Performance",
          value: new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(total),
          description: `${count} invoices posted in this period`,
          variant: total > prevTotal ? "success" : total < prevTotal ? "warning" : "default",
          trend: {
            value: Math.abs(trend),
            direction: trend >= 0 ? "up" : "down",
          },
        };
        break;
      }

      case "customer_engagement": {
        // Active customers in period
        const [activeResult] = await db
          .select({
            count: sql<number>`COUNT(DISTINCT ${salesDocs.partyId})`,
          })
          .from(salesDocs)
          .where(
            and(
              eq(salesDocs.tenantId, tenantId),
              eq(salesDocs.docType, "invoice"),
              eq(salesDocs.status, "posted"),
              gte(salesDocs.docDate, startDate),
              lte(salesDocs.docDate, endDate)
            )
          );

        const activeCount = Number(activeResult?.count || 0);

        // Total customers
        const [totalResult] = await db
          .select({
            count: sql<number>`COUNT(*)`,
          })
          .from(parties)
          .where(and(eq(parties.tenantId, tenantId), eq(parties.type, "customer")));

        const totalCustomers = Number(totalResult?.count || 0);
        const engagementRate = totalCustomers > 0 ? (activeCount / totalCustomers) * 100 : 0;

        cardData = {
          title: "Customer Engagement",
          value: activeCount,
          description: `${engagementRate.toFixed(1)}% of total customers active`,
          variant: engagementRate >= 30 ? "success" : engagementRate >= 15 ? "warning" : "danger",
        };
        break;
      }

      case "lead_conversion": {
        // Leads converted to customers in period
        const [convertedResult] = await db
          .select({
            count: sql<number>`COUNT(*)`,
          })
          .from(leads)
          .where(
            and(
              eq(leads.tenantId, tenantId),
              eq(leads.status, "won"),
              gte(leads.createdAt, start),
              lte(leads.createdAt, end)
            )
          );

        const converted = Number(convertedResult?.count || 0);

        // Total leads in period
        const [totalLeadsResult] = await db
          .select({
            count: sql<number>`COUNT(*)`,
          })
          .from(leads)
          .where(
            and(
              eq(leads.tenantId, tenantId),
              gte(leads.createdAt, start),
              lte(leads.createdAt, end)
            )
          );

        const totalLeads = Number(totalLeadsResult?.count || 0);
        const conversionRate = totalLeads > 0 ? (converted / totalLeads) * 100 : 0;

        cardData = {
          title: "Lead Conversion",
          value: `${conversionRate.toFixed(1)}%`,
          description: `${converted} of ${totalLeads} leads converted`,
          variant: conversionRate >= 20 ? "success" : conversionRate >= 10 ? "warning" : "default",
        };
        break;
      }

      case "revenue_trends": {
        // Revenue by month/week in period
        const revenueData = await db
          .select({
            month: sql<string>`TO_CHAR(${salesDocs.docDate}, 'YYYY-MM')`,
            total: sql<string>`COALESCE(SUM(${salesDocs.totalAmount}), 0)`,
          })
          .from(salesDocs)
          .where(
            and(
              eq(salesDocs.tenantId, tenantId),
              eq(salesDocs.docType, "invoice"),
              eq(salesDocs.status, "posted"),
              gte(salesDocs.docDate, startDate),
              lte(salesDocs.docDate, endDate)
            )
          )
          .groupBy(sql`TO_CHAR(${salesDocs.docDate}, 'YYYY-MM')`)
          .orderBy(sql`TO_CHAR(${salesDocs.docDate}, 'YYYY-MM')`);

        const totalRevenue = revenueData.reduce((sum, r) => sum + parseFloat(r.total || "0"), 0);
        const avgRevenue = revenueData.length > 0 ? totalRevenue / revenueData.length : 0;

        cardData = {
          title: "Revenue Trends",
          value: new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(avgRevenue),
          description: `Average monthly revenue (${revenueData.length} periods)`,
          variant: "default",
        };
        break;
      }

      case "quote_to_sale": {
        // Quote conversion rate
        const [quotesResult] = await db
          .select({
            count: sql<number>`COUNT(*)`,
          })
          .from(salesDocs)
          .where(
            and(
              eq(salesDocs.tenantId, tenantId),
              eq(salesDocs.docType, "quote"),
              gte(salesDocs.docDate, startDate),
              lte(salesDocs.docDate, endDate)
            )
          );

        const quotesCount = Number(quotesResult?.count || 0);

        // Quotes that became invoices
        const [convertedResult] = await db
          .select({
            count: sql<number>`COUNT(DISTINCT ${salesDocs.partyId})`,
          })
          .from(salesDocs)
          .where(
            and(
              eq(salesDocs.tenantId, tenantId),
              eq(salesDocs.docType, "invoice"),
              eq(salesDocs.status, "posted"),
              gte(salesDocs.docDate, startDate),
              lte(salesDocs.docDate, endDate)
            )
          );

        const convertedCount = Number(convertedResult?.count || 0);
        const conversionRate = quotesCount > 0 ? (convertedCount / quotesCount) * 100 : 0;

        cardData = {
          title: "Quote to Sale Rate",
          value: `${conversionRate.toFixed(1)}%`,
          description: `${convertedCount} sales from ${quotesCount} quotes`,
          variant: conversionRate >= 30 ? "success" : conversionRate >= 15 ? "warning" : "default",
        };
        break;
      }

      default:
        return NextResponse.json(
          { error: "Unknown outcome type" },
          { status: 400 }
        );
    }

    return NextResponse.json({
      card: {
        id: `ai-card-${Date.now()}`,
        ...cardData,
        period: body.period,
        outcomeType: body.outcomeType,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/sales-customers/ai-analytics-card error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
