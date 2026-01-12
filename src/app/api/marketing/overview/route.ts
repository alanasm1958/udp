/**
 * /api/marketing/overview
 *
 * GET: Get marketing overview data for dashboard
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";
import { db } from "@/db";
import {
  marketingCampaigns,
  marketingChannels,
  marketingPlans,
  marketingInsights,
  marketingManualEntries,
} from "@/db/schema";
import { eq, and, desc, sql, gte } from "drizzle-orm";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);

    // Get counts and summaries in parallel
    const [
      channelsResult,
      activeCampaignsResult,
      plansResult,
      insightsResult,
      recentEntriesResult,
    ] = await Promise.all([
      // Channel counts by status
      db
        .select({
          status: marketingChannels.status,
          count: sql<number>`count(*)::int`,
        })
        .from(marketingChannels)
        .where(eq(marketingChannels.tenantId, tenantId))
        .groupBy(marketingChannels.status),

      // Active campaigns with budget info
      db
        .select({
          id: marketingCampaigns.id,
          name: marketingCampaigns.name,
          status: marketingCampaigns.status,
          budget: marketingCampaigns.budget,
          spentToDate: marketingCampaigns.spentToDate,
          startDate: marketingCampaigns.startDate,
          endDate: marketingCampaigns.endDate,
          performanceSnapshot: marketingCampaigns.performanceSnapshot,
        })
        .from(marketingCampaigns)
        .where(
          and(
            eq(marketingCampaigns.tenantId, tenantId),
            eq(marketingCampaigns.status, "active")
          )
        )
        .orderBy(desc(marketingCampaigns.createdAt))
        .limit(5),

      // Recent plans
      db
        .select({
          id: marketingPlans.id,
          name: marketingPlans.name,
          status: marketingPlans.status,
          budgetTotal: marketingPlans.budgetTotal,
          createdAt: marketingPlans.createdAt,
        })
        .from(marketingPlans)
        .where(eq(marketingPlans.tenantId, tenantId))
        .orderBy(desc(marketingPlans.createdAt))
        .limit(5),

      // Active insights/alerts
      db
        .select()
        .from(marketingInsights)
        .where(
          and(
            eq(marketingInsights.tenantId, tenantId),
            eq(marketingInsights.status, "active")
          )
        )
        .orderBy(desc(marketingInsights.createdAt))
        .limit(10),

      // Recent manual entries (last 30 days)
      db
        .select({
          totalSpend: sql<string>`COALESCE(sum(spend), 0)`,
          totalImpressions: sql<number>`COALESCE(sum(impressions), 0)::int`,
          totalClicks: sql<number>`COALESCE(sum(clicks), 0)::int`,
          totalConversions: sql<number>`COALESCE(sum(conversions), 0)::int`,
          totalRevenue: sql<string>`COALESCE(sum(revenue), 0)`,
          totalLeads: sql<number>`COALESCE(sum(leads), 0)::int`,
        })
        .from(marketingManualEntries)
        .where(
          and(
            eq(marketingManualEntries.tenantId, tenantId),
            gte(marketingManualEntries.entryDate, sql`CURRENT_DATE - INTERVAL '30 days'`)
          )
        ),
    ]);

    // Process channel counts
    const channelSummary = {
      total: 0,
      connected: 0,
      manual: 0,
      error: 0,
    };

    for (const row of channelsResult) {
      channelSummary.total += row.count;
      if (row.status === "connected") channelSummary.connected = row.count;
      else if (row.status === "manual") channelSummary.manual = row.count;
      else if (row.status === "error") channelSummary.error = row.count;
    }

    // Calculate metrics from active campaigns
    let totalActiveBudget = 0;
    let totalActiveSpent = 0;
    for (const campaign of activeCampaignsResult) {
      totalActiveBudget += Number(campaign.budget || 0);
      totalActiveSpent += Number(campaign.spentToDate || 0);
    }

    // Determine next best action
    let nextBestAction = {
      type: "create_plan",
      title: "Create your first marketing plan",
      description: "Start planning your marketing strategy with AI-powered recommendations",
      actionUrl: "/marketing?tab=planner",
    };

    if (plansResult.length > 0) {
      const latestPlan = plansResult[0];
      if (latestPlan.status === "draft") {
        nextBestAction = {
          type: "complete_plan",
          title: "Complete your draft plan",
          description: `"${latestPlan.name}" is waiting for your input`,
          actionUrl: `/marketing?tab=planner&planId=${latestPlan.id}`,
        };
      } else if (latestPlan.status === "recommended" || latestPlan.status === "edited") {
        nextBestAction = {
          type: "approve_plan",
          title: "Review and approve your plan",
          description: `"${latestPlan.name}" is ready for approval`,
          actionUrl: `/marketing?tab=planner&planId=${latestPlan.id}`,
        };
      } else if (activeCampaignsResult.length === 0 && latestPlan.status === "approved") {
        nextBestAction = {
          type: "create_campaign",
          title: "Create a campaign from your approved plan",
          description: `"${latestPlan.name}" is approved and ready for implementation`,
          actionUrl: `/marketing?tab=campaigns&createFromPlan=${latestPlan.id}`,
        };
      } else if (channelSummary.total === 0) {
        nextBestAction = {
          type: "add_channel",
          title: "Add a marketing channel",
          description: "Connect or add manual channels to track your marketing activities",
          actionUrl: "/marketing?tab=planner&action=addChannel",
        };
      } else if (activeCampaignsResult.length > 0) {
        nextBestAction = {
          type: "track_performance",
          title: "Track campaign performance",
          description: "View analytics and update your campaign metrics",
          actionUrl: `/marketing?tab=campaigns`,
        };
      }
    }

    // Build response
    const metrics = recentEntriesResult[0] || {
      totalSpend: "0",
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      totalRevenue: "0",
      totalLeads: 0,
    };

    return NextResponse.json({
      channels: channelSummary,
      campaigns: {
        active: activeCampaignsResult.length,
        totalBudget: totalActiveBudget,
        totalSpent: totalActiveSpent,
        items: activeCampaignsResult,
      },
      plans: {
        total: plansResult.length,
        items: plansResult,
      },
      insights: {
        total: insightsResult.length,
        items: insightsResult,
      },
      metrics: {
        period: "last_30_days",
        spend: Number(metrics.totalSpend),
        impressions: metrics.totalImpressions,
        clicks: metrics.totalClicks,
        conversions: metrics.totalConversions,
        revenue: Number(metrics.totalRevenue),
        leads: metrics.totalLeads,
      },
      nextBestAction,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/marketing/overview error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
