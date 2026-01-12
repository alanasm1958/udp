/**
 * /api/marketing/campaigns
 *
 * GET: List marketing campaigns for tenant
 * POST: Create a new marketing campaign (from approved plan)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError, getUserIdFromHeaders, isValidUUID } from "@/lib/tenant";
import { db } from "@/db";
import { marketingCampaigns, marketingPlans, actors } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const planId = searchParams.get("planId");

    const conditions = [eq(marketingCampaigns.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(marketingCampaigns.status, status as typeof marketingCampaigns.status.enumValues[number]));
    }

    if (planId && isValidUUID(planId)) {
      conditions.push(eq(marketingCampaigns.planId, planId));
    }

    const items = await db
      .select()
      .from(marketingCampaigns)
      .where(and(...conditions))
      .orderBy(desc(marketingCampaigns.createdAt));

    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        status: item.status,
        planId: item.planId,
        goalRefs: item.goalRefs,
        channelRefs: item.channelRefs,
        budget: item.budget,
        spentToDate: item.spentToDate,
        startDate: item.startDate,
        endDate: item.endDate,
        analyticsScope: item.analyticsScope,
        attributionAssumptions: item.attributionAssumptions,
        performanceSnapshot: item.performanceSnapshot,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      total: items.length,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/marketing/campaigns error:", error);
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
    const { name, planId, goalRefs, channelRefs, budget, startDate, endDate } = body;

    if (!name) {
      return NextResponse.json({ error: "Missing required field: name" }, { status: 400 });
    }

    // If planId is provided, verify the plan exists and is approved
    if (planId) {
      if (!isValidUUID(planId)) {
        return NextResponse.json({ error: "Invalid plan ID" }, { status: 400 });
      }

      const plan = await db
        .select()
        .from(marketingPlans)
        .where(and(eq(marketingPlans.tenantId, tenantId), eq(marketingPlans.id, planId)))
        .limit(1);

      if (plan.length === 0) {
        return NextResponse.json({ error: "Plan not found" }, { status: 404 });
      }

      if (plan[0].status !== "approved" && plan[0].status !== "implemented") {
        return NextResponse.json(
          { error: "Campaigns can only be created from approved or implemented plans" },
          { status: 400 }
        );
      }
    }

    // Get or create actor for user
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

    const result = await db
      .insert(marketingCampaigns)
      .values({
        tenantId,
        name,
        status: "active",
        planId: planId || null,
        goalRefs: goalRefs || [],
        channelRefs: channelRefs || [],
        budget: budget || null,
        startDate: startDate || null,
        endDate: endDate || null,
        createdByActorId: actorId,
      })
      .returning();

    // Update plan to track created campaigns
    if (planId) {
      const plan = await db
        .select()
        .from(marketingPlans)
        .where(eq(marketingPlans.id, planId))
        .limit(1);

      if (plan.length > 0) {
        const currentCampaignIds = (plan[0].createdCampaignIds as string[]) || [];
        await db
          .update(marketingPlans)
          .set({
            createdCampaignIds: [...currentCampaignIds, result[0].id],
            status: "implemented",
            updatedAt: new Date(),
          })
          .where(eq(marketingPlans.id, planId));
      }
    }

    await logAuditEvent({
      tenantId,
      actorId,
      entityType: "marketing_campaign",
      entityId: result[0].id,
      action: "marketing_campaign_created",
      metadata: { name, planId },
    });

    return NextResponse.json({
      success: true,
      campaign: result[0],
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/marketing/campaigns error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
