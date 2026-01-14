"use client";

import * as React from "react";
import {
  SlideOver,
  GlassCard,
  GlassButton,
  GlassTabs,
  Spinner,
  useToast,
} from "@/components/ui/glass";
import { apiGet, apiPost } from "@/lib/http";

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

interface ChannelMetric {
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

interface ChannelInsight {
  id: string;
  type: string;
  title: string;
  content: string;
  priority: "high" | "medium" | "low";
  generatedAt: string;
}

interface ChannelAnalytics {
  channel: {
    id: string;
    name: string;
    type: string;
    status: string;
    integrationProvider: string;
    isConnected: boolean;
  };
  connector: {
    lastSyncAt?: string;
    isActive: boolean;
    accountInfo?: {
      name?: string;
      username?: string;
      email?: string;
    };
  } | null;
  metrics: ChannelMetric[];
  insights: ChannelInsight[];
  needsSync: boolean;
  period: string;
}

interface ChannelDetailSlideOverProps {
  open: boolean;
  onClose: () => void;
  channelId: string;
  channelName: string;
  channelColor: string;
  channelIcon: string;
  onDisconnect: () => void;
  onEdit?: () => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPER COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function MetricCard({
  metric,
  large = false,
}: {
  metric: ChannelMetric;
  large?: boolean;
}) {
  const trendColors = {
    up: "text-emerald-400",
    down: "text-red-400",
    stable: "text-white/40",
  };

  return (
    <GlassCard className={`${large ? "p-4" : "p-3"}`}>
      <p className={`text-white/60 ${large ? "text-sm" : "text-xs"} mb-1`}>
        {metric.label}
      </p>
      <p className={`font-bold text-white ${large ? "text-2xl" : "text-lg"}`}>
        {metric.formatted}
      </p>
      <div className={`flex items-center gap-1 mt-1 ${trendColors[metric.trend]}`}>
        {metric.trend === "up" && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        )}
        {metric.trend === "down" && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        )}
        <span className={large ? "text-sm" : "text-xs"}>{metric.trendFormatted}</span>
        <span className="text-white/30 text-xs ml-1">vs prev</span>
      </div>
    </GlassCard>
  );
}

