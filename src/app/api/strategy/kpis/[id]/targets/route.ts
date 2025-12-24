/**
 * /api/strategy/kpis/[id]/targets
 *
 * GET: List targets for a KPI with optional time range filter
 * POST: Create a new target for a KPI
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { kpiTargets, kpiDefinitions } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface CreateKpiTargetRequest {
  periodStart: string;
  periodEnd: string;
  targetValue: string;
  objectiveId?: string;
  initiativeId?: string;
}

/**
 * GET /api/strategy/kpis/[id]/targets
 * List targets for a KPI with optional time range
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id: kpiDefinitionId } = await params;
    const url = new URL(req.url);

    const fromDate = url.searchParams.get("from");
    const toDate = url.searchParams.get("to");
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 200);

    // Verify KPI exists
    const [kpi] = await db
      .select({ id: kpiDefinitions.id })
      .from(kpiDefinitions)
      .where(
        and(
          eq(kpiDefinitions.tenantId, tenantId),
          eq(kpiDefinitions.id, kpiDefinitionId)
        )
      )
      .limit(1);

    if (!kpi) {
      return NextResponse.json({ error: "KPI definition not found" }, { status: 404 });
    }

    const conditions = [
      eq(kpiTargets.tenantId, tenantId),
      eq(kpiTargets.kpiDefinitionId, kpiDefinitionId),
    ];

    if (fromDate) {
      conditions.push(gte(kpiTargets.periodStart, fromDate));
    }

    if (toDate) {
      conditions.push(lte(kpiTargets.periodEnd, toDate));
    }

    const targets = await db
      .select({
        id: kpiTargets.id,
        periodStart: kpiTargets.periodStart,
        periodEnd: kpiTargets.periodEnd,
        targetValue: kpiTargets.targetValue,
        objectiveId: kpiTargets.objectiveId,
        initiativeId: kpiTargets.initiativeId,
        status: kpiTargets.status,
        createdAt: kpiTargets.createdAt,
      })
      .from(kpiTargets)
      .where(and(...conditions))
      .limit(limit);

    return NextResponse.json({ items: targets });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/strategy/kpis/[id]/targets error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/strategy/kpis/[id]/targets
 * Create a new target for a KPI
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const { id: kpiDefinitionId } = await params;
    const body: CreateKpiTargetRequest = await req.json();

    if (!body.periodStart || !body.periodEnd || body.targetValue === undefined) {
      return NextResponse.json(
        { error: "periodStart, periodEnd, and targetValue are required" },
        { status: 400 }
      );
    }

    // Verify KPI exists
    const [kpi] = await db
      .select({ id: kpiDefinitions.id })
      .from(kpiDefinitions)
      .where(
        and(
          eq(kpiDefinitions.tenantId, tenantId),
          eq(kpiDefinitions.id, kpiDefinitionId)
        )
      )
      .limit(1);

    if (!kpi) {
      return NextResponse.json({ error: "KPI definition not found" }, { status: 404 });
    }

    const [target] = await db
      .insert(kpiTargets)
      .values({
        tenantId,
        kpiDefinitionId,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        targetValue: body.targetValue,
        objectiveId: body.objectiveId ?? null,
        initiativeId: body.initiativeId ?? null,
        createdByActorId: actor.actorId,
      })
      .returning();

    await audit.log("kpi_target", target.id, "kpi_target_created", {
      kpiDefinitionId,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      targetValue: body.targetValue,
    });

    return NextResponse.json(target, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/strategy/kpis/[id]/targets error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
