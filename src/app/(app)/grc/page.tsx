"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GlassCard, PageHeader, GlassTabs, Spinner } from "@/components/ui/glass";
import { Planner } from "@/components/ai/Planner";
import { apiGet, formatDateTime } from "@/lib/http";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "planner", label: "Planner" },
];

interface AuditEvent {
  id: string;
  action: string;
  entityType: string;
  occurredAt: string;
}

interface AuditResponse {
  items: AuditEvent[];
  total: number;
}

interface Alert {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
}

interface AlertsResponse {
  items: Alert[];
  total: number;
}

function GRCPageContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = React.useState("overview");

  // Handle tab query param (e.g., ?tab=planner)
  React.useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && tabs.some((t) => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);
  const [auditData, setAuditData] = React.useState<AuditResponse | null>(null);
  const [alertsData, setAlertsData] = React.useState<AlertsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadData() {
      try {
        // Load recent audit events and alerts in parallel
        const [dashboardData, alertsResult] = await Promise.all([
          apiGet<{ recentActivity: AuditEvent[] }>("/api/reports/dashboard"),
          apiGet<AlertsResponse>("/api/grc/alerts"),
        ]);
        setAuditData({ items: dashboardData.recentActivity || [], total: 0 });
        setAlertsData(alertsResult);
      } catch {
        // Silently handle
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="GRC"
        description="Governance, risk management, and compliance"
      />

      <GlassTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "overview" && (
        <>
          {/* Quick Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link href="/grc/alerts">
              <GlassCard className="hover:bg-white/10 transition-colors cursor-pointer h-full">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-amber-500/20 relative">
                    <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                    </svg>
                    {alertsData && alertsData.items.length > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        {alertsData.items.length}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">Alerts</h3>
                    <p className="text-sm text-white/50 mt-1">
                      {alertsData && alertsData.items.length > 0 ? (
                        <>
                          {alertsData.items.filter((a) => a.severity === "high").length > 0 && (
                            <span className="text-red-400">{alertsData.items.filter((a) => a.severity === "high").length} high</span>
                          )}
                          {alertsData.items.filter((a) => a.severity === "high").length > 0 && alertsData.items.filter((a) => a.severity !== "high").length > 0 && ", "}
                          {alertsData.items.filter((a) => a.severity === "medium").length > 0 && (
                            <span className="text-amber-400">{alertsData.items.filter((a) => a.severity === "medium").length} medium</span>
                          )}
                          {alertsData.items.filter((a) => a.severity === "medium").length > 0 && alertsData.items.filter((a) => a.severity === "low").length > 0 && ", "}
                          {alertsData.items.filter((a) => a.severity === "low").length > 0 && (
                            <span className="text-blue-400">{alertsData.items.filter((a) => a.severity === "low").length} low</span>
                          )}
                        </>
                      ) : (
                        "Risk alerts and notifications"
                      )}
                    </p>
                  </div>
                </div>
              </GlassCard>
            </Link>

            <Link href="/grc/audit">
              <GlassCard className="hover:bg-white/10 transition-colors cursor-pointer h-full">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-blue-500/20">
                    <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Audit Log</h3>
                    <p className="text-sm text-white/50 mt-1">System activity and changes</p>
                  </div>
                </div>
              </GlassCard>
            </Link>

            <GlassCard className="border border-dashed border-white/20">
              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-white mb-1">Controls</h3>
                <p className="text-sm text-white/40">
                  Internal controls and policies (coming soon)
                </p>
              </div>
            </GlassCard>
          </div>

          {/* Recent Audit Activity */}
          <GlassCard>
            <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : auditData?.items && auditData.items.length > 0 ? (
              <div className="space-y-2">
                {auditData.items.slice(0, 5).map((event) => (
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
                ))}
              </div>
            ) : (
              <p className="text-white/40 text-sm py-4">No recent activity</p>
            )}
          </GlassCard>
        </>
      )}

      {activeTab === "planner" && (
        <Planner domain="grc" domainLabel="GRC" />
      )}
    </div>
  );
}

export default function GRCPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>}>
      <GRCPageContent />
    </Suspense>
  );
}

function formatAction(action: string): string {
  return action
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
