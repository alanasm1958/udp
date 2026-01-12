/**
 * /api/master/items/[id]
 *
 * Get, update, and delete a single item
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  items,
  itemIdentifiers,
  serviceProviders,
  people,
  categories,
  uoms,
  taxCategories,
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

function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/master/items/[id]
 * Get item details with identifiers and service providers
 */
export async function GET(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await context.params;

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });
    }

    const [item] = await db
      .select()
      .from(items)
      .where(and(eq(items.tenantId, tenantId), eq(items.id, id)));

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Fetch identifiers
    const identifiers = await db
      .select({
        id: itemIdentifiers.id,
        type: itemIdentifiers.identifierType,
        value: itemIdentifiers.identifierValue,
        isPrimary: itemIdentifiers.isPrimary,
      })
      .from(itemIdentifiers)
      .where(and(eq(itemIdentifiers.tenantId, tenantId), eq(itemIdentifiers.itemId, id)));

    // Fetch service providers (for service items)
    let providers: Array<{
      id: string;
      personId: string;
      personName: string;
      hourlyRate: string | null;
      fixedRate: string | null;
      isPreferred: boolean;
    }> = [];

    if (item.type === "service") {
      const providerRows = await db
        .select({
          id: serviceProviders.id,
          personId: serviceProviders.personId,
          personName: people.fullName,
          hourlyRate: serviceProviders.hourlyRate,
          fixedRate: serviceProviders.fixedRate,
          isPreferred: serviceProviders.isPreferred,
        })
        .from(serviceProviders)
        .innerJoin(people, eq(people.id, serviceProviders.personId))
        .where(and(eq(serviceProviders.tenantId, tenantId), eq(serviceProviders.itemId, id)));

      providers = providerRows;
    }

    // Fetch category name if exists
    let categoryName: string | null = null;
    if (item.categoryId) {
      const [cat] = await db
        .select({ name: categories.name })
        .from(categories)
        .where(eq(categories.id, item.categoryId));
      categoryName = cat?.name ?? null;
    }

    // Fetch UOM name if exists
    let uomName: string | null = null;
    if (item.defaultUomId) {
      const [uom] = await db
        .select({ name: uoms.name })
        .from(uoms)
        .where(eq(uoms.id, item.defaultUomId));
      uomName = uom?.name ?? null;
    }

    return NextResponse.json({
      ...item,
      categoryName,
      uomName,
      identifiers,
      serviceProviders: providers,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/master/items/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/master/items/[id]
 * Update an item
 */
export async function PUT(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);
    const { id } = await context.params;

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });
    }

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const [existing] = await db
      .select({ id: items.id, type: items.type })
      .from(items)
      .where(and(eq(items.tenantId, tenantId), eq(items.id, id)));

    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const body = await req.json();

    // Build update object
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    // Common fields
    if (body.name !== undefined) updateData.name = body.name;
    if (body.sku !== undefined) updateData.sku = body.sku;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.defaultSalesPrice !== undefined) updateData.defaultSalesPrice = String(body.defaultSalesPrice);
    if (body.defaultPurchaseCost !== undefined) updateData.defaultPurchaseCost = String(body.defaultPurchaseCost);
    if (body.metadata !== undefined) updateData.metadata = body.metadata;

    // Handle category
    if (body.categoryId !== undefined) {
      if (body.categoryId && !isValidUuid(body.categoryId)) {
        return NextResponse.json({ error: "Invalid categoryId format" }, { status: 400 });
      }
      updateData.categoryId = body.categoryId || null;
    }

    // Product-specific
    if (existing.type === "product") {
      if (body.trackInventory !== undefined) updateData.trackInventory = body.trackInventory;
      if (body.reorderPoint !== undefined) updateData.reorderPoint = body.reorderPoint ? String(body.reorderPoint) : null;
      if (body.reorderQuantity !== undefined) updateData.reorderQuantity = body.reorderQuantity ? String(body.reorderQuantity) : null;
      if (body.costingMethod !== undefined) updateData.costingMethod = body.costingMethod;
    }

    // Service-specific
    if (existing.type === "service") {
      if (body.defaultNotificationChannel !== undefined) updateData.defaultNotificationChannel = body.defaultNotificationChannel;
      if (body.notificationFallbackOrder !== undefined) updateData.notificationFallbackOrder = body.notificationFallbackOrder;
      if (body.requiresAcknowledgement !== undefined) updateData.requiresAcknowledgement = body.requiresAcknowledgement;
      if (body.acknowledgementTimeoutHours !== undefined) updateData.acknowledgementTimeoutHours = body.acknowledgementTimeoutHours;
      if (body.notifyAllAssignees !== undefined) updateData.notifyAllAssignees = body.notifyAllAssignees;
      if (body.estimatedHours !== undefined) updateData.estimatedHours = body.estimatedHours ? String(body.estimatedHours) : null;
      if (body.fixedCost !== undefined) updateData.fixedCost = body.fixedCost ? String(body.fixedCost) : null;
    }

    // Consumable-specific
    if (existing.type === "consumable") {
      if (body.expenseCategoryCode !== undefined) updateData.expenseCategoryCode = body.expenseCategoryCode;
    }

    // Asset-specific
    if (existing.type === "asset") {
      if (body.assetCategoryCode !== undefined) updateData.assetCategoryCode = body.assetCategoryCode;
      if (body.depreciationMethod !== undefined) updateData.depreciationMethod = body.depreciationMethod;
      if (body.usefulLifeMonths !== undefined) updateData.usefulLifeMonths = body.usefulLifeMonths;
    }

    const [updated] = await db
      .update(items)
      .set(updateData)
      .where(and(eq(items.tenantId, tenantId), eq(items.id, id)))
      .returning();

    await audit.log("item", id, "item_updated", { changes: Object.keys(updateData) });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PUT /api/master/items/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/master/items/[id]
 * Soft-delete an item (set status to discontinued)
 */
export async function DELETE(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);
    const { id } = await context.params;

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });
    }

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const [existing] = await db
      .select({ id: items.id })
      .from(items)
      .where(and(eq(items.tenantId, tenantId), eq(items.id, id)));

    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    await db
      .update(items)
      .set({ status: "discontinued", updatedAt: new Date() })
      .where(and(eq(items.tenantId, tenantId), eq(items.id, id)));

    await audit.log("item", id, "item_discontinued", {});

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("DELETE /api/master/items/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
