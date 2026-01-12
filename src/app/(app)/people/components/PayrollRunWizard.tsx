"use client";

import * as React from "react";
import {
  GlassCard,
  GlassButton,
  GlassBadge,
  SlideOver,
  Spinner,
} from "@/components/ui/glass";
import { apiGet, apiPost, formatDate } from "@/lib/http";

/* =============================================================================
   TYPES
   ============================================================================= */

interface PayPeriod {
  id: string;
  payScheduleId: string;
  scheduleName: string | null;
  frequency: string | null;
  periodNumber: number;
  year: number;
  startDate: string;
  endDate: string;
  payDate: string;
  timesheetCutoff: string | null;
  processingDate: string | null;
  status: string;
  runCount: number;
  hasPostedRun: boolean;
}

type RunType = "regular" | "bonus" | "offcycle" | "correction";

/* =============================================================================
   ICONS
   ============================================================================= */

const Icons = {
  calendar: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  check: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  ),
};

/* =============================================================================
   RUN TYPE OPTIONS
   ============================================================================= */

const runTypes: { value: RunType; label: string; description: string }[] = [
  { value: "regular", label: "Regular", description: "Standard payroll run for the period" },
  { value: "bonus", label: "Bonus", description: "Bonus-only run (no regular wages)" },
  { value: "offcycle", label: "Off-Cycle", description: "Additional pay run for missed payments" },
  { value: "correction", label: "Correction", description: "Corrective run for prior period errors" },
];

/* =============================================================================
   MAIN COMPONENT
   ============================================================================= */

interface PayrollRunWizardProps {
  onClose: () => void;
  onCreated: (runId: string) => void;
}

