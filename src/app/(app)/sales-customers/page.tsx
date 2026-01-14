"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  PageHeader,
  GlassCard,
  GlassButton,
  Spinner,
  GlassBadge,
} from "@/components/ui/glass";
import { apiGet, apiPost } from "@/lib/http";
import {
  Plus,
  Users,
  FileText,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Target,
  Activity,
  UserPlus,
  Receipt,
  FileSignature,
  UserCheck,
  Brain,
  ChevronRight,
  Clock,
  Phone,
  Mail,
  Calendar,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { CustomersTab } from "./components/CustomersTab";
import { LeadsTab } from "./components/LeadsTab";
import { QuotesTab } from "./components/QuotesTab";
import { InvoicesTab } from "./components/InvoicesTab";
import { SalespersonsTab } from "./components/SalespersonsTab";
import { RecordActivityDrawer } from "./components/RecordActivityDrawer";

/* =============================================================================
   TYPES
   ============================================================================= */

interface AnalyticsCard {
  id: string;
  label: string;
  value: number;
  formatted: string;
  change?: number;
  changeFormatted?: string;
  trend?: "up" | "down" | "stable";
  status?: "on-track" | "warning" | "danger" | "healthy" | "neutral";
  subtitle?: string;
  period?: string;
  comparisonPeriod?: string;
}

interface DashboardData {
  cards: AnalyticsCard[];
  calculatedAt: string;
  period: string;
}

interface AISalesTask {
  id: string;
  taskType: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "pending" | "in_progress" | "completed" | "dismissed" | "snoozed";
  title: string;
  description: string;
  aiRationale?: string;
  customerId?: string;
  leadId?: string;
  salesDocId?: string;
  customerName?: string;
  leadName?: string;
  salesDocNumber?: string;
  suggestedActions: Array<{
    action: string;
    type: "call" | "email" | "meeting" | "quote" | "reminder" | "other";
  }>;
  potentialValue?: string;
  riskLevel?: string;
  dueDate?: string;
  scanScore?: number;
  createdAt: string;
}

interface AITasksResponse {
  tasks: AISalesTask[];
  total: number;
  lastScan?: {
    scanId: string;
    status: string;
    completedAt?: string;
    tasksCreated: number;
    tasksUpdated: number;
  };
}

/* =============================================================================
   NAVIGATION CARDS
   ============================================================================= */

interface NavigationCard {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  count?: number;
}

const navigationCards: NavigationCard[] = [
  {
    id: "customers",
    label: "Customers",
    description: "Manage your customer relationships",
    icon: <Users className="w-6 h-6" />,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30 hover:border-purple-500/50",
  },
  {
    id: "leads",
    label: "Leads",
    description: "Track and convert potential sales",
    icon: <UserPlus className="w-6 h-6" />,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/30 hover:border-cyan-500/50",
  },
  {
    id: "quotes",
    label: "Quotes",
    description: "Create and manage quotations",
    icon: <FileSignature className="w-6 h-6" />,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30 hover:border-blue-500/50",
  },
  {
    id: "invoices",
    label: "Invoices",
    description: "Track invoices and payments",
    icon: <Receipt className="w-6 h-6" />,
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30 hover:border-green-500/50",
  },
  {
    id: "salespersons",
    label: "Salespersons",
    description: "Manage your sales team",
    icon: <UserCheck className="w-6 h-6" />,
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30 hover:border-orange-500/50",
  },
  {
    id: "ai-tasks",
    label: "AI Tasks",
    description: "AI-powered sales recommendations",
    icon: <Brain className="w-6 h-6" />,
    color: "text-pink-400",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/30 hover:border-pink-500/50",
  },
];

/* =============================================================================
   ANALYTICS CARDS COMPONENT
   ============================================================================= */

function AnalyticsSection() {
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<DashboardData | null>(null);

  React.useEffect(() => {
    async function loadData() {
      try {
        const result = await apiGet<DashboardData>("/api/sales-customers/analytics/dashboard?period=mtd");
        setData(result);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Spinner size="md" />
      </div>
    );
  }

  if (!data || data.cards.length === 0) {
    return null;
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "on-track":
      case "healthy":
        return "border-green-500/30 bg-green-500/5";
      case "warning":
        return "border-yellow-500/30 bg-yellow-500/5";
      case "danger":
        return "border-red-500/30 bg-red-500/5";
      default:
        return "border-white/10";
    }
  };

  const getTrendIcon = (trend?: string, change?: number) => {
    if (trend === "up" || (change && change > 0)) {
      return <TrendingUp className="w-4 h-4 text-green-400" />;
    }
    if (trend === "down" || (change && change < 0)) {
      return <TrendingUp className="w-4 h-4 text-red-400 rotate-180" />;
    }
    return null;
  };

  const getCardIcon = (id: string) => {
    switch (id) {
      case "revenue_mtd":
        return <DollarSign className="w-5 h-5 text-green-400" />;
      case "pipeline_value":
        return <Target className="w-5 h-5 text-blue-400" />;
      case "active_customers":
        return <Users className="w-5 h-5 text-purple-400" />;
      case "conversion_rate":
        return <TrendingUp className="w-5 h-5 text-cyan-400" />;
      case "outstanding_ar":
        return <FileText className="w-5 h-5 text-orange-400" />;
      case "at_risk_customers":
        return <AlertTriangle className="w-5 h-5 text-red-400" />;
      case "recent_activities":
        return <Activity className="w-5 h-5 text-indigo-400" />;
      default:
        return <Activity className="w-5 h-5 text-white/40" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Analytics</h2>
        <span className="text-xs text-white/40">Updated {new Date(data.calculatedAt).toLocaleTimeString()}</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {data.cards.map((card) => (
          <GlassCard key={card.id} className={`p-4 ${getStatusColor(card.status)}`}>
            <div className="flex items-start justify-between mb-2">
              {getCardIcon(card.id)}
              {getTrendIcon(card.trend, card.change)}
            </div>
            <p className="text-2xl font-bold text-white">{card.formatted}</p>
            <p className="text-sm text-white/60 mt-1">{card.label}</p>
            {card.changeFormatted && (
              <p className={`text-xs mt-1 ${card.change && card.change >= 0 ? "text-green-400" : "text-red-400"}`}>
                {card.changeFormatted} {card.comparisonPeriod || card.period}
              </p>
            )}
            {card.subtitle && <p className="text-xs text-white/40 mt-1">{card.subtitle}</p>}
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

/* =============================================================================
   NAVIGATION CARDS SECTION
   ============================================================================= */

function NavigationSection({ onNavigate }: { onNavigate: (id: string) => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">Quick Access</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {navigationCards.map((card) => (
          <button
            key={card.id}
            onClick={() => onNavigate(card.id)}
            className={`group relative p-4 rounded-xl border ${card.borderColor} ${card.bgColor} transition-all duration-200 hover:scale-[1.02] hover:shadow-lg text-left`}
          >
            <div className={`${card.color} mb-3`}>
              {card.icon}
            </div>
            <h3 className="font-semibold text-white mb-1">{card.label}</h3>
            <p className="text-xs text-white/50 line-clamp-2">{card.description}</p>
            <ChevronRight className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 ${card.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* =============================================================================
   AI TASKS SECTION
   ============================================================================= */

function AITasksSection({ onNavigate }: { onNavigate: (id: string) => void }) {
  const [loading, setLoading] = React.useState(true);
  const [scanning, setScanning] = React.useState(false);
  const [data, setData] = React.useState<AITasksResponse | null>(null);

  const loadTasks = React.useCallback(async () => {
    try {
      const result = await apiGet<AITasksResponse>("/api/sales-customers/ai-tasks?status=pending&limit=5");
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleRunScan = async () => {
    setScanning(true);
    try {
      await apiPost("/api/sales-customers/ai-tasks/scan", { triggerType: "manual" });
      await loadTasks();
    } catch {
      // Error handled silently
    } finally {
      setScanning(false);
    }
  };

  const handleTaskAction = async (taskId: string, action: "complete" | "dismiss" | "snooze") => {
    try {
      await apiPost(`/api/sales-customers/ai-tasks/${taskId}/${action}`, {});
      await loadTasks();
    } catch {
      // Error handled silently
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "high":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "medium":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      default:
        return "bg-white/10 text-white/60 border-white/20";
    }
  };

  const getTaskTypeIcon = (taskType: string) => {
    switch (taskType) {
      case "follow_up_lead":
      case "hot_lead":
        return <UserPlus className="w-4 h-4" />;
      case "follow_up_quote":
      case "quote_expiring":
        return <FileSignature className="w-4 h-4" />;
      case "follow_up_customer":
      case "reactivate_customer":
        return <Users className="w-4 h-4" />;
      case "payment_reminder":
        return <Receipt className="w-4 h-4" />;
      case "at_risk_customer":
      case "churn_prevention":
        return <AlertTriangle className="w-4 h-4" />;
      case "upsell_opportunity":
        return <TrendingUp className="w-4 h-4" />;
      default:
        return <Target className="w-4 h-4" />;
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case "call":
        return <Phone className="w-3 h-3" />;
      case "email":
        return <Mail className="w-3 h-3" />;
      case "meeting":
        return <Calendar className="w-3 h-3" />;
      default:
        return <Activity className="w-3 h-3" />;
    }
  };

  if (loading) {
    return (
      <GlassCard className="p-6">
        <div className="flex items-center justify-center py-6">
          <Spinner size="md" />
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-pink-500/20">
            <Sparkles className="w-5 h-5 text-pink-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">AI Sales Tasks</h2>
            <p className="text-xs text-white/50">
              {data?.lastScan?.completedAt
                ? `Last scan: ${new Date(data.lastScan.completedAt).toLocaleString()}`
                : "AI analyzes your sales data daily at 8 AM"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={handleRunScan}
            disabled={scanning}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? "animate-spin" : ""}`} />
            {scanning ? "Scanning..." : "Run Scan"}
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => onNavigate("ai-tasks")}
            className="gap-1"
          >
            View All
            <ChevronRight className="w-4 h-4" />
          </GlassButton>
        </div>
      </div>

      {data?.tasks && data.tasks.length > 0 ? (
        <div className="space-y-3">
          {data.tasks.map((task) => (
            <GlassCard
              key={task.id}
              className="p-4 border border-white/10 hover:border-white/20 transition-colors"
            >
              <div className="flex items-start gap-4">
                {/* Task Type Icon */}
                <div className={`p-2 rounded-lg ${getPriorityColor(task.priority)}`}>
                  {getTaskTypeIcon(task.taskType)}
                </div>

                {/* Task Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-white truncate">{task.title}</h3>
                    <GlassBadge
                      variant={
                        task.priority === "critical"
                          ? "danger"
                          : task.priority === "high"
                          ? "warning"
                          : "default"
                      }
                    >
                      {task.priority}
                    </GlassBadge>
                    {task.potentialValue && (
                      <span className="text-xs text-green-400 font-medium">
                        ${parseFloat(task.potentialValue).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white/60 mb-2 line-clamp-1">{task.description}</p>

                  {/* Suggested Actions */}
                  {task.suggestedActions && task.suggestedActions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {task.suggestedActions.slice(0, 3).map((action, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-white/5 text-white/70"
                        >
                          {getActionIcon(action.type)}
                          {action.action}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* AI Rationale */}
                  {task.aiRationale && (
                    <p className="text-xs text-white/40 italic line-clamp-1">
                      <Brain className="w-3 h-3 inline mr-1" />
                      {task.aiRationale}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleTaskAction(task.id, "complete")}
                    className="p-2 rounded-lg hover:bg-green-500/20 text-white/40 hover:text-green-400 transition-colors"
                    title="Mark Complete"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleTaskAction(task.id, "snooze")}
                    className="p-2 rounded-lg hover:bg-yellow-500/20 text-white/40 hover:text-yellow-400 transition-colors"
                    title="Snooze"
                  >
                    <Clock className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleTaskAction(task.id, "dismiss")}
                    className="p-2 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
                    title="Dismiss"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      ) : (
        <GlassCard className="p-8 text-center border border-pink-500/20 bg-pink-500/5">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-pink-500/20 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-pink-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">All Caught Up!</h3>
          <p className="text-white/50 mb-4">
            No pending AI tasks. Click &ldquo;Run Scan&rdquo; to check for new recommendations.
          </p>
          <GlassButton variant="primary" onClick={handleRunScan} disabled={scanning} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${scanning ? "animate-spin" : ""}`} />
            {scanning ? "Scanning..." : "Run AI Scan Now"}
          </GlassButton>
        </GlassCard>
      )}
    </div>
  );
}

/* =============================================================================
   RECENT ACTIVITY SECTION
   ============================================================================= */

function RecentActivitySection() {
  const recentActivities = [
    { id: "1", type: "phone_call", customer: "ABC Corp", time: "Today 2:30 PM", outcome: "Positive" },
    { id: "2", type: "meeting", customer: "XYZ Ltd", time: "Yesterday", outcome: "Follow-up needed" },
    { id: "3", type: "quote_sent", customer: "Tech Solutions", time: "2 days ago", outcome: "Waiting" },
  ];

  return (
    <GlassCard padding="none">
      <div className="p-4 border-b border-white/10">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-400" />
          Recent Activities
        </h2>
      </div>
      <div className="divide-y divide-white/5">
        {recentActivities.map((activity) => (
          <div key={activity.id} className="p-4 hover:bg-white/5 transition-colors cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-white">
                  {activity.type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())} - {activity.customer}
                </h3>
                <p className="text-xs text-white/40">{activity.time}</p>
              </div>
              <GlassBadge variant={activity.outcome === "Positive" ? "success" : activity.outcome === "Waiting" ? "warning" : "info"}>
                {activity.outcome}
              </GlassBadge>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

/* =============================================================================
   DASHBOARD VIEW
   ============================================================================= */

function DashboardView({ onNavigate }: { onNavigate: (id: string) => void }) {
  return (
    <div className="space-y-6">
      {/* TIER 1: Analytics */}
      <AnalyticsSection />

      {/* TIER 2: Navigation Cards */}
      <NavigationSection onNavigate={onNavigate} />

      {/* TIER 3: AI Tasks */}
      <AITasksSection onNavigate={onNavigate} />

      {/* TIER 4: Recent Activity */}
      <RecentActivitySection />
    </div>
  );
}

/* =============================================================================
   AI TASKS FULL VIEW
   ============================================================================= */

function AITasksFullView() {
  const [loading, setLoading] = React.useState(true);
  const [scanning, setScanning] = React.useState(false);
  const [data, setData] = React.useState<AITasksResponse | null>(null);
  const [filter, setFilter] = React.useState<"all" | "pending" | "completed">("pending");

  const loadTasks = React.useCallback(async () => {
    setLoading(true);
    try {
      const status = filter === "all" ? "" : filter;
      const result = await apiGet<AITasksResponse>(`/api/sales-customers/ai-tasks?status=${status}&limit=50`);
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  React.useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleRunScan = async () => {
    setScanning(true);
    try {
      await apiPost("/api/sales-customers/ai-tasks/scan", { triggerType: "manual" });
      await loadTasks();
    } catch {
      // Error handled silently
    } finally {
      setScanning(false);
    }
  };

  const handleTaskAction = async (taskId: string, action: "complete" | "dismiss" | "snooze") => {
    try {
      await apiPost(`/api/sales-customers/ai-tasks/${taskId}/${action}`, {});
      await loadTasks();
    } catch {
      // Error handled silently
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "high":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "medium":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      default:
        return "bg-white/10 text-white/60 border-white/20";
    }
  };

  const getTaskTypeIcon = (taskType: string) => {
    switch (taskType) {
      case "follow_up_lead":
      case "hot_lead":
        return <UserPlus className="w-5 h-5" />;
      case "follow_up_quote":
      case "quote_expiring":
        return <FileSignature className="w-5 h-5" />;
      case "follow_up_customer":
      case "reactivate_customer":
        return <Users className="w-5 h-5" />;
      case "payment_reminder":
        return <Receipt className="w-5 h-5" />;
      case "at_risk_customer":
      case "churn_prevention":
        return <AlertTriangle className="w-5 h-5" />;
      case "upsell_opportunity":
        return <TrendingUp className="w-5 h-5" />;
      default:
        return <Target className="w-5 h-5" />;
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case "call":
        return <Phone className="w-4 h-4" />;
      case "email":
        return <Mail className="w-4 h-4" />;
      case "meeting":
        return <Calendar className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-pink-500/20">
            <Brain className="w-6 h-6 text-pink-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">AI Sales Tasks</h2>
            <p className="text-sm text-white/50">
              AI-generated recommendations to help you close more deals
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5">
            {(["pending", "completed", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  filter === f
                    ? "bg-white/10 text-white"
                    : "text-white/50 hover:text-white"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <GlassButton
            variant="primary"
            onClick={handleRunScan}
            disabled={scanning}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? "animate-spin" : ""}`} />
            {scanning ? "Scanning..." : "Run AI Scan"}
          </GlassButton>
        </div>
      </div>

      {/* Last Scan Info */}
      {data?.lastScan && (
        <GlassCard className="p-4 border border-pink-500/20 bg-pink-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-pink-400" />
              <div>
                <p className="text-sm text-white">
                  Last scan: {data.lastScan.completedAt ? new Date(data.lastScan.completedAt).toLocaleString() : "Running..."}
                </p>
                <p className="text-xs text-white/50">
                  {data.lastScan.tasksCreated} new tasks created, {data.lastScan.tasksUpdated} updated
                </p>
              </div>
            </div>
            <GlassBadge variant={data.lastScan.status === "completed" ? "success" : "warning"}>
              {data.lastScan.status}
            </GlassBadge>
          </div>
        </GlassCard>
      )}

      {/* Tasks List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : data?.tasks && data.tasks.length > 0 ? (
        <div className="space-y-4">
          {data.tasks.map((task) => (
            <GlassCard
              key={task.id}
              className={`p-5 border transition-colors ${
                task.status === "completed"
                  ? "border-green-500/20 bg-green-500/5 opacity-60"
                  : task.status === "dismissed"
                  ? "border-white/10 opacity-40"
                  : "border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Task Type Icon */}
                <div className={`p-3 rounded-xl ${getPriorityColor(task.priority)}`}>
                  {getTaskTypeIcon(task.taskType)}
                </div>

                {/* Task Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-white">{task.title}</h3>
                    <GlassBadge
                      variant={
                        task.priority === "critical"
                          ? "danger"
                          : task.priority === "high"
                          ? "warning"
                          : "default"
                      }
                    >
                      {task.priority}
                    </GlassBadge>
                    {task.status !== "pending" && (
                      <GlassBadge
                        variant={task.status === "completed" ? "success" : "default"}
                      >
                        {task.status}
                      </GlassBadge>
                    )}
                    {task.potentialValue && (
                      <span className="text-sm text-green-400 font-medium">
                        Potential: ${parseFloat(task.potentialValue).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white/70 mb-3">{task.description}</p>

                  {/* Suggested Actions */}
                  {task.suggestedActions && task.suggestedActions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {task.suggestedActions.map((action, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 cursor-pointer transition-colors"
                        >
                          {getActionIcon(action.type)}
                          {action.action}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* AI Rationale */}
                  {task.aiRationale && (
                    <div className="p-3 rounded-lg bg-pink-500/10 border border-pink-500/20">
                      <p className="text-sm text-pink-300">
                        <Brain className="w-4 h-4 inline mr-2" />
                        {task.aiRationale}
                      </p>
                    </div>
                  )}

                  {/* Meta Info */}
                  <div className="flex items-center gap-4 mt-3 text-xs text-white/40">
                    {task.dueDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Due: {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                    {task.scanScore && (
                      <span className="flex items-center gap-1">
                        <Brain className="w-3 h-3" />
                        Confidence: {task.scanScore}%
                      </span>
                    )}
                    <span>
                      Created: {new Date(task.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                {task.status === "pending" && (
                  <div className="flex flex-col gap-2">
                    <GlassButton
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTaskAction(task.id, "complete")}
                      className="gap-2 text-green-400 hover:bg-green-500/20"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Complete
                    </GlassButton>
                    <GlassButton
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTaskAction(task.id, "snooze")}
                      className="gap-2 text-yellow-400 hover:bg-yellow-500/20"
                    >
                      <Clock className="w-4 h-4" />
                      Snooze
                    </GlassButton>
                    <GlassButton
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTaskAction(task.id, "dismiss")}
                      className="gap-2 text-red-400 hover:bg-red-500/20"
                    >
                      <XCircle className="w-4 h-4" />
                      Dismiss
                    </GlassButton>
                  </div>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      ) : (
        <GlassCard className="p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-pink-500/20 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-pink-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            {filter === "pending" ? "All Caught Up!" : "No Tasks Found"}
          </h3>
          <p className="text-white/50 max-w-md mx-auto mb-6">
            {filter === "pending"
              ? "No pending AI tasks. The AI scans your sales data daily at 8 AM to find new opportunities."
              : "No tasks match your current filter."}
          </p>
          <GlassButton variant="primary" onClick={handleRunScan} disabled={scanning} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${scanning ? "animate-spin" : ""}`} />
            {scanning ? "Scanning..." : "Run AI Scan Now"}
          </GlassButton>
        </GlassCard>
      )}
    </div>
  );
}

/* =============================================================================
   MAIN COMPONENT
   ============================================================================= */

function SalesCustomersPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeView, setActiveView] = React.useState<string>("dashboard");
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // Handle tab query param (e.g., ?tab=leads)
  React.useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) {
      setActiveView(tab);
    }
  }, [searchParams]);

  const handleNavigate = (viewId: string) => {
    setActiveView(viewId);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", viewId);
    router.replace(url.pathname + url.search, { scroll: false });
  };

  const handleRecordActivity = () => {
    setDrawerOpen(true);
  };

  const handleActivityCreated = () => {
    setDrawerOpen(false);
  };

  const getViewTitle = () => {
    switch (activeView) {
      case "customers":
        return "Customers";
      case "leads":
        return "Leads";
      case "quotes":
        return "Quotes";
      case "invoices":
        return "Invoices";
      case "salespersons":
        return "Salespersons";
      case "ai-tasks":
        return "AI Tasks";
      default:
        return "Sales & Customers";
    }
  };

  const renderContent = () => {
    switch (activeView) {
      case "customers":
        return <CustomersTab />;
      case "leads":
        return <LeadsTab />;
      case "quotes":
        return <QuotesTab />;
      case "invoices":
        return <InvoicesTab />;
      case "salespersons":
        return <SalespersonsTab />;
      case "ai-tasks":
        return <AITasksFullView />;
      default:
        return <DashboardView onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb navigation when in sub-view */}
      {activeView !== "dashboard" && (
        <button
          onClick={() => handleNavigate("dashboard")}
          className="flex items-center gap-2 text-sm text-white/60 hover:text-white/90 transition-colors"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Back to Sales & Customers
        </button>
      )}

      <PageHeader
        title={getViewTitle()}
        description={
          activeView === "dashboard"
            ? "Manage customers, leads, quotes, and invoices in one place"
            : undefined
        }
        actions={
          <GlassButton variant="primary" onClick={handleRecordActivity} className="gap-2">
            <Plus className="w-4 h-4" />
            Record Activity
          </GlassButton>
        }
      />

      {/* Content */}
      {renderContent()}

      {/* Record Activity Drawer */}
      <RecordActivityDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onActivityCreated={handleActivityCreated}
      />
    </div>
  );
}

export default function SalesCustomersPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>}>
      <SalesCustomersPageContent />
    </Suspense>
  );
}
