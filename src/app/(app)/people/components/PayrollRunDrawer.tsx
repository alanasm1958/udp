"use client";

import * as React from "react";
import {
  GlassCard,
  GlassButton,
  GlassBadge,
  GlassTable,
  SlideOver,
  Spinner,
} from "@/components/ui/glass";
import { apiGet, apiPost, formatDate, formatCurrency } from "@/lib/http";

/* =============================================================================
   TYPES
   ============================================================================= */

interface PayrollRun {
  id: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: string;
  runType: string;
  runNumber: number;
  totalGrossPay: string | null;
  totalNetPay: string | null;
  totalEmployeeTaxes: string | null;
  totalEmployeeDeductions: string | null;
  totalEmployerTaxes: string | null;
  totalEmployerContributions: string | null;
  employeeCount: number | null;
  calculatedAt: string | null;
  calculatedByActorId: string | null;
  approvedAt: string | null;
  approvedByActorId: string | null;
  postedAt: string | null;
  postedByActorId: string | null;
  journalEntryId: string | null;
  notes: string | null;
  createdAt: string;
}

interface PayrollEmployee {
  id: string;
  employeeId: string;
  fullName: string;
  employeeNumber: string;
  payType: string;
  payRate: string;
  grossPay: string;
  totalTaxes: string;
  totalDeductions: string;
  netPay: string;
  employerTaxes: string;
  employerContributions: string;
  totalEmployerCost: string;
  status: string;
  paymentMethod: string;
}

interface CalculationResult {
  success: boolean;
  summary?: {
    employeeCount: number;
    totalGrossPay: number;
    totalNetPay: number;
    anomalyCount: number;
  };
  anomalies?: Array<{
    type: string;
    message: string;
    employeeId: string;
    fullName: string;
  }>;
}

/* =============================================================================
   ICONS
   ============================================================================= */

const Icons = {
  calculator: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V18zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V13.5zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V18zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V18zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0012 2.25z" />
    </svg>
  ),
  check: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  send: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  ),
  user: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  refresh: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  ),
};

/* =============================================================================
   STATUS HELPERS
   ============================================================================= */

const statusColors: Record<string, "default" | "info" | "warning" | "success" | "danger"> = {
  draft: "default",
  calculating: "info",
  calculated: "info",
  reviewing: "warning",
  approved: "success",
  posting: "info",
  posted: "success",
  paid: "success",
  void: "danger",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  calculating: "Calculating...",
  calculated: "Calculated",
  reviewing: "In Review",
  approved: "Approved",
  posting: "Posting...",
  posted: "Posted",
  paid: "Paid",
  void: "Void",
};

/* =============================================================================
   COMPONENT HELPERS
   ============================================================================= */

function SummaryRow({ label, value, color = "white" }: { label: string; value: string | React.ReactNode; color?: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-white/60">{label}</span>
      <span className={`text-sm font-medium text-${color}`}>{value}</span>
    </div>
  );
}

/* =============================================================================
   MAIN COMPONENT
   ============================================================================= */

interface PayrollRunDrawerProps {
  runId: string;
  onClose: () => void;
  onUpdated?: () => void;
}

