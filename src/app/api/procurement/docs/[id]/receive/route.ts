/**
 * /api/procurement/docs/[id]/receive
 *
 * POST: Create purchase receipts (receive, unreceive, or return to vendor)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  purchaseDocs,
  purchaseDocLines,
  purchaseReceipts,
  inventoryMovements,
  inventoryBalances,
  transactionSets,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";
import { requireRole, ROLES } from "@/lib/authz";

type ReceiptType = "receive" | "unreceive" | "return_to_vendor";

interface ReceiveLineInput {
  purchaseDocLineId: string;
  quantity: string;
}

interface ReceiveRequest {
  receiptType: ReceiptType;
  warehouseId: string;
  locationId?: string;
  lines: ReceiveLineInput[];
  movementDate: string;
  note?: string;
}

interface CreatedReceipt {
  id: string;
  purchaseDocLineId: string;
  movementId: string;
  receiptType: string;
  quantity: string;
}

/**
 * POST /api/procurement/docs/[id]/receive
 * Create purchase receipts and update inventory
 *
 * receive: increases on_hand in warehouse (receipt movement)
 * unreceive: reverses a receipt - decreases on_hand (issue movement)
 * return_to_vendor: returns goods to vendor - decreases on_hand (issue movement)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // RBAC: admin or procurement can receive goods
    const roleCheck = requireRole(req, [ROLES.PROCUREMENT]);
    if (roleCheck instanceof NextResponse) return roleCheck;

    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const { id: purchaseDocId } = await params;
    const body: ReceiveRequest = await req.json();

    // Validate required fields
    if (!body.receiptType || !body.warehouseId || !body.movementDate || !body.lines || body.lines.length === 0) {
      return NextResponse.json(
        { error: "receiptType, warehouseId, movementDate, and lines are required" },
        { status: 400 }
      );
    }

    const validTypes: ReceiptType[] = ["receive", "unreceive", "return_to_vendor"];
    if (!validTypes.includes(body.receiptType)) {
      return NextResponse.json(
        { error: "receiptType must be one of: receive, unreceive, return_to_vendor" },
        { status: 400 }
      );
    }

    // Verify purchase doc exists and check doc type
    const [doc] = await db
      .select({
        id: purchaseDocs.id,
        status: purchaseDocs.status,
        docNumber: purchaseDocs.docNumber,
        docType: purchaseDocs.docType,
      })
      .from(purchaseDocs)
      .where(and(eq(purchaseDocs.tenantId, tenantId), eq(purchaseDocs.id, purchaseDocId)))
      .limit(1);

    if (!doc) {
      return NextResponse.json({ error: "Purchase document not found" }, { status: 404 });
    }

    // Only allow receiving on order or invoice, not RFQ
    if (doc.docType === "rfq") {
      return NextResponse.json(
        { error: "Cannot receive goods against an RFQ. Use order or invoice." },
        { status: 400 }
      );
    }

    // Validate all lines exist and belong to this doc
    const linesFromDb = await db
      .select({
        id: purchaseDocLines.id,
        productId: purchaseDocLines.productId,
        quantity: purchaseDocLines.quantity,
        unitPrice: purchaseDocLines.unitPrice,
      })
      .from(purchaseDocLines)
      .where(
        and(
          eq(purchaseDocLines.tenantId, tenantId),
          eq(purchaseDocLines.purchaseDocId, purchaseDocId)
        )
      );

    const lineMap = new Map(linesFromDb.map((l) => [l.id, l]));

    for (const inputLine of body.lines) {
      const line = lineMap.get(inputLine.purchaseDocLineId);
      if (!line) {
        return NextResponse.json(
          { error: `Purchase document line not found: ${inputLine.purchaseDocLineId}` },
          { status: 404 }
        );
      }
      if (!line.productId) {
        return NextResponse.json(
          { error: `Cannot receive a line without a product: ${inputLine.purchaseDocLineId}` },
          { status: 400 }
        );
      }
      const qty = parseFloat(inputLine.quantity);
      if (isNaN(qty) || qty <= 0) {
        return NextResponse.json(
          { error: `quantity must be a positive number for line ${inputLine.purchaseDocLineId}` },
          { status: 400 }
        );
      }
    }

    // Create transaction set for tracking
    const [txSet] = await db
      .insert(transactionSets)
      .values({
        tenantId,
        status: "draft",
        source: "purchase_receipt",
        createdByActorId: actor.actorId,
        businessDate: body.movementDate,
        notes: `Procurement ${body.receiptType}: ${doc.docNumber}`,
      })
      .returning();

    const createdReceipts: CreatedReceipt[] = [];

    // Process each line
    for (const inputLine of body.lines) {
      const line = lineMap.get(inputLine.purchaseDocLineId)!;
      const qty = parseFloat(inputLine.quantity);

      // Determine unit cost from line
      const unitCost = line.unitPrice ? parseFloat(line.unitPrice) : 0;

      // Determine movement type and warehouse direction based on receiptType
      let movementType: "receipt" | "issue";
      let fromWarehouseId: string | null = null;
      let toWarehouseId: string | null = null;
      let fromLocationId: string | null = null;
      let toLocationId: string | null = null;

      if (body.receiptType === "receive") {
        // receive: receipt movement into warehouse
        movementType = "receipt";
        toWarehouseId = body.warehouseId;
        toLocationId = body.locationId ?? null;
      } else {
        // unreceive or return_to_vendor: issue movement out of warehouse
        movementType = "issue";
        fromWarehouseId = body.warehouseId;
        fromLocationId = body.locationId ?? null;
      }

      const referenceText = body.note
        ? `${body.note} - procurement ${body.receiptType}: ${doc.docNumber}`
        : `Procurement ${body.receiptType}: ${doc.docNumber}`;

      // Create inventory movement
      const [movement] = await db
        .insert(inventoryMovements)
        .values({
          tenantId,
          transactionSetId: txSet.id,
          movementType,
          movementStatus: "posted",
          movementDate: body.movementDate,
          productId: line.productId!,
          fromWarehouseId,
          fromLocationId,
          toWarehouseId,
          toLocationId,
          quantity: qty.toFixed(6),
          unitCost: unitCost.toFixed(6),
          reference: referenceText,
          createdByActorId: actor.actorId,
        })
        .returning();

      // Check for idempotency - if this exact receipt already exists, return it
      const [existingReceipt] = await db
        .select()
        .from(purchaseReceipts)
        .where(
          and(
            eq(purchaseReceipts.tenantId, tenantId),
            eq(purchaseReceipts.purchaseDocLineId, inputLine.purchaseDocLineId),
            eq(purchaseReceipts.movementId, movement.id),
            eq(purchaseReceipts.receiptType, body.receiptType)
          )
        )
        .limit(1);

      if (existingReceipt) {
        // Already exists - return existing receipt without double-updating balances
        createdReceipts.push({
          id: existingReceipt.id,
          purchaseDocLineId: inputLine.purchaseDocLineId,
          movementId: movement.id,
          receiptType: body.receiptType,
          quantity: existingReceipt.quantity,
        });
        continue;
      }

      // Update inventory balance
      const warehouseId = body.warehouseId;
      const locationId = body.locationId ?? null;

      const [existingBalance] = await db
        .select()
        .from(inventoryBalances)
        .where(
          and(
            eq(inventoryBalances.tenantId, tenantId),
            eq(inventoryBalances.productId, line.productId!),
            eq(inventoryBalances.warehouseId, warehouseId),
            locationId
              ? eq(inventoryBalances.locationId, locationId)
              : sql`${inventoryBalances.locationId} IS NULL`
          )
        );

      if (body.receiptType === "receive") {
        // Receive: on_hand += qty, available += qty
        if (existingBalance) {
          await db
            .update(inventoryBalances)
            .set({
              onHand: (parseFloat(existingBalance.onHand) + qty).toFixed(6),
              available: (parseFloat(existingBalance.available) + qty).toFixed(6),
              updatedAt: sql`now()`,
            })
            .where(eq(inventoryBalances.id, existingBalance.id));
        } else {
          // Create new balance record
          await db.insert(inventoryBalances).values({
            tenantId,
            productId: line.productId!,
            warehouseId,
            locationId,
            onHand: qty.toFixed(6),
            reserved: "0",
            available: qty.toFixed(6),
          });
        }
      } else {
        // Unreceive or return_to_vendor: on_hand -= qty, available -= qty
        if (!existingBalance) {
          return NextResponse.json(
            { error: `No inventory balance found for product in line ${inputLine.purchaseDocLineId}` },
            { status: 400 }
          );
        }

        const currentOnHand = parseFloat(existingBalance.onHand);
        if (currentOnHand < qty) {
          return NextResponse.json(
            { error: `Insufficient on-hand quantity. On hand: ${currentOnHand}, requested: ${qty}` },
            { status: 400 }
          );
        }

        await db
          .update(inventoryBalances)
          .set({
            onHand: (currentOnHand - qty).toFixed(6),
            available: (parseFloat(existingBalance.available) - qty).toFixed(6),
            updatedAt: sql`now()`,
          })
          .where(eq(inventoryBalances.id, existingBalance.id));
      }

      // Create purchase receipt record
      const [receipt] = await db
        .insert(purchaseReceipts)
        .values({
          tenantId,
          purchaseDocId,
          purchaseDocLineId: inputLine.purchaseDocLineId,
          movementId: movement.id,
          receiptType: body.receiptType,
          quantity: qty.toFixed(6),
          note: body.note ?? null,
          createdByActorId: actor.actorId,
        })
        .returning();

      await audit.log("purchase_receipt", receipt.id, "purchase_receipt_created", {
        purchaseDocId,
        purchaseDocLineId: inputLine.purchaseDocLineId,
        receiptType: body.receiptType,
        quantity: qty,
        movementId: movement.id,
      });

      createdReceipts.push({
        id: receipt.id,
        purchaseDocLineId: inputLine.purchaseDocLineId,
        movementId: movement.id,
        receiptType: body.receiptType,
        quantity: receipt.quantity,
      });
    }

    // Update transaction set status
    await db
      .update(transactionSets)
      .set({ status: "posted", updatedAt: sql`now()` })
      .where(eq(transactionSets.id, txSet.id));

    return NextResponse.json(
      {
        purchaseDocId,
        receipts: createdReceipts,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/procurement/docs/[id]/receive error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
