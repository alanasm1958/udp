/**
 * /api/ai-tasks
 *
 * Endpoints for AI-generated tasks requiring human confirmation.
 * These tasks are suggestions/detections that should never auto-execute.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { aiTasks, users } from "@/db/schema";
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

    const conditions = [eq(aiTasks.tenantId, tenantId)];

    if (statusFilter) {
      const validStatuses = ["pending", "in_review", "approved", "rejected", "auto_resolved", "expired"];
      if (validStatuses.includes(statusFilter)) {
        conditions.push(eq(aiTasks.status, statusFilter as typeof aiTasks.status.enumValues[number]));
      }
    }

    if (typeFilter) {
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
      if (validTypes.includes(typeFilter)) {
        conditions.push(eq(aiTasks.taskType, typeFilter as typeof aiTasks.taskType.enumValues[number]));
      }
    }

    if (priorityFilter) {
      conditions.push(eq(aiTasks.priority, priorityFilter));
    }

    if (assignedToUserId && isValidUuid(assignedToUserId)) {
      conditions.push(eq(aiTasks.assignedToUserId, assignedToUserId));
    }

    if (primaryEntityType) {
      conditions.push(eq(aiTasks.primaryEntityType, primaryEntityType));
    }

    if (primaryEntityId && isValidUuid(primaryEntityId)) {
      conditions.push(eq(aiTasks.primaryEntityId, primaryEntityId));
    }

    if (searchQuery) {
      const searchPattern = `%${searchQuery}%`;
      conditions.push(
        or(
          ilike(aiTasks.title, searchPattern),
          ilike(aiTasks.description, searchPattern)
        )!
      );
    }

    const tasksList = await db
      .select({
        id: aiTasks.id,
        taskType: aiTasks.taskType,
        status: aiTasks.status,
        title: aiTasks.title,
        description: aiTasks.description,
        reasoning: aiTasks.reasoning,
        confidenceScore: aiTasks.confidenceScore,
        primaryEntityType: aiTasks.primaryEntityType,
        primaryEntityId: aiTasks.primaryEntityId,
        secondaryEntityType: aiTasks.secondaryEntityType,
        secondaryEntityId: aiTasks.secondaryEntityId,
        suggestedAction: aiTasks.suggestedAction,
        assignedToUserId: aiTasks.assignedToUserId,
        priority: aiTasks.priority,
        dueAt: aiTasks.dueAt,
        createdAt: aiTasks.createdAt,
      })
      .from(aiTasks)
      .where(and(...conditions))
      .orderBy(
        sql`CASE
          WHEN ${aiTasks.priority} = 'urgent' THEN 1
          WHEN ${aiTasks.priority} = 'high' THEN 2
          WHEN ${aiTasks.priority} = 'normal' THEN 3
          ELSE 4
        END`,
        desc(aiTasks.createdAt)
      )
      .limit(limit);

    // Get summary counts
    const [counts] = await db
      .select({
        pending: sql<number>`count(*) filter (where ${aiTasks.status} = 'pending')`,
        inReview: sql<number>`count(*) filter (where ${aiTasks.status} = 'in_review')`,
        total: sql<number>`count(*)`,
      })
      .from(aiTasks)
      .where(eq(aiTasks.tenantId, tenantId));

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
        .select({ id: aiTasks.id })
        .from(aiTasks)
        .where(
          and(
            eq(aiTasks.tenantId, tenantId),
            eq(aiTasks.triggerHash, body.triggerHash),
            inArray(aiTasks.status, ["pending", "in_review"])
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
      .insert(aiTasks)
      .values({
        tenantId,
        taskType: body.taskType,
        status: "pending",
        title: body.title,
        description: body.description,
        reasoning: body.reasoning ?? null,
        confidenceScore: body.confidenceScore ? String(body.confidenceScore) : null,
        primaryEntityType: body.primaryEntityType ?? null,
        primaryEntityId: body.primaryEntityId ?? null,
        secondaryEntityType: body.secondaryEntityType ?? null,
        secondaryEntityId: body.secondaryEntityId ?? null,
        suggestedAction: body.suggestedAction ?? {},
        assignedToUserId: body.assignedToUserId ?? null,
        ownerRoleName: body.ownerRoleName ?? null,
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
