/**
 * /api/marketing/channels/[id]
 *
 * GET: Get channel details with connector status
 * PATCH: Update channel settings
 * DELETE: Disconnect and remove channel
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError, getUserIdFromHeaders, isValidUUID } from "@/lib/tenant";
import { db } from "@/db";
import { marketingChannels, marketingConnectors, actors } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json({ error: "Invalid channel ID" }, { status: 400 });
    }

    const channel = await db
      .select()
      .from(marketingChannels)
      .where(and(eq(marketingChannels.tenantId, tenantId), eq(marketingChannels.id, id)))
      .limit(1);

    if (channel.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Get connector info
    const connector = await db
      .select()
      .from(marketingConnectors)
      .where(and(eq(marketingConnectors.tenantId, tenantId), eq(marketingConnectors.channelId, id)))
      .limit(1);

    const connectorInfo = connector.length > 0 ? {
      connectionType: connector[0].connectionType,
      syncMode: connector[0].syncMode,
      lastSyncAt: connector[0].lastSyncAt,
      isActive: connector[0].isActive,
      syncErrors: connector[0].syncErrors,
      // Don't expose tokens, just account info
      accountInfo: (connector[0].authState as Record<string, unknown>)?.accountInfo || null,
    } : null;

    return NextResponse.json({
      channel: {
        ...channel[0],
        connector: connectorInfo,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/marketing/channels/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userId = getUserIdFromHeaders(req);
    const { id } = await params;

    if (!userId || !isValidUUID(userId)) {
      return NextResponse.json({ error: "Missing or invalid x-user-id header" }, { status: 400 });
    }

    if (!isValidUUID(id)) {
      return NextResponse.json({ error: "Invalid channel ID" }, { status: 400 });
    }

    const body = await req.json();
    const { name, syncMode, dataFreshnessPolicy } = body;

    // Verify channel exists
    const channel = await db
      .select()
      .from(marketingChannels)
      .where(and(eq(marketingChannels.tenantId, tenantId), eq(marketingChannels.id, id)))
      .limit(1);

    if (channel.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Get actor
    const actor = await db
      .select()
      .from(actors)
      .where(and(eq(actors.tenantId, tenantId), eq(actors.userId, userId)))
      .limit(1);

    const actorId = actor.length > 0 ? actor[0].id : null;

    // Update channel
    const updates: Partial<typeof marketingChannels.$inferInsert> = { updatedAt: new Date() };
    if (name) updates.name = name;
    if (dataFreshnessPolicy) updates.dataFreshnessPolicy = dataFreshnessPolicy;

    await db
      .update(marketingChannels)
      .set(updates)
      .where(eq(marketingChannels.id, id));

    // Update connector sync mode if provided
    if (syncMode) {
      await db
        .update(marketingConnectors)
        .set({ syncMode, updatedAt: new Date() })
        .where(and(eq(marketingConnectors.tenantId, tenantId), eq(marketingConnectors.channelId, id)));
    }

    if (actorId) {
      await logAuditEvent({
        tenantId,
        actorId,
        entityType: "marketing_channel",
        entityId: id,
        action: "channel_updated",
        metadata: { updates: Object.keys(updates) },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/marketing/channels/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userId = getUserIdFromHeaders(req);
    const { id } = await params;

    if (!userId || !isValidUUID(userId)) {
      return NextResponse.json({ error: "Missing or invalid x-user-id header" }, { status: 400 });
    }

    if (!isValidUUID(id)) {
      return NextResponse.json({ error: "Invalid channel ID" }, { status: 400 });
    }

    // Verify channel exists
    const channel = await db
      .select()
      .from(marketingChannels)
      .where(and(eq(marketingChannels.tenantId, tenantId), eq(marketingChannels.id, id)))
      .limit(1);

    if (channel.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Get actor
    const actor = await db
      .select()
      .from(actors)
      .where(and(eq(actors.tenantId, tenantId), eq(actors.userId, userId)))
      .limit(1);

    const actorId = actor.length > 0 ? actor[0].id : null;

    // Delete connector first (foreign key constraint)
    await db
      .delete(marketingConnectors)
      .where(and(eq(marketingConnectors.tenantId, tenantId), eq(marketingConnectors.channelId, id)));

    // Delete channel
    await db
      .delete(marketingChannels)
      .where(eq(marketingChannels.id, id));

    if (actorId) {
      await logAuditEvent({
        tenantId,
        actorId,
        entityType: "marketing_channel",
        entityId: id,
        action: "channel_disconnected",
        metadata: {
          channelName: channel[0].name,
          provider: channel[0].integrationProvider,
        },
      });
    }

    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("DELETE /api/marketing/channels/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
