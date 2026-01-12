/**
 * /api/marketing/tasks/[id]
 *
 * GET: Get a single task
 * PATCH: Update task (status, assignment, resolution)
 * DELETE: Cancel/remove task
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError, getUserIdFromHeaders, isValidUUID } from "@/lib/tenant";
import { db } from "@/db";
import { marketingTasks, actors } from "@/db/schema";
import { eq, and } from "drizzle-orm";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await context.params;

    if (!isValidUUID(id)) {
      return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
    }

    const task = await db
      .select()
      .from(marketingTasks)
      .where(and(eq(marketingTasks.tenantId, tenantId), eq(marketingTasks.id, id)))
      .limit(1);

    if (task.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ task: task[0] });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/marketing/tasks/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userId = getUserIdFromHeaders(req);
    const { id } = await context.params;

    if (!userId || !isValidUUID(userId)) {
      return NextResponse.json({ error: "Missing or invalid x-user-id header" }, { status: 400 });
    }

    if (!isValidUUID(id)) {
      return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
    }

    // Verify task exists
    const existing = await db
      .select()
      .from(marketingTasks)
      .where(and(eq(marketingTasks.tenantId, tenantId), eq(marketingTasks.id, id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      status,
      assignedToActorId,
      resolutionNotes,
      autoResolved,
    } = body;

    // Get actor for the user
    let actor = await db
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
    const updateData: Partial<typeof marketingTasks.$inferInsert> = {
      updatedAt: new Date(),
    };

    // Validate and set status
    if (status) {
      const validStatuses = ["pending", "in_progress", "completed", "cancelled", "auto_resolved"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      updateData.status = status as typeof marketingTasks.status.enumValues[number];

      // If completing, set resolution info
      if (status === "completed" || status === "cancelled" || status === "auto_resolved") {
        updateData.resolvedByActorId = actorId;
        updateData.resolvedAt = new Date();
        updateData.autoResolved = autoResolved === true;
      }
    }

    // Update assignment
    if (assignedToActorId !== undefined) {
      if (assignedToActorId === null) {
        updateData.assignedToActorId = null;
        updateData.assignmentRule = "manual";
      } else if (isValidUUID(assignedToActorId)) {
        updateData.assignedToActorId = assignedToActorId;
        updateData.assignmentRule = "manual";
      }
    }

    // Set resolution notes
    if (resolutionNotes !== undefined) {
      updateData.resolutionNotes = resolutionNotes;
    }

    const result = await db
      .update(marketingTasks)
      .set(updateData)
      .where(eq(marketingTasks.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      task: result[0],
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/marketing/tasks/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userId = getUserIdFromHeaders(req);
    const { id } = await context.params;

    if (!userId || !isValidUUID(userId)) {
      return NextResponse.json({ error: "Missing or invalid x-user-id header" }, { status: 400 });
    }

    if (!isValidUUID(id)) {
      return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
    }

    // Verify task exists
    const existing = await db
      .select()
      .from(marketingTasks)
      .where(and(eq(marketingTasks.tenantId, tenantId), eq(marketingTasks.id, id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Soft delete by setting status to cancelled
    const result = await db
      .update(marketingTasks)
      .set({
        status: "cancelled",
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(marketingTasks.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      task: result[0],
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("DELETE /api/marketing/tasks/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
