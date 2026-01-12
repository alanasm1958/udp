/**
 * /api/reports/dashboard
 *
 * GET: Dashboard summary stats with KPI tiles
 *
 * Query params:
 *   range: today | 7d | 30d | mtd | ytd | custom (default: 7d)
 *   from: ISO date (for custom range)
 *   to: ISO date (for custom range)
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
  users,
  actors,
} from "@/db/schema";
import { eq, and, gte, lte, lt, desc, sql } from "drizzle-orm";

/**
 * Compute date range boundaries from range param
 */
function getDateRange(range: string, from?: string, to?: string): { from: string; to: string } {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  switch (range) {
    case "today":
      return { from: todayStr, to: todayStr };
    case "7d": {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return { from: d.toISOString().split("T")[0], to: todayStr };
    }
    case "30d": {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return { from: d.toISOString().split("T")[0], to: todayStr };
    }
    case "mtd": {
      const d = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: d.toISOString().split("T")[0], to: todayStr };
    }
    case "ytd": {
      const d = new Date(today.getFullYear(), 0, 1);
      return { from: d.toISOString().split("T")[0], to: todayStr };
    }
    case "custom":
      return { from: from || todayStr, to: to || todayStr };
    default: {
      // Default to 7d
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return { from: d.toISOString().split("T")[0], to: todayStr };
    }
  }
}

