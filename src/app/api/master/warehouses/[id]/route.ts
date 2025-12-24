/**
 * /api/master/warehouses/[id]
 *
 * Update a specific warehouse by ID
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { warehouses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface UpdateWarehouseRequest {
  name?: string;
  status?: "active" | "inactive";
  address?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// Validate UUID format
function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * PATCH /api/master/warehouses/:id
 * Update a warehouse by ID
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
      return NextResponse.json({ error: "Invalid warehouse ID format" }, { status: 400 });
    }

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: UpdateWarehouseRequest = await req.json();

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
    if (body.address !== undefined) {
      updates.address = body.address;
    }
    if (body.metadata !== undefined) {
      updates.metadata = body.metadata;
    }

    // Check if there are any actual updates
    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const [updated] = await db
      .update(warehouses)
      .set(updates)
      .where(and(eq(warehouses.tenantId, tenantId), eq(warehouses.id, id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
    }

    await audit.log("warehouse", updated.id, "warehouse_updated", {
      changes: Object.keys(updates).filter((k) => k !== "updatedAt"),
    });

    return NextResponse.json({ warehouseId: updated.id });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/master/warehouses/:id error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
