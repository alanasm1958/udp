import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tasks, users } from "@/db/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

/**
 * GET /api/operations/tasks
 * Returns operations domain tasks sorted by priority, deadline, created_at
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "open";
    const limit = parseInt(searchParams.get("limit") || "20");

    // Try to fetch tasks - gracefully handle if table structure differs
    try {
      // Priority order: critical > high > medium > low
      const priorityOrder = sql`CASE
        WHEN ${tasks.priority} = 'critical' THEN 1
        WHEN ${tasks.priority} = 'high' THEN 2
        WHEN ${tasks.priority} = 'medium' THEN 3
        WHEN ${tasks.priority} = 'normal' THEN 4
        WHEN ${tasks.priority} = 'low' THEN 5
        ELSE 6
      END`;

      const taskResults = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          description: tasks.description,
          status: tasks.status,
          priority: tasks.priority,
          dueAt: tasks.dueAt,
          createdAt: tasks.createdAt,
        })
        .from(tasks)
        .where(
          and(
            eq(tasks.tenantId, tenantId),
            status !== "all" ? eq(tasks.status, status) : undefined
          )
        )
        .orderBy(
          priorityOrder,
          asc(tasks.dueAt),
          desc(tasks.createdAt)
        )
        .limit(limit);

      return NextResponse.json({
        tasks: taskResults.map((t) => ({
          ...t,
          dueAt: t.dueAt?.toISOString() || null,
          createdAt: t.createdAt.toISOString(),
        })),
      });
    } catch (dbError) {
      // If query fails due to schema mismatch, return empty tasks
      console.error("Tasks query error (schema mismatch?):", dbError);
      return NextResponse.json({ tasks: [] });
    }
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
