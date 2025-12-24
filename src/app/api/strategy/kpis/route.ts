/**
 * /api/strategy/kpis
 *
 * CRUD endpoints for KPI definitions.
 * GET: List KPI definitions with optional filters (q, limit)
 * POST: Create a new KPI definition
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { kpiDefinitions } from "@/db/schema";
import { eq, and, ilike, or } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface CreateKpiDefinitionRequest {
  code: string;
  name: string;
  description?: string;
  unit: string;
  direction: string;
}

/**
 * GET /api/strategy/kpis
 * List KPI definitions for the tenant with optional filters
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const url = new URL(req.url);

    const searchQuery = url.searchParams.get("q");
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 200);

    const conditions = [eq(kpiDefinitions.tenantId, tenantId)];

    if (searchQuery) {
      const searchPattern = `%${searchQuery}%`;
      conditions.push(
        or(ilike(kpiDefinitions.name, searchPattern), ilike(kpiDefinitions.code, searchPattern))!
      );
    }

    const kpiList = await db
      .select({
        id: kpiDefinitions.id,
        code: kpiDefinitions.code,
        name: kpiDefinitions.name,
        description: kpiDefinitions.description,
        unit: kpiDefinitions.unit,
        direction: kpiDefinitions.direction,
        status: kpiDefinitions.status,
        createdAt: kpiDefinitions.createdAt,
      })
      .from(kpiDefinitions)
      .where(and(...conditions))
      .limit(limit);

    return NextResponse.json({ items: kpiList });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/strategy/kpis error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/strategy/kpis
 * Create a new KPI definition
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: CreateKpiDefinitionRequest = await req.json();

    if (!body.code || !body.name || !body.unit || !body.direction) {
      return NextResponse.json(
        { error: "code, name, unit, and direction are required" },
        { status: 400 }
      );
    }

    const [kpi] = await db
      .insert(kpiDefinitions)
      .values({
        tenantId,
        code: body.code,
        name: body.name,
        description: body.description ?? null,
        unit: body.unit,
        direction: body.direction,
        createdByActorId: actor.actorId,
      })
      .returning();

    await audit.log("kpi_definition", kpi.id, "kpi_definition_created", {
      code: body.code,
      name: body.name,
      unit: body.unit,
      direction: body.direction,
    });

    return NextResponse.json(kpi, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/strategy/kpis error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
