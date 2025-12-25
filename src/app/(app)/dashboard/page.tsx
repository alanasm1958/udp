"use client";

import * as React from "react";
import { GlassCard, PageHeader, StatPill, Spinner } from "@/components/ui/glass";
import { apiGet, formatCurrency, formatDateTime } from "@/lib/http";

interface DashboardStats {
  openAR: number;
  openAP: number;
  receipts7d: number;
  payments7d: number;
  inventoryOnHand: number;
}

interface ActivityItem {
  id: string;
  action: string;
  entityType: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
}

interface DashboardData {
  stats: DashboardStats;
  recentActivity: ActivityItem[];
}

export default function DashboardPage() {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function load() {
      try {
        const result = await apiGet<DashboardData>("/api/reports/dashboard");
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <GlassCard>
        <p className="text-red-400">{error}</p>
      </GlassCard>
    );
  }

  const stats = data?.stats;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Overview of your business" />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatPill label="Open AR" value={formatCurrency(stats?.openAR || 0)} />
        <StatPill label="Open AP" value={formatCurrency(stats?.openAP || 0)} />
        <StatPill label="Receipts (7d)" value={formatCurrency(stats?.receipts7d || 0)} trend="up" />
        <StatPill label="Payments (7d)" value={formatCurrency(stats?.payments7d || 0)} trend="down" />
        <StatPill label="Inventory On-Hand" value={Math.round(stats?.inventoryOnHand || 0)} />
      </div>

      {/* Recent Activity */}
      <GlassCard>
        <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
        <div className="space-y-2">
          {data?.recentActivity && data.recentActivity.length > 0 ? (
            data.recentActivity.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <div>
                    <span className="text-sm text-white/90">{formatAction(event.action)}</span>
                    <span className="text-sm text-white/50 ml-2">on {event.entityType}</span>
                  </div>
                </div>
                <span className="text-xs text-white/40">{formatDateTime(event.occurredAt)}</span>
              </div>
            ))
          ) : (
            <p className="text-white/40 text-sm">No recent activity</p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

function formatAction(action: string): string {
  return action
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
