"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { GlassCard, GlassButton, useToast } from "@/components/ui/glass";
import {
  Package,
  HardDrive,
  Warehouse,
  Building,
  Users,
  Briefcase,
  Database,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
} from "lucide-react";
import RecordOperationsDrawer from "@/components/operations/RecordOperationsDrawer";

/* =============================================================================
   TYPES
   ============================================================================= */

interface AnalyticsData {
  totalAssetValue: MetricData;
  inventoryHealth: MetricData;
  activeVendors: MetricData;
  warehouseUtilization: MetricData;
  pendingProcurement: MetricData;
  maintenanceDue: MetricData;
}

interface MetricData {
  label: string;
  value: number;
  status: string;
  variant: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  dueAt: string | null;
}

interface Alert {
  id: string;
  type: string;
  severity: string;
  message: string;
  createdAt: string;
}

/* =============================================================================
   QUICK ACCESS CARDS
   ============================================================================= */

const QUICK_ACCESS_CARDS = [
  {
    id: "products-services",
    icon: Package,
    title: "Products & Services",
    description: "Manage inventory items and services",
    href: "/operations/catalog",
    color: "text-blue-400",
  },
  {
    id: "assets",
    icon: HardDrive,
    title: "Assets",
    description: "Track fixed and digital assets",
    href: "/operations/catalog?type=asset",
    color: "text-emerald-400",
  },
  {
    id: "warehouses",
    icon: Warehouse,
    title: "Warehouses",
    description: "Manage physical storage locations",
    href: "/operations/warehouses",
    color: "text-orange-400",
  },
  {
    id: "offices",
    icon: Building,
    title: "Offices",
    description: "Manage office locations and resources",
    href: "/operations/offices",
    color: "text-purple-400",
  },
  {
    id: "vendors",
    icon: Users,
    title: "Vendors",
    description: "Manage vendor relationships",
    href: "/operations/vendors",
    color: "text-cyan-400",
  },
  {
    id: "contractors",
    icon: Briefcase,
    title: "Contractors",
    description: "Manage contractor relationships",
    href: "/operations/contractors",
    color: "text-pink-400",
  },
  {
    id: "inventory",
    icon: Database,
    title: "Inventory Overview",
    description: "View all items across locations",
    href: "/operations/catalog?type=product",
    color: "text-yellow-400",
  },
  {
    id: "procurement",
    icon: ShoppingCart,
    title: "Procurement",
    description: "Purchase orders and receiving",
    href: "/operations/fulfillment",
    color: "text-indigo-400",
  },
];

/* =============================================================================
   ANALYTICS CARD COMPONENT
   ============================================================================= */

function AnalyticsCard({
  label,
  value,
  status,
  variant,
  icon,
}: {
  label: string;
  value: string | number;
  status: string;
  variant: string;
  icon: React.ReactNode;
}) {
  const getVariantClasses = () => {
    switch (variant) {
      case "primary":
        return "border-blue-500/30 bg-blue-500/5";
      case "success":
        return "border-green-500/30 bg-green-500/5";
      case "warning":
        return "border-yellow-500/30 bg-yellow-500/5";
      case "danger":
        return "border-red-500/30 bg-red-500/5";
      case "info":
        return "border-cyan-500/30 bg-cyan-500/5";
      default:
        return "border-white/10 bg-white/5";
    }
  };

  const getValueColor = () => {
    switch (variant) {
      case "primary":
        return "text-blue-400";
      case "success":
        return "text-green-400";
      case "warning":
        return "text-yellow-400";
      case "danger":
        return "text-red-400";
      case "info":
        return "text-cyan-400";
      default:
        return "text-white";
    }
  };

  const formatValue = () => {
    if (typeof value === "number") {
      if (label.toLowerCase().includes("value") || label.toLowerCase().includes("cost")) {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(value);
      }
      if (label.toLowerCase().includes("health") || label.toLowerCase().includes("utilization")) {
        return `${value}%`;
      }
    }
    return value;
  };

  return (
    <GlassCard className={`p-4 border ${getVariantClasses()}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-white/60">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${getValueColor()}`}>{formatValue()}</p>
          <p className="text-xs text-white/40 mt-1">{status}</p>
        </div>
        <div className={`p-2 rounded-lg bg-white/5 ${getValueColor()}`}>{icon}</div>
      </div>
    </GlassCard>
  );
}

/* =============================================================================
   MAIN PAGE COMPONENT
   ============================================================================= */

