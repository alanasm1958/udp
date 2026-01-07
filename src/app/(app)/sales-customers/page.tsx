"use client";

import * as React from "react";
import { Suspense } from "react";
import {
  GlassCard,
  GlassButton,
  GlassBadge,
  Spinner,
  useToast,
} from "@/components/ui/glass";
import { apiGet, formatDate, formatCurrency } from "@/lib/http";
import { SalesDocumentsTab } from "./components/SalesDocumentsTab";
import { PeoplePartiesTab } from "./components/PeoplePartiesTab";
import { RecordActivityDrawer } from "./components/RecordActivityDrawer";
import { AIAnalyticsCardWorkflow, AnalyticsCard } from "./components/AIAnalyticsCardWorkflow";

// Tabs removed - page now always shows overview with Quick Access

/* =============================================================================
   TYPES
   ============================================================================= */

interface SalesMetrics {
  totalCustomers: number;
  activeCustomers: number;
  totalPartners: number;
  totalSalespersons: number;
  openQuotes: number;
  openQuotesValue: number;
  postedInvoices: number;
  postedInvoicesValue: number;
  openAR: number;
  newLeads: number;
  qualifiedLeads: number;
  salesTasksCount: number;
  salesAlertsCount: number;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  domain: string | null;
  dueAt: string | null;
  createdAt: string;
}

interface Alert {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  domain: string;
  createdAt: string;
  metadata: Record<string, unknown>;
  actions: {
    plannerUrl?: string;
    createTask?: boolean;
    createCard?: boolean;
  };
}

/* =============================================================================
   ICONS
   ============================================================================= */

const Icons = {
  customer: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  invoice: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  quote: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.423-.077m3.5 0a48.424 48.424 0 00-1.423.077c-1.131.094-1.976 1.057-1.976 2.192V18.75m0 0a2.25 2.25 0 002.25 2.25h.75a2.25 2.25 0 002.25-2.25v-3.375c0-.621-.504-1.125-1.125-1.125H15m-9 0V9.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V18.75m0 0a2.25 2.25 0 002.25 2.25h.75a2.25 2.25 0 002.25-2.25v-3.375c0-.621-.504-1.125-1.125-1.125H9m-9 0V9.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V18.75m0 0a2.25 2.25 0 002.25 2.25h.75a2.25 2.25 0 002.25-2.25v-3.375c0-.621-.504-1.125-1.125-1.125H9" />
    </svg>
  ),
  lead: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  partner: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.059 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  ),
  salesperson: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  chevronRight: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  ),
};

/* =============================================================================
   ANALYTICS CARDS
   ============================================================================= */

interface MetricCardProps {
  label: string;
  value: number | string;
  variant?: "default" | "success" | "warning" | "danger";
  icon?: React.ReactNode;
}

function MetricCard({ label, value, variant = "default", icon }: MetricCardProps) {
  const variantStyles = {
    default: "text-white",
    success: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-red-400",
  };

  const bgStyles = {
    default: "bg-white/5",
    success: "bg-emerald-500/10",
    warning: "bg-amber-500/10",
    danger: "bg-red-500/10",
  };

  return (
    <div
      className={`
        relative overflow-hidden
        rounded-2xl border border-white/10
        p-4 backdrop-blur-sm
        ${bgStyles[variant]}
        group hover:border-white/20 transition-all duration-200
      `}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-1">
            {label}
          </p>
          <p className={`text-2xl font-bold tabular-nums ${variantStyles[variant]}`}>
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
        </div>
        {icon && (
          <div className="text-white/20 group-hover:text-white/30 transition-colors">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}


function AddCardButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`
        relative overflow-hidden
        rounded-2xl border-2 border-dashed border-white/20
        p-4 backdrop-blur-sm
        bg-white/5
        hover:border-white/40 hover:bg-white/10
        transition-all duration-200
        flex flex-col items-center justify-center
        min-h-[96px]
        group
      `}
    >
      <div className="text-white/40 group-hover:text-white/60 transition-colors mb-2">
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </div>
      <p className="text-xs font-medium text-white/50 group-hover:text-white/70 transition-colors">
        Add AI Card
      </p>
    </button>
  );
}

