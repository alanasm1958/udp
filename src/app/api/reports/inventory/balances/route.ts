/**
 * /api/reports/inventory/balances
 *
 * GET: Inventory balances report
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";
import { db } from "@/db";
import { inventoryBalances, products, warehouses, storageLocations } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";

interface InventoryBalanceRow {
  productId: string;
  productSku: string | null;
  productName: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  locationId: string | null;
  locationCode: string | null;
  onHand: number;
  reserved: number;
  available: number;
}

/**
 * GET /api/reports/inventory/balances
 * Query params: warehouseId?, productId?, limit?, offset?, includeZero?
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { searchParams } = new URL(req.url);

    const warehouseId = searchParams.get("warehouseId");
    const productId = searchParams.get("productId");
    const includeZero = searchParams.get("includeZero") === "true";
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Build conditions
    const conditions = [eq(inventoryBalances.tenantId, tenantId)];

    if (!includeZero) {
      conditions.push(gt(inventoryBalances.onHand, "0"));
    }

    if (warehouseId) {
      conditions.push(eq(inventoryBalances.warehouseId, warehouseId));
    }
    if (productId) {
      conditions.push(eq(inventoryBalances.productId, productId));
    }

    // Query inventory balances with joins
    const balances = await db
      .select({
        productId: inventoryBalances.productId,
        productSku: products.sku,
        productName: products.name,
        warehouseId: inventoryBalances.warehouseId,
        warehouseCode: warehouses.code,
        warehouseName: warehouses.name,
        locationId: inventoryBalances.locationId,
        locationCode: storageLocations.code,
        onHand: inventoryBalances.onHand,
        reserved: inventoryBalances.reserved,
        available: inventoryBalances.available,
      })
      .from(inventoryBalances)
      .innerJoin(products, eq(inventoryBalances.productId, products.id))
      .innerJoin(warehouses, eq(inventoryBalances.warehouseId, warehouses.id))
      .leftJoin(storageLocations, eq(inventoryBalances.locationId, storageLocations.id))
      .where(and(...conditions))
      .orderBy(products.name, warehouses.code)
      .limit(limit)
      .offset(offset);

    const items: InventoryBalanceRow[] = balances.map((b) => ({
      productId: b.productId,
      productSku: b.productSku,
      productName: b.productName,
      warehouseId: b.warehouseId,
      warehouseCode: b.warehouseCode,
      warehouseName: b.warehouseName,
      locationId: b.locationId,
      locationCode: b.locationCode,
      onHand: parseFloat(b.onHand),
      reserved: parseFloat(b.reserved),
      available: parseFloat(b.available),
    }));

    // Calculate totals
    const totals = items.reduce(
      (acc, item) => ({
        onHand: acc.onHand + item.onHand,
        reserved: acc.reserved + item.reserved,
        available: acc.available + item.available,
      }),
      { onHand: 0, reserved: 0, available: 0 }
    );

    return NextResponse.json({
      items,
      totals,
      pagination: {
        limit,
        offset,
        hasMore: items.length === limit,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/reports/inventory/balances error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
