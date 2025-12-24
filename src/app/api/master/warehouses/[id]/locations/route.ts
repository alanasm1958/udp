/**
 * /api/master/warehouses/[id]/locations
 *
 * Create storage locations within a warehouse
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { warehouses, storageLocations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface CreateStorageLocationRequest {
  code: string;
  name: string;
  metadata?: Record<string, unknown>;
}

// Validate UUID format
function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * POST /api/master/warehouses/:id/locations
 * Create a new storage location within the warehouse
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: warehouseId } = await params;
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    if (!isValidUuid(warehouseId)) {
      return NextResponse.json({ error: "Invalid warehouse ID format" }, { status: 400 });
    }

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: CreateStorageLocationRequest = await req.json();

    // Validate required fields
    if (!body.code || !body.name) {
      return NextResponse.json(
        { error: "code and name are required" },
        { status: 400 }
      );
    }

    // Verify the warehouse exists for this tenant
    const [warehouse] = await db
      .select({ id: warehouses.id })
      .from(warehouses)
      .where(
        and(
          eq(warehouses.tenantId, tenantId),
          eq(warehouses.id, warehouseId)
        )
      );

    if (!warehouse) {
      return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
    }

    // Check code uniqueness within warehouse
    const [existingCode] = await db
      .select({ id: storageLocations.id })
      .from(storageLocations)
      .where(
        and(
          eq(storageLocations.tenantId, tenantId),
          eq(storageLocations.warehouseId, warehouseId),
          eq(storageLocations.code, body.code)
        )
      );

    if (existingCode) {
      return NextResponse.json(
        { error: `Storage location code '${body.code}' already exists in this warehouse` },
        { status: 409 }
      );
    }

    // Create storage location
    const [location] = await db
      .insert(storageLocations)
      .values({
        tenantId,
        warehouseId,
        code: body.code,
        name: body.name,
        metadata: body.metadata ?? {},
        createdByActorId: actor.actorId,
      })
      .returning();

    await audit.log("storage_location", location.id, "storage_location_created", {
      warehouseId,
      code: body.code,
      name: body.name,
    });

    return NextResponse.json({ storageLocationId: location.id }, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/master/warehouses/:id/locations error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
