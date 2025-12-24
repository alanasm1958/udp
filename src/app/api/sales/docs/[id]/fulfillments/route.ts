/**
 * /api/sales/docs/[id]/fulfillments
 *
 * GET: List fulfillments for a sales document
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { salesDocs, salesDocLines, salesFulfillments, inventoryMovements } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

/**
 * GET /api/sales/docs/[id]/fulfillments
 * List all fulfillments for a sales document, grouped by line
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id: salesDocId } = await params;

    // Verify document exists
    const [doc] = await db
      .select({ id: salesDocs.id })
      .from(salesDocs)
      .where(and(eq(salesDocs.tenantId, tenantId), eq(salesDocs.id, salesDocId)))
      .limit(1);

    if (!doc) {
      return NextResponse.json({ error: "Sales document not found" }, { status: 404 });
    }

    // Fetch all lines for this document
    const lines = await db
      .select({
        id: salesDocLines.id,
        lineNo: salesDocLines.lineNo,
        productId: salesDocLines.productId,
        description: salesDocLines.description,
        quantity: salesDocLines.quantity,
      })
      .from(salesDocLines)
      .where(and(eq(salesDocLines.tenantId, tenantId), eq(salesDocLines.salesDocId, salesDocId)));

    // Fetch all fulfillments for this document with movement details
    const fulfillments = await db
      .select({
        id: salesFulfillments.id,
        salesDocLineId: salesFulfillments.salesDocLineId,
        movementId: salesFulfillments.movementId,
        fulfillmentType: salesFulfillments.fulfillmentType,
        quantity: salesFulfillments.quantity,
        createdAt: salesFulfillments.createdAt,
        movementStatus: inventoryMovements.movementStatus,
        warehouseId: inventoryMovements.fromWarehouseId,
        toWarehouseId: inventoryMovements.toWarehouseId,
      })
      .from(salesFulfillments)
      .innerJoin(inventoryMovements, eq(salesFulfillments.movementId, inventoryMovements.id))
      .where(
        and(eq(salesFulfillments.tenantId, tenantId), eq(salesFulfillments.salesDocId, salesDocId))
      );

    // Group fulfillments by line
    const lineMap = new Map<
      string,
      {
        lineId: string;
        lineNo: number;
        productId: string | null;
        description: string;
        orderedQuantity: string;
        fulfillments: Array<{
          id: string;
          movementId: string;
          fulfillmentType: string;
          quantity: string;
          movementStatus: string;
          warehouseId: string | null;
          createdAt: Date;
        }>;
        totalReserved: number;
        totalShipped: number;
        totalReturned: number;
      }
    >();

    // Initialize with all lines
    for (const line of lines) {
      lineMap.set(line.id, {
        lineId: line.id,
        lineNo: line.lineNo,
        productId: line.productId,
        description: line.description,
        orderedQuantity: line.quantity,
        fulfillments: [],
        totalReserved: 0,
        totalShipped: 0,
        totalReturned: 0,
      });
    }

    // Add fulfillments to their respective lines
    for (const f of fulfillments) {
      const lineData = lineMap.get(f.salesDocLineId);
      if (lineData) {
        const qty = parseFloat(f.quantity);
        lineData.fulfillments.push({
          id: f.id,
          movementId: f.movementId,
          fulfillmentType: f.fulfillmentType,
          quantity: f.quantity,
          movementStatus: f.movementStatus,
          warehouseId: f.warehouseId ?? f.toWarehouseId,
          createdAt: f.createdAt,
        });

        if (f.fulfillmentType === "reserve") {
          lineData.totalReserved += qty;
        } else if (f.fulfillmentType === "unreserve") {
          lineData.totalReserved -= qty;
        } else if (f.fulfillmentType === "ship") {
          lineData.totalShipped += qty;
          // Shipping also reduces reserved (assumes reserve happened first)
          lineData.totalReserved -= qty;
        } else if (f.fulfillmentType === "return") {
          lineData.totalReturned += qty;
        }
      }
    }

    // Convert to array and calculate remaining
    const result = Array.from(lineMap.values()).map((line) => ({
      ...line,
      totalReserved: Math.max(0, line.totalReserved),
      remainingToFulfill:
        parseFloat(line.orderedQuantity) - line.totalShipped + line.totalReturned,
    }));

    return NextResponse.json({
      salesDocId,
      lines: result.sort((a, b) => a.lineNo - b.lineNo),
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/sales/docs/[id]/fulfillments error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
