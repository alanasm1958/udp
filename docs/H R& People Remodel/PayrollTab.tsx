// /components/people/PayrollTab.tsx
"use client";

import { useState, useEffect } from "react";
import {
  GlassCard,
  GlassButton,
  GlassInput,
  GlassSelect,
  GlassTable,
  GlassModal,
  GlassBadge,
  useToast,
} from "@/components/ui/glass";
import { Plus, Calculator, Save, FileText, X, Check } from "lucide-react";

interface PayrollRun {
  id: string;
  period_start: string;
  period_end: string;
  pay_date: string;
  currency: string;
  status: "draft" | "posted" | "voided";
  created_at: string;
}

interface PayrollLine {
  id: string;
  person_name: string;
  person_type: string;
  jurisdiction: string;
  is_included: boolean;
  exclude_reason?: string;
  base_pay: number;
  allowances: Array<{ name: string; amount: number; percent?: number }>;
  other_earnings: Array<{ name: string; amount: number }>;
  employee_taxes: Array<{ name: string; amount: number; percent?: number; basis?: number }>;
  employee_deductions: Array<{ name: string; amount: number; percent?: number; basis?: number }>;
  employer_contributions: Array<{ name: string; amount: number; percent?: number; basis?: number }>;
  gross_pay: number;
  net_pay: number;
  total_employer_cost: number;
  row_notes?: string;
}

