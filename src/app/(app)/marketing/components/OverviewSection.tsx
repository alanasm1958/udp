"use client";

import * as React from "react";
import Link from "next/link";
import { GlassCard, GlassBadge, Spinner, GlassButton, EmptyState } from "@/components/ui/glass";
import { apiGet } from "@/lib/http";

interface OverviewData {
  channels: {
    total: number;
    connected: number;
    manual: number;
    error: number;
  };
  campaigns: {
    active: number;
    totalBudget: number;
    totalSpent: number;
    items: Array<{
      id: string;
      name: string;
      status: string;
      budget: string | null;
      spentToDate: string | null;
    }>;
  };
  plans: {
    total: number;
    items: Array<{
      id: string;
      name: string;
      status: string;
      budgetTotal: string | null;
      createdAt: string;
    }>;
  };
  insights: {
    total: number;
    items: Array<{
      id: string;
      title: string;
      description: string;
      severity: string;
      status: string;
    }>;
  };
  metrics: {
    period: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    leads: number;
  };
  nextBestAction: {
    type: string;
    title: string;
    description: string;
    actionUrl: string;
  };
}

interface MarketingTask {
  id: string;
  taskType: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  whyThis?: string;
  nextAction?: string;
  actionUrl?: string;
}

interface OverviewSectionProps {
  onNavigate: (tab: string, params?: Record<string, string>) => void;
  onStartOnboarding?: () => void;
}

