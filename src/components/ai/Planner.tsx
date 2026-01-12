"use client";

import * as React from "react";
import Link from "next/link";
import { GlassCard, GlassBadge, Spinner, GlassButton, EmptyState, SlideOver, GlassInput, GlassTextarea, GlassSelect, useToast } from "@/components/ui/glass";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/http";

export type PlannerDomain = "finance" | "sales" | "procurement" | "inventory" | "marketing" | "customers" | "operations" | "grc" | "strategy" | "people" | "company";

interface Alert {
  id: string;
  type: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  domain: string;
  metadata: Record<string, unknown>;
  actions: {
    plannerUrl?: string;
    createTask?: boolean;
    createCard?: boolean;
  };
}

interface Initiative {
  id: string;
  title: string;
  description: string;
  horizon: "run" | "improve" | "grow";
  status: "pending" | "active" | "completed";
  priority: "high" | "medium" | "low";
  playbookId?: string;
}

interface PlannerProps {
  domain: PlannerDomain;
  domainLabel: string;
  initiatives?: Initiative[];
  onCreateTask?: (alert: Alert) => void;
  onCreateCard?: (alert: Alert) => void;
}

const horizonTabs = [
  { id: "run", label: "Run Now", color: "blue", description: "Immediate actions and daily operations" },
  { id: "improve", label: "Improve 30-90d", color: "purple", description: "Process improvements and optimizations" },
  { id: "grow", label: "Grow Quarter-Year", color: "emerald", description: "Strategic initiatives and expansion" },
] as const;

type Horizon = typeof horizonTabs[number]["id"];

const severityColors = {
  high: "danger",
  medium: "warning",
  low: "info",
} as const;

const priorityColors = {
  high: "text-red-400",
  medium: "text-amber-400",
  low: "text-blue-400",
};

