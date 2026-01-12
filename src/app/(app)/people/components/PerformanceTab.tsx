"use client";

import * as React from "react";
import {
  GlassCard,
  GlassButton,
  GlassBadge,
  GlassTable,
  SkeletonTable,
  SlideOver,
  useToast,
} from "@/components/ui/glass";
import { formatDate } from "@/lib/http";
import { PerformanceCycleWizard } from "./PerformanceCycleWizard";
import { PerformanceReviewWizard } from "./PerformanceReviewWizard";

/* =============================================================================
   TYPES
   ============================================================================= */

interface PerformanceCycle {
  id: string;
  name: string;
  frequency: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: string;
  reviewCount: number;
  completedReviewCount: number;
  assignedToRole?: string | null;
  notes?: string | null;
}

interface PerformanceReview {
  id: string;
  cycleId: string;
  employeeId: string;
  employeeName: string;
  cycleName: string;
  cycleDueDate: string;
  status: string;
  overallRating?: number | null;
}

interface PerformanceReviewV2 {
  id: string;
  personId: string;
  employeeName: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  visibility: string;
  aiOutcomeCategory: string | null;
  createdAt: string;
}

interface Employee {
  id: string;
  personId: string;
  personName: string;
}

/* =============================================================================
   ICONS
   ============================================================================= */

const Icons = {
  plus: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  star: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  ),
  chart: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  clock: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  check: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  chevronRight: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  ),
  refresh: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  ),
  sparkles: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  ),
  clipboard: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
    </svg>
  ),
};

/* =============================================================================
   STATUS HELPERS
   ============================================================================= */

const statusColors: Record<string, "default" | "info" | "warning" | "success" | "danger"> = {
  planned: "default",
  active: "warning",
  completed: "success",
  cancelled: "danger",
  not_started: "default",
  in_progress: "info",
  submitted: "warning",
  approved: "success",
};

const statusLabels: Record<string, string> = {
  planned: "Planned",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
  not_started: "Not Started",
  in_progress: "In Progress",
  submitted: "Submitted",
  approved: "Approved",
};

const frequencyLabels: Record<string, string> = {
  quarterly: "Quarterly",
  semi_annual: "Semi-Annual",
  annual: "Annual",
  custom: "Custom",
};

// V2 Review status helpers
const reviewV2StatusColors: Record<string, "default" | "info" | "warning" | "success" | "danger"> = {
  draft: "default",
  completed: "info",
  acknowledged: "success",
};

const reviewV2StatusLabels: Record<string, string> = {
  draft: "Draft",
  completed: "Completed",
  acknowledged: "Acknowledged",
};

const aiOutcomeCategoryColors: Record<string, "success" | "info" | "warning" | "danger" | "default"> = {
  outstanding_contribution: "success",
  strong_performance: "success",
  solid_on_track: "info",
  below_expectations: "warning",
  critical_concerns: "danger",
};

const periodTypeLabels: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
  probation: "Probation",
  project: "Project",
  other: "Other",
};

/* =============================================================================
   CYCLE DETAIL DRAWER
   ============================================================================= */