export function OverviewSection({ onNavigate, onStartOnboarding }: OverviewSectionProps) {
  const [data, setData] = React.useState<OverviewData | null>(null);
  const [tasks, setTasks] = React.useState<MarketingTask[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function loadOverview() {
      try {
        // Load overview and tasks in parallel
        const [overviewResult, tasksResult] = await Promise.all([
          apiGet<OverviewData>("/api/marketing/overview"),
          apiGet<{ tasks: MarketingTask[] }>("/api/marketing/tasks?status=pending").catch(() => ({ tasks: [] })),
        ]);
        setData(overviewResult);
        setTasks(tasksResult.tasks || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load overview");
      } finally {
        setLoading(false);
      }
    }
    loadOverview();
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
      <GlassCard className="!bg-red-500/10 border border-red-500/20">
        <p className="text-red-400">{error}</p>
      </GlassCard>
    );
  }

  if (!data) {
    return null;
  }

  const hasActivity = data.campaigns.active > 0 || data.plans.total > 0 || data.channels.total > 0;

  return (
    <div className="space-y-6">
      {/* Next Best Action Card */}
      <GlassCard className="!bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-500/20">
              <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Recommended Next Step</p>
              <h3 className="font-semibold text-white">{data.nextBestAction.title}</h3>
              <p className="text-sm text-white/60">{data.nextBestAction.description}</p>
            </div>
          </div>
          <GlassButton
            variant="primary"
            onClick={() => {
              const url = new URL(data.nextBestAction.actionUrl, window.location.origin);
              const tab = url.searchParams.get("tab");
              if (tab) {
                const params: Record<string, string> = {};
                url.searchParams.forEach((value, key) => {
                  if (key !== "tab") params[key] = value;
                });
                onNavigate(tab, params);
              }
            }}
          >
            Get Started
            <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </GlassButton>
        </div>
      </GlassCard>

      {/* Pending Tasks Section */}
      {tasks.length > 0 && (
        <GlassCard className="!bg-amber-500/5 border border-amber-500/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Tasks ({tasks.length})
            </h3>
          </div>
          <div className="space-y-2">
            {tasks.slice(0, 3).map((task) => (
              <div
                key={task.id}
                className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                onClick={() => {
                  if (task.actionUrl) {
                    const url = new URL(task.actionUrl, window.location.origin);
                    const tab = url.searchParams.get("tab");
                    if (tab) {
                      const params: Record<string, string> = {};
                      url.searchParams.forEach((value, key) => {
                        if (key !== "tab") params[key] = value;
                      });
                      onNavigate(tab, params);
                    }
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 w-2 h-2 rounded-full ${
                    task.priority === 1 ? "bg-red-400" :
                    task.priority === 2 ? "bg-amber-400" : "bg-blue-400"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{task.title}</p>
                    <p className="text-xs text-white/50 truncate">{task.description}</p>
                    {task.nextAction && (
                      <p className="text-xs text-amber-400 mt-1">{task.nextAction}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {!hasActivity ? (
        <EmptyState
          title="Welcome to Marketing"
          description="Create your first marketing plan to start tracking campaigns and analyzing performance"
          icon={
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
            </svg>
          }
          action={
            <div className="flex gap-2">
              {onStartOnboarding && (
                <GlassButton variant="primary" onClick={onStartOnboarding}>
                  Get Started (Guided)
                </GlassButton>
              )}
              <GlassButton variant="ghost" onClick={() => onNavigate("planner")}>
                Create Plan Manually
              </GlassButton>
            </div>
          }
        />
      ) : (
        <>
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <GlassCard className="text-center">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Spend (30d)</p>
              <p className="text-2xl font-bold text-white">
                ${data.metrics.spend.toLocaleString()}
              </p>
            </GlassCard>
            <GlassCard className="text-center">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Leads</p>
              <p className="text-2xl font-bold text-white">
                {data.metrics.leads.toLocaleString()}
              </p>
            </GlassCard>
            <GlassCard className="text-center">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Conversions</p>
              <p className="text-2xl font-bold text-white">
                {data.metrics.conversions.toLocaleString()}
              </p>
            </GlassCard>
            <GlassCard className="text-center">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Revenue</p>
              <p className="text-2xl font-bold text-emerald-400">
                ${data.metrics.revenue.toLocaleString()}
              </p>
            </GlassCard>
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Active Campaigns */}
            <GlassCard>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3" />
                  </svg>
                  Active Campaigns ({data.campaigns.active})
                </h3>
                <button
                  onClick={() => onNavigate("campaigns")}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  View All
                </button>
              </div>
              {data.campaigns.items.length === 0 ? (
                <p className="text-sm text-white/40">No active campaigns</p>
              ) : (
                <div className="space-y-2">
                  {data.campaigns.items.slice(0, 3).map((campaign) => (
                    <div
                      key={campaign.id}
                      className="p-3 rounded-lg bg-white/5 hover:bg-white/8 transition-colors cursor-pointer"
                      onClick={() => onNavigate("campaigns", { campaignId: campaign.id })}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white">{campaign.name}</span>
                        <GlassBadge variant={campaign.status === "active" ? "success" : "default"}>
                          {campaign.status}
                        </GlassBadge>
                      </div>
                      {campaign.budget && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-white/50 mb-1">
                            <span>Budget: ${Number(campaign.budget).toLocaleString()}</span>
                            <span>Spent: ${Number(campaign.spentToDate || 0).toLocaleString()}</span>
                          </div>
                          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{
                                width: `${Math.min(100, (Number(campaign.spentToDate || 0) / Number(campaign.budget)) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>

            {/* Insights & Alerts */}
            <GlassCard>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  Insights ({data.insights.total})
                </h3>
              </div>
              {data.insights.items.length === 0 ? (
                <p className="text-sm text-white/40">No active insights</p>
              ) : (
                <div className="space-y-2">
                  {data.insights.items.slice(0, 4).map((insight) => (
                    <div
                      key={insight.id}
                      className="p-3 rounded-lg bg-white/5"
                    >
                      <div className="flex items-start gap-2">
                        <GlassBadge
                          variant={
                            insight.severity === "critical" ? "danger" :
                            insight.severity === "warning" ? "warning" : "info"
                          }
                        >
                          {insight.severity}
                        </GlassBadge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white">{insight.title}</p>
                          <p className="text-xs text-white/50 truncate">{insight.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>

          {/* Channel Summary */}
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
                Channels ({data.channels.total})
              </h3>
              <button
                onClick={() => onNavigate("planner", { action: "addChannel" })}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Add Channel
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 rounded-lg bg-white/5">
                <p className="text-xl font-bold text-emerald-400">{data.channels.connected}</p>
                <p className="text-xs text-white/50">Connected</p>
              </div>
              <div className="p-3 rounded-lg bg-white/5">
                <p className="text-xl font-bold text-blue-400">{data.channels.manual}</p>
                <p className="text-xs text-white/50">Manual</p>
              </div>
              <div className="p-3 rounded-lg bg-white/5">
                <p className="text-xl font-bold text-red-400">{data.channels.error}</p>
                <p className="text-xs text-white/50">Error</p>
              </div>
            </div>
          </GlassCard>
        </>
      )}
    </div>
  );
}
