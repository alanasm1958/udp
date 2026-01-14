"use client";

import { useState, useEffect, useCallback } from "react";
import { GlassCard, GlassButton, useToast } from "@/components/ui/glass";
import {
  CheckCircle,
  Filter,
  Search,
  ChevronDown,
  Check,
  X,
  RefreshCw,
  ListTodo,
  Building2,
  Users,
  DollarSign,
  ShoppingCart,
  Shield,
  Megaphone,
  Sparkles,
} from "lucide-react";

/* =============================================================================
   TYPES
   ============================================================================= */

interface Task {
  id: string;
  category: string;
  domain: string;
  taskType: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeUserId: string | null;
  assignedToRole: string | null;
  dueAt: string | null;
  expiresAt: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  confidenceScore: string | null;
  reasoning: string | null;
  actionUrl: string | null;
  whyThis: string | null;
  requirementId: string | null;
  actionType: string | null;
  blockedReason: string | null;
  resolvedAt: string | null;
  autoResolved: boolean | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface TasksResponse {
  tasks: Task[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  summary: {
    total: number;
    byStatus: Record<string, number>;
  };
}

/* =============================================================================
   CONSTANTS
   ============================================================================= */

const CATEGORIES = [
  { value: "all", label: "All Categories", icon: ListTodo },
  { value: "standard", label: "Standard", icon: ListTodo },
  { value: "compliance", label: "Compliance", icon: Shield },
  { value: "marketing", label: "Marketing", icon: Megaphone },
  { value: "ai_suggestion", label: "AI Suggestions", icon: Sparkles },
];

const DOMAINS = [
  { value: "all", label: "All Domains", icon: Building2 },
  { value: "operations", label: "Operations", icon: Building2 },
  { value: "hr", label: "HR & People", icon: Users },
  { value: "finance", label: "Finance", icon: DollarSign },
  { value: "sales", label: "Sales", icon: ShoppingCart },
  { value: "grc", label: "GRC", icon: Shield },
  { value: "marketing", label: "Marketing", icon: Megaphone },
];

const STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "in_review", label: "In Review" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "auto_resolved", label: "Auto Resolved" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
];

const PRIORITIES = [
  { value: "all", label: "All Priorities" },
  { value: "critical", label: "Critical" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
];

/* =============================================================================
   HELPER FUNCTIONS
   ============================================================================= */

function getPriorityColor(priority: string) {
  switch (priority) {
    case "critical":
      return "text-red-400 bg-red-500/10 border-red-500/30";
    case "urgent":
      return "text-orange-400 bg-orange-500/10 border-orange-500/30";
    case "high":
      return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
    case "normal":
      return "text-blue-400 bg-blue-500/10 border-blue-500/30";
    case "low":
      return "text-white/60 bg-white/5 border-white/10";
    default:
      return "text-white/60 bg-white/5 border-white/10";
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "open":
      return "text-blue-400 bg-blue-500/10";
    case "in_progress":
      return "text-yellow-400 bg-yellow-500/10";
    case "blocked":
      return "text-red-400 bg-red-500/10";
    case "in_review":
      return "text-purple-400 bg-purple-500/10";
    case "completed":
    case "approved":
      return "text-green-400 bg-green-500/10";
    case "cancelled":
    case "rejected":
      return "text-white/40 bg-white/5";
    case "auto_resolved":
      return "text-cyan-400 bg-cyan-500/10";
    case "expired":
      return "text-orange-400 bg-orange-500/10";
    default:
      return "text-white/60 bg-white/5";
  }
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "standard":
      return <ListTodo className="w-4 h-4" />;
    case "compliance":
      return <Shield className="w-4 h-4" />;
    case "marketing":
      return <Megaphone className="w-4 h-4" />;
    case "ai_suggestion":
      return <Sparkles className="w-4 h-4" />;
    default:
      return <ListTodo className="w-4 h-4" />;
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
    case "marketing":
      return "text-pink-400";
    default:
      return "text-white/60";
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { text: `${Math.abs(diffDays)}d overdue`, className: "text-red-400" };
  } else if (diffDays === 0) {
    return { text: "Due today", className: "text-orange-400" };
  } else if (diffDays === 1) {
    return { text: "Due tomorrow", className: "text-yellow-400" };
  } else if (diffDays <= 7) {
    return { text: `Due in ${diffDays}d`, className: "text-blue-400" };
  } else {
    return { text: date.toLocaleDateString(), className: "text-white/50" };
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
   TASK CARD COMPONENT
   ============================================================================= */

function TaskCard({
  task,
  onResolve,
  onDismiss,
}: {
  task: Task;
  onResolve: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const dueInfo = formatDate(task.dueAt);
  const isActionable = ["open", "in_progress", "in_review"].includes(task.status);

  return (
    <GlassCard className="p-4 hover:bg-white/5 transition-colors">
      <div className="flex items-start gap-4">
        {/* Category Icon */}
        <div className={`p-2 rounded-lg bg-white/5 ${getDomainColor(task.domain)}`}>
          {getCategoryIcon(task.category)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-medium text-white truncate">{task.title}</h3>
              {task.description && (
                <p className="text-sm text-white/50 mt-1 line-clamp-2">{task.description}</p>
              )}
            </div>

            {/* Actions */}
            {isActionable && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => onResolve(task.id)}
                  className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                  title="Mark as completed"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDismiss(task.id)}
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
            {/* Priority badge */}
            <span className={`px-2 py-0.5 rounded text-xs border ${getPriorityColor(task.priority)}`}>
              {task.priority}
            </span>

            {/* Status badge */}
            <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(task.status)}`}>
              {task.status.replace(/_/g, " ")}
            </span>

            {/* Domain */}
            <span className={`text-xs ${getDomainColor(task.domain)}`}>
              {task.domain}
            </span>

            {/* Due date */}
            {dueInfo && (
              <span className={`text-xs ${dueInfo.className}`}>
                {dueInfo.text}
              </span>
            )}

            {/* AI confidence */}
            {task.confidenceScore && (
              <span className="text-xs text-purple-400">
                {(parseFloat(task.confidenceScore) * 100).toFixed(0)}% confidence
              </span>
            )}
          </div>

          {/* AI reasoning */}
          {task.reasoning && (
            <p className="text-xs text-white/40 mt-2 italic">{task.reasoning}</p>
          )}

          {/* Action URL */}
          {task.actionUrl && (
            <a
              href={task.actionUrl}
              className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-block"
            >
              View details &rarr;
            </a>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

/* =============================================================================
   MAIN PAGE COMPONENT
   ============================================================================= */

export default function TasksPage() {
  const { addToast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [pagination, setPagination] = useState({ total: 0, hasMore: false });

  // Filters
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [domain, setDomain] = useState("all");
  const [status, setStatus] = useState("open");
  const [priority, setPriority] = useState("all");

  const loadTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        status,
        category,
        domain,
        priority,
        limit: "50",
      });
      if (search) params.set("search", search);

      const res = await fetch(`/api/master/tasks?${params}`);
      if (res.ok) {
        const data: TasksResponse = await res.json();
        setTasks(data.tasks);
        setSummary(data.summary.byStatus);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error loading tasks:", error);
      addToast("error", "Failed to load tasks");
    } finally {
      setIsLoading(false);
    }
  }, [status, category, domain, priority, search, addToast]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleResolve = async (id: string) => {
    try {
      const res = await fetch("/api/master/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: [id],
          updates: { status: "completed", resolvedAt: new Date().toISOString() },
        }),
      });
      if (res.ok) {
        addToast("success", "Task marked as completed");
        loadTasks();
      }
    } catch (error) {
      console.error("Error resolving task:", error);
      addToast("error", "Failed to update task");
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      const res = await fetch("/api/master/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: [id],
          updates: { status: "cancelled" },
        }),
      });
      if (res.ok) {
        addToast("success", "Task dismissed");
        loadTasks();
      }
    } catch (error) {
      console.error("Error dismissing task:", error);
      addToast("error", "Failed to dismiss task");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Tasks</h1>
          <p className="text-sm text-white/50 mt-1">
            Unified view of all tasks across modules
          </p>
        </div>
        <GlassButton onClick={loadTasks} variant="default">
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </GlassButton>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <GlassCard className="p-4 border border-blue-500/30 bg-blue-500/5">
          <p className="text-sm text-white/60">Open</p>
          <p className="text-2xl font-bold text-blue-400">{summary.open || 0}</p>
        </GlassCard>
        <GlassCard className="p-4 border border-yellow-500/30 bg-yellow-500/5">
          <p className="text-sm text-white/60">In Progress</p>
          <p className="text-2xl font-bold text-yellow-400">{summary.in_progress || 0}</p>
        </GlassCard>
        <GlassCard className="p-4 border border-red-500/30 bg-red-500/5">
          <p className="text-sm text-white/60">Blocked</p>
          <p className="text-2xl font-bold text-red-400">{summary.blocked || 0}</p>
        </GlassCard>
        <GlassCard className="p-4 border border-purple-500/30 bg-purple-500/5">
          <p className="text-sm text-white/60">In Review</p>
          <p className="text-2xl font-bold text-purple-400">{summary.in_review || 0}</p>
        </GlassCard>
        <GlassCard className="p-4 border border-green-500/30 bg-green-500/5">
          <p className="text-sm text-white/60">Completed</p>
          <p className="text-2xl font-bold text-green-400">{summary.completed || 0}</p>
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
              placeholder="Search tasks..."
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
            label="Priority"
            value={priority}
            options={PRIORITIES}
            onChange={setPriority}
          />
        </div>
      </GlassCard>

      {/* Tasks List */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <GlassCard key={i} className="p-4 animate-pulse">
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
      ) : tasks.length > 0 ? (
        <div className="space-y-4">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
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
          <h3 className="text-lg font-semibold text-white mb-2">All caught up!</h3>
          <p className="text-white/50">No tasks match your current filters.</p>
        </GlassCard>
      )}
    </div>
  );
}