export default function OperationsPage() {
  const { addToast } = useToast();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Load analytics
      const analyticsRes = await fetch("/api/operations/analytics/overview");
      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data.analytics);
      }

      // Load tasks
      const tasksRes = await fetch("/api/operations/tasks?limit=5");
      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(data.tasks || []);
      }

      // Load alerts
      const alertsRes = await fetch("/api/operations/alerts?limit=5");
      if (alertsRes.ok) {
        const data = await alertsRes.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error("Error loading operations data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivitySuccess = () => {
    setIsDrawerOpen(false);
    loadData();
    addToast("success", "Activity recorded successfully");
  };

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case "critical":
      case "high":
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case "medium":
        return <Clock className="w-4 h-4 text-yellow-400" />;
      default:
        return <CheckCircle className="w-4 h-4 text-blue-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "text-red-400";
      case "high":
        return "text-orange-400";
      case "medium":
        return "text-yellow-400";
      default:
        return "text-white/60";
    }
  };

  return (
    <div className="min-h-screen p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Operations</h1>
          <p className="text-white/60">
            Manage inventory, assets, vendors, and operational activities
          </p>
        </div>
        <GlassButton onClick={() => setIsDrawerOpen(true)} variant="primary">
          <Plus className="w-5 h-5 mr-2" />
          Record Activity
        </GlassButton>
      </div>

      {/* Analytics Snapshot */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Analytics Snapshot</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {analytics ? (
            <>
              <AnalyticsCard
                {...analytics.totalAssetValue}
                icon={<TrendingUp className="w-5 h-5" />}
              />
              <AnalyticsCard
                {...analytics.inventoryHealth}
                icon={
                  analytics.inventoryHealth.value >= 80 ? (
                    <TrendingUp className="w-5 h-5" />
                  ) : (
                    <TrendingDown className="w-5 h-5" />
                  )
                }
              />
              <AnalyticsCard
                {...analytics.activeVendors}
                icon={<Users className="w-5 h-5" />}
              />
              <AnalyticsCard
                {...analytics.warehouseUtilization}
                icon={<Warehouse className="w-5 h-5" />}
              />
              <AnalyticsCard
                {...analytics.pendingProcurement}
                icon={<ShoppingCart className="w-5 h-5" />}
              />
              <AnalyticsCard
                {...analytics.maintenanceDue}
                icon={<AlertTriangle className="w-5 h-5" />}
              />
            </>
          ) : (
            // Loading skeletons
            Array.from({ length: 6 }).map((_, i) => (
              <GlassCard key={i} className="p-4 animate-pulse">
                <div className="h-4 bg-white/10 rounded w-24 mb-2" />
                <div className="h-8 bg-white/10 rounded w-16 mb-2" />
                <div className="h-3 bg-white/10 rounded w-32" />
              </GlassCard>
            ))
          )}
        </div>
      </div>

      {/* To-Do & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* To-Do Panel */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">To-Do</h3>
            <Link href="/operations/tasks" className="text-sm text-blue-400 hover:text-blue-300">
              View all
            </Link>
          </div>
          {tasks.length > 0 ? (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className={`mt-0.5 ${getPriorityColor(task.priority)}`}>
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{task.title}</p>
                    {task.description && (
                      <p className="text-sm text-white/50 truncate">{task.description}</p>
                    )}
                  </div>
                  {task.dueAt && (
                    <span className="text-xs text-white/40">
                      {new Date(task.dueAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-400/50 mx-auto mb-2" />
              <p className="text-white/50">No pending tasks</p>
            </div>
          )}
        </GlassCard>

        {/* Alerts Panel */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Alerts</h3>
            <Link href="/operations/alerts" className="text-sm text-blue-400 hover:text-blue-300">
              View all
            </Link>
          </div>
          {alerts.length > 0 ? (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  {getAlertIcon(alert.severity)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{alert.message}</p>
                    <p className="text-xs text-white/40">
                      {new Date(alert.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-400/50 mx-auto mb-2" />
              <p className="text-white/50">No active alerts</p>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Quick Access */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Quick Access</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {QUICK_ACCESS_CARDS.map((card) => (
            <Link key={card.id} href={card.href}>
              <GlassCard className="p-4 h-full hover:bg-white/10 transition-colors cursor-pointer">
                <div className={`p-3 rounded-lg bg-white/5 w-fit mb-3 ${card.color}`}>
                  <card.icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-white">{card.title}</h3>
                <p className="text-sm text-white/50 mt-1">{card.description}</p>
              </GlassCard>
            </Link>
          ))}
        </div>
      </div>

      {/* Record Operations Drawer */}
      <RecordOperationsDrawer
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSuccess={handleActivitySuccess}
      />
    </div>
  );
}
