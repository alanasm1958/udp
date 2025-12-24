/**
 * /api/strategy/initiatives/[id]
 *
 * PATCH: Update an existing initiative
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { initiatives } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface UpdateInitiativeRequest {
  name?: string;
  description?: string;
  objectiveId?: string;
  ownerPartyId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * PATCH /api/strategy/initiatives/[id]
 * Update an existing initiative
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
    const body: UpdateInitiativeRequest = await req.json();

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.objectiveId !== undefined) updates.objectiveId = body.objectiveId;
    if (body.ownerPartyId !== undefined) updates.ownerPartyId = body.ownerPartyId;
    if (body.status !== undefined) updates.status = body.status;
    if (body.startDate !== undefined) updates.startDate = body.startDate;
    if (body.endDate !== undefined) updates.endDate = body.endDate;

    const [updated] = await db
      .update(initiatives)
      .set(updates)
      .where(and(eq(initiatives.tenantId, tenantId), eq(initiatives.id, id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Initiative not found" }, { status: 404 });
    }

    await audit.log("initiative", updated.id, "initiative_updated", {
      changes: Object.keys(updates).filter((k) => k !== "updatedAt"),
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/strategy/initiatives/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