interface CycleDrawerProps {
  cycle: PerformanceCycle | null;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

function CycleDetailDrawer({ cycle, open, onClose, onRefresh }: CycleDrawerProps) {
  const [reviews, setReviews] = React.useState<PerformanceReview[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [updating, setUpdating] = React.useState(false);

  React.useEffect(() => {
    if (cycle && open) {
      loadReviews();
    }
  }, [cycle?.id, open]);

  const loadReviews = async () => {
    if (!cycle) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/people/performance-reviews?cycleId=${cycle.id}`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.items || []);
      }
    } catch (error) {
      console.error("Failed to load reviews:", error);
    }
    setLoading(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!cycle) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/people/performance-cycles/${cycle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        onRefresh();
        onClose();
      }
    } catch (error) {
      console.error("Failed to update cycle:", error);
    }
    setUpdating(false);
  };

  if (!cycle) return null;

  const progress = cycle.reviewCount > 0
    ? Math.round((cycle.completedReviewCount / cycle.reviewCount) * 100)
    : 0;

  return (
    <SlideOver open={open} onClose={onClose} title={cycle.name} width="md">
      <div className="space-y-6">
        {/* Overview */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-white/40 uppercase mb-1">Frequency</div>
            <div className="text-white">{frequencyLabels[cycle.frequency] || cycle.frequency}</div>
          </div>
          <div>
            <div className="text-xs text-white/40 uppercase mb-1">Status</div>
            <GlassBadge variant={statusColors[cycle.status] || "default"}>
              {statusLabels[cycle.status] || cycle.status}
            </GlassBadge>
          </div>
          <div>
            <div className="text-xs text-white/40 uppercase mb-1">Period</div>
            <div className="text-white text-sm">
              {formatDate(cycle.periodStart)} - {formatDate(cycle.periodEnd)}
            </div>
          </div>
          <div>
            <div className="text-xs text-white/40 uppercase mb-1">Due Date</div>
            <div className="text-white">{formatDate(cycle.dueDate)}</div>
          </div>
        </div>

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-white/70">Review Progress</span>
            <span className="text-white">{cycle.completedReviewCount}/{cycle.reviewCount} ({progress}%)</span>
          </div>
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 border-t border-white/10 pt-4">
          {cycle.status === "planned" && (
            <GlassButton
              variant="primary"
              onClick={() => handleStatusChange("active")}
              disabled={updating}
            >
              Start Cycle
            </GlassButton>
          )}
          {cycle.status === "active" && (
            <GlassButton
              variant="primary"
              onClick={() => handleStatusChange("completed")}
              disabled={updating || cycle.completedReviewCount < cycle.reviewCount}
            >
              Complete Cycle
            </GlassButton>
          )}
          {(cycle.status === "planned" || cycle.status === "active") && (
            <GlassButton
              variant="ghost"
              onClick={() => handleStatusChange("cancelled")}
              disabled={updating}
            >
              Cancel
            </GlassButton>
          )}
        </div>

        {/* Reviews */}
        <div className="border-t border-white/10 pt-4">
          <h3 className="text-sm font-medium text-white mb-3">Reviews ({reviews.length})</h3>
          {loading ? (
            <SkeletonTable rows={3} columns={3} />
          ) : reviews.length === 0 ? (
            <p className="text-sm text-white/40">No reviews for this cycle</p>
          ) : (
            <div className="space-y-2">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium text-white">{review.employeeName}</div>
                    <div className="text-xs text-white/40">
                      {review.overallRating ? `Rating: ${review.overallRating}/5` : "Not rated"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <GlassBadge variant={statusColors[review.status] || "default"}>
                      {statusLabels[review.status] || review.status}
                    </GlassBadge>
                    {Icons.chevronRight}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SlideOver>
  );
}

/* =============================================================================
   MAIN COMPONENT
   ============================================================================= */

interface PerformanceTabProps {
  onRecordActivity?: () => void;
}

export function PerformanceTab({ onRecordActivity }: PerformanceTabProps) {
  const [cycles, setCycles] = React.useState<PerformanceCycle[]>([]);
  const [pendingReviews, setPendingReviews] = React.useState<PerformanceReview[]>([]);
  const [reviewsV2, setReviewsV2] = React.useState<PerformanceReviewV2[]>([]);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showWizard, setShowWizard] = React.useState(false);
  const [showReviewWizard, setShowReviewWizard] = React.useState(false);
  const [selectedCycle, setSelectedCycle] = React.useState<PerformanceCycle | null>(null);
  const [activeView, setActiveView] = React.useState<"cycles" | "reviews">("reviews");
  const { addToast } = useToast();

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [cyclesRes, reviewsRes, reviewsV2Res, employeesRes] = await Promise.all([
        fetch("/api/people/performance-cycles"),
        fetch("/api/people/performance-reviews?status=not_started"),
        fetch("/api/people/performance/reviews"),
        fetch("/api/payroll/employees"),
      ]);

      if (cyclesRes.ok) {
        const data = await cyclesRes.json();
        setCycles(data.items || []);
      }

      if (reviewsRes.ok) {
        const data = await reviewsRes.json();
        setPendingReviews(data.items || []);
      }

      if (reviewsV2Res.ok) {
        const data = await reviewsV2Res.json();
        setReviewsV2(data.reviews || []);
      }

      if (employeesRes.ok) {
        const data = await employeesRes.json();
        // Map employees to the format expected by the wizard
        const mappedEmployees = (data.employees || []).map((emp: { id: string; personId: string; personFullName?: string }) => ({
          id: emp.id,
          personId: emp.personId,
          personName: emp.personFullName || "Unknown",
        }));
        setEmployees(mappedEmployees);
      }
    } catch (error) {
      console.error("Failed to load performance data:", error);
      addToast("error", "Failed to load performance data");
    }
    setLoading(false);
  }, [addToast]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRowClick = (index: number) => {
    setSelectedCycle(cycles[index]);
  };

  const handleCycleCreated = () => {
    setShowWizard(false);
    loadData();
    onRecordActivity?.();
  };

  const handleReviewCreated = () => {
    setShowReviewWizard(false);
    loadData();
    onRecordActivity?.();
    addToast("success", "Performance review created successfully");
  };

  // Stats
  const activeCycles = cycles.filter(c => c.status === "active").length;
  const draftReviews = reviewsV2.filter(r => r.status === "draft").length;
  const completedReviews = reviewsV2.filter(r => r.status === "completed" || r.status === "acknowledged").length;
  const completedThisYear = cycles.filter(c => {
    const year = new Date().getFullYear();
    return c.status === "completed" && new Date(c.periodEnd).getFullYear() === year;
  }).length;

  return (
    <div className="space-y-6">
      {/* Header with Action */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Performance Management</h2>
          <p className="text-sm text-white/50">Create reviews and track employee performance</p>
        </div>
        <div className="flex items-center gap-2">
          <GlassButton variant="ghost" onClick={loadData} disabled={loading}>
            {Icons.refresh}
          </GlassButton>
          <GlassButton variant="primary" onClick={() => setShowReviewWizard(true)}>
            {Icons.sparkles}
            <span className="ml-2">New Review</span>
          </GlassButton>
          <GlassButton variant="default" onClick={() => setShowWizard(true)}>
            {Icons.plus}
            <span className="ml-2">Create Cycle</span>
          </GlassButton>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        <GlassButton
          variant={activeView === "reviews" ? "primary" : "ghost"}
          onClick={() => setActiveView("reviews")}
        >
          {Icons.clipboard}
          <span className="ml-2">Reviews ({reviewsV2.length})</span>
        </GlassButton>
        <GlassButton
          variant={activeView === "cycles" ? "primary" : "ghost"}
          onClick={() => setActiveView("cycles")}
        >
          {Icons.chart}
          <span className="ml-2">Cycles ({cycles.length})</span>
        </GlassButton>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
              {Icons.sparkles}
            </div>
            <div>
              <div className="text-xs text-white/50 uppercase">Draft Reviews</div>
              <div className="text-xl font-semibold text-white">{draftReviews}</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              {Icons.check}
            </div>
            <div>
              <div className="text-xs text-white/50 uppercase">Completed Reviews</div>
              <div className="text-xl font-semibold text-white">{completedReviews}</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
              {Icons.chart}
            </div>
            <div>
              <div className="text-xs text-white/50 uppercase">Active Cycles</div>
              <div className="text-xl font-semibold text-white">{activeCycles}</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard padding="sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
              {Icons.clock}
            </div>
            <div>
              <div className="text-xs text-white/50 uppercase">Pending (Legacy)</div>
              <div className="text-xl font-semibold text-white">{pendingReviews.length}</div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Reviews V2 Table */}
      {activeView === "reviews" && (
        <GlassCard padding="none">
          {loading ? (
            <div className="p-6">
              <SkeletonTable rows={3} columns={5} />
            </div>
          ) : reviewsV2.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                {Icons.sparkles}
              </div>
              <p className="text-white/70 font-medium mb-2">No performance reviews</p>
              <p className="text-sm text-white/40 mb-6 max-w-md mx-auto">
                Create a guided performance review with AI-powered outcome analysis.
              </p>
              <GlassButton variant="primary" onClick={() => setShowReviewWizard(true)}>
                {Icons.sparkles}
                <span className="ml-2">Create First Review</span>
              </GlassButton>
            </div>
          ) : (
            <GlassTable
              headers={["Employee", "Period", "Type", "AI Outcome", "Status"]}
              rows={reviewsV2.map((review) => [
                // Employee
                <div key="employee">
                  <div className="text-sm font-medium text-white">{review.employeeName}</div>
                  <div className="text-xs text-white/40">{formatDate(review.createdAt)}</div>
                </div>,
                // Period
                <span key="period" className="text-white/70">
                  {formatDate(review.periodStart)} - {formatDate(review.periodEnd)}
                </span>,
                // Type
                <span key="type" className="text-white/70">
                  {periodTypeLabels[review.periodType] || review.periodType}
                </span>,
                // AI Outcome
                review.aiOutcomeCategory ? (
                  <GlassBadge
                    key="outcome"
                    variant={aiOutcomeCategoryColors[review.aiOutcomeCategory] || "default"}
                  >
                    {review.aiOutcomeCategory.replace(/_/g, " ")}
                  </GlassBadge>
                ) : (
                  <span key="outcome" className="text-white/40 text-sm">Not generated</span>
                ),
                // Status
                <GlassBadge key="status" variant={reviewV2StatusColors[review.status] || "default"}>
                  {reviewV2StatusLabels[review.status] || review.status}
                </GlassBadge>,
              ])}
              emptyMessage="No performance reviews found"
            />
          )}
        </GlassCard>
      )}

      {/* Performance Cycles Table */}
      {activeView === "cycles" && (
        <GlassCard padding="none">
          {loading ? (
            <div className="p-6">
              <SkeletonTable rows={3} columns={5} />
            </div>
          ) : cycles.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                {Icons.star}
              </div>
              <p className="text-white/70 font-medium mb-2">No performance cycles</p>
              <p className="text-sm text-white/40 mb-6 max-w-md mx-auto">
                Create a performance cycle to track reviews for your team.
                Set up quarterly, semi-annual, or annual reviews.
              </p>
              <GlassButton variant="primary" onClick={() => setShowWizard(true)}>
                {Icons.plus}
                <span className="ml-2">Create First Cycle</span>
              </GlassButton>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-white/10">
                    {["Cycle", "Period", "Due Date", "Progress", "Status"].map((header, i) => (
                      <th
                        key={i}
                        className="px-4 py-3 text-xs font-semibold text-white/60 uppercase tracking-wider text-left"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cycles.map((cycle, index) => (
                    <tr
                      key={cycle.id}
                      onClick={() => handleRowClick(index)}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-white">{cycle.name}</div>
                        <div className="text-xs text-white/40">{frequencyLabels[cycle.frequency] || cycle.frequency}</div>
                      </td>
                      <td className="px-4 py-3 text-white/70">
                        {formatDate(cycle.periodStart)} - {formatDate(cycle.periodEnd)}
                      </td>
                      <td className="px-4 py-3 text-white/70">{formatDate(cycle.dueDate)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 rounded-full transition-all"
                              style={{ width: `${cycle.reviewCount > 0 ? (cycle.completedReviewCount / cycle.reviewCount) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-white/50">
                            {cycle.completedReviewCount}/{cycle.reviewCount}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <GlassBadge variant={statusColors[cycle.status] || "default"}>
                          {statusLabels[cycle.status] || cycle.status}
                        </GlassBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      )}

      {/* Pending Reviews Section */}
      {pendingReviews.length > 0 && (
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white">Pending Reviews</h3>
            <GlassBadge variant="warning">{pendingReviews.length} pending</GlassBadge>
          </div>
          <div className="space-y-2">
            {pendingReviews.slice(0, 5).map((review) => (
              <div
                key={review.id}
                className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              >
                <div>
                  <div className="text-sm font-medium text-white">{review.employeeName}</div>
                  <div className="text-xs text-white/40">{review.cycleName}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-white/50">Due</div>
                  <div className="text-sm text-amber-400">{formatDate(review.cycleDueDate)}</div>
                </div>
              </div>
            ))}
            {pendingReviews.length > 5 && (
              <p className="text-xs text-white/40 text-center pt-2">
                + {pendingReviews.length - 5} more pending reviews
              </p>
            )}
          </div>
        </GlassCard>
      )}

      {/* Create Cycle Wizard */}
      <PerformanceCycleWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
        onCreated={handleCycleCreated}
      />

      {/* Performance Review Wizard (V2) */}
      <PerformanceReviewWizard
        open={showReviewWizard}
        employees={employees}
        onClose={() => setShowReviewWizard(false)}
        onComplete={handleReviewCreated}
      />

      {/* Cycle Detail Drawer */}
      <CycleDetailDrawer
        cycle={selectedCycle}
        open={selectedCycle !== null}
        onClose={() => setSelectedCycle(null)}
        onRefresh={loadData}
      />
    </div>
  );
}
