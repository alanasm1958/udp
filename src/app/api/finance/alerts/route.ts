import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { salesDocs, purchaseDocs, payments } from "@/db/schema";
import { eq, and, sql, count } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const alerts: Array<{
      id: string;
      severity: "critical" | "warning" | "info";
      type: string;
      message: string;
      impact?: string;
      actions?: string[];
      createdAt: string;
    }> = [];

    // 1. Warning: Overdue payables
    try {
      const [overduePayables] = await db
        .select({
          count: count(),
        })
        .from(purchaseDocs)
        .where(
          and(
            eq(purchaseDocs.tenantId, tenantId),
            sql`${purchaseDocs.status} IN ('posted', 'approved')`,
            sql`${purchaseDocs.dueDate} < ${todayStr}`
          )
        );

      if (overduePayables && overduePayables.count > 0) {
        alerts.push({
          id: "overdue-payables",
          severity: "warning",
          type: "overdue_payables",
          message: `You have ${overduePayables.count} overdue bill${overduePayables.count > 1 ? "s" : ""}`,
          impact: "Late payments may affect vendor relationships and credit terms",
          actions: ["Review cash position", "Prioritize payments"],
          createdAt: today.toISOString(),
        });
      }
    } catch (error) {
      console.error("Error checking overdue payables:", error);
    }

    // 2. Info: Draft documents
    try {
      const [draftSales] = await db
        .select({ count: count() })
        .from(salesDocs)
        .where(
          and(
            eq(salesDocs.tenantId, tenantId),
            eq(salesDocs.status, "draft")
          )
        );

      const [draftPurchases] = await db
        .select({ count: count() })
        .from(purchaseDocs)
        .where(
          and(
            eq(purchaseDocs.tenantId, tenantId),
            eq(purchaseDocs.status, "draft")
          )
        );

      const totalDrafts = (draftSales?.count || 0) + (draftPurchases?.count || 0);

      if (totalDrafts > 0) {
        alerts.push({
          id: "draft-documents",
          severity: "info",
          type: "draft_documents",
          message: `You have ${totalDrafts} draft document${totalDrafts > 1 ? "s" : ""} that need${totalDrafts === 1 ? "s" : ""} to be posted`,
          impact: "Draft documents aren't reflected in your financial reports",
          actions: ["Review and post drafts"],
          createdAt: today.toISOString(),
        });
      }
    } catch (error) {
      console.error("Error checking draft documents:", error);
    }

    // Sort alerts by severity
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return NextResponse.json({
      alerts: alerts.slice(0, limit),
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error fetching finance alerts:", error);
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}
