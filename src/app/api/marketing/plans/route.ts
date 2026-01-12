/**
 * /api/marketing/plans
 *
 * GET: List marketing plans for tenant
 * POST: Create a new marketing plan (draft)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError, getUserIdFromHeaders, isValidUUID } from "@/lib/tenant";
import { db } from "@/db";
import { marketingPlans, actors } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const conditions = [eq(marketingPlans.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(marketingPlans.status, status as typeof marketingPlans.status.enumValues[number]));
    }

    const items = await db
      .select()
      .from(marketingPlans)
      .where(and(...conditions))
      .orderBy(desc(marketingPlans.createdAt));

    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        status: item.status,
        budgetTotal: item.budgetTotal,
        budgetAllocations: item.budgetAllocations,
        channelPriorities: item.channelPriorities,
        recommendations: item.recommendations,
        explanations: item.explanations,
        approvedAt: item.approvedAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      total: items.length,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/marketing/plans error:", error);
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
    const { name, inputsSnapshot } = body;

    if (!name) {
      return NextResponse.json({ error: "Missing required field: name" }, { status: 400 });
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
      .insert(marketingPlans)
      .values({
        tenantId,
        name,
        status: "draft",
        inputsSnapshot: inputsSnapshot || {},
        createdByActorId: actorId,
      })
      .returning();

    await logAuditEvent({
      tenantId,
      actorId,
      entityType: "marketing_plan",
      entityId: result[0].id,
      action: "marketing_plan_created",
      metadata: { name },
    });

    return NextResponse.json({
      success: true,
      plan: result[0],
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/marketing/plans error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
