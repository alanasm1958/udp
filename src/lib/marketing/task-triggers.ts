/**
 * Marketing Task Trigger Utilities
 *
 * Creates tasks based on specific triggers with anti-spam protection.
 * Auto-resolves tasks when conditions are fixed.
 *
 * Task triggers:
 * - plan_approval: Plan needs approval
 * - connector_error: Connector error or stale data
 * - campaign_launch: Campaign ready to launch
 * - campaign_underperforming: Campaign underperforming
 * - onboarding_incomplete: Onboarding not completed
 * - budget_review: Budget review needed
 * - channel_setup: Channel needs setup
 */

import { db } from "@/db";
import {
  marketingTasks,
  marketingPlans,
  marketingCampaigns,
  marketingChannels,
  marketingUserPreferences,
  actors,
} from "@/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import crypto from "crypto";

type TaskType =
  | "plan_approval"
  | "connector_error"
  | "stale_data"
  | "campaign_launch"
  | "campaign_underperforming"
  | "onboarding_incomplete"
  | "budget_review"
  | "channel_setup";

interface TaskTriggerParams {
  tenantId: string;
  taskType: TaskType;
  title: string;
  description: string;
  whyThis?: string;
  expectedOutcome?: string;
  confidenceLevel?: "high" | "medium" | "low";
  missingData?: string[];
  nextAction?: string;
  actionUrl?: string;
  planId?: string;
  campaignId?: string;
  channelId?: string;
  priority?: 1 | 2 | 3;
  dueAt?: Date;
  createdByActorId?: string;
}

// Generate trigger hash for deduplication
function generateTriggerHash(
  taskType: string,
  entityId?: string,
  additionalContext?: string
): string {
  const data = `${taskType}:${entityId || "global"}:${additionalContext || ""}`;
  return crypto.createHash("sha256").update(data).digest("hex").substring(0, 32);
}

// Find assignee: MARKETING_USER else SME_OWNER
async function findTaskAssignee(tenantId: string): Promise<string | null> {
  // Get first actor for tenant (simplified - in production, check roles)
  const owner = await db
    .select({ actorId: actors.id })
    .from(actors)
    .where(and(eq(actors.tenantId, tenantId), eq(actors.type, "user")))
    .orderBy(actors.createdAt)
    .limit(1);

  return owner.length > 0 ? owner[0].actorId : null;
}

/**
 * Create a marketing task with anti-spam protection
 */
