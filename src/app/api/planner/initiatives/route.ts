/**
 * /api/planner/initiatives
 *
 * GET: List initiatives for a domain and horizon
 * POST: Create a new initiative
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError, getUserIdFromHeaders, isValidUUID } from "@/lib/tenant";
import { db } from "@/db";
import { plannerInitiatives, actors } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit";

/**
 * GET /api/planner/initiatives?domain=company&horizon=run
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { searchParams } = new URL(req.url);
    const domain = searchParams.get("domain");
    const horizon = searchParams.get("horizon");

    if (!domain) {
      return NextResponse.json({ error: "Missing required parameter: domain" }, { status: 400 });
    }

    const conditions = [eq(plannerInitiatives.tenantId, tenantId), eq(plannerInitiatives.domain, domain)];

    if (horizon && ["run", "improve", "grow"].includes(horizon)) {
      conditions.push(eq(plannerInitiatives.horizon, horizon as "run" | "improve" | "grow"));
    }

    const items = await db
      .select()
      .from(plannerInitiatives)
      .where(and(...conditions))
      .orderBy(desc(plannerInitiatives.createdAt));

    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        domain: item.domain,
        horizon: item.horizon,
        title: item.title,
        description: item.description,
        priority: item.priority,
        status: item.status,
        playbookId: item.playbookId,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      total: items.length,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/planner/initiatives error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/planner/initiatives
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userId = getUserIdFromHeaders(req);

    if (!userId || !isValidUUID(userId)) {
      return NextResponse.json({ error: "Missing or invalid x-user-id header" }, { status: 400 });
    }

    const body = await req.json();
    const { domain, horizon, title, description, priority, playbookId } = body;

    if (!domain || !horizon || !title) {
      return NextResponse.json({ error: "Missing required fields: domain, horizon, title" }, { status: 400 });
    }

    if (!["run", "improve", "grow"].includes(horizon)) {
      return NextResponse.json({ error: "Invalid horizon. Must be: run, improve, or grow" }, { status: 400 });
    }

    // Get or create actor for user
    const actor = await db
      .select()
      .from(actors)
      .where(and(eq(actors.tenantId, tenantId), eq(actors.userId, userId)))
      .limit(1);

    let actorId: string;
    if (actor.length === 0) {
      const newActor = await db
        .insert(actors)
        .values({ tenantId, type: "user", userId })
        .returning({ id: actors.id });
      actorId = newActor[0].id;
    } else {
      actorId = actor[0].id;
    }

    // If playbookId is provided, check for duplicates
    if (playbookId) {
      const existing = await db
        .select({ id: plannerInitiatives.id })
        .from(plannerInitiatives)
        .where(
          and(
            eq(plannerInitiatives.tenantId, tenantId),
            eq(plannerInitiatives.domain, domain),
            eq(plannerInitiatives.horizon, horizon),
            eq(plannerInitiatives.playbookId, playbookId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return NextResponse.json({
          success: false,
          error: "Initiative from this playbook already exists for this horizon",
          existingId: existing[0].id,
        });
      }
    }

    const result = await db
      .insert(plannerInitiatives)
      .values({
        tenantId,
        domain,
        horizon,
        title,
        description: description || null,
        priority: priority || "medium",
        status: "pending",
        playbookId: playbookId || null,
        createdByActorId: actorId,
      })
      .returning();

    // Audit log
    await logAuditEvent({
      tenantId,
      actorId,
      entityType: "planner_initiative",
      entityId: result[0].id,
      action: "planner_initiative_created",
      metadata: { domain, horizon, title, playbookId },
    });

    return NextResponse.json({
      success: true,
      initiative: {
        id: result[0].id,
        domain: result[0].domain,
        horizon: result[0].horizon,
        title: result[0].title,
        description: result[0].description,
        priority: result[0].priority,
        status: result[0].status,
        playbookId: result[0].playbookId,
        createdAt: result[0].createdAt,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/planner/initiatives error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
