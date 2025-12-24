/**
 * /api/sales/docs/[id]/fulfill
 *
 * POST: Create a fulfillment (reserve, ship, unreserve, return)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  salesDocs,
  salesDocLines,
  salesFulfillments,
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

type FulfillmentType = "reserve" | "ship" | "unreserve" | "return";

interface FulfillRequest {
  salesDocLineId: string;
  warehouseId: string;
  locationId?: string;
  quantity: string;
  fulfillmentType: FulfillmentType;
}

/**
 * POST /api/sales/docs/[id]/fulfill
 * Create a fulfillment record and update inventory
 *
 * reserve: reduces available, increases reserved (no movement posted)
 * ship: reduces on_hand and reserved (issues inventory)
 * unreserve: reduces reserved, increases available (no movement posted)
 * return: increases on_hand (receipt movement)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const { id: salesDocId } = await params;
    const body: FulfillRequest = await req.json();

    // Validate required fields
    if (!body.salesDocLineId || !body.warehouseId || !body.quantity || !body.fulfillmentType) {
      return NextResponse.json(
        { error: "salesDocLineId, warehouseId, quantity, and fulfillmentType are required" },
        { status: 400 }
      );
    }

    const validTypes: FulfillmentType[] = ["reserve", "ship", "unreserve", "return"];
    if (!validTypes.includes(body.fulfillmentType)) {
      return NextResponse.json(
        { error: "fulfillmentType must be one of: reserve, ship, unreserve, return" },
        { status: 400 }
      );
    }

    const qty = parseFloat(body.quantity);
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json({ error: "quantity must be a positive number" }, { status: 400 });
    }

    // Verify sales doc exists
    const [doc] = await db
      .select({ id: salesDocs.id, status: salesDocs.status })
      .from(salesDocs)
      .where(and(eq(salesDocs.tenantId, tenantId), eq(salesDocs.id, salesDocId)))
      .limit(1);

    if (!doc) {
      return NextResponse.json({ error: "Sales document not found" }, { status: 404 });
    }

    // Verify sales doc line exists and belongs to this doc
    const [line] = await db
      .select({ id: salesDocLines.id, productId: salesDocLines.productId })
      .from(salesDocLines)
      .where(
        and(
          eq(salesDocLines.tenantId, tenantId),
          eq(salesDocLines.salesDocId, salesDocId),
          eq(salesDocLines.id, body.salesDocLineId)
        )
      )
      .limit(1);

    if (!line) {
      return NextResponse.json({ error: "Sales document line not found" }, { status: 404 });
    }

    if (!line.productId) {
      return NextResponse.json(
        { error: "Cannot fulfill a line without a product" },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().split("T")[0];

    // Create transaction set for tracking
    const [txSet] = await db
      .insert(transactionSets)
      .values({
        tenantId,
        status: "draft",
        source: "sales_fulfillment",
        createdByActorId: actor.actorId,
        businessDate: today,
        notes: `Sales fulfillment: ${body.fulfillmentType} for doc ${salesDocId}`,
      })
      .returning();

    // Create inventory movement
    // For reserve/unreserve: movement is "adjustment" type (no physical movement)
    // For ship: movement is "issue" type
    // For return: movement is "receipt" type
    let movementType: "issue" | "receipt" | "adjustment";
    let fromWarehouseId: string | null = null;
    let toWarehouseId: string | null = null;

    if (body.fulfillmentType === "ship") {
      movementType = "issue";
      fromWarehouseId = body.warehouseId;
    } else if (body.fulfillmentType === "return") {
      movementType = "receipt";
      toWarehouseId = body.warehouseId;
    } else {
      // reserve and unreserve are tracked as adjustments but don't post
      movementType = "adjustment";
      if (body.fulfillmentType === "reserve") {
        fromWarehouseId = body.warehouseId; // conceptually "from available"
      } else {
        toWarehouseId = body.warehouseId; // conceptually "to available"
      }
    }

    const [movement] = await db
      .insert(inventoryMovements)
      .values({
        tenantId,
        transactionSetId: txSet.id,
        movementType,
        movementStatus: "draft",
        movementDate: today,
        productId: line.productId,
        fromWarehouseId,
        fromLocationId: body.fulfillmentType === "ship" ? (body.locationId ?? null) : null,
        toWarehouseId,
        toLocationId: body.fulfillmentType === "return" ? (body.locationId ?? null) : null,
        quantity: qty.toFixed(6),
        reference: `Sales ${body.fulfillmentType}: ${salesDocId}`,
        createdByActorId: actor.actorId,
      })
      .returning();

    // Update inventory balance based on fulfillment type
    const [existingBalance] = await db
      .select()
      .from(inventoryBalances)
      .where(
        and(
          eq(inventoryBalances.tenantId, tenantId),
          eq(inventoryBalances.productId, line.productId),
          eq(inventoryBalances.warehouseId, body.warehouseId),
          body.locationId
            ? eq(inventoryBalances.locationId, body.locationId)
            : sql`${inventoryBalances.locationId} IS NULL`
        )
      );

    if (!existingBalance && (body.fulfillmentType === "ship" || body.fulfillmentType === "reserve")) {
      return NextResponse.json(
        { error: "No inventory balance found for this product/warehouse" },
        { status: 400 }
      );
    }

    if (body.fulfillmentType === "reserve") {
      // Reserve: available -= qty, reserved += qty
      const currentAvailable = parseFloat(existingBalance.available);
      if (currentAvailable < qty) {
        return NextResponse.json(
          { error: `Insufficient available quantity. Available: ${currentAvailable}` },
          { status: 400 }
        );
      }

      await db
        .update(inventoryBalances)
        .set({
          reserved: (parseFloat(existingBalance.reserved) + qty).toFixed(6),
          available: (currentAvailable - qty).toFixed(6),
          updatedAt: sql`now()`,
        })
        .where(eq(inventoryBalances.id, existingBalance.id));
    } else if (body.fulfillmentType === "ship") {
      // Ship: on_hand -= qty, reserved -= qty
      const currentOnHand = parseFloat(existingBalance.onHand);
      const currentReserved = parseFloat(existingBalance.reserved);

      if (currentOnHand < qty) {
        return NextResponse.json(
          { error: `Insufficient on-hand quantity. On hand: ${currentOnHand}` },
          { status: 400 }
        );
      }

      await db
        .update(inventoryBalances)
        .set({
          onHand: (currentOnHand - qty).toFixed(6),
          reserved: Math.max(0, currentReserved - qty).toFixed(6),
          updatedAt: sql`now()`,
        })
        .where(eq(inventoryBalances.id, existingBalance.id));

      // Mark movement as posted for ship
      await db
        .update(inventoryMovements)
        .set({ movementStatus: "posted" })
        .where(eq(inventoryMovements.id, movement.id));
    } else if (body.fulfillmentType === "unreserve") {
      // Unreserve: reserved -= qty, available += qty
      if (!existingBalance) {
        return NextResponse.json(
          { error: "No inventory balance found for this product/warehouse" },
          { status: 400 }
        );
      }

      const currentReserved = parseFloat(existingBalance.reserved);
      if (currentReserved < qty) {
        return NextResponse.json(
          { error: `Cannot unreserve more than reserved. Reserved: ${currentReserved}` },
          { status: 400 }
        );
      }

      await db
        .update(inventoryBalances)
        .set({
          reserved: (currentReserved - qty).toFixed(6),
          available: (parseFloat(existingBalance.available) + qty).toFixed(6),
          updatedAt: sql`now()`,
        })
        .where(eq(inventoryBalances.id, existingBalance.id));
    } else if (body.fulfillmentType === "return") {
      // Return: on_hand += qty, available += qty
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
          productId: line.productId,
          warehouseId: body.warehouseId,
          locationId: body.locationId ?? null,
          onHand: qty.toFixed(6),
          reserved: "0",
          available: qty.toFixed(6),
        });
      }

      // Mark movement as posted for return
      await db
        .update(inventoryMovements)
        .set({ movementStatus: "posted" })
        .where(eq(inventoryMovements.id, movement.id));
    }

    // Update transaction set status
    await db
      .update(transactionSets)
      .set({ status: "posted", updatedAt: sql`now()` })
      .where(eq(transactionSets.id, txSet.id));

    // Create fulfillment record
    const [fulfillment] = await db
      .insert(salesFulfillments)
      .values({
        tenantId,
        salesDocId,
        salesDocLineId: body.salesDocLineId,
        movementId: movement.id,
        fulfillmentType: body.fulfillmentType,
        quantity: qty.toFixed(6),
        createdByActorId: actor.actorId,
      })
      .returning();

    await audit.log("sales_fulfillment", fulfillment.id, "sales_fulfillment_created", {
      salesDocId,
      salesDocLineId: body.salesDocLineId,
      fulfillmentType: body.fulfillmentType,
      quantity: qty,
      warehouseId: body.warehouseId,
      movementId: movement.id,
    });

    return NextResponse.json(
      {
        id: fulfillment.id,
        salesDocId,
        salesDocLineId: body.salesDocLineId,
        movementId: movement.id,
        fulfillmentType: body.fulfillmentType,
        quantity: fulfillment.quantity,
        transactionSetId: txSet.id,
        createdAt: fulfillment.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/sales/docs/[id]/fulfill error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