export function PayrollRunWizard({ onClose, onCreated }: PayrollRunWizardProps) {
  const [step, setStep] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [payPeriods, setPayPeriods] = React.useState<PayPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = React.useState<string | null>(null);
  const [runType, setRunType] = React.useState<RunType>("regular");
  const [notes, setNotes] = React.useState("");

  // Load pay periods
  React.useEffect(() => {
    setLoading(true);
    apiGet<{ items: PayPeriod[] }>("/api/payroll/pay-periods?includeWithRuns=true")
      .then((res) => {
        setPayPeriods(res.items || []);
        // Auto-select first period without a posted run
        const firstAvailable = res.items?.find(p => !p.hasPostedRun);
        if (firstAvailable) {
          setSelectedPeriodId(firstAvailable.id);
        }
      })
      .catch(() => {
        setPayPeriods([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const selectedPeriod = payPeriods.find(p => p.id === selectedPeriodId);

  const handleCreate = async () => {
    if (!selectedPeriodId) {
      setError("Please select a pay period");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const result = await apiPost<{ run: { id: string } }>("/api/payroll/runs", {
        payPeriodId: selectedPeriodId,
        runType,
        notes: notes.trim() || null,
      });

      if (result.run?.id) {
        onCreated(result.run.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create payroll run");
      setCreating(false);
    }
  };

  return (
    <SlideOver
      open={true}
      onClose={onClose}
      title="Run Payroll"
      width="md"
    >
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Step Indicator */}
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                step >= 1 ? "bg-blue-500 text-white" : "bg-white/10 text-white/40"
              }`}
            >
              1
            </div>
            <div className={`flex-1 h-1 rounded ${step >= 2 ? "bg-blue-500" : "bg-white/10"}`} />
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                step >= 2 ? "bg-blue-500 text-white" : "bg-white/10 text-white/40"
              }`}
            >
              2
            </div>
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

          {/* Step 1: Select Pay Period */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-white mb-1">Select Pay Period</h3>
                <p className="text-sm text-white/50">
                  Choose which pay period to run payroll for
                </p>
              </div>

              {payPeriods.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                    {Icons.warning}
                  </div>
                  <p className="text-white/70 font-medium mb-2">No pay periods found</p>
                  <p className="text-sm text-white/40 mb-6 max-w-md mx-auto">
                    You need to set up pay schedules and generate pay periods before running payroll.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {payPeriods.map((period) => (
                    <button
                      key={period.id}
                      type="button"
                      onClick={() => setSelectedPeriodId(period.id)}
                      disabled={period.hasPostedRun}
                      className={`
                        w-full p-4 rounded-xl text-left transition-all
                        ${selectedPeriodId === period.id
                          ? "bg-blue-500/20 border-2 border-blue-500"
                          : period.hasPostedRun
                            ? "bg-white/5 border-2 border-transparent opacity-50 cursor-not-allowed"
                            : "bg-white/5 border-2 border-transparent hover:bg-white/8 hover:border-white/20"
                        }
                      `}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${selectedPeriodId === period.id ? "bg-blue-500/20 text-blue-400" : "bg-white/10 text-white/50"}`}>
                            {Icons.calendar}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white">
                              {formatDate(period.startDate)} - {formatDate(period.endDate)}
                            </div>
                            <div className="text-xs text-white/50 mt-1">
                              Pay Date: {formatDate(period.payDate)}
                              {period.scheduleName && ` | ${period.scheduleName}`}
                            </div>
                            <div className="text-xs text-white/40 mt-1">
                              Period #{period.periodNumber} of {period.year}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {period.hasPostedRun && (
                            <GlassBadge variant="success">Posted</GlassBadge>
                          )}
                          {period.runCount > 0 && !period.hasPostedRun && (
                            <GlassBadge variant="warning">{period.runCount} draft</GlassBadge>
                          )}
                          {selectedPeriodId === period.id && (
                            <div className="text-blue-400">{Icons.check}</div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <GlassButton variant="ghost" onClick={onClose}>
                  Cancel
                </GlassButton>
                <GlassButton
                  variant="primary"
                  onClick={() => setStep(2)}
                  disabled={!selectedPeriodId}
                >
                  Next
                </GlassButton>
              </div>
            </div>
          )}

          {/* Step 2: Run Options */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-white mb-1">Configure Run</h3>
                <p className="text-sm text-white/50">
                  Set the run type and add any notes
                </p>
              </div>

              {/* Selected Period Summary */}
              {selectedPeriod && (
                <GlassCard padding="sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                      {Icons.calendar}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">
                        {formatDate(selectedPeriod.startDate)} - {formatDate(selectedPeriod.endDate)}
                      </div>
                      <div className="text-xs text-white/50">
                        Pay Date: {formatDate(selectedPeriod.payDate)}
                      </div>
                    </div>
                  </div>
                </GlassCard>
              )}

              {/* Run Type Selection */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Run Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {runTypes.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setRunType(type.value)}
                      className={`
                        p-3 rounded-xl text-left transition-all
                        ${runType === type.value
                          ? "bg-blue-500/20 border-2 border-blue-500"
                          : "bg-white/5 border-2 border-transparent hover:bg-white/8"
                        }
                      `}
                    >
                      <div className="text-sm font-medium text-white">{type.label}</div>
                      <div className="text-xs text-white/40 mt-0.5">{type.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this payroll run..."
                  className="
                    w-full px-4 py-3 rounded-xl
                    bg-white/5 border border-white/10
                    text-white placeholder-white/30
                    focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50
                    resize-none
                  "
                  rows={3}
                />
              </div>

              {/* Info */}
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-start gap-3">
                  <div className="text-blue-400 mt-0.5">{Icons.info}</div>
                  <div className="text-sm text-blue-400/80">
                    After creating the run, you&apos;ll be able to calculate payroll for all active employees,
                    review the results, and post to the general ledger.
                  </div>
                </div>
              </div>

              <div className="flex justify-between gap-3 pt-4 border-t border-white/10">
                <GlassButton variant="ghost" onClick={() => setStep(1)}>
                  Back
                </GlassButton>
                <GlassButton
                  variant="primary"
                  onClick={handleCreate}
                  disabled={creating}
                >
                  {creating ? (
                    <>
                      <Spinner size="sm" />
                      <span className="ml-2">Creating...</span>
                    </>
                  ) : (
                    "Create & Calculate"
                  )}
                </GlassButton>
              </div>
            </div>
          )}
        </div>
      )}
    </SlideOver>
  );
}
