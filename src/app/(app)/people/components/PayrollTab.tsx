"use client";

import * as React from "react";
import {
  GlassCard,
  GlassButton,
  GlassBadge,
  GlassTable,
  GlassInput,
  GlassSelect,
  SlideOver,
  SkeletonTable,
  Spinner,
  useToast,
} from "@/components/ui/glass";
import { formatDate, formatCurrency } from "@/lib/http";

/* =============================================================================
   TYPES
   ============================================================================= */

interface PayrollRunV2 {
  id: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  currency: string;
  status: "draft" | "calculated" | "posted" | "voided";
  lineCount: number;
  totalGross: number;
  totalNet: number;
  totalEmployerCost: number;
  createdAt: string;
}

interface PayrollLineV2 {
  id: string;
  personId: string;
  personName: string;
  personType: string;
  jurisdiction: string;
  isIncluded: boolean;
  excludeReason: string | null;
  basePay: number;
  grossPay: number;
  netPay: number;
  totalTaxes: number;
  totalDeductions: number;
  totalEmployerCost: number;
  earnings: Array<{ name: string; amount: number; percent?: number }>;
  deductions: Array<{ name: string; amount: number; percent?: number; basis?: number }>;
  rowNotes: string | null;
}

interface RunSummary {
  totalGross: number;
  totalNet: number;
  totalEmployerCost: number;
  totalTaxes: number;
  totalDeductions: number;
  includedCount: number;
  excludedCount: number;
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
  currency: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  ),
  calendar: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  refresh: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  ),
  calculator: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V18zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V13.5zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V18zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V18zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0012 2.25z" />
    </svg>
  ),
  save: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  ),
  document: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  ),
  x: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
};

/* =============================================================================
   STATUS HELPERS
   ============================================================================= */

const statusColors: Record<string, "default" | "info" | "warning" | "success" | "danger"> = {
  draft: "default",
  calculated: "info",
  posted: "success",
  voided: "danger",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  calculated: "Calculated",
  posted: "Posted",
  voided: "Voided",
};

/* =============================================================================
   PAYROLL RUN DETAIL DRAWER
   ============================================================================= */

interface PayrollRunDrawerV2Props {
  run: PayrollRunV2;
  onClose: () => void;
  onUpdated: () => void;
}

