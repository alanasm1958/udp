/**
 * /api/master/dimensions
 *
 * CRUD endpoints for dimension definitions, values, and entity tagging.
 * Dimensions allow flexible categorization (cost centers, departments, projects, etc.)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { dimensionDefinitions, dimensionValues, entityDimensions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

// Request types
interface CreateDimensionDefinitionRequest {
  code: string;
  name: string;
  description?: string;
  isHierarchical?: boolean;
}

interface CreateDimensionValueRequest {
  dimensionCode: string;
  code: string;
  name: string;
  parentValueId?: string;
  validFrom?: string;
  validTo?: string;
}

interface UpdateDimensionValueRequest {
  id: string;
  name?: string;
  isActive?: boolean;
  validFrom?: string;
  validTo?: string;
}

interface TagEntityRequest {
  entityType: string;
  entityId: string;
  dimensionValueId: string;
}

interface UntagEntityRequest {
  entityType: string;
  entityId: string;
  dimensionValueId: string;
}

// Response types
interface DimensionDefinitionResponse {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isHierarchical: boolean;
  isActive: boolean;
  createdAt: Date;
  values?: DimensionValueResponse[];
}

interface DimensionValueResponse {
  id: string;
  code: string;
  name: string;
  parentValueId: string | null;
  isActive: boolean;
  validFrom: string | null;
  validTo: string | null;
}

/**
 * GET /api/master/dimensions
 * List all dimension definitions with their values
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);

    // Fetch all dimension definitions
    const definitions = await db
      .select()
      .from(dimensionDefinitions)
      .where(eq(dimensionDefinitions.tenantId, tenantId));

    // Fetch all values
    const values = await db
      .select()
      .from(dimensionValues)
      .where(eq(dimensionValues.tenantId, tenantId));

    // Group values by dimension
    const valuesByDimension = new Map<string, DimensionValueResponse[]>();
    for (const val of values) {
      const list = valuesByDimension.get(val.dimensionDefinitionId) ?? [];
      list.push({
        id: val.id,
        code: val.code,
        name: val.name,
        parentValueId: val.parentValueId,
        isActive: val.isActive,
        validFrom: val.validFrom,
        validTo: val.validTo,
      });
      valuesByDimension.set(val.dimensionDefinitionId, list);
    }

    const response: DimensionDefinitionResponse[] = definitions.map((def) => ({
      id: def.id,
      code: def.code,
      name: def.name,
      description: def.description,
      isHierarchical: def.isHierarchical,
      isActive: def.isActive,
      createdAt: def.createdAt,
      values: valuesByDimension.get(def.id) ?? [],
    }));

    return NextResponse.json({ dimensions: response });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/master/dimensions error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/master/dimensions
 * Create a new dimension definition or dimension value
 * Use action: "create_definition" or "create_value" or "tag" or "untag"
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body = await req.json();
    const action = body.action as string;

    if (action === "create_definition") {
      const data = body as CreateDimensionDefinitionRequest & { action: string };

      if (!data.code || !data.name) {
        return NextResponse.json(
          { error: "code and name are required" },
          { status: 400 }
        );
      }

      const [definition] = await db
        .insert(dimensionDefinitions)
        .values({
          tenantId,
          code: data.code,
          name: data.name,
          description: data.description ?? null,
          isHierarchical: data.isHierarchical ?? false,
          createdByActorId: actor.actorId,
        })
        .returning();

      await audit.log("dimension_definition", definition.id, "dimension_definition_created", {
        code: data.code,
        name: data.name,
      });

      return NextResponse.json(
        {
          id: definition.id,
          code: definition.code,
          name: definition.name,
          description: definition.description,
          isHierarchical: definition.isHierarchical,
          isActive: definition.isActive,
          createdAt: definition.createdAt,
        },
        { status: 201 }
      );
    }

    if (action === "create_value") {
      const data = body as CreateDimensionValueRequest & { action: string };

      if (!data.dimensionCode || !data.code || !data.name) {
        return NextResponse.json(
          { error: "dimensionCode, code, and name are required" },
          { status: 400 }
        );
      }

      // Find the dimension definition by code
      const [definition] = await db
        .select()
        .from(dimensionDefinitions)
        .where(
          and(
            eq(dimensionDefinitions.tenantId, tenantId),
            eq(dimensionDefinitions.code, data.dimensionCode)
          )
        );

      if (!definition) {
        return NextResponse.json(
          { error: `Dimension definition '${data.dimensionCode}' not found` },
          { status: 404 }
        );
      }

      const [value] = await db
        .insert(dimensionValues)
        .values({
          tenantId,
          dimensionDefinitionId: definition.id,
          code: data.code,
          name: data.name,
          parentValueId: data.parentValueId ?? null,
          validFrom: data.validFrom ?? null,
          validTo: data.validTo ?? null,
          createdByActorId: actor.actorId,
        })
        .returning();

      await audit.log("dimension_value", value.id, "dimension_value_created", {
        dimensionDefinitionId: definition.id,
        code: data.code,
        name: data.name,
      });

      return NextResponse.json(
        {
          id: value.id,
          dimensionDefinitionId: value.dimensionDefinitionId,
          code: value.code,
          name: value.name,
          parentValueId: value.parentValueId,
          isActive: value.isActive,
          validFrom: value.validFrom,
          validTo: value.validTo,
        },
        { status: 201 }
      );
    }

    if (action === "tag") {
      const data = body as TagEntityRequest & { action: string };

      if (!data.entityType || !data.entityId || !data.dimensionValueId) {
        return NextResponse.json(
          { error: "entityType, entityId, and dimensionValueId are required" },
          { status: 400 }
        );
      }

      const [tag] = await db
        .insert(entityDimensions)
        .values({
          tenantId,
          entityType: data.entityType,
          entityId: data.entityId,
          dimensionValueId: data.dimensionValueId,
          createdByActorId: actor.actorId,
        })
        .returning();

      await audit.log("entity_dimension", tag.id, "entity_dimension_tagged", {
        entityType: data.entityType,
        entityId: data.entityId,
        dimensionValueId: data.dimensionValueId,
      });

      return NextResponse.json(
        {
          id: tag.id,
          entityType: tag.entityType,
          entityId: tag.entityId,
          dimensionValueId: tag.dimensionValueId,
        },
        { status: 201 }
      );
    }

    if (action === "untag") {
      const data = body as UntagEntityRequest & { action: string };

      if (!data.entityType || !data.entityId || !data.dimensionValueId) {
        return NextResponse.json(
          { error: "entityType, entityId, and dimensionValueId are required" },
          { status: 400 }
        );
      }

      const [deleted] = await db
        .delete(entityDimensions)
        .where(
          and(
            eq(entityDimensions.tenantId, tenantId),
            eq(entityDimensions.entityType, data.entityType),
            eq(entityDimensions.entityId, data.entityId),
            eq(entityDimensions.dimensionValueId, data.dimensionValueId)
          )
        )
        .returning();

      if (!deleted) {
        return NextResponse.json({ error: "Tag not found" }, { status: 404 });
      }

      await audit.log("entity_dimension", deleted.id, "entity_dimension_untagged", {
        entityType: data.entityType,
        entityId: data.entityId,
        dimensionValueId: data.dimensionValueId,
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Invalid action. Use: create_definition, create_value, tag, or untag" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/master/dimensions error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/master/dimensions
 * Update an existing dimension value
 */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: UpdateDimensionValueRequest = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Build update object
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.isActive !== undefined) updates.isActive = body.isActive;
    if (body.validFrom !== undefined) updates.validFrom = body.validFrom;
    if (body.validTo !== undefined) updates.validTo = body.validTo;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const [updated] = await db
      .update(dimensionValues)
      .set(updates)
      .where(
        and(eq(dimensionValues.tenantId, tenantId), eq(dimensionValues.id, body.id))
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Dimension value not found" }, { status: 404 });
    }

    await audit.log("dimension_value", updated.id, "dimension_value_updated", {
      changes: Object.keys(updates),
    });

    return NextResponse.json({
      id: updated.id,
      code: updated.code,
      name: updated.name,
      parentValueId: updated.parentValueId,
      isActive: updated.isActive,
      validFrom: updated.validFrom,
      validTo: updated.validTo,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/master/dimensions error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
