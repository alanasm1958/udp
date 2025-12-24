/**
 * /api/strategy/initiatives
 *
 * CRUD endpoints for initiatives.
 * GET: List initiatives with optional filters (q, objectiveId, limit)
 * POST: Create a new initiative
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { initiatives } from "@/db/schema";
import { eq, and, ilike, or } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface CreateInitiativeRequest {
  code: string;
  name: string;
  description?: string;
  objectiveId?: string;
  ownerPartyId?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * GET /api/strategy/initiatives
 * List initiatives for the tenant with optional filters
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const url = new URL(req.url);

    const searchQuery = url.searchParams.get("q");
    const objectiveIdFilter = url.searchParams.get("objectiveId");
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 200);

    const conditions = [eq(initiatives.tenantId, tenantId)];

    if (objectiveIdFilter) {
      conditions.push(eq(initiatives.objectiveId, objectiveIdFilter));
    }

    if (searchQuery) {
      const searchPattern = `%${searchQuery}%`;
      conditions.push(
        or(ilike(initiatives.name, searchPattern), ilike(initiatives.code, searchPattern))!
      );
    }

    const initiativeList = await db
      .select({
        id: initiatives.id,
        code: initiatives.code,
        name: initiatives.name,
        description: initiatives.description,
        objectiveId: initiatives.objectiveId,
        ownerPartyId: initiatives.ownerPartyId,
        status: initiatives.status,
        startDate: initiatives.startDate,
        endDate: initiatives.endDate,
        createdAt: initiatives.createdAt,
      })
      .from(initiatives)
      .where(and(...conditions))
      .limit(limit);

    return NextResponse.json({ items: initiativeList });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/strategy/initiatives error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/strategy/initiatives
 * Create a new initiative
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: CreateInitiativeRequest = await req.json();

    if (!body.code || !body.name) {
      return NextResponse.json({ error: "code and name are required" }, { status: 400 });
    }

    const [initiative] = await db
      .insert(initiatives)
      .values({
        tenantId,
        code: body.code,
        name: body.name,
        description: body.description ?? null,
        objectiveId: body.objectiveId ?? null,
        ownerPartyId: body.ownerPartyId ?? null,
        startDate: body.startDate ?? null,
        endDate: body.endDate ?? null,
        createdByActorId: actor.actorId,
      })
      .returning();

    await audit.log("initiative", initiative.id, "initiative_created", {
      code: body.code,
      name: body.name,
      objectiveId: body.objectiveId,
    });

    return NextResponse.json(initiative, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/strategy/initiatives error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
