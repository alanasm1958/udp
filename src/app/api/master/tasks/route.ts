import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { masterTasks } from "@/db/schema";
import { eq, and, desc, asc, sql, inArray, or, ilike } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

/**
 * GET /api/master/tasks
 * Unified endpoint for all tasks across modules
 *
 * Query params:
 * - status: open|in_progress|blocked|in_review|completed|cancelled|auto_resolved|approved|rejected|expired|all (default: open)
 * - category: standard|compliance|marketing|ai_suggestion|all (default: all)
 * - domain: operations|hr|finance|sales|marketing|all (default: all)
 * - priority: low|normal|high|urgent|critical|all (default: all)
 * - assigneeUserId: UUID to filter by assignee
 * - search: text search in title/description
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 * - sortBy: priority|dueAt|createdAt (default: priority)
 * - sortOrder: asc|desc (default: desc for priority, asc for dueAt)
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status") || "open";
    const category = searchParams.get("category") || "all";
    const domain = searchParams.get("domain") || "all";
    const priority = searchParams.get("priority") || "all";
    const assigneeUserId = searchParams.get("assigneeUserId");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const sortBy = searchParams.get("sortBy") || "priority";

    // Build where conditions
    const conditions = [eq(masterTasks.tenantId, tenantId)];

    if (status !== "all") {
      conditions.push(eq(masterTasks.status, status as typeof masterTasks.status.enumValues[number]));
    }

    if (category !== "all") {
      conditions.push(eq(masterTasks.category, category as typeof masterTasks.category.enumValues[number]));
    }

    if (domain !== "all") {
      conditions.push(eq(masterTasks.domain, domain));
    }

    if (priority !== "all") {
      conditions.push(eq(masterTasks.priority, priority as typeof masterTasks.priority.enumValues[number]));
    }

    if (assigneeUserId) {
      conditions.push(eq(masterTasks.assigneeUserId, assigneeUserId));
    }

    if (search) {
      conditions.push(
        or(
          ilike(masterTasks.title, `%${search}%`),
          ilike(masterTasks.description, `%${search}%`)
        )!
      );
    }

    // Priority order for sorting
    const priorityOrder = sql`CASE
      WHEN ${masterTasks.priority} = 'critical' THEN 1
      WHEN ${masterTasks.priority} = 'urgent' THEN 2
      WHEN ${masterTasks.priority} = 'high' THEN 3
      WHEN ${masterTasks.priority} = 'normal' THEN 4
      WHEN ${masterTasks.priority} = 'low' THEN 5
      ELSE 6
    END`;

    // Determine sort order
    let orderBy;
    switch (sortBy) {
      case "dueAt":
        orderBy = [asc(masterTasks.dueAt), priorityOrder, desc(masterTasks.createdAt)];
        break;
      case "createdAt":
        orderBy = [desc(masterTasks.createdAt)];
        break;
      case "priority":
      default:
        orderBy = [priorityOrder, asc(masterTasks.dueAt), desc(masterTasks.createdAt)];
    }

    // Fetch tasks with assignee info
    const taskResults = await db
      .select({
        id: masterTasks.id,
        category: masterTasks.category,
        domain: masterTasks.domain,
        taskType: masterTasks.taskType,
        title: masterTasks.title,
        description: masterTasks.description,
        status: masterTasks.status,
        priority: masterTasks.priority,
        assigneeUserId: masterTasks.assigneeUserId,
        assignedToRole: masterTasks.assignedToRole,
        dueAt: masterTasks.dueAt,
        expiresAt: masterTasks.expiresAt,
        relatedEntityType: masterTasks.relatedEntityType,
        relatedEntityId: masterTasks.relatedEntityId,
        confidenceScore: masterTasks.confidenceScore,
        reasoning: masterTasks.reasoning,
        actionUrl: masterTasks.actionUrl,
        whyThis: masterTasks.whyThis,
        requirementId: masterTasks.requirementId,
        actionType: masterTasks.actionType,
        blockedReason: masterTasks.blockedReason,
        resolvedAt: masterTasks.resolvedAt,
        autoResolved: masterTasks.autoResolved,
        metadata: masterTasks.metadata,
        createdAt: masterTasks.createdAt,
        updatedAt: masterTasks.updatedAt,
      })
      .from(masterTasks)
      .where(and(...conditions))
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(masterTasks)
      .where(and(...conditions));

    const totalCount = Number(countResult[0]?.count || 0);

    // Get summary counts by status
    const statusCounts = await db
      .select({
        status: masterTasks.status,
        count: sql<number>`count(*)`,
      })
      .from(masterTasks)
      .where(eq(masterTasks.tenantId, tenantId))
      .groupBy(masterTasks.status);

    const summary = {
      total: totalCount,
      byStatus: Object.fromEntries(
        statusCounts.map((s) => [s.status, Number(s.count)])
      ),
    };

    return NextResponse.json({
      tasks: taskResults.map((t) => ({
        ...t,
        dueAt: t.dueAt?.toISOString() || null,
        expiresAt: t.expiresAt?.toISOString() || null,
        resolvedAt: t.resolvedAt?.toISOString() || null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: offset + taskResults.length < totalCount,
      },
      summary,
    });
  } catch (error) {
    console.error("Master tasks GET error:", error);
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/master/tasks
 * Create a new task in any category
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const body = await request.json();

    const {
      category,
      domain,
      taskType,
      title,
      description,
      priority = "normal",
      assigneeUserId,
      assigneeActorId,
      assignedToRole,
      dueAt,
      expiresAt,
      relatedEntityType,
      relatedEntityId,
      secondaryEntityType,
      secondaryEntityId,
      confidenceScore,
      reasoning,
      suggestedAction,
      actionUrl,
      whyThis,
      expectedOutcome,
      requirementId,
      actionType,
      triggerHash,
      metadata,
      createdByActorId,
    } = body;

    // Validate required fields
    if (!category || !domain || !title) {
      return NextResponse.json(
        { error: "category, domain, and title are required" },
        { status: 400 }
      );
    }

    // Check for duplicate by triggerHash if provided
    if (triggerHash) {
      const existing = await db
        .select({ id: masterTasks.id })
        .from(masterTasks)
        .where(
          and(
            eq(masterTasks.tenantId, tenantId),
            eq(masterTasks.triggerHash, triggerHash),
            inArray(masterTasks.status, ["open", "in_progress", "in_review"])
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return NextResponse.json(
          { error: "Duplicate task exists", existingId: existing[0].id },
          { status: 409 }
        );
      }
    }

    const [newTask] = await db
      .insert(masterTasks)
      .values({
        tenantId,
        category,
        domain,
        taskType,
        title,
        description,
        priority,
        assigneeUserId,
        assigneeActorId,
        assignedToRole,
        dueAt: dueAt ? new Date(dueAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        relatedEntityType,
        relatedEntityId,
        secondaryEntityType,
        secondaryEntityId,
        confidenceScore,
        reasoning,
        suggestedAction,
        actionUrl,
        whyThis,
        expectedOutcome,
        requirementId,
        actionType,
        triggerHash,
        metadata: metadata || {},
        createdByActorId,
      })
      .returning();

    return NextResponse.json({ task: newTask }, { status: 201 });
  } catch (error) {
    console.error("Master tasks POST error:", error);
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/master/tasks
 * Update task status or other fields (bulk update by IDs)
 */