export default function PayrollTab() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [lines, setLines] = useState<PayrollLine[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { addToast } = useToast();

  // Form state for new run
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [payDate, setPayDate] = useState("");
  const [preloadOption, setPreloadOption] = useState("both");

  useEffect(() => {
    loadPayrollRuns();
  }, []);

  const loadPayrollRuns = async () => {
    try {
      const res = await fetch("/api/people/payroll/runs");
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
        if (data.runs.length > 0) {
          selectRun(data.runs[0]);
        }
      }
    } catch (error) {
      console.error("Error loading payroll runs:", error);
      addToast("error", "Failed to load payroll runs");
    }
  };

  const selectRun = async (run: PayrollRun) => {
    setSelectedRun(run);
    try {
      const res = await fetch(`/api/people/payroll/runs/${run.id}`);
      if (res.ok) {
        const data = await res.json();
        setLines(data.lines || []);
      }
    } catch (error) {
      console.error("Error loading run details:", error);
      addToast("error", "Failed to load run details");
    }
  };

  const createPayrollRun = async () => {
    try {
      setIsLoading(true);
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
        loadPayrollRuns();
        selectRun(data.run);
      } else {
        const error = await res.json();
        addToast("error", error.error || "Failed to create payroll run");
      }
    } catch (error) {
      console.error("Error creating payroll run:", error);
      addToast("error", "Failed to create payroll run");
    } finally {
      setIsLoading(false);
    }
  };

  const calculatePayroll = async () => {
    if (!selectedRun) return;

    try {
      setIsLoading(true);
      const res = await fetch(
        `/api/people/payroll/runs/${selectedRun.id}/calculate`,
        { method: "POST" }
      );

      if (res.ok) {
        const data = await res.json();
        setLines(data.lines || []);
        addToast("success", "Payroll calculated successfully");
      } else {
        const error = await res.json();
        addToast("error", error.error || "Failed to calculate payroll");
      }
    } catch (error) {
      console.error("Error calculating payroll:", error);
      addToast("error", "Failed to calculate payroll");
    } finally {
      setIsLoading(false);
    }
  };

  const postPayroll = async () => {
    if (!selectedRun) return;

    try {
      setIsLoading(true);
      const res = await fetch(
        `/api/people/payroll/runs/${selectedRun.id}/post`,
        { method: "POST" }
      );

      if (res.ok) {
        addToast("success", "Payroll posted to ledger");
        loadPayrollRuns();
      } else {
        const error = await res.json();
        addToast("error", error.error || "Failed to post payroll");
      }
    } catch (error) {
      console.error("Error posting payroll:", error);
      addToast("error", "Failed to post payroll");
    } finally {
      setIsLoading(false);
    }
  };

  const downloadPDF = async () => {
    if (!selectedRun) return;

    try {
      const res = await fetch(`/api/people/payroll/runs/${selectedRun.id}/pdf`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `payroll_${selectedRun.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        addToast("error", "Failed to generate PDF");
      }
    } catch (error) {
      console.error("Error downloading PDF:", error);
      addToast("error", "Failed to download PDF");
    }
  };

  const isEditable = selectedRun?.status === "draft";

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <GlassSelect
            value={selectedRun?.id || ""}
            onChange={(e) => {
              const run = runs.find((r) => r.id === e.target.value);
              if (run) selectRun(run);
            }}
          >
            <option value="">Select payroll run</option>
            {runs.map((run) => (
              <option key={run.id} value={run.id}>
                {run.period_start} to {run.period_end} -{" "}
                {run.status.toUpperCase()}
              </option>
            ))}
          </GlassSelect>

          {selectedRun && (
            <GlassBadge
              variant={
                selectedRun.status === "posted"
                  ? "success"
                  : selectedRun.status === "draft"
                  ? "info"
                  : "default"
              }
            >
              {selectedRun.status.toUpperCase()}
            </GlassBadge>
          )}
        </div>

        <div className="flex gap-2">
          <GlassButton onClick={() => setShowCreateModal(true)} variant="primary">
            <Plus className="w-4 h-4 mr-2" />
            New Payroll Run
          </GlassButton>

          {selectedRun && isEditable && (
            <>
              <GlassButton onClick={calculatePayroll} variant="secondary">
                <Calculator className="w-4 h-4 mr-2" />
                Calculate
              </GlassButton>
              <GlassButton onClick={postPayroll} variant="primary">
                <Save className="w-4 h-4 mr-2" />
                Post to Ledger
              </GlassButton>
            </>
          )}

          {selectedRun && (
            <GlassButton onClick={downloadPDF} variant="ghost">
              <FileText className="w-4 h-4 mr-2" />
              Download PDF
            </GlassButton>
          )}
        </div>
      </div>

      {/* Payroll Table */}
      {selectedRun && (
        <GlassCard>
          <GlassTable
            headers={[
              { key: "include", label: "Include" },
              { key: "person", label: "Person" },
              { key: "type", label: "Type" },
              { key: "jurisdiction", label: "Jurisdiction" },
              { key: "base_pay", label: "Base Pay" },
              { key: "gross_pay", label: "Gross Pay" },
              { key: "net_pay", label: "Net Pay" },
              { key: "employer_cost", label: "Employer Cost" },
              { key: "actions", label: "" },
            ]}
            rows={lines.map((line) => ({
              include: line.is_included ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <X className="w-4 h-4 text-red-500" />
              ),
              person: line.person_name,
              type: line.person_type,
              jurisdiction: line.jurisdiction,
              base_pay: `${selectedRun.currency} ${line.base_pay.toFixed(2)}`,
              gross_pay: `${selectedRun.currency} ${line.gross_pay.toFixed(2)}`,
              net_pay: `${selectedRun.currency} ${line.net_pay.toFixed(2)}`,
              employer_cost: `${selectedRun.currency} ${line.total_employer_cost.toFixed(2)}`,
              actions: isEditable ? (
                <GlassButton size="sm" variant="ghost">
                  Edit
                </GlassButton>
              ) : null,
            }))}
            emptyMessage="No employees in this payroll run"
          />

          {/* Summary */}
          <div className="mt-6 p-4 bg-white/5 rounded-lg">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-white/60">Total Gross Pay</div>
                <div className="text-lg font-semibold">
                  {selectedRun.currency}{" "}
                  {lines.reduce((sum, l) => sum + l.gross_pay, 0).toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-white/60">Total Net Pay</div>
                <div className="text-lg font-semibold">
                  {selectedRun.currency}{" "}
                  {lines.reduce((sum, l) => sum + l.net_pay, 0).toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-white/60">Total Employer Cost</div>
                <div className="text-lg font-semibold">
                  {selectedRun.currency}{" "}
                  {lines
                    .reduce((sum, l) => sum + l.total_employer_cost, 0)
                    .toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Create Modal */}
      <GlassModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Payroll Run"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-white/60 mb-2">
              Period Start
            </label>
            <GlassInput
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-2">
              Period End
            </label>
            <GlassInput
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-2">Pay Date</label>
            <GlassInput
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-2">
              Preload Employees
            </label>
            <GlassSelect
              value={preloadOption}
              onChange={(e) => setPreloadOption(e.target.value)}
            >
              <option value="both">Staff & Interns</option>
              <option value="staff">Staff Only</option>
              <option value="interns">Interns Only</option>
              <option value="custom">Custom (No Preload)</option>
            </GlassSelect>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <GlassButton
              onClick={() => setShowCreateModal(false)}
              variant="ghost"
            >
              Cancel
            </GlassButton>
            <GlassButton
              onClick={createPayrollRun}
              variant="primary"
              disabled={isLoading || !periodStart || !periodEnd || !payDate}
            >
              {isLoading ? "Creating..." : "Create Run"}
            </GlassButton>
          </div>
        </div>
      </GlassModal>
    </div>
  );
}
