"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlassCard, PageHeader, GlassBadge, Spinner, ConfirmDialog, useToast } from "@/components/ui/glass";
import { apiGet, formatDateTime } from "@/lib/http";

interface Alert {
  id: string;
  type: "ar_aging" | "ap_due" | "low_inventory" | "fulfillment_pending";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  domain: "finance" | "inventory" | "sales" | "procurement";
  createdAt: string;
  metadata: Record<string, unknown>;
  actions: {
    plannerUrl?: string;
    createTask?: boolean;
    createCard?: boolean;
  };
}

interface AlertsResponse {
  items: Alert[];
  total: number;
  generatedAt: string;
}

const severityColors = {
  high: "danger",
  medium: "warning",
  low: "info",
} as const;

const domainIcons: Record<string, React.ReactNode> = {
  finance: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  ),
  inventory: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  ),
  sales: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  ),
  procurement: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
  ),
};

// Local storage key for snoozed/dismissed alerts
const ALERTS_DISMISSED_KEY = "udp-alerts-dismissed";
const ALERTS_SNOOZED_KEY = "udp-alerts-snoozed";

// Get domain planner URL
function getDomainPlannerUrl(domain: string): string {
  const mapping: Record<string, string> = {
    finance: "/finance",
    inventory: "/inventory/balances",
    sales: "/sales",
    procurement: "/procurement",
  };
  return mapping[domain] || "/dashboard";
}