export async function PATCH(request: NextRequest) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const body = await request.json();

    const { ids, updates } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "ids array is required" },
        { status: 400 }
      );
    }

    if (!updates || Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "updates object is required" },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    const allowedFields = [
      "status",
      "priority",
      "assigneeUserId",
      "assigneeActorId",
      "assignedToRole",
      "dueAt",
      "resolvedByActorId",
      "resolvedAt",
      "resolutionAction",
      "resolutionNotes",
      "autoResolved",
      "blockedReason",
      "metadata",
    ];

    for (const field of allowedFields) {
      if (field in updates) {
        if (field === "dueAt" || field === "resolvedAt") {
          updateData[field] = updates[field] ? new Date(updates[field]) : null;
        } else {
          updateData[field] = updates[field];
        }
      }
    }

    const updated = await db
      .update(masterTasks)
      .set(updateData)
      .where(
        and(
          eq(masterTasks.tenantId, tenantId),
          inArray(masterTasks.id, ids)
        )
      )
      .returning({ id: masterTasks.id });

    return NextResponse.json({
      updated: updated.length,
      ids: updated.map((t) => t.id),
    });
  } catch (error) {
    console.error("Master tasks PATCH error:", error);
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: "Failed to update tasks" },
      { status: 500 }
    );
  }
}
