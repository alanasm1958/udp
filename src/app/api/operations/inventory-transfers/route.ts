/**
 * /api/operations/inventory-transfers
 *
 * POST: Record an inventory transfer between warehouses
 * Creates a transfer record with audit trail
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { inventoryTransfers, inventoryBalances, transactionSets, inventoryMovements } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface CreateTransferRequest {
  itemId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  transferDate: string;
  quantity: number;
  notes?: string;
}

/**
 * POST /api/operations/inventory-transfers
 * Record an inventory transfer
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: CreateTransferRequest = await req.json();

    if (!body.itemId || !body.fromWarehouseId || !body.toWarehouseId || !body.transferDate || !body.quantity) {
      return NextResponse.json(
        { error: "itemId, fromWarehouseId, toWarehouseId, transferDate, and quantity are required" },
        { status: 400 }
      );
    }

    if (body.fromWarehouseId === body.toWarehouseId) {
      return NextResponse.json(
        { error: "Source and destination warehouses must be different" },
        { status: 400 }
      );
    }

    if (body.quantity <= 0) {
      return NextResponse.json(
        { error: "Quantity must be positive" },
        { status: 400 }
      );
    }

    const transferRef = `TRF-${Date.now().toString(36).toUpperCase()}`;

    // Create a transaction set for this transfer
    const [txSet] = await db
      .insert(transactionSets)
      .values({
        tenantId,
        status: "posted",
        source: "web",
        notes: `Inventory transfer - ${transferRef}`,
        businessDate: body.transferDate,
        createdByActorId: actor.actorId,
      })
      .returning();

    // Create inventory movement (transfer type)
    const [movement] = await db
      .insert(inventoryMovements)
      .values({
        tenantId,
        transactionSetId: txSet.id,
        movementType: "transfer",
        movementStatus: "posted",
        movementDate: body.transferDate,
        productId: body.itemId,
        fromWarehouseId: body.fromWarehouseId,
        toWarehouseId: body.toWarehouseId,
        quantity: body.quantity.toString(),
        reference: transferRef,
        createdByActorId: actor.actorId,
      })
      .returning();

    // Create the transfer record
    const [transfer] = await db
      .insert(inventoryTransfers)
      .values({
        tenantId,
        itemId: body.itemId,
        fromWarehouseId: body.fromWarehouseId,
        toWarehouseId: body.toWarehouseId,
        transferDate: body.transferDate,
        quantity: body.quantity.toString(),
        movementId: movement.id,
        notes: body.notes,
        createdByActorId: actor.actorId,
      })
      .returning();

    // Update source warehouse balance (decrease)
    const sourceBalance = await db
      .select()
      .from(inventoryBalances)
      .where(
        and(
          eq(inventoryBalances.tenantId, tenantId),
          eq(inventoryBalances.productId, body.itemId),
          eq(inventoryBalances.warehouseId, body.fromWarehouseId)
        )
      )
      .limit(1);

    if (sourceBalance.length > 0) {
      await db
        .update(inventoryBalances)
        .set({
          onHand: sql`${inventoryBalances.onHand} - ${body.quantity}`,
          available: sql`${inventoryBalances.available} - ${body.quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(inventoryBalances.id, sourceBalance[0].id));
    }

    // Update destination warehouse balance (increase)
    const destBalance = await db
      .select()
      .from(inventoryBalances)
      .where(
        and(
          eq(inventoryBalances.tenantId, tenantId),
          eq(inventoryBalances.productId, body.itemId),
          eq(inventoryBalances.warehouseId, body.toWarehouseId)
        )
      )
      .limit(1);

    if (destBalance.length > 0) {
      await db
        .update(inventoryBalances)
        .set({
          onHand: sql`${inventoryBalances.onHand} + ${body.quantity}`,
          available: sql`${inventoryBalances.available} + ${body.quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(inventoryBalances.id, destBalance[0].id));
    } else {
      await db.insert(inventoryBalances).values({
        tenantId,
        productId: body.itemId,
        warehouseId: body.toWarehouseId,
        onHand: body.quantity.toString(),
        reserved: "0",
        available: body.quantity.toString(),
      });
    }

    await audit.log("inventory_transfer", transfer.id, "transfer_created", {
      reference: transferRef,
      fromWarehouseId: body.fromWarehouseId,
      toWarehouseId: body.toWarehouseId,
      quantity: body.quantity,
    });

    return NextResponse.json({
      id: transfer.id,
      reference: transferRef,
      quantity: body.quantity,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/operations/inventory-transfers error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
