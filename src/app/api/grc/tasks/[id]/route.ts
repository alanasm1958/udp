/**
 * /api/grc/tasks/[id]
 *
 * GET: Get single task
 * PATCH: Update task status, assign, complete
 * DELETE: Remove task
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";
import { db } from "@/db";
import { grcTasks, grcRequirements, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/grc/tasks/:id
 * Get single task with requirement info
 */
export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await params;

    const [task] = await db
      .select({
        id: grcTasks.id,
        requirementId: grcTasks.requirementId,
        requirementTitle: grcRequirements.title,
        requirementCode: grcRequirements.requirementCode,
        title: grcTasks.title,
        description: grcTasks.description,
        actionType: grcTasks.actionType,
        status: grcTasks.status,
        blockedReason: grcTasks.blockedReason,
        assignedTo: grcTasks.assignedTo,
        assignedToName: users.fullName,
        dueDate: grcTasks.dueDate,
        completionEvidence: grcTasks.completionEvidence,
        uploadedDocuments: grcTasks.uploadedDocuments,
        userFeedback: grcTasks.userFeedback,
        completedAt: grcTasks.completedAt,
        autoClosed: grcTasks.autoClosed,
        createdAt: grcTasks.createdAt,
        updatedAt: grcTasks.updatedAt,
      })
      .from(grcTasks)
      .leftJoin(grcRequirements, eq(grcTasks.requirementId, grcRequirements.id))
      .leftJoin(users, eq(grcTasks.assignedTo, users.id))
      .where(
        and(
          eq(grcTasks.id, id),
          eq(grcTasks.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({
      task: {
        ...task,
        completionEvidence: task.completionEvidence as object | null,
        uploadedDocuments: (task.uploadedDocuments as unknown[]) || [],
        completedAt: task.completedAt?.toISOString() || null,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/grc/tasks/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/grc/tasks/:id
 * Update task - status, assignment, completion
 */
export async function PATCH(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await params;
    const body = await req.json();

    // Verify task exists
    const [existing] = await db
      .select({ id: grcTasks.id, status: grcTasks.status })
      .from(grcTasks)
      .where(
        and(
          eq(grcTasks.id, id),
          eq(grcTasks.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Build update
    const updateFields: Record<string, unknown> = {};

    if (body.title !== undefined) updateFields.title = body.title;
    if (body.description !== undefined) updateFields.description = body.description;
    if (body.actionType !== undefined) updateFields.actionType = body.actionType;
    if (body.assignedTo !== undefined) updateFields.assignedTo = body.assignedTo || null;
    if (body.dueDate !== undefined) updateFields.dueDate = body.dueDate || null;
    if (body.blockedReason !== undefined) updateFields.blockedReason = body.blockedReason;
    if (body.userFeedback !== undefined) updateFields.userFeedback = body.userFeedback;
    if (body.completionEvidence !== undefined) updateFields.completionEvidence = body.completionEvidence;
    if (body.uploadedDocuments !== undefined) updateFields.uploadedDocuments = body.uploadedDocuments;

    // Handle status transitions
    if (body.status !== undefined) {
      updateFields.status = body.status;

      if (body.status === "completed") {
        updateFields.completedAt = new Date();
        updateFields.autoClosed = false; // Manual completion
      } else if (body.status === "open" && existing.status === "completed") {
        // Reopening
        updateFields.completedAt = null;
      } else if (body.status === "blocked") {
        if (!body.blockedReason) {
          return NextResponse.json(
            { error: "blockedReason is required when setting status to blocked" },
            { status: 400 }
          );
        }
      }
    }

    updateFields.updatedAt = new Date();

    const [updated] = await db
      .update(grcTasks)
      .set(updateFields)
      .where(eq(grcTasks.id, id))
      .returning();

    return NextResponse.json({
      task: {
        ...updated,
        completionEvidence: updated.completionEvidence as object | null,
        uploadedDocuments: (updated.uploadedDocuments as unknown[]) || [],
        completedAt: updated.completedAt?.toISOString() || null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/grc/tasks/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/grc/tasks/:id
 * Remove task
 */
export async function DELETE(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await params;

    // Verify task exists
    const [existing] = await db
      .select({ id: grcTasks.id })
      .from(grcTasks)
      .where(
        and(
          eq(grcTasks.id, id),
          eq(grcTasks.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await db.delete(grcTasks).where(eq(grcTasks.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("DELETE /api/grc/tasks/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
