import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { masterTasks } from "@/db/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

/**
 * GET /api/operations/tasks
 * Returns operations domain tasks sorted by priority, deadline, created_at
 * Now uses master_tasks table with domain='operations'
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "open";
    const limit = parseInt(searchParams.get("limit") || "20");

    // Priority order: critical > urgent > high > normal > low
    const priorityOrder = sql`CASE
      WHEN ${masterTasks.priority} = 'critical' THEN 1
      WHEN ${masterTasks.priority} = 'urgent' THEN 2
      WHEN ${masterTasks.priority} = 'high' THEN 3
      WHEN ${masterTasks.priority} = 'normal' THEN 4
      WHEN ${masterTasks.priority} = 'low' THEN 5
      ELSE 6
    END`;

    const taskResults = await db
      .select({
        id: masterTasks.id,
        title: masterTasks.title,
        description: masterTasks.description,
        status: masterTasks.status,
        priority: masterTasks.priority,
        dueAt: masterTasks.dueAt,
        createdAt: masterTasks.createdAt,
        category: masterTasks.category,
        taskType: masterTasks.taskType,
        assigneeUserId: masterTasks.assigneeUserId,
        relatedEntityType: masterTasks.relatedEntityType,
        relatedEntityId: masterTasks.relatedEntityId,
      })
      .from(masterTasks)
      .where(
        and(
          eq(masterTasks.tenantId, tenantId),
          eq(masterTasks.domain, "operations"),
          status !== "all" ? eq(masterTasks.status, status as typeof masterTasks.status.enumValues[number]) : undefined
        )
      )
      .orderBy(
        priorityOrder,
        asc(masterTasks.dueAt),
        desc(masterTasks.createdAt)
      )
      .limit(limit);

    return NextResponse.json({
      tasks: taskResults.map((t) => ({
        ...t,
        dueAt: t.dueAt?.toISOString() || null,
        createdAt: t.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Operations tasks error:", error);
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: "Failed to fetch operations tasks" },
      { status: 500 }
    );
  }
}
