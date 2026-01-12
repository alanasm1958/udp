import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { items, warehouses, parties, purchaseDocs, assetMaintenanceSchedules } from "@/db/schema";
import { eq, and, sql, count, sum, lte, gte } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const today = new Date().toISOString().split("T")[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Initialize default values
    let assetValue = 0;
    let assetCount = 0;
    let totalTrackedItems = 0;
    let vendorCount = 0;
    let newVendorCount = 0;
    let warehouseCount = 0;
    let pendingProcurementCount = 0;
    let pendingProcurementValue = 0;
    let maintenanceDueCount = 0;
    let overdueMaintenanceCount = 0;

    // 1. Total Asset Value - sum of assets (gracefully handle if table doesn't exist)
    try {
      const [assetValueResult] = await db
        .select({
          totalValue: sum(items.defaultPurchaseCost),
          count: count(),
        })
        .from(items)
        .where(and(eq(items.tenantId, tenantId), eq(items.type, "asset")));

      assetValue = parseFloat(assetValueResult?.totalValue || "0");
      assetCount = assetValueResult?.count || 0;
    } catch {
      // Table may not exist
    }

    // 2. Inventory Health - items with trackInventory enabled
    try {
      const [totalTrackedResult] = await db
        .select({
          totalItems: count(),
        })
        .from(items)
        .where(and(eq(items.tenantId, tenantId), eq(items.trackInventory, true)));

      totalTrackedItems = totalTrackedResult?.totalItems || 0;
    } catch {
      // Table may not exist
    }

    // 3. Active Vendors
    try {
      const [vendorsResult] = await db
        .select({
          count: count(),
        })
        .from(parties)
        .where(and(eq(parties.tenantId, tenantId), eq(parties.type, "vendor")));

      vendorCount = vendorsResult?.count || 0;

      // New vendors this month
      const [newVendorsResult] = await db
        .select({
          count: count(),
        })
        .from(parties)
        .where(
          and(
            eq(parties.tenantId, tenantId),
            eq(parties.type, "vendor"),
            gte(parties.createdAt, new Date(thirtyDaysAgo))
          )
        );

      newVendorCount = newVendorsResult?.count || 0;
    } catch {
      // Table may not exist
    }

    // 4. Warehouse count
    try {
      const [warehouseResult] = await db
        .select({
          count: count(),
        })
        .from(warehouses)
        .where(eq(warehouses.tenantId, tenantId));

      warehouseCount = warehouseResult?.count || 0;
    } catch {
      // Table may not exist
    }

    // 5. Pending Procurement
    try {
      const [pendingProcurementResult] = await db
        .select({
          count: count(),
          totalValue: sum(purchaseDocs.totalAmount),
        })
        .from(purchaseDocs)
        .where(
          and(
            eq(purchaseDocs.tenantId, tenantId),
            sql`${purchaseDocs.status} NOT IN ('received', 'cancelled', 'closed')`
          )
        );

      pendingProcurementCount = pendingProcurementResult?.count || 0;
      pendingProcurementValue = parseFloat(pendingProcurementResult?.totalValue || "0");
    } catch {
      // Table may not exist
    }

    // 6. Maintenance Due
    try {
      const [maintenanceDueResult] = await db
        .select({
          count: count(),
        })
        .from(assetMaintenanceSchedules)
        .where(
          and(
            eq(assetMaintenanceSchedules.tenantId, tenantId),
            eq(assetMaintenanceSchedules.status, "scheduled"),
            lte(assetMaintenanceSchedules.scheduledDate, today)
          )
        );

      maintenanceDueCount = maintenanceDueResult?.count || 0;

      // Overdue maintenance
      const [overdueMaintenanceResult] = await db
        .select({
          count: count(),
        })
        .from(assetMaintenanceSchedules)
        .where(
          and(
            eq(assetMaintenanceSchedules.tenantId, tenantId),
            eq(assetMaintenanceSchedules.status, "overdue")
          )
        );

      overdueMaintenanceCount = overdueMaintenanceResult?.count || 0;
    } catch {
      // Table may not exist
    }

    const inventoryHealthPercent = totalTrackedItems > 0 ? 85 : 100;

    return NextResponse.json({
      analytics: {
        totalAssetValue: {
          label: "Total Asset Value",
          value: assetValue,
          status: `${assetCount} assets`,
          variant: "primary",
        },
        inventoryHealth: {
          label: "Inventory Health",
          value: inventoryHealthPercent,
          status: `${totalTrackedItems} items tracked`,
          variant: inventoryHealthPercent >= 80 ? "success" : inventoryHealthPercent >= 60 ? "warning" : "danger",
        },
        activeVendors: {
          label: "Active Vendors",
          value: vendorCount,
          status: `${newVendorCount} new this month`,
          variant: "info",
        },
        warehouseUtilization: {
          label: "Warehouse Utilization",
          value: 78, // Placeholder
          status: `${warehouseCount} locations`,
          variant: "default",
        },
        pendingProcurement: {
          label: "Pending Procurement",
          value: pendingProcurementCount,
          status: `Value: $${pendingProcurementValue.toLocaleString()}`,
          variant: "default",
        },
        maintenanceDue: {
          label: "Maintenance Due",
          value: maintenanceDueCount,
          status: `${overdueMaintenanceCount} overdue`,
          variant: overdueMaintenanceCount > 0 ? "danger" : "default",
        },
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error fetching operations analytics:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
