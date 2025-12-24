/**
 * /api/master/entity-dimensions
 *
 * Bulk tagging of entities with dimension values
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { dimensionValues, entityDimensions } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface TagEntityRequest {
  entityType: string;
  entityId: string;
  dimensionValueIds: string[];
}

// Validate UUID format
function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * POST /api/master/entity-dimensions
 * Tag an entity with multiple dimension values (idempotent, skips duplicates)
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: TagEntityRequest = await req.json();

    // Validate required fields
    if (!body.entityType || !body.entityId || !body.dimensionValueIds) {
      return NextResponse.json(
        { error: "entityType, entityId, and dimensionValueIds are required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.dimensionValueIds) || body.dimensionValueIds.length === 0) {
      return NextResponse.json(
        { error: "dimensionValueIds must be a non-empty array" },
        { status: 400 }
      );
    }

    // Validate UUIDs
    if (!isValidUuid(body.entityId)) {
      return NextResponse.json({ error: "Invalid entityId format" }, { status: 400 });
    }

    const invalidValueIds = body.dimensionValueIds.filter((id) => !isValidUuid(id));
    if (invalidValueIds.length > 0) {
      return NextResponse.json(
        { error: `Invalid dimensionValueId format: ${invalidValueIds.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify all dimension values exist for this tenant
    const existingValues = await db
      .select({ id: dimensionValues.id })
      .from(dimensionValues)
      .where(
        and(
          eq(dimensionValues.tenantId, tenantId),
          inArray(dimensionValues.id, body.dimensionValueIds)
        )
      );

    const existingValueIds = new Set(existingValues.map((v) => v.id));
    const missingValueIds = body.dimensionValueIds.filter((id) => !existingValueIds.has(id));

    if (missingValueIds.length > 0) {
      return NextResponse.json(
        { error: `Dimension values not found: ${missingValueIds.join(", ")}` },
        { status: 404 }
      );
    }

    // Check which tags already exist
    const existingTags = await db
      .select({ dimensionValueId: entityDimensions.dimensionValueId })
      .from(entityDimensions)
      .where(
        and(
          eq(entityDimensions.tenantId, tenantId),
          eq(entityDimensions.entityType, body.entityType),
          eq(entityDimensions.entityId, body.entityId),
          inArray(entityDimensions.dimensionValueId, body.dimensionValueIds)
        )
      );

    const existingTagIds = new Set(existingTags.map((t) => t.dimensionValueId));
    const newValueIds = body.dimensionValueIds.filter((id) => !existingTagIds.has(id));

    let createdCount = 0;
    const skippedCount = body.dimensionValueIds.length - newValueIds.length;

    // Insert new tags
    if (newValueIds.length > 0) {
      const insertValues = newValueIds.map((dimensionValueId) => ({
        tenantId,
        entityType: body.entityType,
        entityId: body.entityId,
        dimensionValueId,
        createdByActorId: actor.actorId,
      }));

      await db.insert(entityDimensions).values(insertValues);
      createdCount = newValueIds.length;

      // Audit each new tag
      for (const dimensionValueId of newValueIds) {
        await audit.log("entity_dimension", body.entityId, "entity_dimension_tagged", {
          entityType: body.entityType,
          entityId: body.entityId,
          dimensionValueId,
        });
      }
    }

    return NextResponse.json({
      tagged: true,
      createdCount,
      skippedCount,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/master/entity-dimensions error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
