"use client";

import * as React from "react";
import { GlassButton, Spinner, useToast } from "@/components/ui/glass";
import { apiGet, apiPost } from "@/lib/http";

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ChannelMetric {
  type: string;
  label: string;
  value: number;
  formatted: string;
  trend: "up" | "down" | "stable";
  trendValue: number;
  trendFormatted: string;
}

export interface ChannelData {
  id: string;
  name: string;
  type: string;
  icon: string;
  color: string;
  status: "manual" | "connected" | "disconnected" | "paused" | "error";
  integrationProvider?: string;
  lastSyncAt?: string;
  metrics?: ChannelMetric[];
  accountInfo?: {
    name?: string;
    username?: string;
    email?: string;
  };
}

interface ChannelCardProps {
  channel: ChannelData;
  onConnect: () => void;
  onDisconnect: () => void;
  onExpand: () => void;
  disconnecting?: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPER FUNCTIONS
   ═══════════════════════════════════════════════════════════════════════════ */

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/* ═══════════════════════════════════════════════════════════════════════════
   CHANNEL CARD COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export function ChannelCard({
  channel,
  onConnect,
  onDisconnect,
  onExpand,
  disconnecting,
}: ChannelCardProps) {
  const [loading, setLoading] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [metrics, setMetrics] = React.useState<ChannelMetric[] | null>(channel.metrics || null);
  const [lastSyncAt, setLastSyncAt] = React.useState<string | undefined>(channel.lastSyncAt);
  const { addToast } = useToast();

  const isConnected = channel.status === "connected";

  const fetchAnalytics = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiGet<{
        metrics: ChannelMetric[];
        connector?: { lastSyncAt?: string };
        needsSync: boolean;
      }>(`/api/marketing/channels/${channel.id}/analytics`);

      setMetrics(response.metrics);
      if (response.connector?.lastSyncAt) {
        setLastSyncAt(response.connector.lastSyncAt);
      }

      return response;
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [channel.id]);

  // Fetch analytics when card mounts if connected
  React.useEffect(() => {
    if (isConnected && !metrics) {
      fetchAnalytics();
    }
  }, [isConnected, metrics, fetchAnalytics]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await apiPost<{
        success: boolean;
        metrics: ChannelMetric[];
        syncedAt: string;
      }>(`/api/marketing/channels/${channel.id}/sync`, { period: "30d" });

      if (response.success) {
        setMetrics(response.metrics.map(m => ({
          ...m,
          formatted: formatMetricValue(m.value, m.type),
          trendFormatted: `${m.trendValue >= 0 ? "+" : ""}${m.trendValue.toFixed(1)}%`,
        })));
        setLastSyncAt(response.syncedAt);
        addToast("success", "Channel synced successfully");
      }
    } catch (error) {
      addToast("error", "Failed to sync channel");
      console.error("Sync failed:", error);
    } finally {
      setSyncing(false);
    }
  };

  const formatMetricValue = (value: number, type: string): string => {
    if (type.includes("rate") || type.includes("ctr")) {
      return `${value.toFixed(1)}%`;
    }
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString();
  };

  // Get top 3 metrics for display
  const displayMetrics = metrics?.slice(0, 3) || [];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl transition-all duration-200 ${
        isConnected
          ? "bg-white/10 border-white/20 hover:bg-white/12 cursor-pointer"
          : "bg-white/5 border-white/10 hover:bg-white/8"
      }`}
      onClick={isConnected ? onExpand : undefined}
    >
      {/* Connected indicator */}
      {isConnected && (
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <span className="text-[10px] text-emerald-400 font-medium uppercase tracking-wider">Live</span>
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${channel.color}20` }}
          >
            <svg className="w-5 h-5" fill={channel.color} viewBox="0 0 24 24">
              <path d={channel.icon} />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-white truncate">{channel.name}</h4>
            <p className="text-xs text-white/50 capitalize">
              {channel.accountInfo?.username || channel.accountInfo?.name || channel.type}
            </p>
          </div>
        </div>

        {/* Metrics (Connected State) */}
        {isConnected && (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Spinner size="sm" />
              </div>
            ) : displayMetrics.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {displayMetrics.map((metric) => (
                  <div key={metric.type} className="text-center">
                    <p className="text-xs text-white/50 truncate">{metric.label}</p>
                    <p className="text-sm font-semibold text-white">{metric.formatted}</p>
                    <div
                      className={`flex items-center justify-center gap-0.5 text-[10px] ${
                        metric.trend === "up"
                          ? "text-emerald-400"
                          : metric.trend === "down"
                          ? "text-red-400"
                          : "text-white/40"
                      }`}
                    >
                      {metric.trend === "up" && (
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                        </svg>
                      )}
                      {metric.trend === "down" && (
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                      )}
                      <span>{metric.trendFormatted}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-3 text-center">
                <p className="text-xs text-white/40">No metrics yet</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSync();
                  }}
                  disabled={syncing}
                  className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                >
                  {syncing ? "Syncing..." : "Sync now"}
                </button>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="text-[10px] text-white/40">
                {lastSyncAt ? `Synced ${formatTimeAgo(lastSyncAt)}` : "Never synced"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSync();
                  }}
                  disabled={syncing}
                  className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                  title="Refresh data"
                >
                  <svg
                    className={`w-3.5 h-3.5 text-white/50 ${syncing ? "animate-spin" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
                <span className="text-[10px] text-blue-400 flex items-center gap-1">
                  View
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </div>
          </>
        )}

        {/* Actions (Disconnected State) */}
        {!isConnected && (
          <div className="mt-2">
            <GlassButton
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                onConnect();
              }}
            >
              Connect
            </GlassButton>
          </div>
        )}

        {/* Disconnect button for connected channels (shown on hover via parent) */}
        {isConnected && (
          <div className="mt-2 pt-2 border-t border-white/10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDisconnect();
              }}
              disabled={disconnecting}
              className="w-full py-1.5 rounded-xl text-xs font-medium transition-all bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-50"
            >
              {disconnecting ? "..." : "Disconnect"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChannelCard;