export async function createMarketingTask(params: TaskTriggerParams): Promise<{
  success: boolean;
  task?: typeof marketingTasks.$inferSelect;
  deduplicated?: boolean;
  error?: string;
}> {
  try {
    const entityId = params.planId || params.campaignId || params.channelId;
    const triggerHash = generateTriggerHash(params.taskType, entityId);

    // Check for existing active task with same trigger
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await db
      .select()
      .from(marketingTasks)
      .where(
        and(
          eq(marketingTasks.tenantId, params.tenantId),
          eq(marketingTasks.triggerHash, triggerHash),
          inArray(marketingTasks.status, ["pending", "in_progress"])
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update trigger count (rate-limited update)
      await db
        .update(marketingTasks)
        .set({
          triggerCount: sql`${marketingTasks.triggerCount} + 1`,
          lastTriggeredAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(marketingTasks.id, existing[0].id));

      return {
        success: true,
        task: existing[0],
        deduplicated: true,
      };
    }

    // Find assignee
    const assignedToActorId = await findTaskAssignee(params.tenantId);

    // Create new task
    const result = await db
      .insert(marketingTasks)
      .values({
        tenantId: params.tenantId,
        taskType: params.taskType,
        title: params.title,
        description: params.description,
        status: "pending",
        assignedToActorId,
        assignmentRule: "auto",
        planId: params.planId || null,
        campaignId: params.campaignId || null,
        channelId: params.channelId || null,
        whyThis: params.whyThis,
        expectedOutcome: params.expectedOutcome,
        confidenceLevel: params.confidenceLevel,
        missingData: params.missingData || [],
        nextAction: params.nextAction,
        actionUrl: params.actionUrl,
        priority: params.priority || 2,
        dueAt: params.dueAt,
        triggerHash,
        lastTriggeredAt: new Date(),
        triggerCount: 1,
        createdByActorId: params.createdByActorId,
      })
      .returning();

    return {
      success: true,
      task: result[0],
    };
  } catch (error) {
    console.error("createMarketingTask error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create task",
    };
  }
}

/**
 * Auto-resolve tasks when their conditions are fixed
 */
export async function autoResolveTasks(
  tenantId: string,
  conditions: {
    taskType?: TaskType;
    planId?: string;
    campaignId?: string;
    channelId?: string;
  }
): Promise<{ resolved: number }> {
  try {
    const filters = [
      eq(marketingTasks.tenantId, tenantId),
      inArray(marketingTasks.status, ["pending", "in_progress"]),
    ];

    if (conditions.taskType) {
      filters.push(eq(marketingTasks.taskType, conditions.taskType));
    }
    if (conditions.planId) {
      filters.push(eq(marketingTasks.planId, conditions.planId));
    }
    if (conditions.campaignId) {
      filters.push(eq(marketingTasks.campaignId, conditions.campaignId));
    }
    if (conditions.channelId) {
      filters.push(eq(marketingTasks.channelId, conditions.channelId));
    }

    const result = await db
      .update(marketingTasks)
      .set({
        status: "auto_resolved",
        autoResolved: true,
        resolvedAt: new Date(),
        resolutionNotes: "Automatically resolved when condition was fixed",
        updatedAt: new Date(),
      })
      .where(and(...filters))
      .returning({ id: marketingTasks.id });

    return { resolved: result.length };
  } catch (error) {
    console.error("autoResolveTasks error:", error);
    return { resolved: 0 };
  }
}

/**
 * Trigger task for plan needing approval
 */
export async function triggerPlanApprovalTask(
  tenantId: string,
  plan: { id: string; name: string }
): Promise<void> {
  await createMarketingTask({
    tenantId,
    taskType: "plan_approval",
    title: "Review and approve marketing plan",
    description: `The plan "${plan.name}" has AI-generated recommendations ready for your review.`,
    whyThis: "AI has analyzed your inputs and created a recommended marketing strategy. Your approval is needed to proceed.",
    expectedOutcome: "Once approved, you can create campaigns from this plan.",
    confidenceLevel: "high",
    nextAction: "Review the budget allocations and tactics, then click Approve.",
    actionUrl: `/marketing?tab=planner&planId=${plan.id}`,
    planId: plan.id,
    priority: 1,
  });
}

/**
 * Trigger task for campaign underperforming
 */
export async function triggerCampaignUnderperformingTask(
  tenantId: string,
  campaign: { id: string; name: string; metric: string; value: number; threshold: number }
): Promise<void> {
  await createMarketingTask({
    tenantId,
    taskType: "campaign_underperforming",
    title: `Campaign "${campaign.name}" needs attention`,
    description: `${campaign.metric} (${campaign.value}) is below target (${campaign.threshold}).`,
    whyThis: `This campaign's ${campaign.metric} has dropped below the expected threshold. Action may be needed.`,
    expectedOutcome: "After adjustments, campaign performance should improve within 1-2 weeks.",
    confidenceLevel: "medium",
    missingData: ["Recent performance trends", "Audience engagement data"],
    nextAction: "Review campaign settings and consider pausing or adjusting.",
    actionUrl: `/marketing?tab=campaigns&campaignId=${campaign.id}`,
    campaignId: campaign.id,
    priority: 1,
  });
}

/**
 * Trigger task for onboarding incomplete
 */
export async function triggerOnboardingIncompleteTask(
  tenantId: string,
  actorId?: string
): Promise<void> {
  await createMarketingTask({
    tenantId,
    taskType: "onboarding_incomplete",
    title: "Complete your marketing setup",
    description: "You haven't finished setting up your marketing module. Complete the setup to get personalized recommendations.",
    whyThis: "Completing the onboarding helps us understand your business and provide better marketing recommendations.",
    expectedOutcome: "After completing setup, you'll have a customized marketing plan ready to use.",
    confidenceLevel: "high",
    nextAction: "Click to continue the setup wizard.",
    actionUrl: "/marketing?action=onboarding",
    priority: 2,
    createdByActorId: actorId,
  });
}

/**
 * Trigger task for connector/channel error
 */
export async function triggerConnectorErrorTask(
  tenantId: string,
  channel: { id: string; name: string; error: string }
): Promise<void> {
  await createMarketingTask({
    tenantId,
    taskType: "connector_error",
    title: `Fix connection for ${channel.name}`,
    description: `The ${channel.name} channel has a connection error: ${channel.error}`,
    whyThis: "Without a working connection, we cannot pull performance data from this channel.",
    expectedOutcome: "Reconnecting will restore data sync and improve reporting accuracy.",
    confidenceLevel: "high",
    nextAction: "Reconnect the channel or check your authentication settings.",
    actionUrl: `/marketing?tab=planner&action=addChannel&channelId=${channel.id}`,
    channelId: channel.id,
    priority: 1,
  });
}

/**
 * Trigger task for stale data
 */
export async function triggerStaleDataTask(
  tenantId: string,
  channel: { id: string; name: string; lastSync?: Date }
): Promise<void> {
  const daysSinceSync = channel.lastSync
    ? Math.floor((Date.now() - channel.lastSync.getTime()) / (1000 * 60 * 60 * 24))
    : "unknown";

  await createMarketingTask({
    tenantId,
    taskType: "stale_data",
    title: `Data is stale for ${channel.name}`,
    description: `The ${channel.name} channel hasn't synced data in ${daysSinceSync} days.`,
    whyThis: "Stale data can lead to inaccurate reporting and poor recommendations.",
    expectedOutcome: "After syncing, your dashboard will show current performance metrics.",
    confidenceLevel: "medium",
    missingData: ["Recent performance metrics", "Current spend data"],
    nextAction: "Trigger a manual sync or check the channel connection.",
    actionUrl: `/marketing?tab=planner&channelId=${channel.id}`,
    channelId: channel.id,
    priority: 2,
  });
}

/**
 * Check and trigger onboarding task if needed
 */
export async function checkOnboardingStatus(
  tenantId: string,
  actorId: string
): Promise<{ needsOnboarding: boolean }> {
  // Check if user has completed onboarding
  const prefs = await db
    .select()
    .from(marketingUserPreferences)
    .where(
      and(
        eq(marketingUserPreferences.tenantId, tenantId),
        eq(marketingUserPreferences.actorId, actorId)
      )
    )
    .limit(1);

  // Check if there are any plans (onboarding creates at least one plan)
  const plans = await db
    .select({ id: marketingPlans.id })
    .from(marketingPlans)
    .where(eq(marketingPlans.tenantId, tenantId))
    .limit(1);

  const needsOnboarding =
    (prefs.length === 0 || !prefs[0].onboardingCompleted) && plans.length === 0;

  if (needsOnboarding) {
    await triggerOnboardingIncompleteTask(tenantId, actorId);
  }

  return { needsOnboarding };
}
