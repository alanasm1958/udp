/**
 * /api/master/products/[id]
 *
 * Update a specific product by ID
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products, parties } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface UpdateProductRequest {
  name?: string;
  status?: "active" | "inactive";
  sku?: string | null;
  description?: string | null;
  defaultSalesPrice?: string | number;
  defaultPurchaseCost?: string | number;
  preferredVendorPartyId?: string | null;
  metadata?: Record<string, unknown>;
}

// Validate UUID format
function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * PATCH /api/master/products/:id
 * Update a product by ID
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid product ID format" }, { status: 400 });
    }

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: UpdateProductRequest = await req.json();

    // Build update object
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.name !== undefined) {
      updates.name = body.name;
    }
    if (body.status !== undefined) {
      updates.status = body.status;
    }
    if (body.sku !== undefined) {
      // Check SKU uniqueness if changing to a non-null value
      if (body.sku !== null) {
        const existingSku = await db
          .select({ id: products.id })
          .from(products)
          .where(
            and(
              eq(products.tenantId, tenantId),
              eq(products.sku, body.sku)
            )
          )
          .limit(1);

        if (existingSku.length > 0 && existingSku[0].id !== id) {
          return NextResponse.json(
            { error: `SKU '${body.sku}' already exists` },
            { status: 409 }
          );
        }
      }
      updates.sku = body.sku;
    }
    if (body.description !== undefined) {
      updates.description = body.description;
    }
    if (body.defaultSalesPrice !== undefined) {
      updates.defaultSalesPrice = String(body.defaultSalesPrice);
    }
    if (body.defaultPurchaseCost !== undefined) {
      updates.defaultPurchaseCost = String(body.defaultPurchaseCost);
    }
    if (body.preferredVendorPartyId !== undefined) {
      if (body.preferredVendorPartyId !== null) {
        if (!isValidUuid(body.preferredVendorPartyId)) {
          return NextResponse.json(
            { error: "Invalid preferredVendorPartyId format" },
            { status: 400 }
          );
        }
        const [vendor] = await db
          .select({ id: parties.id })
          .from(parties)
          .where(
            and(
              eq(parties.tenantId, tenantId),
              eq(parties.id, body.preferredVendorPartyId)
            )
          );
        if (!vendor) {
          return NextResponse.json(
            { error: "Preferred vendor party not found" },
            { status: 404 }
          );
        }
      }
      updates.preferredVendorPartyId = body.preferredVendorPartyId;
    }
    if (body.metadata !== undefined) {
      updates.metadata = body.metadata;
    }

    // Check if there are any actual updates
    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const [updated] = await db
      .update(products)
      .set(updates)
      .where(and(eq(products.tenantId, tenantId), eq(products.id, id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    await audit.log("product", updated.id, "product_updated", {
      changes: Object.keys(updates).filter((k) => k !== "updatedAt"),
    });

    return NextResponse.json({ productId: updated.id });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/master/products/:id error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
