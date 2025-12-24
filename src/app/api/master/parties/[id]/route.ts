/**
 * /api/master/parties/[id]
 *
 * Update a specific party by ID
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { parties } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface UpdatePartyRequest {
  displayName?: string;
  legalName?: string;
  notes?: string;
  status?: "active" | "inactive";
}

// Validate UUID format
function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * PATCH /api/master/parties/:id
 * Update a party by ID
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

    // Validate UUID
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid party ID format" }, { status: 400 });
    }

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: UpdatePartyRequest = await req.json();

    // Build update object
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.displayName !== undefined) {
      updates.name = body.displayName;
    }
    if (body.notes !== undefined) {
      updates.notes = body.notes;
    }
    if (body.status !== undefined) {
      updates.isActive = body.status === "active";
    }

    // Check if there are any actual updates
    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const [updated] = await db
      .update(parties)
      .set(updates)
      .where(and(eq(parties.tenantId, tenantId), eq(parties.id, id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    await audit.log("party", updated.id, "party_updated", {
      changes: Object.keys(updates).filter((k) => k !== "updatedAt"),
    });

    return NextResponse.json({ partyId: updated.id });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/master/parties/:id error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
