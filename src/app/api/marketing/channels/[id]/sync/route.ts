/**
 * /api/marketing/channels/[id]/sync
 *
 * POST: Fetch fresh metrics from connected platform and store in database
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError, isValidUUID } from "@/lib/tenant";
import { db } from "@/db";
import { marketingChannels, marketingConnectors, marketingChannelMetrics } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getConnector, type AuthState, type FetchOptions } from "@/lib/connectors";
import { decryptSecret } from "@/lib/secret-crypto";

function resolveConnectorAuthState(raw: AuthState): AuthState {
  const decoded: AuthState = { ...raw };

  if (typeof raw.accessToken === "string") {
    try {
      decoded.accessToken = decryptSecret(raw.accessToken);
    } catch {
      decoded.accessToken = raw.accessToken;
    }
  }

  if (typeof raw.refreshToken === "string") {
    try {
      decoded.refreshToken = decryptSecret(raw.refreshToken);
    } catch {
      decoded.refreshToken = raw.refreshToken;
    }
  }

  if (typeof raw.apiKey === "string") {
    try {
      decoded.apiKey = decryptSecret(raw.apiKey);
    } catch {
      decoded.apiKey = raw.apiKey;
    }
  }

  return decoded;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json({ error: "Invalid channel ID" }, { status: 400 });
    }

    // Parse request body for optional period
    let body: { period?: string; startDate?: string; endDate?: string } = {};
    try {
      body = await req.json();
    } catch {
      // No body provided, use defaults
    }

    const period = (body.period || "30d") as FetchOptions["period"];

    // Get channel and connector info
    const channel = await db
      .select()
      .from(marketingChannels)
      .where(and(eq(marketingChannels.tenantId, tenantId), eq(marketingChannels.id, id)))
      .limit(1);

    if (channel.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    if (channel[0].status !== "connected") {
      return NextResponse.json({ error: "Channel is not connected" }, { status: 400 });
    }

    // Get connector with auth state
    const connector = await db
      .select()
      .from(marketingConnectors)
      .where(and(eq(marketingConnectors.tenantId, tenantId), eq(marketingConnectors.channelId, id)))
      .limit(1);

    if (connector.length === 0) {
      return NextResponse.json({ error: "No connector found for this channel" }, { status: 400 });
    }

    const authState = resolveConnectorAuthState(connector[0].authState as AuthState);
    const provider = channel[0].integrationProvider;

    if (!provider) {
      return NextResponse.json({ error: "Channel has no integration provider" }, { status: 400 });
    }

    // Get the appropriate connector and fetch metrics
    const channelConnector = getConnector(provider);
    const fetchOptions: FetchOptions = {
      period,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
    };

    const metricsResult = await channelConnector.fetchMetrics(authState, fetchOptions);

    // Store metrics in database
    const now = new Date();
    const metricsToInsert = metricsResult.metrics.map((metric) => ({
      tenantId,
      channelId: id,
      metricType: metric.type,
      value: metric.value.toString(),
      previousValue: metric.previousValue?.toString() || null,
      periodStart: metricsResult.periodStart || null,
      periodEnd: metricsResult.periodEnd || null,
      rawData: metricsResult.rawData,
      fetchedAt: now,
    }));

    // Upsert metrics (update if exists for same channel/metric/period, insert otherwise)
    for (const metric of metricsToInsert) {
      await db
        .insert(marketingChannelMetrics)
        .values(metric)
        .onConflictDoUpdate({
          target: [
            marketingChannelMetrics.channelId,
            marketingChannelMetrics.metricType,
            marketingChannelMetrics.periodStart,
          ],
          set: {
            value: metric.value,
            previousValue: metric.previousValue,
            rawData: metric.rawData,
            fetchedAt: now,
          },
        });
    }

    // Update connector lastSyncAt
    await db
      .update(marketingConnectors)
      .set({ lastSyncAt: now })
      .where(eq(marketingConnectors.id, connector[0].id));

    return NextResponse.json({
      success: true,
      metrics: metricsResult.metrics,
      syncedAt: now.toISOString(),
      periodStart: metricsResult.periodStart?.toISOString(),
      periodEnd: metricsResult.periodEnd?.toISOString(),
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/marketing/channels/[id]/sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync channel" },
      { status: 500 }
    );
  }
}
