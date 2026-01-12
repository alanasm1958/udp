/**
 * /api/marketing/plans/[id]/generate
 *
 * POST: Generate AI recommendations for a marketing plan
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError, getUserIdFromHeaders, isValidUUID } from "@/lib/tenant";
import { db } from "@/db";
import { marketingPlans, marketingChannels, products, actors } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Marketing channel recommendations based on business type and objectives
function generateChannelRecommendations(
  inputs: Record<string, unknown>,
  availableChannels: Array<{ id: string; name: string; type: string }>,
  availableProducts: Array<{ id: string; name: string; type: string; defaultSalesPrice: string }>
) {
  const objectives = (inputs.objectives as Array<{ objectiveType: string; targetValue?: number }>) || [];
  const preferences = (inputs.preferences as { preferredChannels?: string[]; riskTolerance?: string }) || {};
  const constraints = (inputs.constraints as { totalBudget?: number }) || {};
  const businessContext = (inputs.businessContext as { businessType?: string; targetAudience?: string }) || {};

  const budget = constraints.totalBudget || 1000;
  const riskTolerance = preferences.riskTolerance || "medium";

  // Default channel priorities based on common SME patterns
  const defaultPriorities = [
    { channelName: "WhatsApp Business", type: "messaging", weight: 0.25, reasoning: "High conversion rates for direct customer engagement" },
    { channelName: "Instagram", type: "social", weight: 0.2, reasoning: "Visual platform ideal for product showcasing and brand awareness" },
    { channelName: "Facebook", type: "social", weight: 0.15, reasoning: "Broad reach and targeting capabilities" },
    { channelName: "Google Ads", type: "ads", weight: 0.2, reasoning: "Intent-based traffic for active shoppers" },
    { channelName: "Email Marketing", type: "email", weight: 0.1, reasoning: "Cost-effective for retention and repeat customers" },
    { channelName: "SMS", type: "sms", weight: 0.1, reasoning: "High open rates for time-sensitive promotions" },
  ];

  // Adjust based on objectives
  const hasLeadGoal = objectives.some((o) => o.objectiveType === "leads");
  const hasRevenueGoal = objectives.some((o) => o.objectiveType === "revenue");
  const hasAwarenessGoal = objectives.some((o) => o.objectiveType === "awareness");

  const budgetAllocations = defaultPriorities.map((channel, index) => {
    let adjustedWeight = channel.weight;

    // Adjust weights based on objectives
    if (hasLeadGoal && (channel.type === "ads" || channel.type === "social")) {
      adjustedWeight *= 1.2;
    }
    if (hasRevenueGoal && channel.type === "messaging") {
      adjustedWeight *= 1.3;
    }
    if (hasAwarenessGoal && channel.type === "social") {
      adjustedWeight *= 1.4;
    }

    // Conservative allocations for low risk tolerance
    if (riskTolerance === "low" && (channel.type === "ads" || channel.type === "influencer")) {
      adjustedWeight *= 0.7;
    }

    return {
      channelName: channel.channelName,
      channelId: availableChannels.find((c) => c.name === channel.channelName)?.id,
      amount: Math.round(budget * adjustedWeight),
      percentage: Math.round(adjustedWeight * 100),
      reasoning: channel.reasoning,
    };
  });

  // Normalize to ensure total equals budget
  const totalAllocated = budgetAllocations.reduce((sum, a) => sum + a.amount, 0);
  const adjustmentRatio = budget / totalAllocated;
  budgetAllocations.forEach((a) => {
    a.amount = Math.round(a.amount * adjustmentRatio);
    a.percentage = Math.round((a.amount / budget) * 100);
  });

  // Generate tactics
  const tactics = [
    {
      channel: "WhatsApp Business",
      tactic: "Product catalog sharing",
      description: "Share product catalogs directly with interested customers",
      expectedOutcome: "30-50% response rate on targeted messages",
    },
    {
      channel: "Instagram",
      tactic: "Reels and Stories",
      description: "Create short-form video content showcasing products/services",
      expectedOutcome: "Increased reach and engagement by 20-40%",
    },
    {
      channel: "Google Ads",
      tactic: "Search campaigns",
      description: "Target high-intent keywords related to your products",
      expectedOutcome: "2-5% conversion rate on landing pages",
    },
    {
      channel: "Email",
      tactic: "Welcome sequence",
      description: "Automated email series for new subscribers",
      expectedOutcome: "15-25% open rate, 2-5% click-through rate",
    },
  ];

  // Generate messaging angles
  const productNames = availableProducts.map((p) => p.name).slice(0, 3);
  const messaging = [
    {
      audience: businessContext.targetAudience || "General audience",
      angle: "Value proposition",
      examples: [
        `Discover quality ${productNames[0] || "products"} at competitive prices`,
        "Why customers choose us: Quality, Service, Value",
      ],
    },
    {
      audience: "Price-conscious buyers",
      angle: "Promotions and offers",
      examples: [
        "Limited time: Get 10% off your first order",
        "Bundle and save on your favorites",
      ],
    },
  ];

  // Risks and assumptions
  const risksAndAssumptions = [
    {
      type: "assumption" as const,
      description: "Budget will remain consistent throughout the campaign period",
      mitigation: "Set up weekly budget reviews and alerts",
    },
    {
      type: "assumption" as const,
      description: "Target audience is active on recommended social platforms",
      mitigation: "Monitor engagement metrics in first 2 weeks and adjust",
    },
    {
      type: "risk" as const,
      description: "Ad fatigue may reduce performance over time",
      mitigation: "Refresh creative content every 2-3 weeks",
    },
    {
      type: "risk" as const,
      description: "Platform algorithm changes may affect reach",
      mitigation: "Diversify across multiple channels to reduce dependency",
    },
  ];

  // Early warning signals
  const earlyWarningSignals = [
    {
      signal: "Click-through rate drops below 1%",
      threshold: "1% CTR",
      action: "Review and refresh ad creative, check targeting",
    },
    {
      signal: "Cost per conversion exceeds target",
      threshold: "150% of target CPA",
      action: "Pause underperforming campaigns, reallocate budget",
    },
    {
      signal: "Engagement rate declining week over week",
      threshold: "20% decline",
      action: "Analyze content performance, adjust posting strategy",
    },
  ];

  return {
    budgetAllocations,
    channelPriorities: defaultPriorities.map((p, i) => ({
      channelName: p.channelName,
      channelId: availableChannels.find((c) => c.name === p.channelName)?.id,
      priority: i + 1,
      reasoning: p.reasoning,
    })),
    excludedChannels: [
      {
        channelName: "TikTok Ads",
        reason: "Requires significant video production capability for effective campaigns",
      },
    ],
    tactics,
    messaging,
    toolsAndServices: [
      { name: "Canva", purpose: "Create visual content for social media", estimatedCost: 0 },
      { name: "Meta Business Suite", purpose: "Manage Facebook and Instagram presence", estimatedCost: 0 },
    ],
    risksAndAssumptions,
    earlyWarningSignals,
  };
}

export async function POST(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userId = getUserIdFromHeaders(req);
    const { id } = await context.params;

    if (!userId || !isValidUUID(userId)) {
      return NextResponse.json({ error: "Missing or invalid x-user-id header" }, { status: 400 });
    }

    if (!isValidUUID(id)) {
      return NextResponse.json({ error: "Invalid plan ID" }, { status: 400 });
    }

    // Get existing plan
    const existingPlan = await db
      .select()
      .from(marketingPlans)
      .where(and(eq(marketingPlans.tenantId, tenantId), eq(marketingPlans.id, id)))
      .limit(1);

    if (existingPlan.length === 0) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const plan = existingPlan[0];
    const inputs = (plan.inputsSnapshot || {}) as Record<string, unknown>;

    // Get available channels
    const channels = await db
      .select({
        id: marketingChannels.id,
        name: marketingChannels.name,
        type: marketingChannels.type,
      })
      .from(marketingChannels)
      .where(eq(marketingChannels.tenantId, tenantId));

    // Get available products
    const productsList = await db
      .select({
        id: products.id,
        name: products.name,
        type: products.type,
        defaultSalesPrice: products.defaultSalesPrice,
      })
      .from(products)
      .where(eq(products.tenantId, tenantId))
      .limit(20);

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

    // Generate recommendations
    const recommendations = generateChannelRecommendations(inputs, channels, productsList);
    const constraints = (inputs.constraints as { totalBudget?: number }) || {};

    // Build summary
    const objectives = (inputs.objectives as Array<{ objectiveType: string }>) || [];
    const objectivesSummary = objectives.map((o) => o.objectiveType).join(", ") || "general marketing";

    const summary = `Based on your ${objectivesSummary} objectives, we recommend a balanced multi-channel approach focusing on messaging (WhatsApp), social media (Instagram, Facebook), and paid search (Google Ads). This strategy prioritizes direct customer engagement while building brand awareness.`;

    const missingData: string[] = [];
    if (!constraints.totalBudget) missingData.push("Total budget not specified - using default allocation");
    if (channels.length === 0) missingData.push("No marketing channels configured - add channels to improve targeting");
    if (productsList.length === 0) missingData.push("No products/services found - add products for better recommendations");

    // Update plan with recommendations
    const result = await db
      .update(marketingPlans)
      .set({
        status: "recommended",
        budgetTotal: String(constraints.totalBudget || 1000),
        budgetAllocations: recommendations.budgetAllocations,
        channelPriorities: recommendations.channelPriorities,
        excludedChannels: recommendations.excludedChannels,
        tactics: recommendations.tactics,
        messaging: recommendations.messaging,
        toolsAndServices: recommendations.toolsAndServices,
        risksAndAssumptions: recommendations.risksAndAssumptions,
        earlyWarningSignals: recommendations.earlyWarningSignals,
        recommendations: {
          summary,
          reasoning: "Recommendations based on SME best practices and your business context",
          confidenceLevel: missingData.length > 1 ? "medium" : "high",
          missingData,
        },
        // Plain language explanation fields (required for adoption)
        // Store extended explanations in recommendations for now, keep explanations for schema compatibility
        explanations: {
          // Legacy fields for schema compatibility
          whyThisRecommendation: `We recommend this channel mix because it balances three key factors:
1) Direct engagement through messaging channels (WhatsApp) for high conversion
2) Brand visibility through social media (Instagram, Facebook) for awareness
3) Intent-based traffic through paid search (Google Ads) for capturing ready buyers`,

          expectedOutcome: `With consistent execution and a $${constraints.totalBudget || 1000}/month budget:
- First 2 weeks: Build initial audience and gather data
- Weeks 3-4: Optimize based on performance metrics
- Weeks 5-6: Expect to see ${objectives[0]?.objectiveType === 'leads' ? '15-30 qualified leads' : objectives[0]?.objectiveType === 'revenue' ? '10-20% increase in attributed revenue' : 'measurable engagement growth'}`,

          nextBestAction: "Review the budget allocations below. If they look reasonable, click 'Approve Plan' to move forward. You can then create a campaign from this plan.",
        },
        updatedAt: new Date(),
      })
      .where(eq(marketingPlans.id, id))
      .returning();

    await logAuditEvent({
      tenantId,
      actorId,
      entityType: "marketing_plan",
      entityId: id,
      action: "marketing_plan_generated",
      metadata: { status: "recommended" },
    });

    return NextResponse.json({
      success: true,
      plan: result[0],
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/marketing/plans/[id]/generate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
