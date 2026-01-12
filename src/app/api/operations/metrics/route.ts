import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { items, warehouses, inventoryBalances, serviceJobs, tasks, alerts, purchaseDocs } from "@/db/schema";
import { eq, and, sql, lte, gte, isNotNull } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

/**
 * GET /api/operations/metrics
 * Returns operations-focused metrics for the Overview page
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);

    // Get all metrics in parallel for performance
    const [
      productsInStock,
      lowStockItems,
      outOfStockItems,
      expiringSoonItems,
      pendingReceipts,
      activeServiceJobs,
      overdueServiceJobs,
      warehouseCount,
      operationsTasks,
      operationsAlerts,
    ] = await Promise.all([
      // Products with stock > 0
      db
        .select({ count: sql<number>`count(distinct ${inventoryBalances.productId})` })
        .from(inventoryBalances)
        .where(
          and(
            eq(inventoryBalances.tenantId, tenantId),
            sql`${inventoryBalances.onHand} > 0`
          )
        )
        .then((r) => r[0]?.count ?? 0),

      // Low stock items (on_hand > 0 but <= 20% of some threshold or explicit low stock)
      // For now, count items where available <= 10 but > 0
      db
        .select({ count: sql<number>`count(distinct ${inventoryBalances.productId})` })
        .from(inventoryBalances)
        .where(
          and(
            eq(inventoryBalances.tenantId, tenantId),
            sql`${inventoryBalances.available} > 0`,
            sql`${inventoryBalances.available} <= 10`
          )
        )
        .then((r) => r[0]?.count ?? 0),

      // Out of stock items (available = 0 or negative)
      db
        .select({ count: sql<number>`count(distinct ${inventoryBalances.productId})` })
        .from(inventoryBalances)
        .where(
          and(
            eq(inventoryBalances.tenantId, tenantId),
            sql`${inventoryBalances.available} <= 0`
          )
        )
        .then((r) => r[0]?.count ?? 0),

      // Expiring soon items (within 30 days)
      db
        .select({ count: sql<number>`count(*)` })
        .from(items)
        .where(
          and(
            eq(items.tenantId, tenantId),
            isNotNull(items.expiryDate),
            gte(items.expiryDate, sql`CURRENT_DATE`),
            lte(items.expiryDate, sql`CURRENT_DATE + INTERVAL '30 days'`)
          )
        )
        .then((r) => r[0]?.count ?? 0),

      // Pending receipts (purchase orders that need receiving)
      db
        .select({ count: sql<number>`count(*)` })
        .from(purchaseDocs)
        .where(
          and(
            eq(purchaseDocs.tenantId, tenantId),
            sql`${purchaseDocs.status} IN ('issued', 'approved', 'partially_fulfilled')`
          )
        )
        .then((r) => r[0]?.count ?? 0),

      // Active service jobs (not completed or cancelled)
      db
        .select({ count: sql<number>`count(*)` })
        .from(serviceJobs)
        .where(
          and(
            eq(serviceJobs.tenantId, tenantId),
            sql`${serviceJobs.status} NOT IN ('completed', 'cancelled')`
          )
        )
        .then((r) => r[0]?.count ?? 0),

      // Overdue service jobs (past due date and not completed)
      db
        .select({ count: sql<number>`count(*)` })
        .from(serviceJobs)
        .where(
          and(
            eq(serviceJobs.tenantId, tenantId),
            sql`${serviceJobs.status} NOT IN ('completed', 'cancelled')`,
            isNotNull(serviceJobs.dueDate),
            lte(serviceJobs.dueDate, sql`CURRENT_DATE`)
          )
        )
        .then((r) => r[0]?.count ?? 0),

      // Warehouse count
      db
        .select({ count: sql<number>`count(*)` })
        .from(warehouses)
        .where(
          and(
            eq(warehouses.tenantId, tenantId),
            eq(warehouses.status, "active")
          )
        )
        .then((r) => r[0]?.count ?? 0),

      // Operations tasks (domain = operations, status = open)
      db
        .select({ count: sql<number>`count(*)` })
        .from(tasks)
        .where(
          and(
            eq(tasks.tenantId, tenantId),
            eq(tasks.domain, "operations"),
            eq(tasks.status, "open")
          )
        )
        .then((r) => r[0]?.count ?? 0),

      // Operations alerts (domain = operations, status = active)
      db
        .select({ count: sql<number>`count(*)` })
        .from(alerts)
        .where(
          and(
            eq(alerts.tenantId, tenantId),
            eq(alerts.domain, "operations"),
            eq(alerts.status, "active")
          )
        )
        .then((r) => r[0]?.count ?? 0),
    ]);

    return NextResponse.json({
      metrics: {
        productsInStock: Number(productsInStock),
        lowStockCount: Number(lowStockItems),
        outOfStockCount: Number(outOfStockItems),
        expiringSoonCount: Number(expiringSoonItems),
        pendingReceiptsCount: Number(pendingReceipts),
        activeServiceJobsCount: Number(activeServiceJobs),
        overdueServiceJobsCount: Number(overdueServiceJobs),
        warehousesCount: Number(warehouseCount),
        operationsTasksCount: Number(operationsTasks),
        operationsAlertsCount: Number(operationsAlerts),
      },
    });
  } catch (error) {
    console.error("Operations metrics error:", error);
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: "Failed to fetch operations metrics" },
      { status: 500 }
    );
  }
}
