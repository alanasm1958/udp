/**
 * POST /api/omni/inventory/draft
 *
 * Create a draft inventory movement via the Omni flow.
 * This creates a transaction_set and an inventory_movement record in draft status.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  transactionSets,
  inventoryMovements,
  products,
  warehouses,
  storageLocations,
  uoms,
  documents,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface InventoryDraftRequest {
  movementType: "receipt" | "issue" | "transfer" | "adjustment";
  movementDate: string; // YYYY-MM-DD
  productId: string;
  fromWarehouseId?: string;
  fromLocationId?: string;
  toWarehouseId?: string;
  toLocationId?: string;
  quantity: string | number;
  uomId?: string;
  unitCost?: string | number;
  documentId?: string;
  reference?: string;
}

// Validate UUID format
function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// Validate date format YYYY-MM-DD
function isValidDate(str: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(Date.parse(str));
}

/**
 * POST /api/omni/inventory/draft
 * Create a draft inventory movement
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: InventoryDraftRequest = await req.json();

    // Validate required fields
    if (!body.movementType || !body.movementDate || !body.productId || body.quantity === undefined) {
      return NextResponse.json(
        { error: "movementType, movementDate, productId, and quantity are required" },
        { status: 400 }
      );
    }

    const validMovementTypes = ["receipt", "issue", "transfer", "adjustment"];
    if (!validMovementTypes.includes(body.movementType)) {
      return NextResponse.json(
        { error: "movementType must be one of: receipt, issue, transfer, adjustment" },
        { status: 400 }
      );
    }

    if (!isValidDate(body.movementDate)) {
      return NextResponse.json(
        { error: "movementDate must be in YYYY-MM-DD format" },
        { status: 400 }
      );
    }

    if (!isValidUuid(body.productId)) {
      return NextResponse.json({ error: "Invalid productId format" }, { status: 400 });
    }

    const quantity = parseFloat(String(body.quantity));
    if (isNaN(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: "quantity must be a positive number" },
        { status: 400 }
      );
    }

    // Validate movement type constraints
    if (body.movementType === "receipt") {
      if (!body.toWarehouseId) {
        return NextResponse.json(
          { error: "receipt movement requires toWarehouseId" },
          { status: 400 }
        );
      }
    } else if (body.movementType === "issue") {
      if (!body.fromWarehouseId) {
        return NextResponse.json(
          { error: "issue movement requires fromWarehouseId" },
          { status: 400 }
        );
      }
    } else if (body.movementType === "transfer") {
      if (!body.fromWarehouseId || !body.toWarehouseId) {
        return NextResponse.json(
          { error: "transfer movement requires both fromWarehouseId and toWarehouseId" },
          { status: 400 }
        );
      }
    } else if (body.movementType === "adjustment") {
      if (!body.toWarehouseId && !body.fromWarehouseId) {
        return NextResponse.json(
          { error: "adjustment movement requires at least toWarehouseId or fromWarehouseId" },
          { status: 400 }
        );
      }
    }

    // Validate product exists
    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.tenantId, tenantId), eq(products.id, body.productId)));

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Validate warehouses exist
    if (body.fromWarehouseId) {
      if (!isValidUuid(body.fromWarehouseId)) {
        return NextResponse.json({ error: "Invalid fromWarehouseId format" }, { status: 400 });
      }
      const [wh] = await db
        .select({ id: warehouses.id })
        .from(warehouses)
        .where(and(eq(warehouses.tenantId, tenantId), eq(warehouses.id, body.fromWarehouseId)));
      if (!wh) {
        return NextResponse.json({ error: "From warehouse not found" }, { status: 404 });
      }
    }

    if (body.toWarehouseId) {
      if (!isValidUuid(body.toWarehouseId)) {
        return NextResponse.json({ error: "Invalid toWarehouseId format" }, { status: 400 });
      }
      const [wh] = await db
        .select({ id: warehouses.id })
        .from(warehouses)
        .where(and(eq(warehouses.tenantId, tenantId), eq(warehouses.id, body.toWarehouseId)));
      if (!wh) {
        return NextResponse.json({ error: "To warehouse not found" }, { status: 404 });
      }
    }

    // Validate storage locations if provided
    if (body.fromLocationId) {
      if (!isValidUuid(body.fromLocationId)) {
        return NextResponse.json({ error: "Invalid fromLocationId format" }, { status: 400 });
      }
      const [loc] = await db
        .select({ id: storageLocations.id })
        .from(storageLocations)
        .where(
          and(
            eq(storageLocations.tenantId, tenantId),
            eq(storageLocations.id, body.fromLocationId),
            eq(storageLocations.warehouseId, body.fromWarehouseId!)
          )
        );
      if (!loc) {
        return NextResponse.json({ error: "From location not found or not in from warehouse" }, { status: 404 });
      }
    }

    if (body.toLocationId) {
      if (!isValidUuid(body.toLocationId)) {
        return NextResponse.json({ error: "Invalid toLocationId format" }, { status: 400 });
      }
      const [loc] = await db
        .select({ id: storageLocations.id })
        .from(storageLocations)
        .where(
          and(
            eq(storageLocations.tenantId, tenantId),
            eq(storageLocations.id, body.toLocationId),
            eq(storageLocations.warehouseId, body.toWarehouseId!)
          )
        );
      if (!loc) {
        return NextResponse.json({ error: "To location not found or not in to warehouse" }, { status: 404 });
      }
    }

    // Validate UOM if provided
    if (body.uomId) {
      if (!isValidUuid(body.uomId)) {
        return NextResponse.json({ error: "Invalid uomId format" }, { status: 400 });
      }
      const [uom] = await db
        .select({ id: uoms.id })
        .from(uoms)
        .where(and(eq(uoms.tenantId, tenantId), eq(uoms.id, body.uomId)));
      if (!uom) {
        return NextResponse.json({ error: "UOM not found" }, { status: 404 });
      }
    }

    // Validate document if provided
    if (body.documentId) {
      if (!isValidUuid(body.documentId)) {
        return NextResponse.json({ error: "Invalid documentId format" }, { status: 400 });
      }
      const [doc] = await db
        .select({ id: documents.id })
        .from(documents)
        .where(and(eq(documents.tenantId, tenantId), eq(documents.id, body.documentId)));
      if (!doc) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }
    }

    // Create transaction set in draft
    const [txSet] = await db
      .insert(transactionSets)
      .values({
        tenantId,
        status: "draft",
        source: "inventory",
        createdByActorId: actor.actorId,
        businessDate: body.movementDate,
        notes: `Inventory ${body.movementType}: ${body.reference || ""}`.trim(),
      })
      .returning();

    await audit.log("transaction_set", txSet.id, "transaction_set_created", {
      source: "inventory",
      movementType: body.movementType,
    });

    // Create inventory movement in draft
    const [movement] = await db
      .insert(inventoryMovements)
      .values({
        tenantId,
        transactionSetId: txSet.id,
        movementType: body.movementType,
        movementStatus: "draft",
        movementDate: body.movementDate,
        productId: body.productId,
        fromWarehouseId: body.fromWarehouseId ?? null,
        fromLocationId: body.fromLocationId ?? null,
        toWarehouseId: body.toWarehouseId ?? null,
        toLocationId: body.toLocationId ?? null,
        quantity: String(quantity),
        uomId: body.uomId ?? null,
        unitCost: body.unitCost !== undefined ? String(body.unitCost) : null,
        reference: body.reference ?? null,
        documentId: body.documentId ?? null,
        createdByActorId: actor.actorId,
      })
      .returning();

    await audit.log("inventory_movement", movement.id, "inventory_movement_drafted", {
      transactionSetId: txSet.id,
      movementType: body.movementType,
      productId: body.productId,
      quantity: String(quantity),
    });

    return NextResponse.json(
      {
        transactionSetId: txSet.id,
        movementId: movement.id,
        status: "draft",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/omni/inventory/draft error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