function InsightCard({ insight }: { insight: ChannelInsight }) {
  const priorityColors = {
    high: "border-red-500/30 bg-red-500/5",
    medium: "border-amber-500/30 bg-amber-500/5",
    low: "border-blue-500/30 bg-blue-500/5",
  };

  const priorityIcons = {
    high: (
      <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    medium: (
      <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    low: (
      <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  };

  return (
    <div className={`rounded-xl border p-4 ${priorityColors[insight.priority]}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{priorityIcons[insight.priority]}</div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-white mb-1">{insight.title}</h4>
          <p className="text-sm text-white/70 leading-relaxed">{insight.content}</p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export function ChannelDetailSlideOver({
  open,
  onClose,
  channelId,
  channelName,
  channelColor,
  channelIcon,
  onDisconnect,
  onEdit,
}: ChannelDetailSlideOverProps) {
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [generatingInsights, setGeneratingInsights] = React.useState(false);
  const [analytics, setAnalytics] = React.useState<ChannelAnalytics | null>(null);
  const [period, setPeriod] = React.useState("30d");
  const { addToast } = useToast();

  const fetchAnalytics = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiGet<ChannelAnalytics>(
        `/api/marketing/channels/${channelId}/analytics?period=${period}`
      );
      setAnalytics(response);
      return response;
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
      addToast("error", "Failed to load analytics");
      return null;
    } finally {
      setLoading(false);
    }
  }, [channelId, period, addToast]);

  // Fetch analytics when panel opens or period changes
  React.useEffect(() => {
    if (open && channelId) {
      fetchAnalytics();
    }
  }, [open, channelId, period, fetchAnalytics]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await apiPost(`/api/marketing/channels/${channelId}/sync`, { period });
      await fetchAnalytics();
      addToast("success", "Channel synced successfully");
    } catch (error) {
      addToast("error", "Failed to sync channel");
      console.error("Sync failed:", error);
    } finally {
      setSyncing(false);
    }
  };

  const handleGenerateInsights = async () => {
    setGeneratingInsights(true);
    try {
      await apiPost(`/api/marketing/channels/${channelId}/ai-insights`, {
        focusArea: "all",
      });
      await fetchAnalytics();
      addToast("success", "AI insights generated");
    } catch (error) {
      addToast("error", "Failed to generate insights");
      console.error("AI insights failed:", error);
    } finally {
      setGeneratingInsights(false);
    }
  };

  const periodTabs = [
    { id: "7d", label: "7 Days" },
    { id: "30d", label: "30 Days" },
    { id: "90d", label: "90 Days" },
  ];

  return (
    <SlideOver open={open} onClose={onClose} title="" width="lg">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 pb-4 border-b border-white/10">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: `${channelColor}20` }}
        >
          <svg className="w-7 h-7" fill={channelColor} viewBox="0 0 24 24">
            <path d={channelIcon} />
          </svg>
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-white">{channelName} Analytics</h2>
          {analytics?.connector?.accountInfo && (
            <p className="text-sm text-white/50">
              {analytics.connector.accountInfo.username ||
                analytics.connector.accountInfo.name ||
                analytics.connector.accountInfo.email}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? <Spinner size="sm" /> : "Sync"}
          </GlassButton>
        </div>
      </div>

      {/* Period Selector */}
      <div className="mb-6">
        <GlassTabs
          tabs={periodTabs}
          activeTab={period}
          onTabChange={(id) => setPeriod(id)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Metrics Grid */}
          <div>
            <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3">
              Performance Metrics
            </h3>
            {analytics?.metrics && analytics.metrics.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {analytics.metrics.map((metric) => (
                  <MetricCard key={metric.type} metric={metric} large />
                ))}
              </div>
            ) : (
              <GlassCard className="text-center py-8">
                <p className="text-white/50 mb-3">No metrics available</p>
                <GlassButton variant="primary" size="sm" onClick={handleSync} disabled={syncing}>
                  {syncing ? "Syncing..." : "Sync Channel Data"}
                </GlassButton>
              </GlassCard>
            )}
          </div>

          {/* AI Insights */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
                AI Insights
              </h3>
              <GlassButton
                variant="ghost"
                size="sm"
                onClick={handleGenerateInsights}
                disabled={generatingInsights || !analytics?.metrics?.length}
              >
                {generatingInsights ? (
                  <>
                    <Spinner size="sm" />
                    <span className="ml-2">Generating...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Generate Insights
                  </>
                )}
              </GlassButton>
            </div>
            {analytics?.insights && analytics.insights.length > 0 ? (
              <div className="space-y-3">
                {analytics.insights.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} />
                ))}
              </div>
            ) : (
              <GlassCard className="text-center py-6">
                <svg className="w-8 h-8 mx-auto text-white/30 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <p className="text-white/50 text-sm">
                  {analytics?.metrics?.length
                    ? "Click 'Generate Insights' to get AI-powered analysis"
                    : "Sync channel data first to generate insights"}
                </p>
              </GlassCard>
            )}
          </div>

          {/* Connection Info */}
          <div>
            <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3">
              Connection Details
            </h3>
            <GlassCard>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">Status</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-sm text-white">Connected</span>
                  </div>
                </div>
                {analytics?.connector?.lastSyncAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/60">Last Synced</span>
                    <span className="text-sm text-white">
                      {new Date(analytics.connector.lastSyncAt).toLocaleString()}
                    </span>
                  </div>
                )}
                {analytics?.connector?.accountInfo?.email && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/60">Account</span>
                    <span className="text-sm text-white">
                      {analytics.connector.accountInfo.email}
                    </span>
                  </div>
                )}
              </div>
            </GlassCard>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-white/10">
            <div className="flex gap-3">
              {onEdit && (
                <GlassButton variant="ghost" className="flex-1" onClick={onEdit}>
                  Edit Credentials
                </GlassButton>
              )}
              <GlassButton
                variant="ghost"
                className="flex-1 !text-red-400 hover:!bg-red-500/10"
                onClick={onDisconnect}
              >
                Disconnect Channel
              </GlassButton>
            </div>
          </div>
        </div>
      )}
    </SlideOver>
  );
}

export default ChannelDetailSlideOver;