export function Planner({
  domain,
  domainLabel,
  initiatives: initialInitiatives,
  onCreateTask,
  onCreateCard,
}: PlannerProps) {
  const [activeHorizon, setActiveHorizon] = React.useState<Horizon>("run");
  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [initiatives, setInitiatives] = React.useState<Initiative[]>(initialInitiatives || []);
  const [dismissedAlerts, setDismissedAlerts] = React.useState<Set<string>>(new Set());
  const [editingInit, setEditingInit] = React.useState<Initiative | null>(null);
  const [editForm, setEditForm] = React.useState({ title: "", description: "", priority: "medium" as Initiative["priority"] });
  const [saving, setSaving] = React.useState(false);
  const { addToast } = useToast();

  // Load initiatives from API on mount
  React.useEffect(() => {
    async function loadInitiatives() {
      try {
        const result = await apiGet<{ items: Initiative[] }>(`/api/planner/initiatives?domain=${domain}`);
        setInitiatives(result.items);
      } catch {
        // Silently fail - will show empty state
      }
    }
    loadInitiatives();
  }, [domain]);

  // Load dismissed alerts from API on mount
  React.useEffect(() => {
    async function loadDismissedAlerts() {
      try {
        const result = await apiGet<{ dismissedAlertIds: string[] }>(`/api/planner/alerts/dismissed?domain=${domain}`);
        setDismissedAlerts(new Set(result.dismissedAlertIds));
      } catch {
        // Silently fail
      }
    }
    loadDismissedAlerts();
  }, [domain]);

  // Check for pending task from sessionStorage (from alerts page)
  React.useEffect(() => {
    try {
      const pendingTask = sessionStorage.getItem("udp-pending-task");
      if (pendingTask) {
        const task = JSON.parse(pendingTask);
        sessionStorage.removeItem("udp-pending-task");

        // Create initiative via API
        createInitiative({
          title: task.title || "New Task",
          description: task.description || "",
          horizon: "run",
          priority: task.priority || "medium",
        }).then(() => {
          addToast("success", "Task added to planner");
        });
      }
    } catch { /* Ignore sessionStorage errors */ }
  }, [domain, addToast]);

  // Fetch domain-specific alerts
  React.useEffect(() => {
    async function loadAlerts() {
      try {
        const result = await apiGet<{ items: Alert[] }>("/api/grc/alerts");
        // Filter alerts for this domain
        const domainAlerts = result.items.filter(
          (a) => a.domain === domain || mapDomainToAlertDomain(domain) === a.domain
        );
        setAlerts(domainAlerts);
      } catch {
        // Silently fail - alerts are optional
      } finally {
        setLoading(false);
      }
    }
    loadAlerts();
  }, [domain]);

  // Create initiative via API
  const createInitiative = async (data: {
    title: string;
    description?: string;
    horizon: Horizon;
    priority: Initiative["priority"];
    playbookId?: string;
  }) => {
    try {
      setSaving(true);
      const result = await apiPost<{ success: boolean; initiative: Initiative; error?: string; existingId?: string }>(
        "/api/planner/initiatives",
        {
          domain,
          horizon: data.horizon,
          title: data.title,
          description: data.description || "",
          priority: data.priority,
          playbookId: data.playbookId,
        }
      );

      if (result.success && result.initiative) {
        setInitiatives((prev) => [result.initiative, ...prev]);
        return result.initiative;
      } else if (result.existingId) {
        addToast("warning", "This playbook initiative already exists");
        return null;
      }
      return null;
    } catch (error) {
      addToast("error", "Failed to create initiative");
      console.error("Create initiative error:", error);
      return null;
    } finally {
      setSaving(false);
    }
  };

  // Update initiative via API
  const updateInitiative = async (id: string, updates: Partial<Pick<Initiative, "title" | "description" | "priority" | "status" | "horizon">>) => {
    try {
      setSaving(true);
      const result = await apiPatch<{ success: boolean; initiative: Initiative }>(
        `/api/planner/initiatives/${id}`,
        updates
      );

      if (result.success && result.initiative) {
        setInitiatives((prev) =>
          prev.map((i) => (i.id === id ? result.initiative : i))
        );
        return true;
      }
      return false;
    } catch (error) {
      addToast("error", "Failed to update initiative");
      console.error("Update initiative error:", error);
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Delete initiative via API
  const deleteInitiative = async (id: string) => {
    try {
      setSaving(true);
      await apiDelete(`/api/planner/initiatives/${id}`);
      setInitiatives((prev) => prev.filter((i) => i.id !== id));
      return true;
    } catch (error) {
      addToast("error", "Failed to delete initiative");
      console.error("Delete initiative error:", error);
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Dismiss alert via API
  const handleDismissAlert = async (alertId: string) => {
    // Optimistic update
    setDismissedAlerts((prev) => new Set(prev).add(alertId));

    try {
      await apiPost(`/api/planner/alerts/${alertId}/dismiss`, { domain });
    } catch (error) {
      // Revert on error
      setDismissedAlerts((prev) => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
      addToast("error", "Failed to dismiss alert");
      console.error("Dismiss alert error:", error);
    }
  };

  const handleCreateTaskFromAlert = async (alert: Alert) => {
    if (onCreateTask) {
      onCreateTask(alert);
    } else {
      // Create initiative via API
      const newInit = await createInitiative({
        title: alert.title,
        description: alert.description,
        horizon: "run",
        priority: alert.severity,
      });
      if (newInit) {
        handleDismissAlert(alert.id);
      }
    }
  };

  const visibleAlerts = alerts.filter((a) => !dismissedAlerts.has(a.id));
  const horizonInitiatives = initiatives.filter((i) => i.horizon === activeHorizon);
  const activeTab = horizonTabs.find((t) => t.id === activeHorizon)!;

  return (
    <div className="space-y-4">
      {/* Horizon Tabs */}
      <div className="flex gap-2 flex-wrap">
        {horizonTabs.map((tab) => {
          const isActive = activeHorizon === tab.id;
          const colorClasses = {
            blue: isActive ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "text-white/50 hover:text-blue-400 hover:bg-blue-500/10",
            purple: isActive ? "bg-purple-500/20 text-purple-400 border-purple-500/30" : "text-white/50 hover:text-purple-400 hover:bg-purple-500/10",
            emerald: isActive ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "text-white/50 hover:text-emerald-400 hover:bg-emerald-500/10",
          };
          return (
            <button
              key={tab.id}
              onClick={() => setActiveHorizon(tab.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${colorClasses[tab.color]} ${isActive ? "" : "border-transparent"}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Horizon Description */}
      <p className="text-sm text-white/40">{activeTab.description}</p>

      {/* Diagnosis Panel - Shows Alerts */}
      {loading ? (
        <GlassCard>
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        </GlassCard>
      ) : visibleAlerts.length > 0 ? (
        <GlassCard>
          <h3 className="text-sm font-semibold text-white/70 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            Diagnosis - Items Requiring Attention
          </h3>
          <div className="space-y-2">
            {visibleAlerts.map((alert) => (
              <div
                key={alert.id}
                className="p-3 rounded-xl bg-white/5 hover:bg-white/8 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <GlassBadge variant={severityColors[alert.severity]}>
                        {alert.severity}
                      </GlassBadge>
                      <span className="text-sm font-medium text-white">{alert.title}</span>
                    </div>
                    <p className="text-xs text-white/50">{alert.description}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {alert.actions.createTask && (
                      <button
                        onClick={() => handleCreateTaskFromAlert(alert)}
                        disabled={saving}
                        className="p-1.5 text-white/40 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors disabled:opacity-50"
                        title="Create task"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                      </button>
                    )}
                    {alert.actions.createCard && onCreateCard && (
                      <button
                        onClick={() => onCreateCard(alert)}
                        className="p-1.5 text-white/40 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors"
                        title="Create AI card"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                      </button>
                    )}
                    {alert.actions.plannerUrl && (
                      <Link
                        href={alert.actions.plannerUrl}
                        className="p-1.5 text-white/40 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                        title="Go to related area"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </Link>
                    )}
                    <button
                      onClick={() => handleDismissAlert(alert.id)}
                      className="p-1.5 text-white/40 hover:text-white/60 rounded-lg transition-colors"
                      title="Dismiss"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      ) : null}

      {/* Initiatives / Action Queue */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
            </svg>
            {activeTab.label} - Initiatives
          </h3>
          <GlassButton
            size="sm"
            variant="ghost"
            disabled={saving}
            onClick={async () => {
              await createInitiative({
                title: `New ${domainLabel} Initiative`,
                description: "Click to edit description",
                horizon: activeHorizon,
                priority: "medium",
              });
            }}
          >
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Initiative
          </GlassButton>
        </div>

        {horizonInitiatives.length === 0 ? (
          <EmptyState
            title={`No ${activeTab.label} initiatives`}
            description={`Add initiatives from alerts or create new ones to plan your ${domainLabel.toLowerCase()} activities.`}
            icon={
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
              </svg>
            }
          />
        ) : (
          <div className="space-y-2">
            {horizonInitiatives.map((init) => (
              <div
                key={init.id}
                className="p-3 rounded-xl bg-white/5 hover:bg-white/8 transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs ${priorityColors[init.priority]}`}>
                        {init.priority === "high" ? "!" : init.priority === "medium" ? "-" : ""}
                      </span>
                      <span className="text-sm font-medium text-white">{init.title}</span>
                      <GlassBadge variant={init.status === "completed" ? "success" : init.status === "active" ? "info" : "default"}>
                        {init.status}
                      </GlassBadge>
                    </div>
                    <p className="text-xs text-white/50">{init.description}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setEditingInit(init);
                        setEditForm({ title: init.title, description: init.description, priority: init.priority });
                      }}
                      disabled={saving}
                      className="p-1.5 text-white/40 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors disabled:opacity-50"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                    <button
                      onClick={async () => {
                        const nextStatus = init.status === "completed" ? "pending" : init.status === "active" ? "completed" : "active";
                        await updateInitiative(init.id, { status: nextStatus });
                      }}
                      disabled={saving}
                      className="p-1.5 text-white/40 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-50"
                      title="Change status"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteInitiative(init.id)}
                      disabled={saving}
                      className="p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                      title="Remove"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Playbooks Section */}
      <GlassCard>
        <h3 className="text-sm font-semibold text-white/70 mb-3 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
          Playbooks
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {getPlaybooksForDomain(domain).map((playbook) => (
            <button
              key={playbook.id}
              disabled={saving}
              onClick={async () => {
                const newInit = await createInitiative({
                  title: playbook.title,
                  description: playbook.description,
                  horizon: activeHorizon,
                  priority: "medium",
                  playbookId: playbook.id,
                });
                if (newInit) {
                  addToast("success", `Added "${playbook.title}" to ${activeTab.label}`);
                }
              }}
              className="p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left group disabled:opacity-50"
            >
              <p className="text-sm font-medium text-white mb-1 flex items-center justify-between">
                {playbook.title}
                <svg className="w-4 h-4 text-white/30 group-hover:text-emerald-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </p>
              <p className="text-xs text-white/40">{playbook.description}</p>
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Edit Initiative SlideOver */}
      <SlideOver
        open={!!editingInit}
        onClose={() => setEditingInit(null)}
        title="Edit Initiative"
      >
        <div className="space-y-4">
          <GlassInput
            label="Title"
            value={editForm.title}
            onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Initiative title"
          />
          <GlassTextarea
            label="Description"
            value={editForm.description}
            onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Describe the initiative..."
            rows={3}
          />
          <GlassSelect
            label="Priority"
            value={editForm.priority}
            onChange={(e) => setEditForm((f) => ({ ...f, priority: e.target.value as Initiative["priority"] }))}
            options={[
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
            ]}
          />
          <GlassSelect
            label="Horizon"
            value={editingInit?.horizon || "run"}
            onChange={async (e) => {
              if (editingInit) {
                const newHorizon = e.target.value as Horizon;
                const success = await updateInitiative(editingInit.id, { horizon: newHorizon });
                if (success) {
                  setEditingInit((prev) => prev ? { ...prev, horizon: newHorizon } : null);
                }
              }
            }}
            options={[
              { value: "run", label: "Run Now" },
              { value: "improve", label: "Improve 30-90d" },
              { value: "grow", label: "Grow Quarter-Year" },
            ]}
          />
          <div className="flex gap-2 pt-4">
            <GlassButton
              variant="primary"
              className="flex-1"
              disabled={saving}
              onClick={async () => {
                if (editingInit) {
                  const success = await updateInitiative(editingInit.id, {
                    title: editForm.title,
                    description: editForm.description,
                    priority: editForm.priority,
                  });
                  if (success) {
                    addToast("success", "Initiative updated");
                    setEditingInit(null);
                  }
                }
              }}
            >
              {saving ? "Saving..." : "Save Changes"}
            </GlassButton>
            <GlassButton variant="ghost" onClick={() => setEditingInit(null)}>
              Cancel
            </GlassButton>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}

// Helper to map planner domains to alert domains
function mapDomainToAlertDomain(domain: PlannerDomain): string {
  const mapping: Record<PlannerDomain, string> = {
    finance: "finance",
    sales: "sales",
    procurement: "procurement",
    inventory: "inventory",
    marketing: "sales", // Marketing alerts map to sales
    customers: "sales",
    operations: "sales",
    grc: "finance",
    strategy: "finance",
    people: "finance",
    company: "finance",
  };
  return mapping[domain];
}

// Domain-specific playbooks
function getPlaybooksForDomain(domain: PlannerDomain) {
  const playbooks: Record<PlannerDomain, Array<{ id: string; title: string; description: string }>> = {
    finance: [
      { id: "fin-1", title: "AR Collection", description: "Systematic approach to collecting receivables" },
      { id: "fin-2", title: "Cash Flow Forecast", description: "Weekly cash position planning" },
      { id: "fin-3", title: "Month-End Close", description: "Closing procedures checklist" },
      { id: "fin-4", title: "AP Optimization", description: "Payment timing strategies" },
    ],
    sales: [
      { id: "sales-1", title: "Lead Qualification", description: "BANT scoring framework" },
      { id: "sales-2", title: "Quote to Close", description: "Sales cycle management" },
      { id: "sales-3", title: "Win-Back Campaign", description: "Re-engage lost deals" },
      { id: "sales-4", title: "Upsell Strategy", description: "Expand existing accounts" },
    ],
    marketing: [
      { id: "mkt-1", title: "Campaign Launch", description: "Multi-channel campaign checklist" },
      { id: "mkt-2", title: "Content Calendar", description: "Editorial planning process" },
      { id: "mkt-3", title: "Lead Nurture", description: "Email sequence optimization" },
      { id: "mkt-4", title: "Event Playbook", description: "Trade show & webinar planning" },
    ],
    customers: [
      { id: "cust-1", title: "Onboarding", description: "New customer success path" },
      { id: "cust-2", title: "QBR Prep", description: "Quarterly business review template" },
      { id: "cust-3", title: "Churn Prevention", description: "At-risk account intervention" },
      { id: "cust-4", title: "Expansion Plays", description: "Cross-sell opportunities" },
    ],
    operations: [
      { id: "ops-1", title: "Fulfillment SOP", description: "Order processing standards" },
      { id: "ops-2", title: "Quality Control", description: "Inspection checkpoints" },
      { id: "ops-3", title: "Capacity Planning", description: "Resource allocation" },
      { id: "ops-4", title: "Process Audit", description: "Efficiency review framework" },
    ],
    procurement: [
      { id: "proc-1", title: "Vendor Selection", description: "RFQ evaluation criteria" },
      { id: "proc-2", title: "Contract Renewal", description: "Negotiation preparation" },
      { id: "proc-3", title: "Cost Reduction", description: "Spend analysis approach" },
      { id: "proc-4", title: "Supply Risk", description: "Contingency planning" },
    ],
    inventory: [
      { id: "inv-1", title: "Stock Review", description: "ABC analysis process" },
      { id: "inv-2", title: "Reorder Points", description: "Safety stock calculation" },
      { id: "inv-3", title: "Cycle Counting", description: "Inventory accuracy program" },
      { id: "inv-4", title: "Dead Stock", description: "Obsolete inventory disposal" },
    ],
    grc: [
      { id: "grc-1", title: "Compliance Review", description: "Regulatory checklist" },
      { id: "grc-2", title: "Risk Assessment", description: "Threat identification" },
      { id: "grc-3", title: "Audit Prep", description: "Documentation readiness" },
      { id: "grc-4", title: "Incident Response", description: "Issue escalation protocol" },
    ],
    strategy: [
      { id: "strat-1", title: "OKR Setting", description: "Quarterly objective alignment" },
      { id: "strat-2", title: "Competitor Analysis", description: "Market positioning review" },
      { id: "strat-3", title: "Board Deck", description: "Executive presentation prep" },
      { id: "strat-4", title: "Growth Planning", description: "Expansion opportunity assessment" },
    ],
    people: [
      { id: "ppl-1", title: "Hiring Plan", description: "Recruitment pipeline and timeline" },
      { id: "ppl-2", title: "Onboarding", description: "New hire integration checklist" },
      { id: "ppl-3", title: "Performance Review", description: "Feedback and evaluation cycle" },
      { id: "ppl-4", title: "Training Program", description: "Skills development initiative" },
    ],
    company: [
      { id: "co-1", title: "Process Audit", description: "Operational efficiency review" },
      { id: "co-2", title: "Policy Update", description: "Governance documentation refresh" },
      { id: "co-3", title: "System Migration", description: "Technology upgrade planning" },
      { id: "co-4", title: "Vendor Review", description: "Service provider evaluation" },
    ],
  };
  return playbooks[domain] || [];
}