export function PayrollRunDrawer({ runId, onClose, onUpdated }: PayrollRunDrawerProps) {
  const [loading, setLoading] = React.useState(true);
  const [run, setRun] = React.useState<PayrollRun | null>(null);
  const [employees, setEmployees] = React.useState<PayrollEmployee[]>([]);
  const [processing, setProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [anomalies, setAnomalies] = React.useState<CalculationResult["anomalies"]>([]);
  const [showEmployees, setShowEmployees] = React.useState(false);

  const loadRun = React.useCallback(() => {
    setLoading(true);
    setError(null);

    Promise.all([
      apiGet<PayrollRun>(`/api/payroll/runs/${runId}`),
      apiGet<{ items: PayrollEmployee[] }>(`/api/payroll/runs/${runId}/employees`),
    ])
      .then(([runData, empData]) => {
        setRun(runData);
        setEmployees(empData.items || []);
      })
      .catch((err) => {
        setError(err.message || "Failed to load payroll run");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [runId]);

  React.useEffect(() => {
    loadRun();
  }, [loadRun]);

  const handleCalculate = async () => {
    if (!run) return;

    setProcessing(true);
    setError(null);

    try {
      const result = await apiPost<CalculationResult>(`/api/payroll/runs/${runId}/calculate`, {});

      if (result.success) {
        setAnomalies(result.anomalies || []);
        loadRun();
        onUpdated?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Calculation failed");
    } finally {
      setProcessing(false);
    }
  };

  const handleApprove = async () => {
    if (!run) return;

    setProcessing(true);
    setError(null);

    try {
      const result = await apiPost<{ success: boolean }>(`/api/payroll/runs/${runId}/approve`, {
        acknowledgeAnomalies: anomalies && anomalies.length > 0,
      });

      if (result.success) {
        loadRun();
        onUpdated?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setProcessing(false);
    }
  };

  const handlePost = async () => {
    if (!run) return;

    setProcessing(true);
    setError(null);

    try {
      const result = await apiPost<{ success: boolean; journalEntryId?: string }>(`/api/payroll/runs/${runId}/post`, {});

      if (result.success) {
        loadRun();
        onUpdated?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Posting failed");
    } finally {
      setProcessing(false);
    }
  };

  // Determine which action is available
  const canCalculate = run && ["draft", "calculated"].includes(run.status);
  const canApprove = run && ["calculated", "reviewing"].includes(run.status);
  const canPost = run && run.status === "approved";
  const isProcessingState = run && ["calculating", "posting"].includes(run.status);

  return (
    <SlideOver
      open={true}
      onClose={onClose}
      title="Payroll Run Details"
      width="lg"
    >
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      ) : !run ? (
        <div className="text-center py-12 text-white/50">
          Payroll run not found
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
                Pay Date: {formatDate(run.payDate)} | {run.runType.charAt(0).toUpperCase() + run.runType.slice(1)} Run #{run.runNumber}
              </p>
            </div>
            <GlassBadge variant={statusColors[run.status] || "default"}>
              {statusLabels[run.status] || run.status}
            </GlassBadge>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <div className="flex items-center gap-3">
                <div className="text-red-400">{Icons.warning}</div>
                <div className="text-sm text-red-400">{error}</div>
              </div>
            </div>
          )}

          {/* Anomalies */}
          {anomalies && anomalies.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-start gap-3">
                <div className="text-amber-400 mt-0.5">{Icons.warning}</div>
                <div>
                  <div className="text-sm font-medium text-amber-400 mb-2">
                    {anomalies.length} Anomaly/Anomalies Detected
                  </div>
                  <ul className="text-sm text-amber-400/80 space-y-1">
                    {anomalies.slice(0, 5).map((a, i) => (
                      <li key={i}>
                        {a.fullName}: {a.message}
                      </li>
                    ))}
                    {anomalies.length > 5 && (
                      <li className="text-amber-400/60">
                        ...and {anomalies.length - 5} more
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Summary */}
          <GlassCard>
            <h3 className="text-sm font-medium text-white/70 mb-4">Payroll Summary</h3>
            <div className="divide-y divide-white/10">
              <SummaryRow
                label="Employees"
                value={run.employeeCount ?? "-"}
              />
              <SummaryRow
                label="Gross Pay"
                value={run.totalGrossPay ? formatCurrency(parseFloat(run.totalGrossPay)) : "-"}
              />
              <SummaryRow
                label="Employee Taxes"
                value={run.totalEmployeeTaxes ? `(${formatCurrency(parseFloat(run.totalEmployeeTaxes))})` : "-"}
                color="red-400"
              />
              <SummaryRow
                label="Employee Deductions"
                value={run.totalEmployeeDeductions ? `(${formatCurrency(parseFloat(run.totalEmployeeDeductions))})` : "-"}
                color="red-400"
              />
              <SummaryRow
                label="Net Pay"
                value={run.totalNetPay ? formatCurrency(parseFloat(run.totalNetPay)) : "-"}
                color="emerald-400"
              />
              <div className="pt-3 mt-1">
                <SummaryRow
                  label="Employer Taxes"
                  value={run.totalEmployerTaxes ? formatCurrency(parseFloat(run.totalEmployerTaxes)) : "-"}
                  color="orange-400"
                />
                <SummaryRow
                  label="Employer Contributions"
                  value={run.totalEmployerContributions ? formatCurrency(parseFloat(run.totalEmployerContributions)) : "-"}
                  color="orange-400"
                />
              </div>
            </div>
          </GlassCard>

          {/* Employees Section */}
          <div>
            <button
              type="button"
              onClick={() => setShowEmployees(!showEmployees)}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/8 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                  {Icons.user}
                </div>
                <span className="text-sm font-medium text-white">
                  {employees.length} Employees
                </span>
              </div>
              <svg
                className={`w-5 h-5 text-white/50 transition-transform ${showEmployees ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {showEmployees && employees.length > 0 && (
              <div className="mt-4">
                <GlassTable
                  headers={["Employee", "Gross", "Taxes", "Deductions", "Net"]}
                  rows={employees.map((emp) => [
                    <div key="emp" className="text-sm">
                      <div className="font-medium text-white">{emp.fullName}</div>
                      <div className="text-xs text-white/40">{emp.employeeNumber}</div>
                    </div>,
                    <span key="gross" className="text-white">
                      {formatCurrency(parseFloat(emp.grossPay))}
                    </span>,
                    <span key="taxes" className="text-red-400">
                      ({formatCurrency(parseFloat(emp.totalTaxes))})
                    </span>,
                    <span key="deductions" className="text-red-400">
                      ({formatCurrency(parseFloat(emp.totalDeductions))})
                    </span>,
                    <span key="net" className="text-emerald-400 font-medium">
                      {formatCurrency(parseFloat(emp.netPay))}
                    </span>,
                  ])}
                  emptyMessage="No employees in this run"
                />
              </div>
            )}
          </div>

          {/* Timeline */}
          <GlassCard>
            <h3 className="text-sm font-medium text-white/70 mb-4">Timeline</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <div className={`w-2 h-2 rounded-full ${run.createdAt ? "bg-blue-500" : "bg-white/20"}`} />
                <span className="text-white/60">Created:</span>
                <span className="text-white">{formatDate(run.createdAt)}</span>
              </div>
              {run.calculatedAt && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-white/60">Calculated:</span>
                  <span className="text-white">{formatDate(run.calculatedAt)}</span>
                </div>
              )}
              {run.approvedAt && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-white/60">Approved:</span>
                  <span className="text-white">{formatDate(run.approvedAt)}</span>
                </div>
              )}
              {run.postedAt && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-white/60">Posted:</span>
                  <span className="text-white">{formatDate(run.postedAt)}</span>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Notes */}
          {run.notes && (
            <GlassCard>
              <h3 className="text-sm font-medium text-white/70 mb-2">Notes</h3>
              <p className="text-sm text-white/60 whitespace-pre-wrap">{run.notes}</p>
            </GlassCard>
          )}

          {/* Actions */}
          <div className="pt-4 border-t border-white/10">
            <div className="flex flex-wrap gap-3">
              {canCalculate && (
                <GlassButton
                  variant="primary"
                  onClick={handleCalculate}
                  disabled={processing || !!isProcessingState}
                >
                  {processing ? <Spinner size="sm" /> : Icons.calculator}
                  <span className="ml-2">
                    {run.status === "calculated" ? "Recalculate" : "Calculate"}
                  </span>
                </GlassButton>
              )}

              {canApprove && (
                <GlassButton
                  variant="primary"
                  onClick={handleApprove}
                  disabled={processing || !!isProcessingState}
                >
                  {processing ? <Spinner size="sm" /> : Icons.check}
                  <span className="ml-2">Approve</span>
                </GlassButton>
              )}

              {canPost && (
                <GlassButton
                  variant="primary"
                  onClick={handlePost}
                  disabled={processing || !!isProcessingState}
                >
                  {processing ? <Spinner size="sm" /> : Icons.send}
                  <span className="ml-2">Post to GL</span>
                </GlassButton>
              )}

              <GlassButton variant="ghost" onClick={loadRun} disabled={loading}>
                {Icons.refresh}
                <span className="ml-2">Refresh</span>
              </GlassButton>
            </div>

            {run.status === "posted" && run.journalEntryId && (
              <p className="text-xs text-white/40 mt-3">
                Posted to journal entry: {run.journalEntryId.slice(0, 8)}...
              </p>
            )}
          </div>
        </div>
      )}
    </SlideOver>
  );
}
