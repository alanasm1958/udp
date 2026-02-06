"use client";

import * as React from "react";
import {
  GlassCard,
  GlassButton,
  SlideOver,
  PageHeader,
  Spinner,
  useToast,
  GlassTextarea,
} from "@/components/ui/glass";
import { apiGet, apiPost } from "@/lib/http";

interface Period {
  id: string | null;
  year: number;
  month: number;
  monthName: string;
  startDate: string;
  endDate: string;
  status: "open" | "soft_closed" | "hard_closed";
  checklistSnapshot: {
    unreconciledBankAccounts: number;
    pendingInvoices: number;
    unpostedJournals: number;
    missingDocuments: number;
  } | null;
  periodTotals: {
    revenue: number;
    expenses: number;
    netIncome: number;
  } | null;
}

const STATUS_COLORS = {
  open: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  soft_closed: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  hard_closed: "bg-red-500/20 text-red-400 border-red-500/30",
};

const STATUS_LABELS = {
  open: "Open",
  soft_closed: "Soft Closed",
  hard_closed: "Hard Closed",
};

export default function PeriodsPage() {
  const { addToast } = useToast();

  const currentYear = new Date().getFullYear();
  const [year, setYear] = React.useState(currentYear);
  const [periods, setPeriods] = React.useState<Period[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Modal states
  const [selectedPeriod, setSelectedPeriod] = React.useState<Period | null>(null);
  const [modalType, setModalType] = React.useState<"soft_close" | "hard_close" | "reopen" | null>(null);
  const [reopenReason, setReopenReason] = React.useState("");
  const [actionLoading, setActionLoading] = React.useState(false);

  const loadPeriods = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<{ periods: Period[] }>(`/api/finance/periods?year=${year}`);
      setPeriods(result.periods);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load periods");
    } finally {
      setLoading(false);
    }
  }, [year]);

  React.useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  const initializeYear = async () => {
    setActionLoading(true);
    try {
      await apiPost(`/api/finance/periods`, { year });
      addToast("success", `Periods initialized for ${year}`);
      loadPeriods();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to initialize periods");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSoftClose = async () => {
    if (!selectedPeriod?.id) return;
    setActionLoading(true);
    try {
      await apiPost(`/api/finance/periods/${selectedPeriod.id}/soft-close`, {});
      addToast("success", `${selectedPeriod.monthName} ${selectedPeriod.year} soft closed`);
      closeModal();
      loadPeriods();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to soft close period");
    } finally {
      setActionLoading(false);
    }
  };

  const handleHardClose = async () => {
    if (!selectedPeriod?.id) return;
    setActionLoading(true);
    try {
      await apiPost(`/api/finance/periods/${selectedPeriod.id}/hard-close`, {});
      addToast("success", `${selectedPeriod.monthName} ${selectedPeriod.year} hard closed`);
      closeModal();
      loadPeriods();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to hard close period");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopen = async () => {
    if (!selectedPeriod?.id) return;
    if (reopenReason.length < 10) {
      addToast("error", "Please provide a reason (at least 10 characters)");
      return;
    }
    setActionLoading(true);
    try {
      await apiPost(`/api/finance/periods/${selectedPeriod.id}/reopen`, { reason: reopenReason });
      addToast("success", `${selectedPeriod.monthName} ${selectedPeriod.year} reopened`);
      closeModal();
      loadPeriods();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to reopen period");
    } finally {
      setActionLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedPeriod(null);
    setModalType(null);
    setReopenReason("");
  };

  const openModal = (period: Period, type: "soft_close" | "hard_close" | "reopen") => {
    setSelectedPeriod(period);
    setModalType(type);
  };

  const yearsAvailable = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const hasUninitializedPeriods = periods.some((p) => p.id === null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounting Periods"
        description="Manage monthly accounting periods - soft close for review, hard close to lock"
      />

      {/* Year Selector */}
      <GlassCard padding="sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-white/70">Fiscal Year:</label>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              {yearsAvailable.map((y) => (
                <option key={y} value={y} className="bg-gray-900">
                  {y}
                </option>
              ))}
            </select>
          </div>
          <GlassButton onClick={loadPeriods} disabled={loading}>
            {loading ? <Spinner size="sm" /> : "Refresh"}
          </GlassButton>
          {hasUninitializedPeriods && (
            <GlassButton onClick={initializeYear} disabled={actionLoading} variant="ghost">
              Initialize {year} Periods
            </GlassButton>
          )}
        </div>
      </GlassCard>

      {/* Error */}
      {error && (
        <GlassCard>
          <p className="text-red-400">{error}</p>
        </GlassCard>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500/40 border border-emerald-500/50" />
          <span className="text-white/70">Open - Normal posting allowed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500/40 border border-amber-500/50" />
          <span className="text-white/70">Soft Closed - Posting with warning</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500/40 border border-red-500/50" />
          <span className="text-white/70">Hard Closed - No posting allowed</span>
        </div>
      </div>

      {/* Periods Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {periods.map((period) => (
            <GlassCard key={`${period.year}-${period.month}`} padding="sm">
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white">{period.monthName}</h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[period.status]}`}
                  >
                    {STATUS_LABELS[period.status]}
                  </span>
                </div>

                {/* Date Range */}
                <p className="text-xs text-white/50">
                  {period.startDate} to {period.endDate}
                </p>

                {/* Checklist (if soft closed) */}
                {period.checklistSnapshot && (
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between text-white/60">
                      <span>Unreconciled Banks</span>
                      <span
                        className={
                          period.checklistSnapshot.unreconciledBankAccounts > 0
                            ? "text-amber-400"
                            : "text-emerald-400"
                        }
                      >
                        {period.checklistSnapshot.unreconciledBankAccounts}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-white/60">
                      <span>Pending Invoices</span>
                      <span
                        className={
                          period.checklistSnapshot.pendingInvoices > 0
                            ? "text-amber-400"
                            : "text-emerald-400"
                        }
                      >
                        {period.checklistSnapshot.pendingInvoices}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-white/60">
                      <span>Unposted Journals</span>
                      <span
                        className={
                          period.checklistSnapshot.unpostedJournals > 0
                            ? "text-amber-400"
                            : "text-emerald-400"
                        }
                      >
                        {period.checklistSnapshot.unpostedJournals}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-white/60">
                      <span>Missing Documents</span>
                      <span
                        className={
                          period.checklistSnapshot.missingDocuments > 0
                            ? "text-amber-400"
                            : "text-emerald-400"
                        }
                      >
                        {period.checklistSnapshot.missingDocuments}
                      </span>
                    </div>
                  </div>
                )}

                {/* Period Totals (if hard closed) */}
                {period.periodTotals && (
                  <div className="space-y-1 text-xs border-t border-white/10 pt-2">
                    <div className="flex items-center justify-between text-white/60">
                      <span>Revenue</span>
                      <span className="text-emerald-400">
                        ${period.periodTotals.revenue.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-white/60">
                      <span>Expenses</span>
                      <span className="text-red-400">
                        ${period.periodTotals.expenses.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between font-medium text-white/80">
                      <span>Net Income</span>
                      <span
                        className={
                          period.periodTotals.netIncome >= 0
                            ? "text-emerald-400"
                            : "text-red-400"
                        }
                      >
                        ${period.periodTotals.netIncome.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                {/* Actions */}
                {period.id && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
                    {period.status === "open" && (
                      <GlassButton
                        size="sm"
                        variant="ghost"
                        onClick={() => openModal(period, "soft_close")}
                      >
                        Soft Close
                      </GlassButton>
                    )}
                    {period.status === "soft_closed" && (
                      <>
                        <GlassButton
                          size="sm"
                          variant="ghost"
                          onClick={() => openModal(period, "hard_close")}
                        >
                          Hard Close
                        </GlassButton>
                        <GlassButton
                          size="sm"
                          variant="ghost"
                          onClick={() => openModal(period, "reopen")}
                        >
                          Reopen
                        </GlassButton>
                      </>
                    )}
                    {period.status === "hard_closed" && (
                      <GlassButton
                        size="sm"
                        variant="ghost"
                        onClick={() => openModal(period, "reopen")}
                      >
                        Reopen
                      </GlassButton>
                    )}
                  </div>
                )}

                {/* Uninitialized State */}
                {!period.id && (
                  <p className="text-xs text-white/40 italic">Not initialized</p>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Soft Close Modal */}
      <SlideOver
        open={modalType === "soft_close" && !!selectedPeriod}
        onClose={closeModal}
        title={`Soft Close ${selectedPeriod?.monthName} ${selectedPeriod?.year}`}
      >
        <div className="space-y-4">
          <p className="text-white/70">
            Soft closing this period will:
          </p>
          <ul className="list-disc list-inside text-white/60 text-sm space-y-1">
            <li>Calculate and store a checklist snapshot</li>
            <li>Allow posting with a warning message</li>
            <li>Mark the period for review before hard close</li>
          </ul>
          <p className="text-amber-400 text-sm">
            You can still post to this period, but users will see a warning.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <GlassButton variant="ghost" onClick={closeModal}>
              Cancel
            </GlassButton>
            <GlassButton onClick={handleSoftClose} disabled={actionLoading}>
              {actionLoading ? <Spinner size="sm" /> : "Soft Close"}
            </GlassButton>
          </div>
        </div>
      </SlideOver>

      {/* Hard Close Modal */}
      <SlideOver
        open={modalType === "hard_close" && !!selectedPeriod}
        onClose={closeModal}
        title={`Hard Close ${selectedPeriod?.monthName} ${selectedPeriod?.year}`}
      >
        <div className="space-y-4">
          <p className="text-white/70">
            Hard closing this period will:
          </p>
          <ul className="list-disc list-inside text-white/60 text-sm space-y-1">
            <li>Calculate and lock period totals (revenue, expenses, net income)</li>
            <li>Prevent any new postings to this period</li>
            <li>Require admin approval to reopen</li>
          </ul>

          {selectedPeriod?.checklistSnapshot && (
            <div className="bg-white/5 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium text-white">Checklist Summary:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  Unreconciled Banks:{" "}
                  <span
                    className={
                      selectedPeriod.checklistSnapshot.unreconciledBankAccounts > 0
                        ? "text-amber-400"
                        : "text-emerald-400"
                    }
                  >
                    {selectedPeriod.checklistSnapshot.unreconciledBankAccounts}
                  </span>
                </div>
                <div>
                  Pending Invoices:{" "}
                  <span
                    className={
                      selectedPeriod.checklistSnapshot.pendingInvoices > 0
                        ? "text-amber-400"
                        : "text-emerald-400"
                    }
                  >
                    {selectedPeriod.checklistSnapshot.pendingInvoices}
                  </span>
                </div>
                <div>
                  Unposted Journals:{" "}
                  <span
                    className={
                      selectedPeriod.checklistSnapshot.unpostedJournals > 0
                        ? "text-amber-400"
                        : "text-emerald-400"
                    }
                  >
                    {selectedPeriod.checklistSnapshot.unpostedJournals}
                  </span>
                </div>
                <div>
                  Missing Documents:{" "}
                  <span
                    className={
                      selectedPeriod.checklistSnapshot.missingDocuments > 0
                        ? "text-amber-400"
                        : "text-emerald-400"
                    }
                  >
                    {selectedPeriod.checklistSnapshot.missingDocuments}
                  </span>
                </div>
              </div>
            </div>
          )}

          <p className="text-red-400 text-sm">
            This action will prevent any new postings to this period.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <GlassButton variant="ghost" onClick={closeModal}>
              Cancel
            </GlassButton>
            <GlassButton onClick={handleHardClose} disabled={actionLoading}>
              {actionLoading ? <Spinner size="sm" /> : "Hard Close"}
            </GlassButton>
          </div>
        </div>
      </SlideOver>

      {/* Reopen Modal */}
      <SlideOver
        open={modalType === "reopen" && !!selectedPeriod}
        onClose={closeModal}
        title={`Reopen ${selectedPeriod?.monthName} ${selectedPeriod?.year}`}
      >
        <div className="space-y-4">
          <p className="text-white/70">
            Reopening this period will allow new postings. Please provide a reason:
          </p>
          <textarea
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            placeholder="Reason for reopening (at least 10 characters)..."
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 min-h-[100px]"
          />
          <p className="text-amber-400 text-sm">
            This action will be logged in the audit trail.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <GlassButton variant="ghost" onClick={closeModal}>
              Cancel
            </GlassButton>
            <GlassButton
              onClick={handleReopen}
              disabled={actionLoading || reopenReason.length < 10}
            >
              {actionLoading ? <Spinner size="sm" /> : "Reopen Period"}
            </GlassButton>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
