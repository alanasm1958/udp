/**
 * /api/strategy/objectives
 *
 * CRUD endpoints for strategic objectives.
 * GET: List objectives with optional filters (q, limit)
 * POST: Create a new objective
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { objectives } from "@/db/schema";
import { eq, and, ilike, or } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface CreateObjectiveRequest {
  code: string;
  name: string;
  description?: string;
  ownerPartyId?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * GET /api/strategy/objectives
 * List objectives for the tenant with optional filters
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const url = new URL(req.url);

    const searchQuery = url.searchParams.get("q");
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 200);

    const conditions = [eq(objectives.tenantId, tenantId)];

    if (searchQuery) {
      const searchPattern = `%${searchQuery}%`;
      conditions.push(
        or(ilike(objectives.name, searchPattern), ilike(objectives.code, searchPattern))!
      );
    }

    const objectiveList = await db
      .select({
        id: objectives.id,
        code: objectives.code,
        name: objectives.name,
        description: objectives.description,
        ownerPartyId: objectives.ownerPartyId,
        status: objectives.status,
        startDate: objectives.startDate,
        endDate: objectives.endDate,
        createdAt: objectives.createdAt,
      })
      .from(objectives)
      .where(and(...conditions))
      .limit(limit);

    return NextResponse.json({ items: objectiveList });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/strategy/objectives error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/strategy/objectives
 * Create a new objective
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: CreateObjectiveRequest = await req.json();

    if (!body.code || !body.name) {
      return NextResponse.json({ error: "code and name are required" }, { status: 400 });
    }

    const [objective] = await db
      .insert(objectives)
      .values({
        tenantId,
        code: body.code,
        name: body.name,
        description: body.description ?? null,
        ownerPartyId: body.ownerPartyId ?? null,
        startDate: body.startDate ?? null,
        endDate: body.endDate ?? null,
        createdByActorId: actor.actorId,
      })
      .returning();

    await audit.log("objective", objective.id, "objective_created", {
      code: body.code,
      name: body.name,
    });

    return NextResponse.json(objective, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/strategy/objectives error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
