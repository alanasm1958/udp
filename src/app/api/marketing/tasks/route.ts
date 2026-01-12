/**
 * /api/marketing/tasks
 *
 * GET: List marketing tasks for current user
 * POST: Create a new marketing task (with anti-spam protection)
 *
 * Task System Rules:
 * - Assignment: MARKETING_USER else SME_OWNER
 * - Anti-spam: One task per action, rate-limited, auto-resolve when fixed
 * - Task triggers: plan_approval, connector_error, stale_data, campaign_launch, campaign_underperforming, onboarding_incomplete
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError, getUserIdFromHeaders, isValidUUID } from "@/lib/tenant";
import { db } from "@/db";
import {
  marketingTasks,
  actors,
} from "@/db/schema";
import { eq, and, desc, inArray, sql, gte } from "drizzle-orm";
import crypto from "crypto";

// Rate limit: max 1 task per trigger type per entity per 24 hours
const RATE_LIMIT_HOURS = 24;

// Generate a hash for deduplication
function generateTriggerHash(
  taskType: string,
  entityId?: string,
  additionalContext?: string
): string {
  const data = `${taskType}:${entityId || "global"}:${additionalContext || ""}`;
  return crypto.createHash("sha256").update(data).digest("hex").substring(0, 32);
}

// Get user with marketing role or fallback to SME owner
// Assignment rule: MARKETING_USER else SME_OWNER
async function findTaskAssignee(tenantId: string): Promise<string | null> {
  // Get first actor for tenant (SME owner - first created user)
  // In production, this would check for marketing role first
  const owner = await db
    .select({ actorId: actors.id })
    .from(actors)
    .where(and(eq(actors.tenantId, tenantId), eq(actors.type, "user")))
    .orderBy(actors.createdAt)
    .limit(1);

  return owner.length > 0 ? owner[0].actorId : null;
}

// Check for rate limiting
async function isRateLimited(
  tenantId: string,
  triggerHash: string
): Promise<{ limited: boolean; existingTask?: typeof marketingTasks.$inferSelect }> {
  const cutoff = new Date(Date.now() - RATE_LIMIT_HOURS * 60 * 60 * 1000);

  const existing = await db
    .select()
    .from(marketingTasks)
    .where(
      and(
        eq(marketingTasks.tenantId, tenantId),
        eq(marketingTasks.triggerHash, triggerHash),
        gte(marketingTasks.lastTriggeredAt, cutoff),
        inArray(marketingTasks.status, ["pending", "in_progress"])
      )
    )
    .limit(1);

  return {
    limited: existing.length > 0,
    existingTask: existing[0],
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userId = getUserIdFromHeaders(req);
    const searchParams = req.nextUrl.searchParams;

    // Query parameters
    const status = searchParams.get("status");
    const taskType = searchParams.get("type");
    const assignedToMe = searchParams.get("assignedToMe") === "true";

    // Build query conditions
    const conditions = [eq(marketingTasks.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(marketingTasks.status, status as typeof marketingTasks.status.enumValues[number]));
    }

    if (taskType) {
      conditions.push(eq(marketingTasks.taskType, taskType as typeof marketingTasks.taskType.enumValues[number]));
    }

    // If filtering by assigned to me, get the actor ID
    if (assignedToMe && userId && isValidUUID(userId)) {
      const actor = await db
        .select({ id: actors.id })
        .from(actors)
        .where(and(eq(actors.tenantId, tenantId), eq(actors.userId, userId)))
        .limit(1);

      if (actor.length > 0) {
        conditions.push(eq(marketingTasks.assignedToActorId, actor[0].id));
      }
    }

    const tasks = await db
      .select()
      .from(marketingTasks)
      .where(and(...conditions))
      .orderBy(marketingTasks.priority, desc(marketingTasks.createdAt))
      .limit(100);

    // Get counts by status
    const statusCounts = await db
      .select({
        status: marketingTasks.status,
        count: sql<number>`count(*)::int`,
      })
      .from(marketingTasks)
      .where(eq(marketingTasks.tenantId, tenantId))
      .groupBy(marketingTasks.status);

    const counts = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
      auto_resolved: 0,
    };
    statusCounts.forEach((s) => {
      counts[s.status as keyof typeof counts] = s.count;
    });

    return NextResponse.json({
      tasks,
      counts,
      total: tasks.length,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/marketing/tasks error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userId = getUserIdFromHeaders(req);

    if (!userId || !isValidUUID(userId)) {
      return NextResponse.json({ error: "Missing or invalid x-user-id header" }, { status: 400 });
    }

    const body = await req.json();
    const {
      taskType,
      title,
      description,
      planId,
      campaignId,
      channelId,
      whyThis,
      expectedOutcome,
      confidenceLevel,
      missingData,
      nextAction,
      actionUrl,
      priority = 2,
      dueAt,
    } = body;

    // Validate required fields
    if (!taskType || !title || !description) {
      return NextResponse.json(
        { error: "taskType, title, and description are required" },
        { status: 400 }
      );
    }

    // Validate taskType
    const validTaskTypes = [
      "plan_approval",
      "connector_error",
      "stale_data",
      "campaign_launch",
      "campaign_underperforming",
      "onboarding_incomplete",
      "budget_review",
      "channel_setup",
    ];
    if (!validTaskTypes.includes(taskType)) {
      return NextResponse.json({ error: "Invalid task type" }, { status: 400 });
    }

    // Generate trigger hash for deduplication
    const entityId = planId || campaignId || channelId;
    const triggerHash = generateTriggerHash(taskType, entityId);

    // Check rate limiting (anti-spam)
    const { limited, existingTask } = await isRateLimited(tenantId, triggerHash);

    if (limited && existingTask) {
      // Update trigger count instead of creating new task
      await db
        .update(marketingTasks)
        .set({
          triggerCount: sql`${marketingTasks.triggerCount} + 1`,
          lastTriggeredAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(marketingTasks.id, existingTask.id));

      return NextResponse.json({
        success: true,
        task: existingTask,
        deduplicated: true,
        message: "Task already exists and was updated",
      });
    }

    // Get or create actor
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

    // Find assignee (MARKETING_USER else SME_OWNER)
    const assignedToActorId = await findTaskAssignee(tenantId);

    // Create the task
    const result = await db
      .insert(marketingTasks)
      .values({
        tenantId,
        taskType: taskType as typeof marketingTasks.taskType.enumValues[number],
        title,
        description,
        status: "pending",
        assignedToActorId,
        assignmentRule: "auto",
        planId: planId && isValidUUID(planId) ? planId : null,
        campaignId: campaignId && isValidUUID(campaignId) ? campaignId : null,
        channelId: channelId && isValidUUID(channelId) ? channelId : null,
        whyThis,
        expectedOutcome,
        confidenceLevel,
        missingData: missingData || [],
        nextAction,
        actionUrl,
        priority,
        dueAt: dueAt ? new Date(dueAt) : null,
        triggerHash,
        lastTriggeredAt: new Date(),
        triggerCount: 1,
        createdByActorId: actorId,
      })
      .returning();

    return NextResponse.json({
      success: true,
      task: result[0],
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/marketing/tasks error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
