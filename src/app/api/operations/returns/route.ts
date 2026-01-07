/**
 * /api/operations/returns
 *
 * POST: Record a return from the Record Activity drawer
 * - Customer returns: add stock back
 * - Supplier returns: reduce stock
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { returns, inventoryBalances, transactionSets, inventoryMovements } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface CreateReturnRequest {
  type: "customer_return" | "supplier_return";
  itemId: string;
  warehouseId?: string;
  returnDate: string;
  quantity: number;
  reason?: string;
}

/**
 * POST /api/operations/returns
 * Record a return
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: CreateReturnRequest = await req.json();

    if (!body.type || !body.itemId || !body.returnDate || !body.quantity) {
      return NextResponse.json(
        { error: "type, itemId, returnDate, and quantity are required" },
        { status: 400 }
      );
    }

    if (!["customer_return", "supplier_return"].includes(body.type)) {
      return NextResponse.json(
        { error: "type must be customer_return or supplier_return" },
        { status: 400 }
      );
    }

    if (body.quantity <= 0) {
      return NextResponse.json(
        { error: "Quantity must be positive" },
        { status: 400 }
      );
    }

    const returnRef = `RET-${Date.now().toString(36).toUpperCase()}`;

    // Customer return = add to stock (receipt)
    // Supplier return = remove from stock (issue)
    const isCustomerReturn = body.type === "customer_return";
    const stockDelta = isCustomerReturn ? body.quantity : -body.quantity;

    // Create a transaction set for this return
    const [txSet] = await db
      .insert(transactionSets)
      .values({
        tenantId,
        status: "posted",
        source: "web",
        notes: `${isCustomerReturn ? "Customer" : "Supplier"} return - ${returnRef}`,
        businessDate: body.returnDate,
        createdByActorId: actor.actorId,
      })
      .returning();

    // Create inventory movement
    const [movement] = await db
      .insert(inventoryMovements)
      .values({
        tenantId,
        transactionSetId: txSet.id,
        movementType: isCustomerReturn ? "receipt" : "issue",
        movementStatus: "posted",
        movementDate: body.returnDate,
        productId: body.itemId,
        toWarehouseId: isCustomerReturn ? body.warehouseId : null,
        fromWarehouseId: isCustomerReturn ? null : body.warehouseId,
        quantity: body.quantity.toString(),
        reference: returnRef,
        createdByActorId: actor.actorId,
      })
      .returning();

    // Create the return record
    const [returnRecord] = await db
      .insert(returns)
      .values({
        tenantId,
        type: body.type,
        itemId: body.itemId,
        warehouseId: body.warehouseId || null,
        returnDate: body.returnDate,
        quantity: body.quantity.toString(),
        reason: body.reason,
        movementId: movement.id,
        createdByActorId: actor.actorId,
      })
      .returning();

    // Update inventory balance if warehouse specified
    if (body.warehouseId) {
      const existing = await db
        .select()
        .from(inventoryBalances)
        .where(
          and(
            eq(inventoryBalances.tenantId, tenantId),
            eq(inventoryBalances.productId, body.itemId),
            eq(inventoryBalances.warehouseId, body.warehouseId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(inventoryBalances)
          .set({
            onHand: sql`${inventoryBalances.onHand} + ${stockDelta}`,
            available: sql`${inventoryBalances.available} + ${stockDelta}`,
            updatedAt: new Date(),
          })
          .where(eq(inventoryBalances.id, existing[0].id));
      } else if (stockDelta > 0) {
        // Only create balance if adding stock
        await db.insert(inventoryBalances).values({
          tenantId,
          productId: body.itemId,
          warehouseId: body.warehouseId,
          onHand: stockDelta.toString(),
          reserved: "0",
          available: stockDelta.toString(),
        });
      }
    }

    await audit.log("return", returnRecord.id, "return_created", {
      reference: returnRef,
      type: body.type,
      quantity: body.quantity,
      warehouseId: body.warehouseId,
    });

    return NextResponse.json({
      id: returnRecord.id,
      reference: returnRef,
      type: body.type,
      quantity: body.quantity,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/operations/returns error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
