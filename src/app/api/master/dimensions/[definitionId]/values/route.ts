/**
 * /api/master/dimensions/[definitionId]/values
 *
 * Create dimension values under a specific definition
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { dimensionDefinitions, dimensionValues } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface CreateDimensionValueRequest {
  key: string;
  name: string;
  metadata?: Record<string, unknown>;
}

// Validate UUID format
function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * POST /api/master/dimensions/:definitionId/values
 * Create a new dimension value under the specified definition
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ definitionId: string }> }
): Promise<NextResponse> {
  try {
    const { definitionId } = await params;
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    // Validate UUID
    if (!isValidUuid(definitionId)) {
      return NextResponse.json({ error: "Invalid definition ID format" }, { status: 400 });
    }

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: CreateDimensionValueRequest = await req.json();

    // Validate required fields
    if (!body.key || !body.name) {
      return NextResponse.json(
        { error: "key and name are required" },
        { status: 400 }
      );
    }

    // Verify the dimension definition exists for this tenant
    const [definition] = await db
      .select()
      .from(dimensionDefinitions)
      .where(
        and(
          eq(dimensionDefinitions.tenantId, tenantId),
          eq(dimensionDefinitions.id, definitionId)
        )
      );

    if (!definition) {
      return NextResponse.json(
        { error: "Dimension definition not found" },
        { status: 404 }
      );
    }

    // Create the dimension value
    const [value] = await db
      .insert(dimensionValues)
      .values({
        tenantId,
        dimensionDefinitionId: definitionId,
        code: body.key,
        name: body.name,
        createdByActorId: actor.actorId,
      })
      .returning();

    await audit.log("dimension_value", value.id, "dimension_value_created", {
      dimensionDefinitionId: definitionId,
      key: body.key,
      name: body.name,
      metadata: body.metadata,
    });

    return NextResponse.json({ dimensionValueId: value.id }, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/master/dimensions/:definitionId/values error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
