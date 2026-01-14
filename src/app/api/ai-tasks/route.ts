/**
 * /api/ai-tasks
 *
 * Endpoints for AI-generated tasks requiring human confirmation.
 * These tasks are suggestions/detections that should never auto-execute.
 * Now uses master_tasks table with category='ai_suggestion'
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { masterTasks } from "@/db/schema";
import { eq, and, ilike, or, inArray, desc, sql } from "drizzle-orm";
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

/**
 * GET /api/ai-tasks
 * List AI tasks with filters
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const url = new URL(req.url);

    const statusFilter = url.searchParams.get("status");
    const typeFilter = url.searchParams.get("type");
    const priorityFilter = url.searchParams.get("priority");
    const assignedToUserId = url.searchParams.get("assignedToUserId");
    const primaryEntityType = url.searchParams.get("primaryEntityType");
    const primaryEntityId = url.searchParams.get("primaryEntityId");
    const searchQuery = url.searchParams.get("q");
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 200);

    // Filter by category='ai_suggestion' for AI tasks
    const conditions = [
      eq(masterTasks.tenantId, tenantId),
      eq(masterTasks.category, "ai_suggestion"),
    ];

    if (statusFilter) {
      // Map legacy AI task statuses to master task statuses
      const statusMap: Record<string, typeof masterTasks.status.enumValues[number]> = {
        pending: "open",
        in_review: "in_review",
        approved: "approved",
        rejected: "rejected",
        auto_resolved: "auto_resolved",
        expired: "expired",
      };
      const mappedStatus = statusMap[statusFilter] || statusFilter;
      conditions.push(eq(masterTasks.status, mappedStatus as typeof masterTasks.status.enumValues[number]));
    }

    if (typeFilter) {
      conditions.push(eq(masterTasks.taskType, typeFilter));
    }

    if (priorityFilter) {
      conditions.push(eq(masterTasks.priority, priorityFilter as typeof masterTasks.priority.enumValues[number]));
    }

    if (assignedToUserId && isValidUuid(assignedToUserId)) {
      conditions.push(eq(masterTasks.assigneeUserId, assignedToUserId));
    }

    if (primaryEntityType) {
      conditions.push(eq(masterTasks.relatedEntityType, primaryEntityType));
    }

    if (primaryEntityId && isValidUuid(primaryEntityId)) {
      conditions.push(eq(masterTasks.relatedEntityId, primaryEntityId));
    }

    if (searchQuery) {
      const searchPattern = `%${searchQuery}%`;
      conditions.push(
        or(
          ilike(masterTasks.title, searchPattern),
          ilike(masterTasks.description, searchPattern)
        )!
      );
    }

    const tasksList = await db
      .select({
        id: masterTasks.id,
        taskType: masterTasks.taskType,
        status: masterTasks.status,
        title: masterTasks.title,
        description: masterTasks.description,
        reasoning: masterTasks.reasoning,
        confidenceScore: masterTasks.confidenceScore,
        primaryEntityType: masterTasks.relatedEntityType,
        primaryEntityId: masterTasks.relatedEntityId,
        secondaryEntityType: masterTasks.secondaryEntityType,
        secondaryEntityId: masterTasks.secondaryEntityId,
        suggestedAction: masterTasks.suggestedAction,
        assignedToUserId: masterTasks.assigneeUserId,
        priority: masterTasks.priority,
        dueAt: masterTasks.dueAt,
        createdAt: masterTasks.createdAt,
      })
      .from(masterTasks)
      .where(and(...conditions))
      .orderBy(
        sql`CASE
          WHEN ${masterTasks.priority} = 'urgent' THEN 1
          WHEN ${masterTasks.priority} = 'high' THEN 2
          WHEN ${masterTasks.priority} = 'normal' THEN 3
          ELSE 4
        END`,
        desc(masterTasks.createdAt)
      )
      .limit(limit);

    // Get summary counts for AI tasks only
    const [counts] = await db
      .select({
        pending: sql<number>`count(*) filter (where ${masterTasks.status} = 'open')`,
        inReview: sql<number>`count(*) filter (where ${masterTasks.status} = 'in_review')`,
        total: sql<number>`count(*)`,
      })
      .from(masterTasks)
      .where(and(
        eq(masterTasks.tenantId, tenantId),
        eq(masterTasks.category, "ai_suggestion")
      ));

    return NextResponse.json({
      tasks: tasksList,
      summary: {
        pending: Number(counts?.pending ?? 0),
        inReview: Number(counts?.inReview ?? 0),
        total: Number(counts?.total ?? 0),
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/ai-tasks error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai-tasks
 * Create a new AI task (typically called by system processes)
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body = await req.json();

    // Validate required fields
    if (!body.taskType || !body.title || !body.description) {
      return NextResponse.json(
        { error: "taskType, title, and description are required" },
        { status: 400 }
      );
    }

    const validTypes = [
      "link_person_to_user",
      "merge_duplicate_people",
      "complete_quick_add",
      "assign_item_to_warehouse",
      "approve_purchase_variance",
      "low_stock_reorder",
      "service_job_unassigned",
      "service_job_overdue",
      "supplier_delay_impact",
      "review_substitution",
      "landed_cost_allocation",
    ];

    if (!validTypes.includes(body.taskType)) {
      return NextResponse.json({ error: "Invalid taskType" }, { status: 400 });
    }

    // Check for duplicate via triggerHash
    if (body.triggerHash) {
      const [existing] = await db
        .select({ id: masterTasks.id })
        .from(masterTasks)
        .where(
          and(
            eq(masterTasks.tenantId, tenantId),
            eq(masterTasks.category, "ai_suggestion"),
            eq(masterTasks.triggerHash, body.triggerHash),
            inArray(masterTasks.status, ["open", "in_review"])
          )
        );

      if (existing) {
        return NextResponse.json(
          { error: "Duplicate task already exists", existingTaskId: existing.id },
          { status: 409 }
        );
      }
    }

    const [task] = await db
      .insert(masterTasks)
      .values({
        tenantId,
        category: "ai_suggestion",
        domain: body.domain || "operations",
        taskType: body.taskType,
        status: "open",
        title: body.title,
        description: body.description,
        reasoning: body.reasoning ?? null,
        confidenceScore: body.confidenceScore ? String(body.confidenceScore) : null,
        relatedEntityType: body.primaryEntityType ?? null,
        relatedEntityId: body.primaryEntityId ?? null,
        secondaryEntityType: body.secondaryEntityType ?? null,
        secondaryEntityId: body.secondaryEntityId ?? null,
        suggestedAction: body.suggestedAction ?? {},
        assigneeUserId: body.assignedToUserId ?? null,
        assignedToRole: body.ownerRoleName ?? null,
        priority: body.priority ?? "normal",
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        triggerHash: body.triggerHash ?? null,
        metadata: body.metadata ?? {},
        createdByActorId: actor.actorId,
      })
      .returning();

    await audit.log("ai_task", task.id, "ai_task_created", {
      taskType: body.taskType,
      title: body.title,
    });

    return NextResponse.json({ taskId: task.id }, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/ai-tasks error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
