/**
 * /api/procurement/docs/[id]/receipts
 *
 * GET: List receipts for a purchase document
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { purchaseDocs, purchaseDocLines, purchaseReceipts, inventoryMovements } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

/**
 * GET /api/procurement/docs/[id]/receipts
 * List all receipts for a purchase document, grouped by line with totals
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id: purchaseDocId } = await params;

    // Verify document exists
    const [doc] = await db
      .select({ id: purchaseDocs.id })
      .from(purchaseDocs)
      .where(and(eq(purchaseDocs.tenantId, tenantId), eq(purchaseDocs.id, purchaseDocId)))
      .limit(1);

    if (!doc) {
      return NextResponse.json({ error: "Purchase document not found" }, { status: 404 });
    }

    // Fetch all lines for this document
    const lines = await db
      .select({
        id: purchaseDocLines.id,
        lineNo: purchaseDocLines.lineNo,
        productId: purchaseDocLines.productId,
        description: purchaseDocLines.description,
        quantity: purchaseDocLines.quantity,
      })
      .from(purchaseDocLines)
      .where(
        and(eq(purchaseDocLines.tenantId, tenantId), eq(purchaseDocLines.purchaseDocId, purchaseDocId))
      );

    // Fetch all receipts for this document with movement details
    const receipts = await db
      .select({
        id: purchaseReceipts.id,
        purchaseDocLineId: purchaseReceipts.purchaseDocLineId,
        movementId: purchaseReceipts.movementId,
        receiptType: purchaseReceipts.receiptType,
        quantity: purchaseReceipts.quantity,
        note: purchaseReceipts.note,
        createdAt: purchaseReceipts.createdAt,
        movementStatus: inventoryMovements.movementStatus,
        movementToWarehouseId: inventoryMovements.toWarehouseId,
        movementFromWarehouseId: inventoryMovements.fromWarehouseId,
      })
      .from(purchaseReceipts)
      .innerJoin(inventoryMovements, eq(purchaseReceipts.movementId, inventoryMovements.id))
      .where(
        and(
          eq(purchaseReceipts.tenantId, tenantId),
          eq(purchaseReceipts.purchaseDocId, purchaseDocId)
        )
      );

    // Group receipts by line
    const lineMap = new Map<
      string,
      {
        purchaseDocLineId: string;
        productId: string | null;
        orderedQuantity: string;
        receipts: Array<{
          id: string;
          movementId: string;
          receiptType: string;
          quantity: string;
          warehouseId: string | null;
          note: string | null;
          createdAt: Date;
        }>;
        totalReceived: number;
        totalUnreceived: number;
        totalReturned: number;
      }
    >();

    // Initialize with all lines
    for (const line of lines) {
      lineMap.set(line.id, {
        purchaseDocLineId: line.id,
        productId: line.productId,
        orderedQuantity: line.quantity,
        receipts: [],
        totalReceived: 0,
        totalUnreceived: 0,
        totalReturned: 0,
      });
    }

    // Add receipts to their respective lines
    for (const r of receipts) {
      const lineData = lineMap.get(r.purchaseDocLineId);
      if (lineData) {
        const qty = parseFloat(r.quantity);
        lineData.receipts.push({
          id: r.id,
          movementId: r.movementId,
          receiptType: r.receiptType,
          quantity: r.quantity,
          warehouseId: r.movementToWarehouseId ?? r.movementFromWarehouseId,
          note: r.note,
          createdAt: r.createdAt,
        });

        if (r.receiptType === "receive") {
          lineData.totalReceived += qty;
        } else if (r.receiptType === "unreceive") {
          lineData.totalUnreceived += qty;
        } else if (r.receiptType === "return_to_vendor") {
          lineData.totalReturned += qty;
        }
      }
    }

    // Convert to array with totals object format
    const result = Array.from(lineMap.values()).map((line) => {
      // Net received = received - unreceived - returned
      const netReceived = line.totalReceived - line.totalUnreceived - line.totalReturned;

      return {
        purchaseDocLineId: line.purchaseDocLineId,
        productId: line.productId,
        orderedQuantity: line.orderedQuantity,
        totals: {
          received: line.totalReceived.toFixed(6),
          unreceived: line.totalUnreceived.toFixed(6),
          returned: line.totalReturned.toFixed(6),
          netReceived: netReceived.toFixed(6),
        },
        receipts: line.receipts,
      };
    });

    return NextResponse.json({
      purchaseDocId,
      lines: result,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/procurement/docs/[id]/receipts error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