function PayrollRunDrawerV2({ run, onClose, onUpdated }: PayrollRunDrawerV2Props) {
  const [lines, setLines] = React.useState<PayrollLineV2[]>([]);
  const [summary, setSummary] = React.useState<RunSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [processing, setProcessing] = React.useState(false);
  const { addToast } = useToast();

  const loadDetails = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/people/payroll/runs/${run.id}`);
      if (res.ok) {
        const data = await res.json();
        setLines(data.lines || []);
        setSummary(data.summary || null);
      }
    } catch (error) {
      console.error("Error loading run details:", error);
      addToast("error", "Failed to load run details");
    } finally {
      setLoading(false);
    }
  }, [run.id, addToast]);

  React.useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const handleCalculate = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/people/payroll/runs/${run.id}/calculate`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        setLines(data.lines || []);
        setSummary(data.summary || null);
        addToast("success", "Payroll calculated successfully");
        onUpdated();
      } else {
        const error = await res.json();
        addToast("error", error.error || "Failed to calculate payroll");
      }
    } catch (error) {
      console.error("Error calculating payroll:", error);
      addToast("error", "Failed to calculate payroll");
    } finally {
      setProcessing(false);
    }
  };

  const handlePost = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/people/payroll/runs/${run.id}/post`, {
        method: "POST",
      });

      if (res.ok) {
        addToast("success", "Payroll posted to general ledger");
        onUpdated();
        onClose();
      } else {
        const error = await res.json();
        addToast("error", error.error || "Failed to post payroll");
      }
    } catch (error) {
      console.error("Error posting payroll:", error);
      addToast("error", "Failed to post payroll");
    } finally {
      setProcessing(false);
    }
  };

  const isEditable = run.status === "draft" || run.status === "calculated";

  return (
    <SlideOver open={true} onClose={onClose} title="Payroll Run Details" width="lg">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">
                {formatDate(run.periodStart)} - {formatDate(run.periodEnd)}
              </h2>
              <p className="text-sm text-white/50 mt-1">
                Pay Date: {formatDate(run.payDate)} | {run.currency}
              </p>
            </div>
            <GlassBadge variant={statusColors[run.status] || "default"}>
              {statusLabels[run.status] || run.status}
            </GlassBadge>
          </div>

          {/* Summary */}
          {summary && (
            <GlassCard>
              <h3 className="text-sm font-medium text-white/70 mb-4">Summary</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-white/60">Total Gross Pay</div>
                  <div className="text-lg font-semibold text-white">
                    {run.currency} {formatCurrency(summary.totalGross)}
                  </div>
                </div>
                <div>
                  <div className="text-white/60">Total Net Pay</div>
                  <div className="text-lg font-semibold text-emerald-400">
                    {run.currency} {formatCurrency(summary.totalNet)}
                  </div>
                </div>
                <div>
                  <div className="text-white/60">Total Employer Cost</div>
                  <div className="text-lg font-semibold text-orange-400">
                    {run.currency} {formatCurrency(summary.totalEmployerCost)}
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/10 flex gap-4 text-sm">
                <div>
                  <span className="text-white/60">Included: </span>
                  <span className="text-white font-medium">{summary.includedCount}</span>
                </div>
                <div>
                  <span className="text-white/60">Excluded: </span>
                  <span className="text-red-400 font-medium">{summary.excludedCount}</span>
                </div>
              </div>
            </GlassCard>
          )}

          {/* Lines Table */}
          <div>
            <h3 className="text-sm font-medium text-white/70 mb-3">
              Payroll Lines ({lines.length})
            </h3>
            <GlassTable
              headers={["Include", "Person", "Type", "Gross", "Taxes", "Net", "Employer Cost"]}
              rows={lines.map((line) => [
                // Include
                line.isIncluded ? (
                  <span key="inc" className="text-green-500">{Icons.check}</span>
                ) : (
                  <span key="exc" className="text-red-500" title={line.excludeReason || "Excluded"}>
                    {Icons.x}
                  </span>
                ),
                // Person
                <div key="person">
                  <div className="text-sm font-medium text-white">{line.personName}</div>
                  <div className="text-xs text-white/40">{line.jurisdiction}</div>
                </div>,
                // Type
                <span key="type" className="text-white/70 capitalize">{line.personType}</span>,
                // Gross
                <span key="gross" className="text-white">
                  {formatCurrency(line.grossPay)}
                </span>,
                // Taxes
                <span key="taxes" className="text-red-400">
                  ({formatCurrency(line.totalTaxes)})
                </span>,
                // Net
                <span key="net" className="text-emerald-400 font-medium">
                  {formatCurrency(line.netPay)}
                </span>,
                // Employer Cost
                <span key="employer" className="text-orange-400">
                  {formatCurrency(line.totalEmployerCost)}
                </span>,
              ])}
              emptyMessage="No payroll lines in this run"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-white/10">
            {isEditable && (
              <>
                <GlassButton
                  variant="default"
                  onClick={handleCalculate}
                  disabled={processing}
                >
                  {processing ? <Spinner size="sm" /> : Icons.calculator}
                  <span className="ml-2">
                    {run.status === "calculated" ? "Recalculate" : "Calculate"}
                  </span>
                </GlassButton>

                {run.status === "calculated" && (
                  <GlassButton
                    variant="primary"
                    onClick={handlePost}
                    disabled={processing}
                  >
                    {processing ? <Spinner size="sm" /> : Icons.save}
                    <span className="ml-2">Post to GL</span>
                  </GlassButton>
                )}
              </>
            )}

            <GlassButton variant="ghost" onClick={loadDetails} disabled={loading}>
              {Icons.refresh}
              <span className="ml-2">Refresh</span>
            </GlassButton>
          </div>
        </div>
      )}
    </SlideOver>
  );
}

/* =============================================================================
   MAIN COMPONENT
   ============================================================================= */

interface PayrollTabProps {
  onRecordActivity?: () => void;
}

export function PayrollTab({ onRecordActivity }: PayrollTabProps) {
  const [runs, setRuns] = React.useState<PayrollRunV2[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedRun, setSelectedRun] = React.useState<PayrollRunV2 | null>(null);
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const { addToast } = useToast();

  // Form state for new run
  const [periodStart, setPeriodStart] = React.useState("");
  const [periodEnd, setPeriodEnd] = React.useState("");
  const [payDate, setPayDate] = React.useState("");
  const [preloadOption, setPreloadOption] = React.useState("both");

  const loadRuns = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/people/payroll/runs");
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
      }
    } catch (error) {
      console.error("Error loading payroll runs:", error);
      addToast("error", "Failed to load payroll runs");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  React.useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const handleRowClick = (index: number) => {
    setSelectedRun(runs[index]);
  };

  const handleCloseDrawer = () => {
    setSelectedRun(null);
  };

  const handleRunUpdated = () => {
    loadRuns();
    onRecordActivity?.();
  };

  const handleCreateRun = async () => {
    if (!periodStart || !periodEnd || !payDate) {
      addToast("error", "Please fill in all required fields");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/people/payroll/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodStart,
          periodEnd,
          payDate,
          preloadOption,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        addToast("success", "Payroll run created successfully");
        setShowCreateModal(false);
        setPeriodStart("");
        setPeriodEnd("");
        setPayDate("");
        setPreloadOption("both");
        loadRuns();
        setSelectedRun(data.run);
        onRecordActivity?.();
      } else {
        const error = await res.json();
        addToast("error", error.error || "Failed to create payroll run");
      }
    } catch (error) {
      console.error("Error creating payroll run:", error);
      addToast("error", "Failed to create payroll run");
    } finally {
      setCreating(false);
    }
  };

  // Summary stats
  const draftCount = runs.filter((r) => r.status === "draft" || r.status === "calculated").length;
  const postedCount = runs.filter((r) => r.status === "posted").length;
  const totalGross = runs
    .filter((r) => r.status === "posted")
    .reduce((sum, r) => sum + (r.totalGross || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header with Action */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Payroll Runs</h2>
          <p className="text-sm text-white/50">Manage payroll processing and history</p>
        </div>
        <div className="flex items-center gap-3">
          <GlassButton variant="ghost" onClick={loadRuns} disabled={loading}>
            {Icons.refresh}
          </GlassButton>
          <GlassButton variant="primary" onClick={() => setShowCreateModal(true)}>
            {Icons.plus}
            <span className="ml-2">Run Payroll</span>
          </GlassButton>
        </div>
      </div>

      {/* Summary Stats */}
      {!loading && runs.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <GlassCard className="text-center py-4">
            <p className="text-2xl font-bold text-white">{draftCount}</p>
            <p className="text-sm text-white/50">In Progress</p>
          </GlassCard>
          <GlassCard className="text-center py-4">
            <p className="text-2xl font-bold text-emerald-400">{postedCount}</p>
            <p className="text-sm text-white/50">Posted</p>
          </GlassCard>
          <GlassCard className="text-center py-4">
            <p className="text-2xl font-bold text-cyan-400">{formatCurrency(totalGross)}</p>
            <p className="text-sm text-white/50">Total Gross (Posted)</p>
          </GlassCard>
        </div>
      )}

      {/* Payroll Runs Table */}
      <GlassCard padding="none">
        {loading ? (
          <div className="p-6">
            <SkeletonTable rows={5} columns={6} />
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              {Icons.currency}
            </div>
            <p className="text-white/70 font-medium mb-2">No payroll runs yet</p>
            <p className="text-sm text-white/40 mb-6 max-w-md mx-auto">
              Run your first payroll to calculate earnings, taxes, and deductions for your team
            </p>
            <GlassButton variant="primary" onClick={() => setShowCreateModal(true)}>
              {Icons.plus}
              <span className="ml-2">Run First Payroll</span>
            </GlassButton>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-white/10">
                  {["Period", "Pay Date", "Employees", "Gross", "Net", "Status"].map((header, i) => (
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
                {runs.map((run, index) => (
                  <tr
                    key={run.id}
                    onClick={() => handleRowClick(index)}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                          {Icons.calendar}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">
                            {formatDate(run.periodStart)} - {formatDate(run.periodEnd)}
                          </div>
                          <div className="text-xs text-white/40">
                            {run.currency}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white/70">{formatDate(run.payDate)}</td>
                    <td className="px-4 py-3 text-white/70">{run.lineCount || "-"}</td>
                    <td className="px-4 py-3 text-white font-medium">
                      {run.totalGross ? formatCurrency(run.totalGross) : "-"}
                    </td>
                    <td className="px-4 py-3 text-emerald-400">
                      {run.totalNet ? formatCurrency(run.totalNet) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <GlassBadge variant={statusColors[run.status] || "default"}>
                        {statusLabels[run.status] || run.status}
                      </GlassBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Info Card */}
      <GlassCard>
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-white mb-1">Payroll Workflow</h3>
            <p className="text-sm text-white/50">
              <strong>Draft</strong> → <strong>Calculate</strong> → <strong>Post to GL</strong>.
              Click on a payroll run to view details and manage the workflow.
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Create Modal */}
      <SlideOver
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Payroll Run"
      >
        <div className="space-y-4">
          <div>
            <GlassInput
              label="Period Start"
              type="date"
              value={periodStart}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPeriodStart(e.target.value)}
            />
          </div>

          <div>
            <GlassInput
              label="Period End"
              type="date"
              value={periodEnd}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPeriodEnd(e.target.value)}
            />
          </div>

          <div>
            <GlassInput
              label="Pay Date"
              type="date"
              value={payDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPayDate(e.target.value)}
            />
          </div>

          <div>
            <GlassSelect
              label="Preload Employees"
              value={preloadOption}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPreloadOption(e.target.value)}
              options={[
                { value: "both", label: "Staff & Contractors" },
                { value: "staff", label: "Staff Only" },
                { value: "contractors", label: "Contractors Only" },
                { value: "custom", label: "Custom (No Preload)" },
              ]}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <GlassButton
              onClick={() => setShowCreateModal(false)}
              variant="ghost"
            >
              Cancel
            </GlassButton>
            <GlassButton
              onClick={handleCreateRun}
              variant="primary"
              disabled={creating || !periodStart || !periodEnd || !payDate}
            >
              {creating ? "Creating..." : "Create Run"}
            </GlassButton>
          </div>
        </div>
      </SlideOver>

      {/* Payroll Run Drawer */}
      {selectedRun && (
        <PayrollRunDrawerV2
          run={selectedRun}
          onClose={handleCloseDrawer}
          onUpdated={handleRunUpdated}
        />
      )}
    </div>
  );
}
