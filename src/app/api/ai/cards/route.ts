/**
 * /api/ai/cards
 *
 * GET: Generate AI Cards based on system state and alerts
 *
 * Card types:
 * - metric_snapshot: Key metric summaries
 * - task_suggestion: Suggested tasks based on alerts
 * - document_summary: Recent document summaries
 * - recommendation: AI-driven recommendations
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";
import { db } from "@/db";
import {
  salesDocs,
  payments,
  paymentAllocations,
  inventoryBalances,
  products,
  parties,
  auditEvents,
} from "@/db/schema";
import { eq, and, sql, desc, gte } from "drizzle-orm";

export interface AICard {
  id: string;
  type: "metric_snapshot" | "task_suggestion" | "document_summary" | "recommendation";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  domain: "finance" | "sales" | "procurement" | "inventory" | "operations" | "general";
  createdAt: string;
  expiresAt?: string;
  data: Record<string, unknown>;
  actions: Array<{
    label: string;
    type: "navigate" | "create_task" | "dismiss" | "snooze";
    href?: string;
    payload?: Record<string, unknown>;
  }>;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * GET /api/ai/cards
 * Returns dynamically generated AI cards
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const cards: AICard[] = [];

    // Date references
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // === Metric Snapshot Cards ===

    // Cash Flow Summary Card
    const receipts7d = await db
      .select({
        total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, tenantId),
          eq(payments.type, "receipt"),
          eq(payments.status, "posted"),
          gte(payments.paymentDate, sevenDaysAgo.toISOString().split("T")[0])
        )
      );

    const payments7d = await db
      .select({
        total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, tenantId),
          eq(payments.type, "payment"),
          eq(payments.status, "posted"),
          gte(payments.paymentDate, sevenDaysAgo.toISOString().split("T")[0])
        )
      );

    const receiptsTotal = parseFloat(receipts7d[0]?.total || "0");
    const paymentsTotal = parseFloat(payments7d[0]?.total || "0");
    const netCashFlow = receiptsTotal - paymentsTotal;

    if (receiptsTotal > 0 || paymentsTotal > 0) {
      cards.push({
        id: `metric-cashflow-${tenantId}`,
        type: "metric_snapshot",
        title: "7-Day Cash Flow",
        description: `Net ${netCashFlow >= 0 ? "inflow" : "outflow"} of ${formatCurrency(Math.abs(netCashFlow))}`,
        priority: netCashFlow < 0 ? "high" : "low",
        domain: "finance",
        createdAt: now.toISOString(),
        data: {
          receipts: receiptsTotal,
          payments: paymentsTotal,
          netCashFlow,
          period: "7d",
        },
        actions: [
          { label: "View Cashbook", type: "navigate", href: "/finance/payments" },
          { label: "Dismiss", type: "dismiss" },
        ],
      });
    }

    // Open AR Summary
    const arResult = await db
      .select({
        total: sql<string>`COALESCE(SUM(${salesDocs.totalAmount}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(salesDocs)
      .where(
        and(
          eq(salesDocs.tenantId, tenantId),
          eq(salesDocs.docType, "invoice"),
          eq(salesDocs.status, "posted")
        )
      );

    const arAllocated = await db
      .select({
        total: sql<string>`COALESCE(SUM(${paymentAllocations.amount}), 0)`,
      })
      .from(paymentAllocations)
      .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
      .where(
        and(
          eq(paymentAllocations.tenantId, tenantId),
          eq(paymentAllocations.targetType, "sales_doc"),
          eq(payments.status, "posted")
        )
      );

    const openAR = parseFloat(arResult[0]?.total || "0") - parseFloat(arAllocated[0]?.total || "0");
    const arCount = Number(arResult[0]?.count || 0);

    if (openAR > 0) {
      cards.push({
        id: `metric-ar-${tenantId}`,
        type: "metric_snapshot",
        title: "Open Receivables",
        description: `${formatCurrency(openAR)} from ${arCount} invoice${arCount > 1 ? "s" : ""}`,
        priority: openAR > 10000 ? "high" : "medium",
        domain: "finance",
        createdAt: now.toISOString(),
        data: {
          openAR,
          invoiceCount: arCount,
        },
        actions: [
          { label: "View AR", type: "navigate", href: "/finance/ar" },
          { label: "Send Reminders", type: "create_task", payload: { taskType: "ar_reminder" } },
          { label: "Dismiss", type: "dismiss" },
        ],
      });
    }

    // === Task Suggestion Cards ===

    // Recent Activity Analysis
    const recentEvents = await db
      .select({
        action: auditEvents.action,
        count: sql<number>`COUNT(*)`,
      })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.tenantId, tenantId),
          gte(auditEvents.occurredAt, sevenDaysAgo)
        )
      )
      .groupBy(auditEvents.action)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(5);

    if (recentEvents.length > 0) {
      const topAction = recentEvents[0];
      cards.push({
        id: `task-activity-${tenantId}`,
        type: "task_suggestion",
        title: "Activity Insight",
        description: `${topAction.count} ${formatAction(topAction.action)} events this week. Consider reviewing workflow efficiency.`,
        priority: "low",
        domain: "operations",
        createdAt: now.toISOString(),
        data: {
          topActions: recentEvents.map((e) => ({
            action: e.action,
            count: e.count,
          })),
        },
        actions: [
          { label: "View Audit Log", type: "navigate", href: "/settings" },
          { label: "Snooze 1 Week", type: "snooze", payload: { days: 7 } },
          { label: "Dismiss", type: "dismiss" },
        ],
      });
    }

    // === Document Summary Cards ===

    // Recent Sales Documents
    const recentSales = await db
      .select({
        docType: salesDocs.docType,
        count: sql<number>`COUNT(*)`,
        total: sql<string>`COALESCE(SUM(${salesDocs.totalAmount}), 0)`,
      })
      .from(salesDocs)
      .where(
        and(
          eq(salesDocs.tenantId, tenantId),
          gte(salesDocs.createdAt, thirtyDaysAgo)
        )
      )
      .groupBy(salesDocs.docType);

    const salesSummary = recentSales.reduce(
      (acc, row) => {
        acc[row.docType] = { count: row.count, total: parseFloat(row.total) };
        return acc;
      },
      {} as Record<string, { count: number; total: number }>
    );

    if (Object.keys(salesSummary).length > 0) {
      const orderCount = salesSummary["order"]?.count || 0;
      const invoiceCount = salesSummary["invoice"]?.count || 0;
      const invoiceTotal = salesSummary["invoice"]?.total || 0;

      cards.push({
        id: `doc-sales-${tenantId}`,
        type: "document_summary",
        title: "30-Day Sales Summary",
        description: `${orderCount} order${orderCount !== 1 ? "s" : ""}, ${invoiceCount} invoice${invoiceCount !== 1 ? "s" : ""} (${formatCurrency(invoiceTotal)})`,
        priority: "low",
        domain: "sales",
        createdAt: now.toISOString(),
        data: salesSummary,
        actions: [
          { label: "View Sales", type: "navigate", href: "/sales" },
          { label: "Dismiss", type: "dismiss" },
        ],
      });
    }

    // === Recommendation Cards ===

    // Inventory optimization recommendation
    const inventoryData = await db
      .select({
        productId: inventoryBalances.productId,
        productName: products.name,
        available: inventoryBalances.available,
        reserved: inventoryBalances.reserved,
      })
      .from(inventoryBalances)
      .innerJoin(products, eq(inventoryBalances.productId, products.id))
      .where(eq(inventoryBalances.tenantId, tenantId))
      .limit(100);

    const highReserved = inventoryData.filter(
      (inv) => parseFloat(inv.reserved) > parseFloat(inv.available) * 2
    );

    if (highReserved.length > 0) {
      cards.push({
        id: `rec-inventory-${tenantId}`,
        type: "recommendation",
        title: "Inventory Allocation Review",
        description: `${highReserved.length} product${highReserved.length > 1 ? "s have" : " has"} high reservation ratios. Consider reviewing fulfillment priorities.`,
        priority: "medium",
        domain: "inventory",
        createdAt: now.toISOString(),
        data: {
          products: highReserved.slice(0, 5).map((p) => ({
            name: p.productName,
            available: parseFloat(p.available),
            reserved: parseFloat(p.reserved),
          })),
        },
        actions: [
          { label: "View Inventory", type: "navigate", href: "/inventory/balances" },
          { label: "Review Fulfillment", type: "navigate", href: "/operations/fulfillment" },
          { label: "Dismiss", type: "dismiss" },
        ],
      });
    }

    // Customer engagement recommendation
    const customerCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(parties)
      .where(
        and(eq(parties.tenantId, tenantId), eq(parties.type, "customer"))
      );

    const activeCustomers = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${salesDocs.partyId})`,
      })
      .from(salesDocs)
      .where(
        and(
          eq(salesDocs.tenantId, tenantId),
          gte(salesDocs.createdAt, thirtyDaysAgo)
        )
      );

    const totalCustomers = Number(customerCount[0]?.count || 0);
    const activeCount = Number(activeCustomers[0]?.count || 0);

    if (totalCustomers > 0 && activeCount < totalCustomers * 0.3) {
      cards.push({
        id: `rec-customers-${tenantId}`,
        type: "recommendation",
        title: "Customer Engagement",
        description: `Only ${activeCount} of ${totalCustomers} customers active in the last 30 days. Consider reaching out to dormant accounts.`,
        priority: "low",
        domain: "sales",
        createdAt: now.toISOString(),
        data: {
          totalCustomers,
          activeCustomers: activeCount,
          inactiveCustomers: totalCustomers - activeCount,
        },
        actions: [
          { label: "View Customers", type: "navigate", href: "/customers/accounts" },
          { label: "Create Outreach Task", type: "create_task", payload: { taskType: "customer_outreach" } },
          { label: "Dismiss", type: "dismiss" },
        ],
      });
    }

    // Sort cards by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    cards.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return NextResponse.json({
      items: cards,
      total: cards.length,
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/ai/cards error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

function formatAction(action: string): string {
  return action
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
