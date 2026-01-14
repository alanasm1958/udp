/**
 * /api/marketing/channels/[id]/ai-insights
 *
 * POST: Generate AI insights for a marketing channel based on its metrics
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError, isValidUUID } from "@/lib/tenant";
import { db } from "@/db";
import { marketingChannels, marketingConnectors, marketingChannelMetrics, marketingChannelInsights } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getAIProvider, isAIAvailable } from "@/lib/ai/provider";

interface InsightRequest {
  focusArea?: "performance" | "growth" | "engagement" | "recommendations" | "all";
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

    // Parse request body
    let body: InsightRequest = {};
    try {
      body = await req.json();
    } catch {
      // No body provided, use defaults
    }

    const focusArea = body.focusArea || "all";

    // Get channel info
    const channel = await db
      .select()
      .from(marketingChannels)
      .where(and(eq(marketingChannels.tenantId, tenantId), eq(marketingChannels.id, id)))
      .limit(1);

    if (channel.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Get recent metrics
    const metrics = await db
      .select()
      .from(marketingChannelMetrics)
      .where(and(
        eq(marketingChannelMetrics.tenantId, tenantId),
        eq(marketingChannelMetrics.channelId, id)
      ))
      .orderBy(desc(marketingChannelMetrics.fetchedAt))
      .limit(20);

    if (metrics.length === 0) {
      return NextResponse.json({
        error: "No metrics available. Please sync the channel first."
      }, { status: 400 });
    }

    // Build metrics summary for AI
    const metricsSummary = metrics.reduce((acc, m) => {
      if (!acc[m.metricType]) {
        acc[m.metricType] = {
          current: parseFloat(m.value),
          previous: m.previousValue ? parseFloat(m.previousValue) : null,
        };
      }
      return acc;
    }, {} as Record<string, { current: number; previous: number | null }>);

    // Generate AI insights
    const insights = await generateInsights(
      channel[0].name,
      channel[0].integrationProvider || "unknown",
      metricsSummary,
      focusArea
    );

    // Store insights in database
    const now = new Date();
    const insightsToStore = insights.map((insight) => ({
      tenantId,
      channelId: id,
      insightType: insight.type,
      title: insight.title,
      content: insight.content,
      priority: insight.priority,
      metadata: insight.metadata || {},
      generatedAt: now,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24h expiry
      aiModel: isAIAvailable() ? process.env.AI_PROVIDER || "mock" : "mock",
      rawContext: { metrics: metricsSummary, focusArea },
    }));

    // Clear old insights and insert new ones
    await db
      .delete(marketingChannelInsights)
      .where(and(
        eq(marketingChannelInsights.tenantId, tenantId),
        eq(marketingChannelInsights.channelId, id)
      ));

    if (insightsToStore.length > 0) {
      await db.insert(marketingChannelInsights).values(insightsToStore);
    }

    return NextResponse.json({
      success: true,
      insights: insights,
      generatedAt: now.toISOString(),
      channel: {
        id: channel[0].id,
        name: channel[0].name,
        provider: channel[0].integrationProvider,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/marketing/channels/[id]/ai-insights error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate insights" },
      { status: 500 }
    );
  }
}

interface GeneratedInsight {
  type: string;
  title: string;
  content: string;
  priority: "high" | "medium" | "low";
  metadata?: Record<string, unknown>;
}

async function generateInsights(
  channelName: string,
  provider: string,
  metrics: Record<string, { current: number; previous: number | null }>,
  focusArea: string
): Promise<GeneratedInsight[]> {
  const insights: GeneratedInsight[] = [];

  // Check if AI is available
  if (isAIAvailable() && process.env.AI_PROVIDER !== "mock") {
    try {
      const aiProvider = getAIProvider();
      const prompt = buildPrompt(channelName, provider, metrics, focusArea);

      const response = await aiProvider.complete({
        messages: [
          {
            role: "system",
            content: `You are a marketing analytics expert. Analyze the provided metrics and generate actionable insights.
              Return your response as a JSON array of insights with the structure:
              [{"type": "recommendation|trend|alert|summary", "title": "short title", "content": "detailed insight", "priority": "high|medium|low"}]
              Focus on actionable, specific insights based on the data. Be concise but helpful.`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        maxTokens: 1000,
        temperature: 0.7,
      });

      // Parse AI response
      try {
        const parsed = JSON.parse(response.content);
        if (Array.isArray(parsed)) {
          return parsed.map((p) => ({
            type: p.type || "recommendation",
            title: p.title || "Insight",
            content: p.content || "",
            priority: p.priority || "medium",
          }));
        }
      } catch {
        // If parsing fails, create a single insight from the response
        insights.push({
          type: "summary",
          title: "AI Analysis",
          content: response.content,
          priority: "medium",
        });
      }
    } catch (error) {
      console.error("AI insight generation failed:", error);
      // Fall through to rule-based insights
    }
  }

  // Rule-based insights as fallback or supplement
  return generateRuleBasedInsights(channelName, provider, metrics, focusArea);
}

function buildPrompt(
  channelName: string,
  provider: string,
  metrics: Record<string, { current: number; previous: number | null }>,
  focusArea: string
): string {
  const metricsText = Object.entries(metrics)
    .map(([key, val]) => {
      const change = val.previous
        ? `(${((val.current - val.previous) / val.previous * 100).toFixed(1)}% change)`
        : "";
      return `- ${key.replace(/_/g, " ")}: ${val.current.toLocaleString()} ${change}`;
    })
    .join("\n");

  return `Analyze these ${channelName} (${provider}) marketing metrics and provide ${focusArea === "all" ? "comprehensive" : focusArea} insights:

${metricsText}

Provide 3-5 actionable insights focusing on ${focusArea === "all" ? "performance, growth opportunities, and recommendations" : focusArea}.`;
}

function generateRuleBasedInsights(
  channelName: string,
  provider: string,
  metrics: Record<string, { current: number; previous: number | null }>,
  focusArea: string
): GeneratedInsight[] {
  const insights: GeneratedInsight[] = [];

  // Engagement rate analysis
  const engagementRate = metrics["engagement_rate"];
  if (engagementRate) {
    const change = engagementRate.previous
      ? ((engagementRate.current - engagementRate.previous) / engagementRate.previous * 100)
      : 0;

    if (engagementRate.current > 4) {
      insights.push({
        type: "trend",
        title: "Strong Engagement",
        content: `Your engagement rate of ${engagementRate.current.toFixed(1)}% is above the industry average. Keep up the content quality!`,
        priority: "medium",
      });
    } else if (engagementRate.current < 2) {
      insights.push({
        type: "alert",
        title: "Low Engagement",
        content: `Your engagement rate of ${engagementRate.current.toFixed(1)}% is below average. Consider posting more interactive content like polls, questions, or behind-the-scenes content.`,
        priority: "high",
      });
    }

    if (change > 10) {
      insights.push({
        type: "trend",
        title: "Engagement Growing",
        content: `Engagement is up ${change.toFixed(1)}% compared to the previous period. Your recent content strategy is working well.`,
        priority: "medium",
      });
    } else if (change < -10) {
      insights.push({
        type: "alert",
        title: "Engagement Declining",
        content: `Engagement has dropped ${Math.abs(change).toFixed(1)}%. Review your recent posts to identify what's not resonating with your audience.`,
        priority: "high",
      });
    }
  }

  // Follower/Reach analysis
  const followers = metrics["followers"] || metrics["page_likes"];
  const reach = metrics["reach"];

  if (followers && reach) {
    const reachRatio = reach.current / followers.current;
    if (reachRatio > 1.5) {
      insights.push({
        type: "recommendation",
        title: "Viral Potential",
        content: `Your reach (${reach.current.toLocaleString()}) significantly exceeds your follower count. Your content is being shared! Consider creating more shareable content.`,
        priority: "medium",
      });
    }
  }

  // Growth analysis
  if (followers && followers.previous) {
    const growth = ((followers.current - followers.previous) / followers.previous * 100);
    if (growth > 5) {
      insights.push({
        type: "trend",
        title: "Strong Growth",
        content: `You've grown ${growth.toFixed(1)}% this period. Continue with your current content strategy and engagement tactics.`,
        priority: "low",
      });
    } else if (growth < 0) {
      insights.push({
        type: "alert",
        title: "Audience Shrinking",
        content: `You've lost ${Math.abs(growth).toFixed(1)}% of followers. Review recent content for anything that may have caused unfollows.`,
        priority: "high",
      });
    }
  }

  // Provider-specific insights
  if (provider === "instagram" || provider === "tiktok") {
    insights.push({
      type: "recommendation",
      title: "Video Content Opportunity",
      content: `${provider === "instagram" ? "Reels" : "Short videos"} typically get 2-3x more reach. Consider creating more video content.`,
      priority: "medium",
    });
  }

  // Email-specific insights
  if (provider === "email") {
    const openRate = metrics["open_rate"];
    if (openRate && openRate.current < 20) {
      insights.push({
        type: "alert",
        title: "Low Open Rate",
        content: `Your open rate of ${openRate.current.toFixed(1)}% is below average. Try A/B testing subject lines and sending at different times.`,
        priority: "high",
      });
    }
  }

  // Default summary if no specific insights
  if (insights.length === 0) {
    const metricCount = Object.keys(metrics).length;
    insights.push({
      type: "summary",
      title: "Channel Overview",
      content: `Your ${channelName} channel is tracking ${metricCount} metrics. Regular monitoring helps identify trends and opportunities for optimization.`,
      priority: "low",
    });
  }

  return insights;
}
