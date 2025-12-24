/**
 * /api/strategy/kpis/[id]/measurements
 *
 * GET: List measurements for a KPI (most recent first)
 * POST: Create a new measurement for a KPI
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { kpiMeasurements, kpiDefinitions } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface CreateKpiMeasurementRequest {
  measuredAt: string;
  value: string;
  source?: string;
  notes?: string;
  objectiveId?: string;
  initiativeId?: string;
}

/**
 * GET /api/strategy/kpis/[id]/measurements
 * List measurements for a KPI (most recent first)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id: kpiDefinitionId } = await params;
    const url = new URL(req.url);

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

    const measurements = await db
      .select({
        id: kpiMeasurements.id,
        measuredAt: kpiMeasurements.measuredAt,
        value: kpiMeasurements.value,
        source: kpiMeasurements.source,
        notes: kpiMeasurements.notes,
        objectiveId: kpiMeasurements.objectiveId,
        initiativeId: kpiMeasurements.initiativeId,
        createdAt: kpiMeasurements.createdAt,
      })
      .from(kpiMeasurements)
      .where(
        and(
          eq(kpiMeasurements.tenantId, tenantId),
          eq(kpiMeasurements.kpiDefinitionId, kpiDefinitionId)
        )
      )
      .orderBy(desc(kpiMeasurements.measuredAt))
      .limit(limit);

    return NextResponse.json({ items: measurements });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/strategy/kpis/[id]/measurements error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/strategy/kpis/[id]/measurements
 * Create a new measurement for a KPI
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
    const body: CreateKpiMeasurementRequest = await req.json();

    if (!body.measuredAt || body.value === undefined) {
      return NextResponse.json(
        { error: "measuredAt and value are required" },
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

    const [measurement] = await db
      .insert(kpiMeasurements)
      .values({
        tenantId,
        kpiDefinitionId,
        measuredAt: new Date(body.measuredAt),
        value: body.value,
        source: body.source ?? null,
        notes: body.notes ?? null,
        objectiveId: body.objectiveId ?? null,
        initiativeId: body.initiativeId ?? null,
        createdByActorId: actor.actorId,
      })
      .returning();

    await audit.log("kpi_measurement", measurement.id, "kpi_measurement_created", {
      kpiDefinitionId,
      measuredAt: body.measuredAt,
      value: body.value,
      source: body.source,
    });

    return NextResponse.json(measurement, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/strategy/kpis/[id]/measurements error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
