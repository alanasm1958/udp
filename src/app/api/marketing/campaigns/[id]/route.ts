/**
 * /api/marketing/campaigns/[id]
 *
 * GET: Get a single marketing campaign
 * PATCH: Update a marketing campaign
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError, getUserIdFromHeaders, isValidUUID } from "@/lib/tenant";
import { db } from "@/db";
import { marketingCampaigns, actors } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await context.params;

    if (!isValidUUID(id)) {
      return NextResponse.json({ error: "Invalid campaign ID" }, { status: 400 });
    }

    const campaign = await db
      .select()
      .from(marketingCampaigns)
      .where(and(eq(marketingCampaigns.tenantId, tenantId), eq(marketingCampaigns.id, id)))
      .limit(1);

    if (campaign.length === 0) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({ campaign: campaign[0] });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/marketing/campaigns/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userId = getUserIdFromHeaders(req);
    const { id } = await context.params;

    if (!userId || !isValidUUID(userId)) {
      return NextResponse.json({ error: "Missing or invalid x-user-id header" }, { status: 400 });
    }

    if (!isValidUUID(id)) {
      return NextResponse.json({ error: "Invalid campaign ID" }, { status: 400 });
    }

    const body = await req.json();

    // Get existing campaign
    const existing = await db
      .select()
      .from(marketingCampaigns)
      .where(and(eq(marketingCampaigns.tenantId, tenantId), eq(marketingCampaigns.id, id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Get or create actor for user
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

    // Build update object
    const updateData: Partial<typeof marketingCampaigns.$inferInsert> = {
      updatedAt: new Date(),
    };

    // Only allow updating specific fields
    const allowedFields = [
      "name", "status", "goalRefs", "channelRefs", "budget", "spentToDate",
      "startDate", "endDate", "analyticsScope", "attributionAssumptions",
      "performanceSnapshot"
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        (updateData as Record<string, unknown>)[field] = body[field];
      }
    }

    const result = await db
      .update(marketingCampaigns)
      .set(updateData)
      .where(and(eq(marketingCampaigns.tenantId, tenantId), eq(marketingCampaigns.id, id)))
      .returning();

    await logAuditEvent({
      tenantId,
      actorId,
      entityType: "marketing_campaign",
      entityId: id,
      action: "marketing_campaign_updated",
      metadata: { updatedFields: Object.keys(updateData) },
    });

    return NextResponse.json({
      success: true,
      campaign: result[0],
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/marketing/campaigns/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
