// /app/(app)/people/page.tsx
"use client";

import { useState, useEffect } from "react";
import {
  GlassCard,
  GlassTabs,
  GlassButton,
  GlassIconButton,
  GlassModal,
} from "@/components/ui/glass";
import {
  ModulePageHeader,
  AnalyticsSection,
  AnalyticsCard,
  TodoAlertsSection,
  TodoPanel,
  AlertsPanel,
} from "@/components/layout/module-layout";
import { 
  Users, 
  UserPlus, 
  Award, 
  FileText, 
  DollarSign,
  Settings,
  ChevronDown,
} from "lucide-react";
import PeopleTab from "@/components/people/PeopleTab";
import PayrollTab from "@/components/people/PayrollTab";
import PerformanceTab from "@/components/people/PerformanceTab";
import DocumentsTab from "@/components/people/DocumentsTab";
import SettingsTab from "@/components/people/SettingsTab";

interface Analytics {
  headcount: {
    label: string;
    value: number;
    detail?: string;
    variant: "default" | "success" | "warning" | "danger" | "info";
  };
  newHires: {
    label: string;
    value: number;
    variant: "default" | "success" | "warning" | "danger" | "info";
  };
  contractsEnding: {
    label: string;
    value: number;
    variant: "default" | "success" | "warning" | "danger" | "info";
  };
  payrollStatus: {
    label: string;
    value: string;
    detail?: string;
    variant: "default" | "success" | "warning" | "danger" | "info";
  };
  openAlerts: {
    label: string;
    value: number;
    variant: "default" | "success" | "warning" | "danger" | "info";
  };
}

interface Alert {
  id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  created_at: string;
}

interface Todo {
  id: string;
  title: string;
  description?: string;
  due_at?: string;
  priority: "low" | "medium" | "high" | "critical";
}

export default function PeoplePage() {
  const [activeTab, setActiveTab] = useState("people");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showActionMenu, setShowActionMenu] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);

      // Fetch analytics
      const analyticsRes = await fetch("/api/people/analytics");
      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data.analytics);
      }

      // Fetch alerts
      const alertsRes = await fetch("/api/people/alerts?type=alert");
      if (alertsRes.ok) {
        const data = await alertsRes.json();
        setAlerts(data.alerts || []);
      }

      // Fetch todos/tasks
      const todosRes = await fetch("/api/people/alerts?type=task");
      if (todosRes.ok) {
        const data = await todosRes.json();
        setTodos(data.tasks || []);
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: "people", label: "People", icon: Users },
    { id: "payroll", label: "Payroll", icon: DollarSign },
    { id: "performance", label: "Performance", icon: Award },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const actionMenuItems = [
    { label: "Add Person", action: () => console.log("Add person") },
    { label: "Record Performance", action: () => console.log("Record performance") },
    { label: "Upload Document", action: () => console.log("Upload document") },
    { label: "Record Leave", action: () => console.log("Record leave") },
    { label: "Other HR Event", action: () => console.log("Other event") },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case "people":
        return <PeopleTab />;
      case "payroll":
        return <PayrollTab />;
      case "performance":
        return <PerformanceTab />;
      case "documents":
        return <DocumentsTab />;
      case "settings":
        return <SettingsTab />;
      default:
        return <PeopleTab />;
    }
  };

  return (
    <div className="min-h-screen p-8 space-y-8">
      {/* Header */}
      <ModulePageHeader
        title="HR & People"
        subtitle="Manage your team, payroll, performance, and HR documents"
        action={
          <div className="relative">
            <GlassButton
              onClick={() => setShowActionMenu(!showActionMenu)}
              variant="primary"
            >
              Record HR & People Activity
              <ChevronDown className="ml-2 h-4 w-4" />
            </GlassButton>

            {showActionMenu && (
              <GlassCard className="absolute right-0 mt-2 w-64 z-50">
                {actionMenuItems.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      item.action();
                      setShowActionMenu(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-white/10 transition-colors first:rounded-t-lg last:rounded-b-lg"
                  >
                    {item.label}
                  </button>
                ))}
              </GlassCard>
            )}
          </div>
        }
      />

      {/* Analytics Cards */}
      {analytics && (
        <AnalyticsSection>
          <AnalyticsCard
            variant={analytics.headcount.variant}
            label={analytics.headcount.label}
            value={analytics.headcount.value.toString()}
            status={analytics.headcount.detail}
          />
          <AnalyticsCard
            variant={analytics.newHires.variant}
            label={analytics.newHires.label}
            value={analytics.newHires.value.toString()}
          />
          <AnalyticsCard
            variant={analytics.contractsEnding.variant}
            label={analytics.contractsEnding.label}
            value={analytics.contractsEnding.value.toString()}
          />
          <AnalyticsCard
            variant={analytics.payrollStatus.variant}
            label={analytics.payrollStatus.label}
            value={analytics.payrollStatus.value}
            status={analytics.payrollStatus.detail}
          />
          <AnalyticsCard
            variant={analytics.openAlerts.variant}
            label={analytics.openAlerts.label}
            value={analytics.openAlerts.value.toString()}
          />
        </AnalyticsSection>
      )}

      {/* Todo & Alerts */}
      <TodoAlertsSection>
        <TodoPanel
          title="HR Tasks"
          todos={todos}
          emptyMessage="No pending HR tasks"
        />
        <AlertsPanel
          title="HR Alerts"
          alerts={alerts}
          emptyMessage="No active alerts"
        />
      </TodoAlertsSection>

      {/* Tabs Navigation */}
      <GlassTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Tab Content */}
      <div className="mt-6">
        {renderTabContent()}
      </div>
    </div>
  );
}
