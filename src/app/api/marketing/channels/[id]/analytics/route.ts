/**
 * /api/marketing/channels/[id]/analytics
 *
 * GET: Retrieve cached metrics with trends for a channel
 * Triggers sync if data is stale (> 24h)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError, isValidUUID } from "@/lib/tenant";
import { db } from "@/db";
import { marketingChannels, marketingConnectors, marketingChannelMetrics, marketingChannelInsights } from "@/db/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import { PROVIDER_METRICS, type ProviderType } from "@/lib/connectors";

interface FormattedMetric {
  type: string;
  label: string;
  value: number;
  formatted: string;
  previousValue?: number;
  trend: "up" | "down" | "stable";
  trendValue: number;
  trendFormatted: string;
  format: "number" | "percentage" | "currency";
}

function formatValue(value: number, format: "number" | "percentage" | "currency"): string {
  switch (format) {
    case "percentage":
      return `${value.toFixed(1)}%`;
    case "currency":
      return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case "number":
    default:
      if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`;
      } else if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`;
      }
      return value.toLocaleString();
  }
}

function formatTrend(value: number): string {
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "30d";

    if (!isValidUUID(id)) {
      return NextResponse.json({ error: "Invalid channel ID" }, { status: 400 });
    }

    // Get channel info
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

    const isConnected = channel[0].status === "connected" && connector.length > 0;
    const lastSyncAt = connector[0]?.lastSyncAt;

    // Check if we need to sync (data is stale if > 24h old or never synced)
    const needsSync = !lastSyncAt || (new Date().getTime() - new Date(lastSyncAt).getTime() > 24 * 60 * 60 * 1000);

    // Get recent metrics from database
    const metrics = await db
      .select()
      .from(marketingChannelMetrics)
      .where(and(
        eq(marketingChannelMetrics.tenantId, tenantId),
        eq(marketingChannelMetrics.channelId, id)
      ))
      .orderBy(desc(marketingChannelMetrics.fetchedAt))
      .limit(20);

    // Get provider metric definitions
    const provider = channel[0].integrationProvider as ProviderType;
    const metricDefs = provider ? PROVIDER_METRICS[provider] || [] : [];

    // Format metrics for response
    const formattedMetrics: FormattedMetric[] = [];
    const seenTypes = new Set<string>();

    for (const metric of metrics) {
      if (seenTypes.has(metric.metricType)) continue;
      seenTypes.add(metric.metricType);

      const def = metricDefs.find((d) => d.type === metric.metricType);
      const value = parseFloat(metric.value);
      const previousValue = metric.previousValue ? parseFloat(metric.previousValue) : undefined;
      const format = def?.format || "number";

      let trend: "up" | "down" | "stable" = "stable";
      let trendValue = 0;

      if (previousValue !== undefined && previousValue !== 0) {
        trendValue = ((value - previousValue) / previousValue) * 100;
        trend = trendValue > 1 ? "up" : trendValue < -1 ? "down" : "stable";
      }

      formattedMetrics.push({
        type: metric.metricType,
        label: def?.label || metric.metricType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        value,
        formatted: formatValue(value, format),
        previousValue,
        trend,
        trendValue,
        trendFormatted: formatTrend(trendValue),
        format,
      });
    }

    // Get AI insights if available
    const insights = await db
      .select()
      .from(marketingChannelInsights)
      .where(and(
        eq(marketingChannelInsights.tenantId, tenantId),
        eq(marketingChannelInsights.channelId, id)
      ))
      .orderBy(desc(marketingChannelInsights.generatedAt))
      .limit(5);

    return NextResponse.json({
      channel: {
        id: channel[0].id,
        name: channel[0].name,
        type: channel[0].type,
        status: channel[0].status,
        integrationProvider: channel[0].integrationProvider,
        isConnected,
      },
      connector: connector.length > 0 ? {
        lastSyncAt: lastSyncAt?.toISOString(),
        isActive: connector[0].isActive,
        accountInfo: (connector[0].authState as Record<string, unknown>)?.accountInfo || null,
      } : null,
      metrics: formattedMetrics,
      insights: insights.map((i) => ({
        id: i.id,
        type: i.insightType,
        title: i.title,
        content: i.content,
        priority: i.priority,
        generatedAt: i.generatedAt?.toISOString(),
      })),
      needsSync,
      period,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/marketing/channels/[id]/analytics error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get analytics" },
      { status: 500 }
    );
  }
}
