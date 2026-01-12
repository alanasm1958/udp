// app/(app)/hr-people/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  GlassCard,
  GlassButton,
  GlassIconButton,
  SlideOver,
} from "@/components/ui/glass";
import { Users, DollarSign, Award, TrendingUp, AlertCircle, Plus } from "lucide-react";
import RecordActivityDrawer from "@/components/hr/RecordActivityDrawer";

interface AnalyticsCard {
  label: string;
  value: string | number;
  change?: string;
  variant: "default" | "success" | "warning" | "danger";
  icon: React.ReactNode;
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
  description: string;
  due_at?: string;
  priority: "low" | "medium" | "high";
}

export default function HRPeoplePage() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<AnalyticsCard[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Single drawer state
  const [showRecordActivity, setShowRecordActivity] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/hr-people/analytics");
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data.analytics || []);
        setTodos(data.todos || []);
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const accessCards = [
    {
      title: "Persons",
      description: "View and manage all persons in your organization",
      icon: <Users className="w-6 h-6" />,
      onClick: () => router.push("/hr-people/persons"),
      count: analytics.find((a) => a.label.includes("Total"))?.value,
    },
    {
      title: "Payroll History",
      description: "View past payroll runs and create new ones",
      icon: <DollarSign className="w-6 h-6" />,
      onClick: () => router.push("/hr-people/payroll"),
      count: analytics.find((a) => a.label.includes("Payroll"))?.value,
    },
    {
      title: "Performance Reviews",
      description: "Manage performance reviews and evaluations",
      icon: <Award className="w-6 h-6" />,
      onClick: () => router.push("/hr-people/performance"),
      count: analytics.find((a) => a.label.includes("Review"))?.value,
    },
  ];

  return (
    <div className="min-h-screen p-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold mb-2">HR & People</h1>
          <p className="text-white/60">
            Manage your team, payroll, and performance reviews
          </p>
        </div>
        <GlassButton
          onClick={() => setShowRecordActivity(true)}
          variant="primary"
          size="lg"
        >
          <Plus className="w-5 h-5 mr-2" />
          Record HR & People Activity
        </GlassButton>
      </div>

      {/* Snapshot Section - Analytics Cards */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Snapshot</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {analytics.map((card, index) => (
            <GlassCard key={index} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg bg-white/5`}>
                  {card.icon}
                </div>
                {card.change && (
                  <span className={`text-sm ${
                    card.variant === "success" ? "text-green-400" : 
                    card.variant === "danger" ? "text-red-400" : 
                    "text-white/60"
                  }`}>
                    {card.change}
                  </span>
                )}
              </div>
              <div>
                <p className="text-white/60 text-sm mb-1">{card.label}</p>
                <p className="text-3xl font-bold">{card.value}</p>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* Middle Section - To Do & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* To Do */}
        <GlassCard>
          <div className="p-6 border-b border-white/10">
            <h3 className="text-lg font-semibold">To Do</h3>
          </div>
          <div className="p-6">
            {todos.length === 0 ? (
              <p className="text-white/40 text-center py-8">
                No pending tasks
              </p>
            ) : (
              <div className="space-y-3">
                {todos.map((todo) => (
                  <div
                    key={todo.id}
                    className="p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{todo.title}</p>
                        {todo.description && (
                          <p className="text-sm text-white/60 mt-1">
                            {todo.description}
                          </p>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        todo.priority === "high" ? "bg-red-500/20 text-red-400" :
                        todo.priority === "medium" ? "bg-yellow-500/20 text-yellow-400" :
                        "bg-blue-500/20 text-blue-400"
                      }`}>
                        {todo.priority}
                      </span>
                    </div>
                    {todo.due_at && (
                      <p className="text-xs text-white/40 mt-2">
                        Due: {new Date(todo.due_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>

        {/* Alerts */}
        <GlassCard>
          <div className="p-6 border-b border-white/10">
            <h3 className="text-lg font-semibold">Alerts</h3>
          </div>
          <div className="p-6">
            {alerts.length === 0 ? (
              <p className="text-white/40 text-center py-8">No active alerts</p>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-lg ${
                      alert.severity === "critical" ? "bg-red-500/10 border border-red-500/20" :
                      alert.severity === "warning" ? "bg-yellow-500/10 border border-yellow-500/20" :
                      "bg-blue-500/10 border border-blue-500/20"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className={`w-5 h-5 flex-shrink-0 ${
                        alert.severity === "critical" ? "text-red-400" :
                        alert.severity === "warning" ? "text-yellow-400" :
                        "text-blue-400"
                      }`} />
                      <div className="flex-1">
                        <p className="font-medium">{alert.title}</p>
                        <p className="text-sm text-white/60 mt-1">
                          {alert.message}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Bottom Section - Access Cards */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Quick Access</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {accessCards.map((card, index) => (
            <GlassCard
              key={index}
              className="p-6 cursor-pointer hover:bg-white/5 transition-all"
              onClick={card.onClick}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-lg bg-white/5">
                  {card.icon}
                </div>
                {card.count && (
                  <span className="text-2xl font-bold">{card.count}</span>
                )}
              </div>
              <h3 className="text-lg font-semibold mb-2">{card.title}</h3>
              <p className="text-sm text-white/60">{card.description}</p>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* Record Activity Drawer - Single entry point for all HR activities */}
      <RecordActivityDrawer
        isOpen={showRecordActivity}
        onClose={() => setShowRecordActivity(false)}
        onSuccess={() => {
          setShowRecordActivity(false);
          loadDashboardData();
        }}
      />
    </div>
  );
}
