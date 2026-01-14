"use client";

import { useState, useEffect, useCallback } from "react";
import { GlassCard, GlassButton, useToast } from "@/components/ui/glass";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Filter,
  Search,
  ChevronDown,
  Check,
  X,
  RefreshCw,
  Building2,
  Users,
  DollarSign,
  ShoppingCart,
  Shield,
  Bell,
  Eye,
} from "lucide-react";

/* =============================================================================
   TYPES
   ============================================================================= */

interface Alert {
  id: string;
  category: string;
  domain: string;
  alertType: string;
  title: string;
  message: string | null;
  severity: string;
  status: string;
  source: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  requirementId: string | null;
  resolvedAt: string | null;
  autoResolved: boolean | null;
  resolutionReason: string | null;
  expiresAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface AlertsResponse {
  alerts: Alert[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  summary: {
    total: number;
    bySeverity: Record<string, number>;
    byStatus: Record<string, number>;
  };
}

/* =============================================================================
   CONSTANTS
   ============================================================================= */

const CATEGORIES = [
  { value: "all", label: "All Categories", icon: Bell },
  { value: "standard", label: "Standard", icon: Bell },
  { value: "compliance", label: "Compliance", icon: Shield },
];

const DOMAINS = [
  { value: "all", label: "All Domains", icon: Building2 },
  { value: "operations", label: "Operations", icon: Building2 },
  { value: "hr", label: "HR & People", icon: Users },
  { value: "finance", label: "Finance", icon: DollarSign },
  { value: "sales", label: "Sales", icon: ShoppingCart },
  { value: "grc", label: "GRC", icon: Shield },
];

const STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];

const SEVERITIES = [
  { value: "all", label: "All Severities" },
  { value: "critical", label: "Critical" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Info" },
];

const SOURCES = [
  { value: "all", label: "All Sources" },
  { value: "system", label: "System" },
  { value: "ai", label: "AI" },
  { value: "connector", label: "Connector" },
  { value: "user", label: "User" },
];

/* =============================================================================
   HELPER FUNCTIONS
   ============================================================================= */

function getSeverityIcon(severity: string) {
  switch (severity) {
    case "critical":
      return <AlertTriangle className="w-5 h-5" />;
    case "warning":
      return <AlertCircle className="w-5 h-5" />;
    case "info":
    default:
      return <Info className="w-5 h-5" />;
  }
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case "critical":
      return "text-red-400 bg-red-500/10 border-red-500/30";
    case "warning":
      return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
    case "info":
    default:
      return "text-blue-400 bg-blue-500/10 border-blue-500/30";
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "active":
      return "text-red-400 bg-red-500/10";
    case "acknowledged":
      return "text-yellow-400 bg-yellow-500/10";
    case "resolved":
      return "text-green-400 bg-green-500/10";
    case "dismissed":
      return "text-white/40 bg-white/5";
    default:
      return "text-white/60 bg-white/5";
  }
}

function getDomainColor(domain: string) {
  switch (domain) {
    case "operations":
      return "text-blue-400";
    case "hr":
      return "text-purple-400";
    case "finance":
      return "text-green-400";
    case "sales":
      return "text-orange-400";
    case "grc":
      return "text-red-400";
    default:
      return "text-white/60";
  }
}

function formatTimeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

/* =============================================================================
   FILTER DROPDOWN COMPONENT
   ============================================================================= */

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; icon?: React.ComponentType<{ className?: string }> }[];
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((o) => o.value === value);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm"
      >
        {selectedOption?.icon && <selectedOption.icon className="w-4 h-4 text-white/60" />}
        <span className="text-white/80">{selectedOption?.label || label}</span>
        <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-48 bg-zinc-900 border border-white/10 rounded-lg shadow-xl z-20 py-1 max-h-64 overflow-y-auto">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10 transition-colors ${
                  value === option.value ? "text-blue-400" : "text-white/80"
                }`}
              >
                {option.icon && <option.icon className="w-4 h-4" />}
                <span className="flex-1 text-left">{option.label}</span>
                {value === option.value && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* =============================================================================
   ALERT CARD COMPONENT
   ============================================================================= */

function AlertCard({
  alert,
  onAcknowledge,
  onResolve,
  onDismiss,
}: {
  alert: Alert;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const isActionable = alert.status === "active" || alert.status === "acknowledged";

  return (
    <GlassCard className={`p-4 border ${getSeverityColor(alert.severity)} hover:bg-white/5 transition-colors`}>
      <div className="flex items-start gap-4">
        {/* Severity Icon */}
        <div className={`p-2 rounded-lg ${getSeverityColor(alert.severity).split(" ")[1]}`}>
          {getSeverityIcon(alert.severity)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-medium text-white">{alert.title}</h3>
              {alert.message && (
                <p className="text-sm text-white/50 mt-1 line-clamp-2">{alert.message}</p>
              )}
            </div>

            {/* Actions */}
            {isActionable && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {alert.status === "active" && (
                  <button
                    onClick={() => onAcknowledge(alert.id)}
                    className="p-1.5 rounded-lg bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors"
                    title="Acknowledge"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => onResolve(alert.id)}
                  className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                  title="Resolve"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDismiss(alert.id)}
                  className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60 transition-colors"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Meta info */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {/* Severity badge */}
            <span className={`px-2 py-0.5 rounded text-xs border ${getSeverityColor(alert.severity)}`}>
              {alert.severity}
            </span>

            {/* Status badge */}
            <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(alert.status)}`}>
              {alert.status}
            </span>

            {/* Domain */}
            <span className={`text-xs ${getDomainColor(alert.domain)}`}>
              {alert.domain}
            </span>

            {/* Alert type */}
            <span className="text-xs text-white/40">
              {alert.alertType.replace(/_/g, " ")}
            </span>

            {/* Source */}
            <span className="text-xs text-white/40">
              via {alert.source}
            </span>

            {/* Time */}
            <span className="text-xs text-white/40">
              {formatTimeAgo(alert.createdAt)}
            </span>
          </div>

          {/* Resolution info */}
          {alert.resolvedAt && (
            <p className="text-xs text-green-400/60 mt-2">
              Resolved {formatTimeAgo(alert.resolvedAt)}
              {alert.autoResolved && " (auto)"}
              {alert.resolutionReason && `: ${alert.resolutionReason}`}
            </p>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

/* =============================================================================
   MAIN PAGE COMPONENT
   ============================================================================= */

export default function AlertsPage() {
  const { addToast } = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<{ bySeverity: Record<string, number>; byStatus: Record<string, number> }>({
    bySeverity: {},
    byStatus: {},
  });
  const [pagination, setPagination] = useState({ total: 0, hasMore: false });

  // Filters
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [domain, setDomain] = useState("all");
  const [status, setStatus] = useState("active");
  const [severity, setSeverity] = useState("all");
  const [source, setSource] = useState("all");

  const loadAlerts = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        status,
        category,
        domain,
        severity,
        source,
        limit: "50",
      });
      if (search) params.set("search", search);

      const res = await fetch(`/api/master/alerts?${params}`);
      if (res.ok) {
        const data: AlertsResponse = await res.json();
        setAlerts(data.alerts);
        setSummary({
          bySeverity: data.summary.bySeverity,
          byStatus: data.summary.byStatus,
        });
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error loading alerts:", error);
      addToast("error", "Failed to load alerts");
    } finally {
      setIsLoading(false);
    }
  }, [status, category, domain, severity, source, search, addToast]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleAcknowledge = async (id: string) => {
    try {
      const res = await fetch("/api/master/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: [id],
          updates: { status: "acknowledged" },
        }),
      });
      if (res.ok) {
        addToast("success", "Alert acknowledged");
        loadAlerts();
      }
    } catch (error) {
      console.error("Error acknowledging alert:", error);
      addToast("error", "Failed to acknowledge alert");
    }
  };

  const handleResolve = async (id: string) => {
    try {
      const res = await fetch("/api/master/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: [id],
          updates: { status: "resolved" },
        }),
      });
      if (res.ok) {
        addToast("success", "Alert resolved");
        loadAlerts();
      }
    } catch (error) {
      console.error("Error resolving alert:", error);
      addToast("error", "Failed to resolve alert");
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      const res = await fetch("/api/master/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: [id],
          updates: { status: "dismissed" },
        }),
      });
      if (res.ok) {
        addToast("success", "Alert dismissed");
        loadAlerts();
      }
    } catch (error) {
      console.error("Error dismissing alert:", error);
      addToast("error", "Failed to dismiss alert");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Alerts</h1>
          <p className="text-sm text-white/50 mt-1">
            Unified view of all alerts across modules
          </p>
        </div>
        <GlassButton onClick={loadAlerts} variant="default">
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </GlassButton>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <GlassCard className="p-4 border border-red-500/30 bg-red-500/5">
          <p className="text-sm text-white/60">Critical</p>
          <p className="text-2xl font-bold text-red-400">{summary.bySeverity.critical || 0}</p>
        </GlassCard>
        <GlassCard className="p-4 border border-yellow-500/30 bg-yellow-500/5">
          <p className="text-sm text-white/60">Warning</p>
          <p className="text-2xl font-bold text-yellow-400">{summary.bySeverity.warning || 0}</p>
        </GlassCard>
        <GlassCard className="p-4 border border-blue-500/30 bg-blue-500/5">
          <p className="text-sm text-white/60">Info</p>
          <p className="text-2xl font-bold text-blue-400">{summary.bySeverity.info || 0}</p>
        </GlassCard>
        <GlassCard className="p-4 border border-red-500/30 bg-red-500/5">
          <p className="text-sm text-white/60">Active</p>
          <p className="text-2xl font-bold text-red-400">{summary.byStatus.active || 0}</p>
        </GlassCard>
        <GlassCard className="p-4 border border-green-500/30 bg-green-500/5">
          <p className="text-sm text-white/60">Resolved</p>
          <p className="text-2xl font-bold text-green-400">{summary.byStatus.resolved || 0}</p>
        </GlassCard>
        <GlassCard className="p-4 border border-white/10 bg-white/5">
          <p className="text-sm text-white/60">Total</p>
          <p className="text-2xl font-bold text-white">{pagination.total}</p>
        </GlassCard>
      </div>

      {/* Filters */}
      <GlassCard className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-white/60">
            <Filter className="w-4 h-4" />
            <span className="text-sm">Filters:</span>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search alerts..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 text-sm focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <FilterDropdown
            label="Category"
            value={category}
            options={CATEGORIES}
            onChange={setCategory}
          />

          <FilterDropdown
            label="Domain"
            value={domain}
            options={DOMAINS}
            onChange={setDomain}
          />

          <FilterDropdown
            label="Status"
            value={status}
            options={STATUSES}
            onChange={setStatus}
          />

          <FilterDropdown
            label="Severity"
            value={severity}
            options={SEVERITIES}
            onChange={setSeverity}
          />

          <FilterDropdown
            label="Source"
            value={source}
            options={SOURCES}
            onChange={setSource}
          />
        </div>
      </GlassCard>

      {/* Alerts List */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <GlassCard key={i} className="p-4 animate-pulse border border-white/10">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-white/10" />
                <div className="flex-1">
                  <div className="h-5 bg-white/10 rounded w-1/3 mb-2" />
                  <div className="h-4 bg-white/10 rounded w-2/3" />
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      ) : alerts.length > 0 ? (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={handleAcknowledge}
              onResolve={handleResolve}
              onDismiss={handleDismiss}
            />
          ))}

          {pagination.hasMore && (
            <div className="text-center py-4">
              <GlassButton variant="default">
                Load more
              </GlassButton>
            </div>
          )}
        </div>
      ) : (
        <GlassCard className="p-12 text-center">
          <CheckCircle className="w-16 h-16 text-green-400/50 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">All clear!</h3>
          <p className="text-white/50">No alerts match your current filters.</p>
        </GlassCard>
      )}
    </div>
  );
}
