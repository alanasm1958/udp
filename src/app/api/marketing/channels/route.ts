/**
 * /api/marketing/channels
 *
 * GET: List marketing channels for tenant
 * POST: Create a new marketing channel (manual mode)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError, getUserIdFromHeaders, isValidUUID } from "@/lib/tenant";
import { db } from "@/db";
import { marketingChannels, actors } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");

    const conditions = [eq(marketingChannels.tenantId, tenantId)];

    if (type) {
      conditions.push(eq(marketingChannels.type, type as typeof marketingChannels.type.enumValues[number]));
    }

    if (status) {
      conditions.push(eq(marketingChannels.status, status as typeof marketingChannels.status.enumValues[number]));
    }

    const items = await db
      .select()
      .from(marketingChannels)
      .where(and(...conditions))
      .orderBy(desc(marketingChannels.createdAt));

    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        status: item.status,
        integrationProvider: item.integrationProvider,
        authMethod: item.authMethod,
        dataFreshnessPolicy: item.dataFreshnessPolicy,
        permissions: item.permissions,
        metadata: item.metadata,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      total: items.length,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/marketing/channels error:", error);
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
    const { name, type, integrationProvider, metadata } = body;

    if (!name || !type) {
      return NextResponse.json({ error: "Missing required fields: name, type" }, { status: 400 });
    }

    const validTypes = ["social", "email", "messaging", "ads", "website_analytics", "sms", "offline", "agency", "influencer"];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: `Invalid type. Must be one of: ${validTypes.join(", ")}` }, { status: 400 });
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
      .insert(marketingChannels)
      .values({
        tenantId,
        name,
        type: type as typeof marketingChannels.type.enumValues[number],
        status: "manual", // Default to manual mode
        integrationProvider: integrationProvider || null,
        metadata: metadata || {},
        createdByActorId: actorId,
      })
      .returning();

    await logAuditEvent({
      tenantId,
      actorId,
      entityType: "marketing_channel",
      entityId: result[0].id,
      action: "marketing_channel_created",
      metadata: { name, type },
    });

    return NextResponse.json({
      success: true,
      channel: result[0],
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/marketing/channels error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
