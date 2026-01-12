/**
 * /api/ai-tasks/[id]
 *
 * Get and resolve individual AI tasks
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { aiTasks, people, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

type AITaskStatus = "pending" | "in_review" | "approved" | "rejected" | "auto_resolved" | "expired";

/**
 * GET /api/ai-tasks/[id]
 * Get AI task details
 */
export async function GET(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await context.params;

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
    }

    const [task] = await db
      .select()
      .from(aiTasks)
      .where(and(eq(aiTasks.tenantId, tenantId), eq(aiTasks.id, id)));

    if (!task) {
      return NextResponse.json({ error: "AI task not found" }, { status: 404 });
    }

    // Fetch related entity details based on type
    let primaryEntityDetails: Record<string, unknown> | null = null;
    let secondaryEntityDetails: Record<string, unknown> | null = null;

    if (task.primaryEntityType === "person" && task.primaryEntityId) {
      const [person] = await db
        .select({
          id: people.id,
          fullName: people.fullName,
          primaryEmail: people.primaryEmail,
          primaryPhone: people.primaryPhone,
        })
        .from(people)
        .where(eq(people.id, task.primaryEntityId));
      primaryEntityDetails = person ?? null;
    }

    if (task.secondaryEntityType === "person" && task.secondaryEntityId) {
      const [person] = await db
        .select({
          id: people.id,
          fullName: people.fullName,
          primaryEmail: people.primaryEmail,
          primaryPhone: people.primaryPhone,
        })
        .from(people)
        .where(eq(people.id, task.secondaryEntityId));
      secondaryEntityDetails = person ?? null;
    }

    if (task.secondaryEntityType === "user" && task.secondaryEntityId) {
      const [user] = await db
        .select({
          id: users.id,
          fullName: users.fullName,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, task.secondaryEntityId));
      secondaryEntityDetails = user ?? null;
    }

    // Fetch assignee details
    let assigneeName: string | null = null;
    if (task.assignedToUserId) {
      const [user] = await db
        .select({ fullName: users.fullName })
        .from(users)
        .where(eq(users.id, task.assignedToUserId));
      assigneeName = user?.fullName ?? null;
    }

    return NextResponse.json({
      ...task,
      primaryEntityDetails,
      secondaryEntityDetails,
      assigneeName,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/ai-tasks/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/ai-tasks/[id]
 * Update AI task (resolve, reject, assign, etc.)
 */
export async function PUT(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);
    const { id } = await context.params;

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
    }

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const [existing] = await db
      .select()
      .from(aiTasks)
      .where(and(eq(aiTasks.tenantId, tenantId), eq(aiTasks.id, id)));

    if (!existing) {
      return NextResponse.json({ error: "AI task not found" }, { status: 404 });
    }

    const body = await req.json();
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    // Handle resolution
    if (body.resolution) {
      const validResolutions = ["approved", "rejected"];
      if (!validResolutions.includes(body.resolution)) {
        return NextResponse.json({ error: "Invalid resolution. Must be 'approved' or 'rejected'" }, { status: 400 });
      }

      // Check if task is resolvable
      if (!["pending", "in_review"].includes(existing.status)) {
        return NextResponse.json(
          { error: `Cannot resolve task with status '${existing.status}'` },
          { status: 400 }
        );
      }

      updateData.status = body.resolution as AITaskStatus;
      updateData.resolvedAt = new Date();
      updateData.resolvedByActorId = actor.actorId;
      updateData.resolutionAction = body.resolution;
      updateData.resolutionNotes = body.resolutionNotes ?? null;

      // Execute action if approved
      if (body.resolution === "approved" && existing.taskType === "link_person_to_user") {
        const action = existing.suggestedAction as { personId?: string; userId?: string };
        if (action.personId && action.userId) {
          await db
            .update(people)
            .set({ linkedUserId: action.userId, updatedAt: new Date() })
            .where(and(eq(people.tenantId, tenantId), eq(people.id, action.personId)));

          await audit.log("person", action.personId, "person_linked_to_user", {
            userId: action.userId,
            taskId: id,
          });
        }
      }

      if (body.resolution === "approved" && existing.taskType === "complete_quick_add") {
        const action = existing.suggestedAction as { personId?: string };
        if (action.personId) {
          await db
            .update(people)
            .set({
              isQuickAdd: false,
              quickAddCompletedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(and(eq(people.tenantId, tenantId), eq(people.id, action.personId)));
        }
      }
    }

    // Handle status change (for in_review)
    if (body.status && !body.resolution) {
      if (body.status === "in_review" && existing.status === "pending") {
        updateData.status = "in_review";
      }
    }

    // Handle assignment
    if (body.assignedToUserId !== undefined) {
      if (body.assignedToUserId && !isValidUuid(body.assignedToUserId)) {
        return NextResponse.json({ error: "Invalid assignedToUserId format" }, { status: 400 });
      }
      if (body.assignedToUserId) {
        const [user] = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.tenantId, tenantId), eq(users.id, body.assignedToUserId)));
        if (!user) {
          return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
      }
      updateData.assignedToUserId = body.assignedToUserId || null;
    }

    // Handle priority change
    if (body.priority !== undefined) {
      const validPriorities = ["low", "normal", "high", "urgent"];
      if (validPriorities.includes(body.priority)) {
        updateData.priority = body.priority;
      }
    }

    // Handle metadata update
    if (body.metadata !== undefined) {
      updateData.metadata = body.metadata;
    }

    const [updated] = await db
      .update(aiTasks)
      .set(updateData)
      .where(and(eq(aiTasks.tenantId, tenantId), eq(aiTasks.id, id)))
      .returning();

    await audit.log("ai_task", id, "ai_task_updated", {
      changes: Object.keys(updateData),
      resolution: body.resolution,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PUT /api/ai-tasks/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