export default function AlertsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [generatedAt, setGeneratedAt] = React.useState<string | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = React.useState<Set<string>>(new Set());
  const [snoozedAlerts, setSnoozedAlerts] = React.useState<Map<string, number>>(new Map());
  const [confirmDialog, setConfirmDialog] = React.useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: "", message: "", onConfirm: () => {} });

  // Load dismissed/snoozed alerts from localStorage
  React.useEffect(() => {
    try {
      const dismissed = localStorage.getItem(ALERTS_DISMISSED_KEY);
      if (dismissed) {
        setDismissedAlerts(new Set(JSON.parse(dismissed)));
      }
      const snoozed = localStorage.getItem(ALERTS_SNOOZED_KEY);
      if (snoozed) {
        const parsed = JSON.parse(snoozed);
        const now = Date.now();
        // Filter out expired snoozes
        const validSnoozes = new Map<string, number>();
        for (const [id, expiry] of Object.entries(parsed)) {
          if ((expiry as number) > now) {
            validSnoozes.set(id, expiry as number);
          }
        }
        setSnoozedAlerts(validSnoozes);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  React.useEffect(() => {
    async function loadData() {
      try {
        const data = await apiGet<AlertsResponse>("/api/grc/alerts");
        setAlerts(data.items || []);
        setGeneratedAt(data.generatedAt);
      } catch {
        // Silently handle - will show empty state
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleDismiss = (alertId: string) => {
    setConfirmDialog({
      open: true,
      title: "Dismiss Alert",
      message: "Are you sure you want to dismiss this alert? It will reappear if the underlying condition persists.",
      onConfirm: () => {
        const newDismissed = new Set(dismissedAlerts).add(alertId);
        setDismissedAlerts(newDismissed);
        try {
          localStorage.setItem(ALERTS_DISMISSED_KEY, JSON.stringify(Array.from(newDismissed)));
        } catch {
          // Ignore localStorage errors
        }
        addToast("success", "Alert dismissed");
        setConfirmDialog((prev) => ({ ...prev, open: false }));
      },
    });
  };

  const handleSnooze = (alertId: string, days: number) => {
    const expiry = Date.now() + days * 24 * 60 * 60 * 1000;
    const newSnoozed = new Map(snoozedAlerts).set(alertId, expiry);
    setSnoozedAlerts(newSnoozed);
    try {
      localStorage.setItem(ALERTS_SNOOZED_KEY, JSON.stringify(Object.fromEntries(newSnoozed)));
    } catch {
      // Ignore localStorage errors
    }
    addToast("info", `Alert snoozed for ${days} day${days > 1 ? "s" : ""}`);
  };

  const handleCreateTask = (alert: Alert) => {
    // Navigate to the domain's planner tab with the alert info
    const plannerUrl = getDomainPlannerUrl(alert.domain);
    // Store the alert info for the planner to pick up
    try {
      sessionStorage.setItem("udp-pending-task", JSON.stringify({
        title: alert.title,
        description: alert.description,
        priority: alert.severity,
        source: "alert",
        alertId: alert.id,
      }));
    } catch {
      // Ignore storage errors
    }
    addToast("success", "Task created! Opening planner...");
    setTimeout(() => {
      router.push(plannerUrl);
    }, 500);
  };

  const handleCreateCard = (alert: Alert) => {
    // Navigate to card studio with the alert info
    try {
      sessionStorage.setItem("udp-pending-card", JSON.stringify({
        title: alert.title,
        description: alert.description,
        priority: alert.severity,
        domain: alert.domain,
        type: "task_suggestion",
        source: "alert",
        alertId: alert.id,
      }));
    } catch {
      // Ignore storage errors
    }
    addToast("success", "Opening Card Studio...");
    setTimeout(() => {
      router.push("/dashboard/cards?create=true");
    }, 500);
  };

  // Filter out dismissed and snoozed alerts
  const visibleAlerts = alerts.filter((a) => {
    if (dismissedAlerts.has(a.id)) return false;
    const snoozeExpiry = snoozedAlerts.get(a.id);
    if (snoozeExpiry && snoozeExpiry > Date.now()) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const highCount = visibleAlerts.filter((a) => a.severity === "high").length;
  const mediumCount = visibleAlerts.filter((a) => a.severity === "medium").length;
  const lowCount = visibleAlerts.filter((a) => a.severity === "low").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        description="Risk alerts and business notifications"
        actions={
          generatedAt ? (
            <span className="text-xs text-white/40">
              Last updated: {formatDateTime(generatedAt)}
            </span>
          ) : null
        }
      />

      {/* Summary Cards */}
      {visibleAlerts.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <GlassCard className="!p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{highCount}</p>
                <p className="text-xs text-white/50">High Priority</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard className="!p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{mediumCount}</p>
                <p className="text-xs text-white/50">Medium Priority</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard className="!p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{lowCount}</p>
                <p className="text-xs text-white/50">Low Priority</p>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Alerts List */}
      <div className="space-y-4">
        {visibleAlerts.length > 0 ? (
          visibleAlerts.map((alert) => (
            <GlassCard key={alert.id} className="hover:bg-white/5 transition-colors">
              <div className="flex items-start gap-4">
                <div
                  className={`p-2 rounded-lg ${
                    alert.severity === "high"
                      ? "bg-red-500/20"
                      : alert.severity === "medium"
                      ? "bg-amber-500/20"
                      : "bg-blue-500/20"
                  }`}
                >
                  <div
                    className={
                      alert.severity === "high"
                        ? "text-red-400"
                        : alert.severity === "medium"
                        ? "text-amber-400"
                        : "text-blue-400"
                    }
                  >
                    {domainIcons[alert.domain] || (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-white">{alert.title}</h3>
                    <GlassBadge variant={severityColors[alert.severity]}>
                      {alert.severity}
                    </GlassBadge>
                    <GlassBadge variant="default">{alert.domain}</GlassBadge>
                  </div>
                  <p className="text-sm text-white/60">{alert.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {alert.actions.plannerUrl && (
                      <Link
                        href={alert.actions.plannerUrl}
                        className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/15 text-white rounded-lg transition-colors"
                      >
                        Go to Related
                      </Link>
                    )}
                    {alert.actions.createTask && (
                      <button
                        onClick={() => handleCreateTask(alert)}
                        className="px-3 py-1.5 text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors"
                      >
                        Create Task
                      </button>
                    )}
                    {alert.actions.createCard && (
                      <button
                        onClick={() => handleCreateCard(alert)}
                        className="px-3 py-1.5 text-xs bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-colors"
                      >
                        Create Card
                      </button>
                    )}
                    <button
                      onClick={() => handleSnooze(alert.id, 1)}
                      className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-white/50 rounded-lg transition-colors"
                    >
                      Snooze 1d
                    </button>
                    <button
                      onClick={() => handleSnooze(alert.id, 7)}
                      className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-white/50 rounded-lg transition-colors"
                    >
                      Snooze 7d
                    </button>
                    <button
                      onClick={() => handleDismiss(alert.id)}
                      className="px-3 py-1.5 text-xs bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-400 rounded-lg transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
                <span className="text-xs text-white/40">
                  {new Date(alert.createdAt).toLocaleDateString()}
                </span>
              </div>
            </GlassCard>
          ))
        ) : (
          <GlassCard>
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">All Clear</h3>
              <p className="text-white/50">
                {alerts.length > 0
                  ? "All alerts have been dismissed or snoozed."
                  : "No active alerts at this time."}
              </p>
            </div>
          </GlassCard>
        )}
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
