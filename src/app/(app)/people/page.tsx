"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  GlassCard,
  PageHeader,
  GlassTabs,
  GlassButton,
  GlassBadge,
  Spinner,
} from "@/components/ui/glass";
import { Planner } from "@/components/ai/Planner";
import { PeopleTab } from "./components/PeopleTab";
import { PayrollTab } from "./components/PayrollTab";
import { PerformanceTab } from "./components/PerformanceTab";
import { DocumentsTab } from "./components/DocumentsTab";
import { SettingsTab } from "./components/SettingsTab";
import { apiGet } from "@/lib/http";

/* =============================================================================
   ICONS
   ============================================================================= */
const Icons = {
  users: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  payroll: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  ),
  performance: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
    </svg>
  ),
  documents: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  settings: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  planner: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
    </svg>
  ),
  plus: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  refresh: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  ),
  alert: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  task: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

/* =============================================================================
   TYPES
   ============================================================================= */
interface AnalyticsData {
  headcount: { label: string; value: number; detail?: string; variant: string };
  newHires: { label: string; value: number; variant: string };
  contractsEnding: { label: string; value: number; variant: string };
  payrollStatus: { label: string; value: string; detail?: string; variant: string };
  openAlerts: { label: string; value: number; variant: string };
  pendingLeave?: { label: string; value: number; variant: string };
  expiringDocs?: { label: string; value: number; variant: string };
}

interface HRAlert {
  id: string;
  type: string;
  severity: string;
  message: string;
  status: string;
  createdAt: string;
}

interface HRTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueAt: string | null;
  createdAt: string;
}

/* =============================================================================
   ANALYTICS CARD
   ============================================================================= */
