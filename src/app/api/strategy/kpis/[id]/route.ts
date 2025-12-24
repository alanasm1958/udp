/**
 * /api/strategy/kpis/[id]
 *
 * PATCH: Update an existing KPI definition
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { kpiDefinitions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface UpdateKpiDefinitionRequest {
  name?: string;
  description?: string;
  unit?: string;
  direction?: string;
  status?: string;
}

/**
 * PATCH /api/strategy/kpis/[id]
 * Update an existing KPI definition
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const { id } = await params;
    const body: UpdateKpiDefinitionRequest = await req.json();

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.unit !== undefined) updates.unit = body.unit;
    if (body.direction !== undefined) updates.direction = body.direction;
    if (body.status !== undefined) updates.status = body.status;

    const [updated] = await db
      .update(kpiDefinitions)
      .set(updates)
      .where(and(eq(kpiDefinitions.tenantId, tenantId), eq(kpiDefinitions.id, id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "KPI definition not found" }, { status: 404 });
    }

    await audit.log("kpi_definition", updated.id, "kpi_definition_updated", {
      changes: Object.keys(updates).filter((k) => k !== "updatedAt"),
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/strategy/kpis/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
