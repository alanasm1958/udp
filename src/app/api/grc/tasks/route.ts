/**
 * /api/grc/tasks
 *
 * GET: List GRC tasks (linked to requirements)
 * POST: Create a new task
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";
import { db } from "@/db";
import { grcTasks, grcRequirements, users } from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";

export interface GrcTaskResponse {
  id: string;
  requirementId: string;
  requirementTitle: string;
  title: string;
  description: string | null;
  actionType: string | null;
  status: "open" | "blocked" | "completed";
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

    // Build conditions
    const conditions = [eq(grcTasks.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(grcTasks.status, status as "open" | "blocked" | "completed"));
    }
    if (requirementId) {
      conditions.push(eq(grcTasks.requirementId, requirementId));
    }
    if (assignedTo) {
      conditions.push(eq(grcTasks.assignedTo, assignedTo));
    }

    // Query tasks with requirement info
    const tasksData = await db
      .select({
        id: grcTasks.id,
        requirementId: grcTasks.requirementId,
        requirementTitle: grcRequirements.title,
        title: grcTasks.title,
        description: grcTasks.description,
        actionType: grcTasks.actionType,
        status: grcTasks.status,
        blockedReason: grcTasks.blockedReason,
        assignedTo: grcTasks.assignedTo,
        assignedToName: users.fullName,
        dueDate: grcTasks.dueDate,
        completedAt: grcTasks.completedAt,
        autoClosed: grcTasks.autoClosed,
        createdAt: grcTasks.createdAt,
      })
      .from(grcTasks)
      .leftJoin(grcRequirements, eq(grcTasks.requirementId, grcRequirements.id))
      .leftJoin(users, eq(grcTasks.assignedTo, users.id))
      .where(and(...conditions))
      .orderBy(desc(grcTasks.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(grcTasks)
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
      dueDate: t.dueDate,
      completedAt: t.completedAt?.toISOString() || null,
      autoClosed: t.autoClosed || false,
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

    // Create task
    const [task] = await db
      .insert(grcTasks)
      .values({
        tenantId,
        requirementId,
        title,
        description: description || null,
        actionType: actionType || null,
        assignedTo: assignedTo || null,
        dueDate: dueDate || null,
        status: "open",
      })
      .returning();

    return NextResponse.json({ task }, { status: 201 });
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