function AnalyticsCard({
  label,
  value,
  detail,
  variant = "default",
  icon,
}: {
  label: string;
  value: string | number;
  detail?: string;
  variant?: string;
  icon?: React.ReactNode;
}) {
  const variantColors: Record<string, string> = {
    default: "bg-white/5",
    success: "bg-emerald-500/10 border-emerald-500/20",
    warning: "bg-amber-500/10 border-amber-500/20",
    danger: "bg-red-500/10 border-red-500/20",
    info: "bg-blue-500/10 border-blue-500/20",
  };

  const valueColors: Record<string, string> = {
    default: "text-white",
    success: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-red-400",
    info: "text-blue-400",
  };

  return (
    <GlassCard className={`${variantColors[variant] || variantColors.default} border`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-white/50">{label}</p>
          <p className={`text-2xl font-bold ${valueColors[variant] || valueColors.default}`}>
            {value}
          </p>
          {detail && <p className="text-xs text-white/40 mt-1">{detail}</p>}
        </div>
        {icon && <div className="p-3 rounded-xl bg-white/5">{icon}</div>}
      </div>
    </GlassCard>
  );
}

/* =============================================================================
   ALERTS PANEL
   ============================================================================= */
function AlertsPanel({
  alerts,
  tasks,
  loading,
}: {
  alerts: HRAlert[];
  tasks: HRTask[];
  loading: boolean;
}) {
  const severityColors: Record<string, string> = {
    info: "info",
    warning: "warning",
    critical: "danger",
  };

  const priorityColors: Record<string, string> = {
    low: "default",
    medium: "info",
    high: "warning",
    critical: "danger",
  };

  if (loading) {
    return (
      <GlassCard>
        <div className="flex items-center justify-center h-32">
          <Spinner size="md" />
        </div>
      </GlassCard>
    );
  }

  const hasContent = alerts.length > 0 || tasks.length > 0;

  if (!hasContent) {
    return (
      <GlassCard>
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
            {Icons.task}
          </div>
          <p className="text-white/70 font-medium">All caught up!</p>
          <p className="text-sm text-white/40">No pending alerts or tasks</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Alerts */}
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <div className="text-amber-400">{Icons.alert}</div>
          <h3 className="font-semibold text-white">HR Alerts</h3>
          {alerts.length > 0 && (
            <GlassBadge variant="warning">{alerts.length}</GlassBadge>
          )}
        </div>
        {alerts.length === 0 ? (
          <p className="text-sm text-white/40">No active alerts</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {alerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <GlassBadge variant={severityColors[alert.severity] as "default" | "info" | "warning" | "success" | "danger" || "default"}>
                    {alert.severity}
                  </GlassBadge>
                  <p className="text-sm text-white/70 flex-1">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Tasks */}
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <div className="text-blue-400">{Icons.task}</div>
          <h3 className="font-semibold text-white">HR Tasks</h3>
          {tasks.length > 0 && (
            <GlassBadge variant="info">{tasks.length}</GlassBadge>
          )}
        </div>
        {tasks.length === 0 ? (
          <p className="text-sm text-white/40">No pending tasks</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {tasks.slice(0, 5).map((task) => (
              <div
                key={task.id}
                className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm text-white font-medium">{task.title}</p>
                    {task.dueAt && (
                      <p className="text-xs text-white/40 mt-1">
                        Due: {new Date(task.dueAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <GlassBadge variant={priorityColors[task.priority] as "default" | "info" | "warning" | "success" | "danger" || "default"}>
                    {task.priority}
                  </GlassBadge>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

/* =============================================================================
   TABS
   ============================================================================= */
const tabs = [
  { id: "people", label: "People", icon: Icons.users },
  { id: "payroll", label: "Payroll", icon: Icons.payroll },
  { id: "performance", label: "Performance", icon: Icons.performance },
  { id: "documents", label: "Documents", icon: Icons.documents },
  { id: "settings", label: "Settings", icon: Icons.settings },
  { id: "planner", label: "Planner", icon: Icons.planner },
];

/* =============================================================================
   MAIN COMPONENT
   ============================================================================= */
function PeoplePageContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = React.useState("people");
  const [analytics, setAnalytics] = React.useState<AnalyticsData | null>(null);
  const [alerts, setAlerts] = React.useState<HRAlert[]>([]);
  const [tasks, setTasks] = React.useState<HRTask[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && tabs.some((t) => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  React.useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);

      // Fetch analytics
      const analyticsData = await apiGet<{ analytics: AnalyticsData }>("/api/people/analytics").catch(() => null);
      if (analyticsData) {
        setAnalytics(analyticsData.analytics);
      }

      // Fetch alerts and tasks
      const alertsData = await apiGet<{ alerts: HRAlert[]; tasks: HRTask[] }>("/api/people/alerts").catch(() => null);
      if (alertsData) {
        setAlerts(alertsData.alerts || []);
        setTasks(alertsData.tasks || []);
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "people":
        return <PeopleTab onRecordActivity={loadDashboardData} />;
      case "payroll":
        return <PayrollTab onRecordActivity={loadDashboardData} />;
      case "performance":
        return <PerformanceTab onRecordActivity={loadDashboardData} />;
      case "documents":
        return <DocumentsTab onRecordActivity={loadDashboardData} />;
      case "settings":
        return <SettingsTab />;
      case "planner":
        return <Planner domain="people" domainLabel="HR & People" />;
      default:
        return <PeopleTab onRecordActivity={loadDashboardData} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <PageHeader
          title="HR & People"
          description="Manage your team, payroll, performance, and HR documents"
        />
        <GlassButton variant="ghost" onClick={loadDashboardData} disabled={isLoading}>
          {Icons.refresh}
        </GlassButton>
      </div>

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <AnalyticsCard
            label={analytics.headcount.label}
            value={analytics.headcount.value}
            detail={analytics.headcount.detail}
            variant={analytics.headcount.variant}
            icon={Icons.users}
          />
          <AnalyticsCard
            label={analytics.newHires.label}
            value={analytics.newHires.value}
            variant={analytics.newHires.variant}
            icon={Icons.plus}
          />
          <AnalyticsCard
            label={analytics.contractsEnding.label}
            value={analytics.contractsEnding.value}
            variant={analytics.contractsEnding.variant}
            icon={Icons.alert}
          />
          <AnalyticsCard
            label={analytics.payrollStatus.label}
            value={analytics.payrollStatus.value}
            detail={analytics.payrollStatus.detail}
            variant={analytics.payrollStatus.variant}
            icon={Icons.payroll}
          />
          <AnalyticsCard
            label={analytics.openAlerts.label}
            value={analytics.openAlerts.value}
            variant={analytics.openAlerts.variant}
            icon={Icons.task}
          />
        </div>
      )}

      {/* Alerts & Tasks */}
      <AlertsPanel alerts={alerts} tasks={tasks} loading={isLoading} />

      {/* Tabs */}
      <GlassTabs
        tabs={tabs.map((t) => ({ id: t.id, label: t.label }))}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Tab Content */}
      <div className="mt-6">{renderTabContent()}</div>
    </div>
  );
}

export default function PeoplePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      }
    >
      <PeoplePageContent />
    </Suspense>
  );
}
