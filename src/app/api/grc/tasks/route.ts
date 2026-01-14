/**
 * /api/grc/tasks
 *
 * GET: List GRC tasks (category='compliance')
 * POST: Create a new compliance task
 * Now uses master_tasks table
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";
import { db } from "@/db";
import { masterTasks, grcRequirements, users } from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";

export interface GrcTaskResponse {
  id: string;
  requirementId: string | null;
  requirementTitle: string;
  title: string;
  description: string | null;
  actionType: string | null;
  status: string;
  blockedReason: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  dueDate: string | null;
  completedAt: string | null;
  autoClosed: boolean;
  createdAt: string;
}

/**
 * GET /api/grc/tasks
 * List tasks with optional filters
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status");
    const requirementId = searchParams.get("requirementId");
    const assignedTo = searchParams.get("assignedTo");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Build conditions - filter by category='compliance' for GRC tasks
    const conditions = [
      eq(masterTasks.tenantId, tenantId),
      eq(masterTasks.category, "compliance"),
    ];

    if (status) {
      // Map legacy status values to master_task_status
      const statusMap: Record<string, typeof masterTasks.status.enumValues[number]> = {
        open: "open",
        blocked: "blocked",
        completed: "completed",
      };
      const mappedStatus = statusMap[status] || status;
      conditions.push(eq(masterTasks.status, mappedStatus as typeof masterTasks.status.enumValues[number]));
    }
    if (requirementId) {
      conditions.push(eq(masterTasks.requirementId, requirementId));
    }
    if (assignedTo) {
      conditions.push(eq(masterTasks.assigneeUserId, assignedTo));
    }

    // Query tasks with requirement info
    const tasksData = await db
      .select({
        id: masterTasks.id,
        requirementId: masterTasks.requirementId,
        requirementTitle: grcRequirements.title,
        title: masterTasks.title,
        description: masterTasks.description,
        actionType: masterTasks.actionType,
        status: masterTasks.status,
        blockedReason: masterTasks.blockedReason,
        assignedTo: masterTasks.assigneeUserId,
        assignedToName: users.fullName,
        dueAt: masterTasks.dueAt,
        resolvedAt: masterTasks.resolvedAt,
        autoResolved: masterTasks.autoResolved,
        createdAt: masterTasks.createdAt,
      })
      .from(masterTasks)
      .leftJoin(grcRequirements, eq(masterTasks.requirementId, grcRequirements.id))
      .leftJoin(users, eq(masterTasks.assigneeUserId, users.id))
      .where(and(...conditions))
      .orderBy(desc(masterTasks.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(masterTasks)
      .where(and(...conditions));

    const total = countResult[0]?.count || 0;

    const tasks: GrcTaskResponse[] = tasksData.map((t) => ({
      id: t.id,
      requirementId: t.requirementId,
      requirementTitle: t.requirementTitle || "Unknown Requirement",
      title: t.title,
      description: t.description,
      actionType: t.actionType,
      status: t.status,
      blockedReason: t.blockedReason,
      assignedTo: t.assignedTo,
      assignedToName: t.assignedToName,
      dueDate: t.dueAt?.toISOString().split('T')[0] || null,
      completedAt: t.resolvedAt?.toISOString() || null,
      autoClosed: t.autoResolved || false,
      createdAt: t.createdAt.toISOString(),
    }));

    return NextResponse.json({ tasks, total });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/grc/tasks error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/grc/tasks
 * Create a new task
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const body = await req.json();

    const { requirementId, title, description, actionType, assignedTo, dueDate } = body;

    if (!requirementId || !title) {
      return NextResponse.json(
        { error: "requirementId and title are required" },
        { status: 400 }
      );
    }

    // Verify requirement exists
    const requirement = await db
      .select({ id: grcRequirements.id })
      .from(grcRequirements)
      .where(
        and(
          eq(grcRequirements.id, requirementId),
          eq(grcRequirements.tenantId, tenantId)
        )
      )
      .limit(1);

    if (requirement.length === 0) {
      return NextResponse.json(
        { error: "Requirement not found" },
        { status: 404 }
      );
    }

    // Create task in master_tasks
    const [task] = await db
      .insert(masterTasks)
      .values({
        tenantId,
        category: "compliance",
        domain: "grc",
        requirementId,
        title,
        description: description || null,
        actionType: actionType || null,
        assigneeUserId: assignedTo || null,
        dueAt: dueDate ? new Date(dueDate) : null,
        status: "open",
        priority: "normal",
      })
      .returning();

    // Return in the expected format
    return NextResponse.json({
      task: {
        id: task.id,
        tenantId: task.tenantId,
        requirementId: task.requirementId,
        title: task.title,
        description: task.description,
        actionType: task.actionType,
        status: task.status,
        assignedTo: task.assigneeUserId,
        dueDate: task.dueAt?.toISOString().split('T')[0] || null,
        createdAt: task.createdAt.toISOString(),
      }
    }, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/grc/tasks error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