/**
 * GET /api/reports/dashboard
 * Returns comprehensive KPI stats for the dashboard
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { searchParams } = new URL(req.url);

    const range = searchParams.get("range") || "7d";
    const customFrom = searchParams.get("from") || undefined;
    const customTo = searchParams.get("to") || undefined;

    const dateRange = getDateRange(range, customFrom, customTo);
    const today = new Date().toISOString().split("T")[0];
    const asOfDate = new Date().toISOString();

    // === KPI 1: Cash Today (net cash position = all receipts - all payments) ===
    const cashReceiptsAllTime = await db
      .select({
        total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, tenantId),
          eq(payments.type, "receipt"),
          eq(payments.status, "posted")
        )
      );
    const totalReceipts = parseFloat(cashReceiptsAllTime[0]?.total || "0");

    const cashPaymentsAllTime = await db
      .select({
        total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, tenantId),
          eq(payments.type, "payment"),
          eq(payments.status, "posted")
        )
      );
    const totalPayments = parseFloat(cashPaymentsAllTime[0]?.total || "0");

    const cashToday = totalReceipts - totalPayments;

    // Cash delta: compare to 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

    const cashReceipts7dAgo = await db
      .select({
        total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, tenantId),
          eq(payments.type, "receipt"),
          eq(payments.status, "posted"),
          lt(payments.paymentDate, sevenDaysAgoStr)
        )
      );
    const cashPayments7dAgo = await db
      .select({
        total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, tenantId),
          eq(payments.type, "payment"),
          eq(payments.status, "posted"),
          lt(payments.paymentDate, sevenDaysAgoStr)
        )
      );
    const cash7dAgo = parseFloat(cashReceipts7dAgo[0]?.total || "0") - parseFloat(cashPayments7dAgo[0]?.total || "0");
    const cashDelta = cashToday - cash7dAgo;
    const cashDeltaPercent = cash7dAgo !== 0 ? ((cashDelta / Math.abs(cash7dAgo)) * 100) : 0;

    // === KPI 2: Open AR ===
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

    // Count overdue AR invoices (dueDate < today and still has balance)
    const overdueARResult = await db
      .select({
        id: salesDocs.id,
        totalAmount: salesDocs.totalAmount,
        dueDate: salesDocs.dueDate,
      })
      .from(salesDocs)
      .where(
        and(
          eq(salesDocs.tenantId, tenantId),
          eq(salesDocs.docType, "invoice"),
          eq(salesDocs.status, "posted"),
          lt(salesDocs.dueDate, today)
        )
      );
    // Check each overdue invoice for remaining balance
    let overdueCount = 0;
    for (const inv of overdueARResult) {
      const allocResult = await db
        .select({
          allocated: sql<string>`COALESCE(SUM(${paymentAllocations.amount}), 0)`,
        })
        .from(paymentAllocations)
        .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
        .where(
          and(
            eq(paymentAllocations.tenantId, tenantId),
            eq(paymentAllocations.targetType, "sales_doc"),
            eq(paymentAllocations.targetId, inv.id),
            eq(payments.status, "posted")
          )
        );
      const allocated = parseFloat(allocResult[0]?.allocated || "0");
      const remaining = parseFloat(inv.totalAmount) - allocated;
      if (remaining > 0.01) {
        overdueCount++;
      }
    }

    // === KPI 3: Open AP ===
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

    // Count AP due in next 7 days
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const apDueSoonResult = await db
      .select({
        id: purchaseDocs.id,
        totalAmount: purchaseDocs.totalAmount,
      })
      .from(purchaseDocs)
      .where(
        and(
          eq(purchaseDocs.tenantId, tenantId),
          eq(purchaseDocs.docType, "invoice"),
          eq(purchaseDocs.status, "posted"),
          gte(purchaseDocs.dueDate, today),
          lte(purchaseDocs.dueDate, sevenDaysFromNow)
        )
      );
    let apDue7dCount = 0;
    for (const inv of apDueSoonResult) {
      const allocResult = await db
        .select({
          allocated: sql<string>`COALESCE(SUM(${paymentAllocations.amount}), 0)`,
        })
        .from(paymentAllocations)
        .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
        .where(
          and(
            eq(paymentAllocations.tenantId, tenantId),
            eq(paymentAllocations.targetType, "purchase_doc"),
            eq(paymentAllocations.targetId, inv.id),
            eq(payments.status, "posted")
          )
        );
      const allocated = parseFloat(allocResult[0]?.allocated || "0");
      const remaining = parseFloat(inv.totalAmount) - allocated;
      if (remaining > 0.01) {
        apDue7dCount++;
      }
    }

    // === KPI 4: Sales MTD ===
    const mtdStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
    const salesMTDResult = await db
      .select({
        total: sql<string>`COALESCE(SUM(${salesDocs.totalAmount}), 0)`,
      })
      .from(salesDocs)
      .where(
        and(
          eq(salesDocs.tenantId, tenantId),
          eq(salesDocs.docType, "invoice"),
          eq(salesDocs.status, "posted"),
          gte(salesDocs.docDate, mtdStart)
        )
      );
    const salesMTD = parseFloat(salesMTDResult[0]?.total || "0");

    // === KPI 5: Inventory ===
    const inventoryResult = await db
      .select({
        totalOnHand: sql<string>`COALESCE(SUM(${inventoryBalances.onHand}), 0)`,
        totalAvailable: sql<string>`COALESCE(SUM(${inventoryBalances.available}), 0)`,
      })
      .from(inventoryBalances)
      .where(eq(inventoryBalances.tenantId, tenantId));
    const inventoryOnHand = parseFloat(inventoryResult[0]?.totalOnHand || "0");

    // Count low/zero stock items
    const inventoryItems = await db
      .select({
        productId: inventoryBalances.productId,
        onHand: inventoryBalances.onHand,
        available: inventoryBalances.available,
      })
      .from(inventoryBalances)
      .where(eq(inventoryBalances.tenantId, tenantId));

    // Aggregate by product
    const productStock = new Map<string, { onHand: number; available: number }>();
    for (const item of inventoryItems) {
      const existing = productStock.get(item.productId);
      if (existing) {
        existing.onHand += parseFloat(item.onHand);
        existing.available += parseFloat(item.available);
      } else {
        productStock.set(item.productId, {
          onHand: parseFloat(item.onHand),
          available: parseFloat(item.available),
        });
      }
    }
    let lowStockCount = 0;
    for (const [, stock] of productStock) {
      if (stock.available <= 0) {
        lowStockCount++;
      }
    }

    // === Period-specific cash flow ===
    const receiptsInRange = await db
      .select({
        total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, tenantId),
          eq(payments.type, "receipt"),
          eq(payments.status, "posted"),
          gte(payments.paymentDate, dateRange.from),
          lte(payments.paymentDate, dateRange.to)
        )
      );
    const receiptsRange = parseFloat(receiptsInRange[0]?.total || "0");

    const paymentsInRange = await db
      .select({
        total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, tenantId),
          eq(payments.type, "payment"),
          eq(payments.status, "posted"),
          gte(payments.paymentDate, dateRange.from),
          lte(payments.paymentDate, dateRange.to)
        )
      );
    const paymentsRange = parseFloat(paymentsInRange[0]?.total || "0");

    // === Recent audit events ===
    const recentEvents = await db
      .select({
        id: auditEvents.id,
        action: auditEvents.action,
        entityType: auditEvents.entityType,
        entityId: auditEvents.entityId,
        actorId: auditEvents.actorId,
        occurredAt: auditEvents.occurredAt,
        metadata: auditEvents.metadata,
      })
      .from(auditEvents)
      .where(eq(auditEvents.tenantId, tenantId))
      .orderBy(desc(auditEvents.occurredAt))
      .limit(20);

    // Get actor info for activity feed
    const actorIds = [...new Set(recentEvents.map((e) => e.actorId))];
    const actorInfo = new Map<string, { type: string; name: string | null }>();
    if (actorIds.length > 0) {
      const actorsData = await db
        .select({
          id: actors.id,
          type: actors.type,
          userId: actors.userId,
          systemName: actors.systemName,
        })
        .from(actors)
        .where(eq(actors.tenantId, tenantId));

      const userIds = actorsData.filter((a) => a.userId).map((a) => a.userId!);
      const usersData = userIds.length > 0
        ? await db
            .select({ id: users.id, fullName: users.fullName })
            .from(users)
            .where(eq(users.tenantId, tenantId))
        : [];
      const userMap = new Map(usersData.map((u) => [u.id, u.fullName]));

      for (const actor of actorsData) {
        let name: string | null = null;
        if (actor.type === "user" && actor.userId) {
          name = userMap.get(actor.userId) || null;
        } else if (actor.type === "system") {
          name = actor.systemName || "System";
        }
        actorInfo.set(actor.id, { type: actor.type, name });
      }
    }

    return NextResponse.json({
      asOfDate,
      dateRange: {
        range,
        from: dateRange.from,
        to: dateRange.to,
      },
      kpis: {
        cashToday: {
          value: cashToday,
          delta: cashDelta,
          deltaPercent: Math.round(cashDeltaPercent * 10) / 10,
          label: "Cash Position",
          route: "/finance/payments?status=posted",
        },
        openAR: {
          value: openAR,
          overdueCount,
          label: "Open AR",
          route: "/finance/ar",
        },
        openAP: {
          value: openAP,
          dueSoonCount: apDue7dCount,
          label: "Open AP",
          route: "/finance/ap",
        },
        salesMTD: {
          value: salesMTD,
          label: "Sales MTD",
          route: "/sales?docType=invoice&status=posted",
        },
        inventory: {
          value: inventoryOnHand,
          lowStockCount,
          label: "Inventory On-Hand",
          route: "/inventory/balances",
        },
      },
      periodStats: {
        receipts: receiptsRange,
        payments: paymentsRange,
        netCashFlow: receiptsRange - paymentsRange,
      },
      // Legacy stats format for backward compatibility
      stats: {
        openAR,
        openAP,
        receipts7d: receiptsRange,
        payments7d: paymentsRange,
        inventoryOnHand,
      },
      recentActivity: recentEvents.map((e) => {
        const actor = actorInfo.get(e.actorId);
        return {
          id: e.id,
          action: e.action,
          entityType: e.entityType,
          entityId: e.entityId,
          actorName: actor?.name || null,
          actorType: actor?.type || null,
          occurredAt: e.occurredAt,
          metadata: e.metadata,
        };
      }),
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
