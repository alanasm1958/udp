/**
 * /api/reports/dashboard
 *
 * GET: Dashboard summary stats
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";
import { db } from "@/db";
import {
  salesDocs,
  purchaseDocs,
  payments,
  paymentAllocations,
  inventoryBalances,
  auditEvents,
} from "@/db/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";

/**
 * GET /api/reports/dashboard
 * Returns summary stats for the dashboard
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);

    // Date for last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

    // Open AR - posted invoices minus allocated amounts
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

    const arTotal = parseFloat(arResult[0]?.total || "0");

    // Get allocated amounts for AR
    const arAllocatedResult = await db
      .select({
        allocated: sql<string>`COALESCE(SUM(${paymentAllocations.amount}), 0)`,
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

    const arAllocated = parseFloat(arAllocatedResult[0]?.allocated || "0");
    const openAR = arTotal - arAllocated;

    // Open AP - posted purchase invoices minus allocated amounts
    const apResult = await db
      .select({
        total: sql<string>`COALESCE(SUM(${purchaseDocs.totalAmount}), 0)`,
      })
      .from(purchaseDocs)
      .where(
        and(
          eq(purchaseDocs.tenantId, tenantId),
          eq(purchaseDocs.docType, "invoice"),
          eq(purchaseDocs.status, "posted")
        )
      );

    const apTotal = parseFloat(apResult[0]?.total || "0");

    // Get allocated amounts for AP
    const apAllocatedResult = await db
      .select({
        allocated: sql<string>`COALESCE(SUM(${paymentAllocations.amount}), 0)`,
      })
      .from(paymentAllocations)
      .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
      .where(
        and(
          eq(paymentAllocations.tenantId, tenantId),
          eq(paymentAllocations.targetType, "purchase_doc"),
          eq(payments.status, "posted")
        )
      );

    const apAllocated = parseFloat(apAllocatedResult[0]?.allocated || "0");
    const openAP = apTotal - apAllocated;

    // Cash receipts last 7 days
    const receiptsResult = await db
      .select({
        total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, tenantId),
          eq(payments.type, "receipt"),
          eq(payments.status, "posted"),
          gte(payments.paymentDate, sevenDaysAgoStr)
        )
      );

    const receipts7d = parseFloat(receiptsResult[0]?.total || "0");

    // Payments last 7 days
    const paymentsResult = await db
      .select({
        total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, tenantId),
          eq(payments.type, "payment"),
          eq(payments.status, "posted"),
          gte(payments.paymentDate, sevenDaysAgoStr)
        )
      );

    const payments7d = parseFloat(paymentsResult[0]?.total || "0");

    // Inventory on-hand count
    const inventoryResult = await db
      .select({
        totalOnHand: sql<string>`COALESCE(SUM(${inventoryBalances.onHand}), 0)`,
      })
      .from(inventoryBalances)
      .where(eq(inventoryBalances.tenantId, tenantId));

    const inventoryOnHand = parseFloat(inventoryResult[0]?.totalOnHand || "0");

    // Recent audit events
    const recentEvents = await db
      .select({
        id: auditEvents.id,
        action: auditEvents.action,
        entityType: auditEvents.entityType,
        occurredAt: auditEvents.occurredAt,
        metadata: auditEvents.metadata,
      })
      .from(auditEvents)
      .where(eq(auditEvents.tenantId, tenantId))
      .orderBy(desc(auditEvents.occurredAt))
      .limit(20);

    return NextResponse.json({
      stats: {
        openAR,
        openAP,
        receipts7d,
        payments7d,
        inventoryOnHand,
      },
      recentActivity: recentEvents.map((e) => ({
        id: e.id,
        action: e.action,
        entityType: e.entityType,
        occurredAt: e.occurredAt,
        metadata: e.metadata,
      })),
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/reports/dashboard error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
