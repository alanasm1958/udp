/**
 * /api/marketing/plans/[id]/scenarios
 *
 * GET: List what-if scenarios for a plan
 * POST: Create and calculate a new what-if scenario
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError, getUserIdFromHeaders, isValidUUID } from "@/lib/tenant";
import { db } from "@/db";
import { marketingWhatIfScenarios, marketingPlans, actors } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Calculate scenario impact
function calculateScenarioImpact(
  scenarioType: string,
  parameters: Record<string, unknown>,
  currentPlan: typeof marketingPlans.$inferSelect
) {
  const currentBudget = Number(currentPlan.budgetTotal || 1000);
  const currentAllocations = (currentPlan.budgetAllocations as Array<{ channelName: string; amount: number }>) || [];

  let projectedOutcome = "";
  let budgetImpact = 0;
  let roiChange = 0;
  let recommendedAction = "";
  let reasoning = "";

  switch (scenarioType) {
    case "budget_change": {
      const params = parameters as { budgetChange?: { amount?: number; percentage?: number } };
      const change = params.budgetChange || {};

      if (change.percentage) {
        budgetImpact = currentBudget * (change.percentage / 100);
      } else if (change.amount) {
        budgetImpact = change.amount - currentBudget;
      }

      const newBudget = currentBudget + budgetImpact;
      const percentChange = ((newBudget - currentBudget) / currentBudget) * 100;

      if (budgetImpact > 0) {
        projectedOutcome = `Increasing budget by ${Math.abs(percentChange).toFixed(0)}% could increase reach by ${(percentChange * 0.7).toFixed(0)}% and conversions by ${(percentChange * 0.5).toFixed(0)}%`;
        roiChange = percentChange * 0.5; // Conservative estimate
        recommendedAction = "Consider allocating additional budget to top-performing channels";
        reasoning = "More budget typically increases reach and conversions, but with diminishing returns above certain thresholds";
      } else {
        projectedOutcome = `Reducing budget by ${Math.abs(percentChange).toFixed(0)}% may reduce reach by ${(Math.abs(percentChange) * 0.8).toFixed(0)}% and conversions by ${(Math.abs(percentChange) * 0.6).toFixed(0)}%`;
        roiChange = percentChange * 0.6; // Impact is slightly higher when cutting
        recommendedAction = "Focus remaining budget on highest-converting channels";
        reasoning = "Budget cuts should be strategic - maintain presence on key channels while reducing spend on experimental ones";
      }
      break;
    }

    case "channel_remove": {
      const params = parameters as { channelRemove?: { channelId: string } };
      const channelId = params.channelRemove?.channelId;
      const removedChannel = currentAllocations.find((a) =>
        (a as unknown as { channelId?: string }).channelId === channelId
      );

      if (removedChannel) {
        budgetImpact = -removedChannel.amount;
        const percentOfBudget = (removedChannel.amount / currentBudget) * 100;
        projectedOutcome = `Removing ${removedChannel.channelName} frees up $${removedChannel.amount} (${percentOfBudget.toFixed(0)}% of budget)`;
        roiChange = -percentOfBudget * 0.3; // Some loss expected
        recommendedAction = `Reallocate the $${removedChannel.amount} to remaining channels or save it`;
        reasoning = "Removing a channel may impact overall reach but allows focus on better-performing alternatives";
      } else {
        projectedOutcome = "Channel not found in current allocations";
        recommendedAction = "Review current channel list";
      }
      break;
    }

    case "channel_add": {
      const params = parameters as { channelAdd?: { channelName: string; budget: number } };
      const newChannel = params.channelAdd;

      if (newChannel) {
        budgetImpact = newChannel.budget;
        const percentIncrease = (newChannel.budget / currentBudget) * 100;
        projectedOutcome = `Adding ${newChannel.channelName} with $${newChannel.budget} budget could expand reach by ${(percentIncrease * 0.8).toFixed(0)}%`;
        roiChange = percentIncrease * 0.4; // New channels need time to optimize
        recommendedAction = "Start with a test budget and scale based on performance";
        reasoning = "New channels typically require a learning period before achieving optimal performance";
      }
      break;
    }

    case "time_horizon_change": {
      const params = parameters as { timeHorizonChange?: { newHorizon: string } };
      const newHorizon = params.timeHorizonChange?.newHorizon;

      projectedOutcome = `Extending to ${newHorizon} allows for better optimization and compound growth`;
      roiChange = 15; // Longer horizons typically improve ROI
      recommendedAction = "Adjust pacing schedule to spread budget effectively";
      reasoning = "Longer campaigns allow for learning, optimization, and building momentum";
      break;
    }

    default:
      projectedOutcome = "Scenario type not recognized";
  }

  return {
    projectedOutcome,
    budgetImpact,
    roiChange,
    recommendedAction,
    reasoning,
  };
}

export async function GET(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id: planId } = await context.params;

    if (!isValidUUID(planId)) {
      return NextResponse.json({ error: "Invalid plan ID" }, { status: 400 });
    }

    // Verify plan exists
    const plan = await db
      .select()
      .from(marketingPlans)
      .where(and(eq(marketingPlans.tenantId, tenantId), eq(marketingPlans.id, planId)))
      .limit(1);

    if (plan.length === 0) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const scenarios = await db
      .select()
      .from(marketingWhatIfScenarios)
      .where(
        and(
          eq(marketingWhatIfScenarios.tenantId, tenantId),
          eq(marketingWhatIfScenarios.planId, planId)
        )
      )
      .orderBy(desc(marketingWhatIfScenarios.createdAt));

    return NextResponse.json({
      items: scenarios,
      total: scenarios.length,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/marketing/plans/[id]/scenarios error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userId = getUserIdFromHeaders(req);
    const { id: planId } = await context.params;

    if (!userId || !isValidUUID(userId)) {
      return NextResponse.json({ error: "Missing or invalid x-user-id header" }, { status: 400 });
    }

    if (!isValidUUID(planId)) {
      return NextResponse.json({ error: "Invalid plan ID" }, { status: 400 });
    }

    const body = await req.json();
    const { name, scenarioType, parameters } = body;

    if (!name || !scenarioType || !parameters) {
      return NextResponse.json(
        { error: "Missing required fields: name, scenarioType, parameters" },
        { status: 400 }
      );
    }

    const validTypes = ["budget_change", "channel_remove", "channel_add", "pricing_change", "time_horizon_change"];
    if (!validTypes.includes(scenarioType)) {
      return NextResponse.json(
        { error: `Invalid scenarioType. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Get the plan
    const plan = await db
      .select()
      .from(marketingPlans)
      .where(and(eq(marketingPlans.tenantId, tenantId), eq(marketingPlans.id, planId)))
      .limit(1);

    if (plan.length === 0) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Get or create actor
    const actor = await db
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

    // Calculate scenario impact
    const resultSnapshot = calculateScenarioImpact(scenarioType, parameters, plan[0]);

    // Create scenario
    const result = await db
      .insert(marketingWhatIfScenarios)
      .values({
        tenantId,
        planId,
        name,
        scenarioType: scenarioType as typeof marketingWhatIfScenarios.scenarioType.enumValues[number],
        parameters,
        resultSnapshot,
        createdByActorId: actorId,
      })
      .returning();

    await logAuditEvent({
      tenantId,
      actorId,
      entityType: "marketing_what_if_scenario",
      entityId: result[0].id,
      action: "marketing_scenario_created",
      metadata: { name, scenarioType, planId },
    });

    return NextResponse.json({
      success: true,
      scenario: result[0],
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/marketing/plans/[id]/scenarios error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