function AnalyticsSection({ metrics }: { metrics: SalesMetrics | null }) {
  const [userCards, setUserCards] = React.useState<AnalyticsCard[]>([]);
  const [showWorkflow, setShowWorkflow] = React.useState(false);

  // Load user cards from localStorage
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("sales-analytics-cards");
      if (saved) {
        setUserCards(JSON.parse(saved));
      }
    } catch {
      // Ignore
    }
  }, []);

  const handleCardCreated = (card: AnalyticsCard) => {
    const newCards = [...userCards, card];
    setUserCards(newCards);
    localStorage.setItem("sales-analytics-cards", JSON.stringify(newCards));
  };

  const handleRemoveCard = (cardId: string) => {
    const newCards = userCards.filter((c) => c.id !== cardId);
    setUserCards(newCards);
    localStorage.setItem("sales-analytics-cards", JSON.stringify(newCards));
  };

  // Always show cards, even with zero values or if metrics is null
  // Use default values if metrics is null
  const safeMetrics: SalesMetrics = metrics || {
    totalCustomers: 0,
    activeCustomers: 0,
    totalPartners: 0,
    totalSalespersons: 0,
    openQuotes: 0,
    openQuotesValue: 0,
    postedInvoices: 0,
    postedInvoicesValue: 0,
    openAR: 0,
    newLeads: 0,
    qualifiedLeads: 0,
    salesTasksCount: 0,
    salesAlertsCount: 0,
  };

  // Fixed cards (4-5 important ones)
  const fixedCards = [
    {
      id: "fixed-1",
      label: "Total Customers",
      value: safeMetrics.totalCustomers,
      variant: "success" as const,
      icon: Icons.customer,
    },
    {
      id: "fixed-2",
      label: "Sales Value (30d)",
      value: formatCurrency(safeMetrics.postedInvoicesValue),
      variant: "success" as const,
      icon: Icons.invoice,
    },
    {
      id: "fixed-3",
      label: "Open AR",
      value: formatCurrency(safeMetrics.openAR),
      variant: safeMetrics.openAR > 10000 ? ("warning" as const) : ("default" as const),
      icon: Icons.invoice,
    },
    {
      id: "fixed-4",
      label: "Open Quotes",
      value: safeMetrics.openQuotes,
      variant: safeMetrics.openQuotes > 0 ? ("warning" as const) : ("default" as const),
      icon: Icons.quote,
    },
    {
      id: "fixed-5",
      label: "New Leads (30d)",
      value: safeMetrics.newLeads,
      variant: safeMetrics.newLeads > 0 ? ("warning" as const) : ("default" as const),
      icon: Icons.lead,
    },
  ];

  // Combine fixed cards and user cards
  const allCards = [...fixedCards, ...userCards];

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {allCards.map((card, index) => {
          if ("label" in card) {
            // Fixed card
            return (
              <div key={card.id} className="relative group">
                <MetricCard
                  label={card.label}
                  value={card.value}
                  variant={card.variant}
                  icon={card.icon}
                />
              </div>
            );
          } else {
            // User AI card
            return (
              <div key={card.id} className="relative group">
                <MetricCard
                  label={card.title}
                  value={card.value}
                  variant={card.variant}
                />
          <button
                  onClick={() => handleRemoveCard(card.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg bg-red-500/20 hover:bg-red-500/30"
                  title="Remove card"
                >
                  <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          }
        })}
        <AddCardButton onClick={() => setShowWorkflow(true)} />
      </div>

      <AIAnalyticsCardWorkflow
        open={showWorkflow}
        onClose={() => setShowWorkflow(false)}
        onCardCreated={handleCardCreated}
      />
    </>
  );
}

/* =============================================================================
   TASKS & ALERTS SECTION
   ============================================================================= */

function TasksSection({ tasks }: { tasks: Task[] }) {
  const priorityColors: Record<string, string> = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-amber-500",
    normal: "bg-blue-500",
    low: "bg-gray-500",
  };

  const priorityBadge: Record<string, "danger" | "warning" | "info" | "default"> = {
    critical: "danger",
    high: "warning",
    medium: "warning",
    normal: "info",
    low: "default",
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-emerald-500/20 flex items-center justify-center">
          {Icons.check}
        </div>
        <p className="text-sm text-white/50">All caught up!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.slice(0, 5).map((task) => (
        <div
          key={task.id}
          className="flex items-start gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/8 transition-colors cursor-pointer"
        >
          <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${priorityColors[task.priority] || "bg-gray-500"}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{task.title}</p>
            <div className="flex items-center gap-2 mt-1">
              <GlassBadge variant={priorityBadge[task.priority] || "default"}>
                {task.priority}
              </GlassBadge>
              {task.dueAt && (
                <span className="text-xs text-white/40">
                  Due {formatDate(task.dueAt)}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
      {tasks.length > 5 && (
        <p className="text-xs text-white/40 text-center pt-2">
          +{tasks.length - 5} more tasks
        </p>
      )}
    </div>
  );
}

function AlertsSection({ alerts }: { alerts: Alert[] }) {
  const severityStyles: Record<string, { bg: string; border: string; dot: string }> = {
    critical: { bg: "bg-red-500/10", border: "border-red-500/30", dot: "bg-red-500" },
    warning: { bg: "bg-amber-500/10", border: "border-amber-500/30", dot: "bg-amber-500" },
    info: { bg: "bg-blue-500/10", border: "border-blue-500/30", dot: "bg-blue-500" },
  };

  if (alerts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-emerald-500/20 flex items-center justify-center">
          {Icons.check}
        </div>
        <p className="text-sm text-white/50">No active alerts</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.slice(0, 5).map((alert) => {
        const styles = severityStyles[alert.severity] || severityStyles.info;
        return (
          <div
            key={alert.id}
            className={`flex items-start gap-3 p-3 rounded-xl border ${styles.bg} ${styles.border}`}
          >
            <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${styles.dot}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{alert.title}</p>
              <p className="text-xs text-white/40 mt-1">{alert.description}</p>
            </div>
          </div>
        );
      })}
      {alerts.length > 5 && (
        <p className="text-xs text-white/40 text-center pt-2">
          +{alerts.length - 5} more alerts
        </p>
      )}
    </div>
  );
}

/* =============================================================================
   QUICK ACCESS
   ============================================================================= */

interface EntryCardProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
  onClick?: () => void;
}

function EntryCard({ href, icon, label, description, color, onClick }: EntryCardProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (onClick) {
      onClick();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        group relative overflow-hidden
        flex items-center gap-4 p-5
        rounded-2xl border border-white/10
        bg-gradient-to-br from-white/5 to-transparent
        hover:border-white/20 hover:from-white/8
        transition-all duration-200
        cursor-pointer
        w-full text-left
      `}
    >
      <div className={`flex-shrink-0 p-3 rounded-xl ${color}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white group-hover:text-white transition-colors">
          {label}
        </p>
        <p className="text-sm text-white/50 truncate">{description}</p>
      </div>
      <div className="text-white/30 group-hover:text-white/60 group-hover:translate-x-1 transition-all">
        {Icons.chevronRight}
      </div>
    </button>
  );
}

interface QuickAccessSectionProps {
  onNavigate: (view: "sales-documents" | "people-parties", filter: string) => void;
}

function QuickAccessSection({ onNavigate }: QuickAccessSectionProps) {
  const entries: Array<EntryCardProps & { view: "sales-documents" | "people-parties"; filter: string }> = [
    {
      href: "#",
      icon: Icons.invoice,
      label: "Invoices",
      description: "View and manage sales invoices",
      color: "bg-blue-500/20 text-blue-400",
      view: "sales-documents",
      filter: "invoices",
    },
    {
      href: "#",
      icon: Icons.quote,
      label: "Quotes",
      description: "Manage price quotes and proposals",
      color: "bg-green-500/20 text-green-400",
      view: "sales-documents",
      filter: "quotes",
    },
    {
      href: "#",
      icon: Icons.lead,
      label: "Leads",
      description: "Track and qualify potential customers",
      color: "bg-purple-500/20 text-purple-400",
      view: "sales-documents",
      filter: "leads",
    },
    {
      href: "#",
      icon: Icons.customer,
      label: "Customers",
      description: "Customer database and profiles",
      color: "bg-emerald-500/20 text-emerald-400",
      view: "people-parties",
      filter: "customers",
    },
    {
      href: "#",
      icon: Icons.partner,
      label: "Partners",
      description: "Partner organizations and relationships",
      color: "bg-indigo-500/20 text-indigo-400",
      view: "people-parties",
      filter: "partners",
    },
    {
      href: "#",
      icon: Icons.salesperson,
      label: "Salespersons",
      description: "Sales team and representatives",
      color: "bg-amber-500/20 text-amber-400",
      view: "people-parties",
      filter: "salespersons",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {entries.map((entry) => (
        <EntryCard
          key={`${entry.view}-${entry.filter}`}
          href={entry.href}
          icon={entry.icon}
          label={entry.label}
          description={entry.description}
          color={entry.color}
          onClick={() => onNavigate(entry.view, entry.filter)}
        />
      ))}
    </div>
  );
}

/* =============================================================================
   MAIN PAGE
   ============================================================================= */

function SalesCustomersPageContent() {
  const [metrics, setMetrics] = React.useState<SalesMetrics | null>(null);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [recordActivityOpen, setRecordActivityOpen] = React.useState(false);
  const [activeView, setActiveView] = React.useState<"overview" | "sales-documents" | "people-parties">("overview");
  const [viewFilter, setViewFilter] = React.useState<string>("all");

  // Load metrics, tasks, and alerts
  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      apiGet<{ metrics: SalesMetrics }>("/api/sales-customers/metrics")
        .catch((err) => {
          console.error("Failed to fetch metrics:", err);
          // Return default metrics with zeros instead of null
          return {
            metrics: {
              totalCustomers: 0,
              activeCustomers: 0,
              totalPartners: 0,
              totalSalespersons: 0,
              openQuotes: 0,
              openQuotesValue: 0,
              postedInvoices: 0,
              postedInvoicesValue: 0,
              openAR: 0,
              newLeads: 0,
              qualifiedLeads: 0,
              salesTasksCount: 0,
              salesAlertsCount: 0,
            },
          };
        }),
      // Get sales tasks
      apiGet<{ tasks: Task[] }>("/api/sales-customers/tasks?status=open&limit=10").catch(() => ({ tasks: [] })),
      // Get all alerts and filter for sales domain on client side
      apiGet<{ items: Alert[] }>("/api/grc/alerts").catch(() => ({ items: [] })),
    ]).then(([metricsRes, tasksRes, alertsRes]) => {
      setMetrics(metricsRes.metrics);
      setTasks(tasksRes.tasks || []);
      // Filter alerts for sales domain (alerts API doesn't have status field, all are active)
      const salesAlerts = (alertsRes.items || [])
        .filter((a) => a.domain === "sales")
        .slice(0, 10);
      setAlerts(salesAlerts);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-8 pb-12">
      {/* Header with Record Activity CTA */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Sales & Customers</h1>
          <p className="text-sm text-white/50 mt-1">
            Manage customers, leads, quotes, and invoices in one place
          </p>
        </div>
        <GlassButton
          variant="primary"
          size="lg"
          onClick={() => setRecordActivityOpen(true)}
          className="group"
        >
          <span className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-white/20 group-hover:bg-white/30 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            </span>
            Record Sales & Customers Activity
          </span>
        </GlassButton>
      </div>

      {/* Content */}
      {activeView === "overview" && (
        <>
          {/* Analytics Cards */}
          <section>
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">
              Overview
            </h2>
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-24 bg-white/5 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : (
              <AnalyticsSection metrics={metrics} />
            )}
          </section>

          {/* Tasks & Alerts Two-Column */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GlassCard>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide">
                  To-Do
                </h3>
                <GlassBadge variant={tasks.length > 0 ? "warning" : "success"}>
                  {tasks.length}
                </GlassBadge>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <TasksSection tasks={tasks} />
              )}
            </GlassCard>

            <GlassCard>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide">
                  Alerts
                </h3>
                <GlassBadge variant={alerts.length > 0 ? "danger" : "success"}>
                  {alerts.length}
                </GlassBadge>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <AlertsSection alerts={alerts} />
              )}
            </GlassCard>
          </section>

          {/* Quick Access */}
          <section>
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">
              Quick Access
            </h2>
            <QuickAccessSection onNavigate={(view, filter) => {
              setActiveView(view);
              setViewFilter(filter);
            }} />
          </section>
        </>
      )}

      {activeView === "sales-documents" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Sales & Documents</h2>
            <GlassButton variant="ghost" onClick={() => setActiveView("overview")}>
              ← Back to Overview
            </GlassButton>
          </div>
          <SalesDocumentsTab initialView={viewFilter as any} />
        </div>
      )}

      {activeView === "people-parties" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">People & Parties</h2>
            <GlassButton variant="ghost" onClick={() => setActiveView("overview")}>
              ← Back to Overview
            </GlassButton>
          </div>
          <PeoplePartiesTab initialView={viewFilter as any} />
        </div>
      )}

      {/* Record Activity Drawer */}
      <RecordActivityDrawer
        open={recordActivityOpen}
        onClose={() => setRecordActivityOpen(false)}
        onActivityCreated={() => {
          setRecordActivityOpen(false);
          window.location.reload();
        }}
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
