"use client";

import * as React from "react";
import {
  GlassCard,
  GlassButton,
  GlassBadge,
  GlassTable,
  SkeletonTable,
} from "@/components/ui/glass";
import { apiGet, apiPost, formatDate, formatCurrency } from "@/lib/http";
import { PayrollRunDrawer } from "./PayrollRunDrawer";
import { PayrollRunWizard } from "./PayrollRunWizard";

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
  totalEmployerTaxes: string | null;
  totalEmployerContributions: string | null;
  employeeCount: number | null;
  calculatedAt: string | null;
  approvedAt: string | null;
  postedAt: string | null;
  createdAt: string;
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
   MAIN COMPONENT
   ============================================================================= */

interface PayrollTabProps {
  onRecordActivity?: () => void;
}

export function PayrollTab({ onRecordActivity }: PayrollTabProps) {
  const [payrollRuns, setPayrollRuns] = React.useState<PayrollRun[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedRunId, setSelectedRunId] = React.useState<string | null>(null);
  const [showWizard, setShowWizard] = React.useState(false);

  const loadRuns = React.useCallback(() => {
    setLoading(true);
    apiGet<{ items: PayrollRun[] }>("/api/payroll/runs?limit=50")
      .then((res) => setPayrollRuns(res.items || []))
      .catch(() => setPayrollRuns([]))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const handleRunClick = (index: number) => {
    const run = payrollRuns[index];
    if (run) {
      setSelectedRunId(run.id);
    }
  };

  const handleCloseDrawer = () => {
    setSelectedRunId(null);
  };

  const handleRunUpdated = () => {
    loadRuns();
  };

  const handleCreateRun = () => {
    setShowWizard(true);
  };

  const handleWizardClose = () => {
    setShowWizard(false);
  };

  const handleRunCreated = (runId: string) => {
    setShowWizard(false);
    loadRuns();
    // Open the drawer for the new run
    setSelectedRunId(runId);
  };

  // Summary stats
  const draftCount = payrollRuns.filter(r => r.status === "draft" || r.status === "calculated").length;
  const pendingApprovalCount = payrollRuns.filter(r => r.status === "reviewing" || r.status === "approved").length;
  const postedCount = payrollRuns.filter(r => r.status === "posted" || r.status === "paid").length;

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
          <GlassButton variant="primary" onClick={handleCreateRun}>
            {Icons.plus}
            <span className="ml-2">Run Payroll</span>
          </GlassButton>
        </div>
      </div>

      {/* Summary Stats */}
      {!loading && payrollRuns.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <GlassCard className="text-center py-4">
            <p className="text-2xl font-bold text-white">{draftCount}</p>
            <p className="text-sm text-white/50">In Progress</p>
          </GlassCard>
          <GlassCard className="text-center py-4">
            <p className="text-2xl font-bold text-yellow-400">{pendingApprovalCount}</p>
            <p className="text-sm text-white/50">Pending</p>
          </GlassCard>
          <GlassCard className="text-center py-4">
            <p className="text-2xl font-bold text-emerald-400">{postedCount}</p>
            <p className="text-sm text-white/50">Completed</p>
          </GlassCard>
        </div>
      )}

      {/* Payroll Runs Table */}
      <GlassCard padding="none">
        {loading ? (
          <div className="p-6">
            <SkeletonTable rows={5} columns={6} />
          </div>
        ) : payrollRuns.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              {Icons.currency}
            </div>
            <p className="text-white/70 font-medium mb-2">No payroll runs yet</p>
            <p className="text-sm text-white/40 mb-6 max-w-md mx-auto">
              Run your first payroll to calculate earnings, taxes, and deductions for your team
            </p>
            <GlassButton variant="primary" onClick={handleCreateRun}>
              {Icons.plus}
              <span className="ml-2">Run First Payroll</span>
            </GlassButton>
          </div>
        ) : (
          <GlassTable
            headers={["Period", "Pay Date", "Employees", "Gross", "Net", "Status"]}
            rows={payrollRuns.map((run) => [
              // Period
              <div key="period" className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                  {Icons.calendar}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">
                    {formatDate(run.periodStart)} - {formatDate(run.periodEnd)}
                  </div>
                  <div className="text-xs text-white/40 capitalize">
                    {run.runType} Run #{run.runNumber}
                  </div>
                </div>
              </div>,
              // Pay Date
              <span key="payDate" className="text-white/70">{formatDate(run.payDate)}</span>,
              // Employees
              <span key="employees" className="text-white/70">{run.employeeCount ?? "-"}</span>,
              // Gross
              <span key="gross" className="text-white font-medium">
                {run.totalGrossPay ? formatCurrency(parseFloat(run.totalGrossPay)) : "-"}
              </span>,
              // Net
              <span key="net" className="text-emerald-400">
                {run.totalNetPay ? formatCurrency(parseFloat(run.totalNetPay)) : "-"}
              </span>,
              // Status
              <GlassBadge key="status" variant={statusColors[run.status] || "default"}>
                {statusLabels[run.status] || run.status}
              </GlassBadge>,
            ])}
            onRowClick={handleRunClick}
            emptyMessage="No payroll runs found"
          />
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
              <strong>Draft</strong> → <strong>Calculate</strong> → <strong>Approve</strong> → <strong>Post to GL</strong>.
              Click on a payroll run to view details and manage the workflow.
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Payroll Run Drawer */}
      {selectedRunId && (
        <PayrollRunDrawer
          runId={selectedRunId}
          onClose={handleCloseDrawer}
          onUpdated={handleRunUpdated}
        />
      )}

      {/* Payroll Run Wizard */}
      {showWizard && (
        <PayrollRunWizard
          onClose={handleWizardClose}
          onCreated={handleRunCreated}
        />
      )}
    </div>
  );
}
