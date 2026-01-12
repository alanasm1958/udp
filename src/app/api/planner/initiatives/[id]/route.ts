/**
 * /api/planner/initiatives/[id]
 *
 * PATCH: Update an initiative
 * DELETE: Remove an initiative (soft delete by setting status to completed)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError, getUserIdFromHeaders, isValidUUID } from "@/lib/tenant";
import { db } from "@/db";
import { plannerInitiatives, actors } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/planner/initiatives/[id]
 */
export async function PATCH(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userId = getUserIdFromHeaders(req);
    const { id } = await context.params;

    if (!userId || !isValidUUID(userId)) {
      return NextResponse.json({ error: "Missing or invalid x-user-id header" }, { status: 400 });
    }

    if (!isValidUUID(id)) {
      return NextResponse.json({ error: "Invalid initiative ID" }, { status: 400 });
    }

    // Check initiative exists and belongs to tenant
    const existing = await db
      .select()
      .from(plannerInitiatives)
      .where(and(eq(plannerInitiatives.id, id), eq(plannerInitiatives.tenantId, tenantId)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Initiative not found" }, { status: 404 });
    }

    const body = await req.json();
    const { title, description, priority, status, horizon } = body;

    // Get actor
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

    // Build update object
    const updates: Record<string, unknown> = { updatedAt: sql`now()` };
    const changes: Record<string, unknown> = {};

    if (title !== undefined) {
      updates.title = title;
      changes.title = title;
    }
    if (description !== undefined) {
      updates.description = description;
      changes.description = description;
    }
    if (priority !== undefined && ["low", "medium", "high"].includes(priority)) {
      updates.priority = priority;
      changes.priority = priority;
    }
    if (status !== undefined && ["pending", "active", "completed"].includes(status)) {
      updates.status = status;
      changes.status = status;
    }
    if (horizon !== undefined && ["run", "improve", "grow"].includes(horizon)) {
      updates.horizon = horizon;
      changes.horizon = horizon;
    }

    const result = await db
      .update(plannerInitiatives)
      .set(updates)
      .where(and(eq(plannerInitiatives.id, id), eq(plannerInitiatives.tenantId, tenantId)))
      .returning();

    // Determine audit action
    const auditAction = status !== undefined && status !== existing[0].status
      ? "planner_initiative_status_changed"
      : "planner_initiative_updated";

    await logAuditEvent({
      tenantId,
      actorId,
      entityType: "planner_initiative",
      entityId: id,
      action: auditAction,
      metadata: {
        changes,
        previousStatus: existing[0].status,
        newStatus: status || existing[0].status,
      },
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
        updatedAt: result[0].updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/planner/initiatives/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/planner/initiatives/[id]
 * Note: This actually deletes the record since planner initiatives are user-created
 */
export async function DELETE(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await context.params;

    if (!isValidUUID(id)) {
      return NextResponse.json({ error: "Invalid initiative ID" }, { status: 400 });
    }

    // Check initiative exists and belongs to tenant
    const existing = await db
      .select()
      .from(plannerInitiatives)
      .where(and(eq(plannerInitiatives.id, id), eq(plannerInitiatives.tenantId, tenantId)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Initiative not found" }, { status: 404 });
    }

    // Delete the initiative
    await db
      .delete(plannerInitiatives)
      .where(and(eq(plannerInitiatives.id, id), eq(plannerInitiatives.tenantId, tenantId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("DELETE /api/planner/initiatives/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
