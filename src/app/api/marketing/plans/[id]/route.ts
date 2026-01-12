/**
 * /api/marketing/plans/[id]
 *
 * GET: Get a single marketing plan
 * PATCH: Update a marketing plan
 * DELETE: Delete a marketing plan (only drafts)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError, getUserIdFromHeaders, isValidUUID } from "@/lib/tenant";
import { db } from "@/db";
import { marketingPlans, actors } from "@/db/schema";
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
      return NextResponse.json({ error: "Invalid plan ID" }, { status: 400 });
    }

    const plan = await db
      .select()
      .from(marketingPlans)
      .where(and(eq(marketingPlans.tenantId, tenantId), eq(marketingPlans.id, id)))
      .limit(1);

    if (plan.length === 0) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    return NextResponse.json({ plan: plan[0] });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/marketing/plans/[id] error:", error);
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
      return NextResponse.json({ error: "Invalid plan ID" }, { status: 400 });
    }

    const body = await req.json();

    // Get existing plan
    const existing = await db
      .select()
      .from(marketingPlans)
      .where(and(eq(marketingPlans.tenantId, tenantId), eq(marketingPlans.id, id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
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
    const updateData: Partial<typeof marketingPlans.$inferInsert> = {
      updatedAt: new Date(),
    };

    // Only allow updating specific fields
    const allowedFields = [
      "name", "status", "inputsSnapshot", "recommendations", "budgetTotal",
      "budgetAllocations", "pacingSchedule", "channelPriorities", "excludedChannels",
      "tactics", "messaging", "toolsAndServices", "risksAndAssumptions",
      "earlyWarningSignals", "explanations", "linkedCardIds"
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        (updateData as Record<string, unknown>)[field] = body[field];
      }
    }

    // Handle approval
    if (body.status === "approved" && existing[0].status !== "approved") {
      updateData.approvedByActorId = actorId;
      updateData.approvedAt = new Date();
    }

    const result = await db
      .update(marketingPlans)
      .set(updateData)
      .where(and(eq(marketingPlans.tenantId, tenantId), eq(marketingPlans.id, id)))
      .returning();

    await logAuditEvent({
      tenantId,
      actorId,
      entityType: "marketing_plan",
      entityId: id,
      action: "marketing_plan_updated",
      metadata: { updatedFields: Object.keys(updateData) },
    });

    return NextResponse.json({
      success: true,
      plan: result[0],
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/marketing/plans/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: RouteContext): Promise<NextResponse> {
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
    const existing = await db
      .select()
      .from(marketingPlans)
      .where(and(eq(marketingPlans.tenantId, tenantId), eq(marketingPlans.id, id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Only allow deleting drafts
    if (existing[0].status !== "draft") {
      return NextResponse.json(
        { error: "Only draft plans can be deleted" },
        { status: 400 }
      );
    }

    // Get actor
    let actor = await db
      .select()
      .from(actors)
      .where(and(eq(actors.tenantId, tenantId), eq(actors.userId, userId)))
      .limit(1);

    const actorId = actor[0]?.id;

    await db
      .delete(marketingPlans)
      .where(and(eq(marketingPlans.tenantId, tenantId), eq(marketingPlans.id, id)));

    if (actorId) {
      await logAuditEvent({
        tenantId,
        actorId,
        entityType: "marketing_plan",
        entityId: id,
        action: "marketing_plan_deleted",
        metadata: { name: existing[0].name },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("DELETE /api/marketing/plans/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
