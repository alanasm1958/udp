"use client";

import * as React from "react";
import {
  GlassCard,
  GlassButton,
  GlassBadge,
  GlassInput,
  GlassSelect,
  SlideOver,
} from "@/components/ui/glass";

/* =============================================================================
   TYPES
   ============================================================================= */

type CycleFrequency = "quarterly" | "semi_annual" | "annual" | "custom";

interface CycleFormData {
  name: string;
  frequency: CycleFrequency;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  assignedToRole: "hr" | "manager" | "owner" | "";
  notes: string;
  autoGenerateReviews: boolean;
}

interface PerformanceCycleWizardProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

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
  spinner: (
    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  ),
};

/* =============================================================================
   HELPERS
   ============================================================================= */

function getQuarterDates(quarter: number, year: number): { start: string; end: string; due: string } {
  const startMonth = (quarter - 1) * 3;
  const endMonth = startMonth + 2;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, endMonth + 1, 0); // Last day of quarter
  const due = new Date(year, endMonth + 1, 14); // 2 weeks after quarter end
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
    due: due.toISOString().split("T")[0],
  };
}

function getSemiAnnualDates(half: 1 | 2, year: number): { start: string; end: string; due: string } {
  const startMonth = (half - 1) * 6;
  const endMonth = startMonth + 5;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, endMonth + 1, 0);
  const due = new Date(year, endMonth + 1, 14);
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
    due: due.toISOString().split("T")[0],
  };
}

function getAnnualDates(year: number): { start: string; end: string; due: string } {
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
    due: `${year + 1}-01-14`,
  };
}

const frequencyOptions = [
  { value: "quarterly", label: "Quarterly" },
  { value: "semi_annual", label: "Semi-Annual" },
  { value: "annual", label: "Annual" },
  { value: "custom", label: "Custom" },
];

const roleOptions = [
  { value: "", label: "Not assigned" },
  { value: "hr", label: "HR Team" },
  { value: "manager", label: "Direct Manager" },
  { value: "owner", label: "Business Owner" },
];

/* =============================================================================
   WIZARD STEPS
   ============================================================================= */

function StepIndicator({ step, currentStep, label }: { step: number; currentStep: number; label: string }) {
  const isComplete = currentStep > step;
  const isCurrent = currentStep === step;

  return (
    <div className="flex items-center gap-2">
      <div
        className={`
          w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors
          ${isComplete ? "bg-emerald-500 text-white" : ""}
          ${isCurrent ? "bg-indigo-500 text-white" : ""}
          ${!isComplete && !isCurrent ? "bg-white/10 text-white/40" : ""}
        `}
      >
        {isComplete ? Icons.check : step}
      </div>
      <span className={`text-sm ${isCurrent ? "text-white" : "text-white/50"}`}>{label}</span>
    </div>
  );
}

/* =============================================================================
   MAIN COMPONENT
   ============================================================================= */

export function PerformanceCycleWizard({ open, onClose, onCreated }: PerformanceCycleWizardProps) {
  const [step, setStep] = React.useState(1);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

  const [formData, setFormData] = React.useState<CycleFormData>({
    name: "",
    frequency: "quarterly",
    periodStart: "",
    periodEnd: "",
    dueDate: "",
    assignedToRole: "",
    notes: "",
    autoGenerateReviews: true,
  });

  // Reset form when opened
  React.useEffect(() => {
    if (open) {
      const dates = getQuarterDates(currentQuarter, currentYear);
      setFormData({
        name: `Q${currentQuarter} ${currentYear} Review`,
        frequency: "quarterly",
        periodStart: dates.start,
        periodEnd: dates.end,
        dueDate: dates.due,
        assignedToRole: "manager",
        notes: "",
        autoGenerateReviews: true,
      });
      setStep(1);
      setError(null);
    }
  }, [open, currentQuarter, currentYear]);

  // Update dates when frequency changes
  const handleFrequencyChange = (freq: CycleFrequency) => {
    let dates: { start: string; end: string; due: string };
    let name = "";

    switch (freq) {
      case "quarterly":
        dates = getQuarterDates(currentQuarter, currentYear);
        name = `Q${currentQuarter} ${currentYear} Review`;
        break;
      case "semi_annual":
        const half = currentQuarter <= 2 ? 1 : 2;
        dates = getSemiAnnualDates(half as 1 | 2, currentYear);
        name = `H${half} ${currentYear} Review`;
        break;
      case "annual":
        dates = getAnnualDates(currentYear);
        name = `${currentYear} Annual Review`;
        break;
      case "custom":
      default:
        dates = {
          start: formData.periodStart || new Date().toISOString().split("T")[0],
          end: formData.periodEnd || "",
          due: formData.dueDate || "",
        };
        name = "Custom Review Cycle";
        break;
    }

    setFormData(prev => ({
      ...prev,
      frequency: freq,
      name,
      periodStart: dates.start,
      periodEnd: dates.end,
      dueDate: dates.due,
    }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/people/performance-cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          frequency: formData.frequency,
          periodStart: formData.periodStart,
          periodEnd: formData.periodEnd,
          dueDate: formData.dueDate,
          assignedToRole: formData.assignedToRole || null,
          notes: formData.notes || null,
          autoGenerateReviews: formData.autoGenerateReviews,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create cycle");
      }

      const data = await res.json();
      console.log("Created cycle:", data);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }

    setSubmitting(false);
  };

  const canProceedStep1 = formData.name && formData.frequency && formData.periodStart && formData.periodEnd && formData.dueDate;
  const canSubmit = canProceedStep1;

  return (
    <SlideOver open={open} onClose={onClose} title="Create Performance Cycle" width="md">
      <div className="space-y-6">
        {/* Step Indicators */}
        <div className="flex items-center gap-6 pb-4 border-b border-white/10">
          <StepIndicator step={1} currentStep={step} label="Details" />
          <div className="flex-1 h-px bg-white/10" />
          <StepIndicator step={2} currentStep={step} label="Options" />
        </div>

        {/* Step 1: Basic Details */}
        {step === 1 && (
          <div className="space-y-4">
            <GlassSelect
              label="Frequency"
              value={formData.frequency}
              onChange={(e) => handleFrequencyChange(e.target.value as CycleFrequency)}
              options={frequencyOptions}
            />

            <GlassInput
              label="Cycle Name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Q1 2026 Review"
            />

            <div className="grid grid-cols-2 gap-4">
              <GlassInput
                label="Period Start"
                type="date"
                value={formData.periodStart}
                onChange={(e) => setFormData(prev => ({ ...prev, periodStart: e.target.value }))}
              />
              <GlassInput
                label="Period End"
                type="date"
                value={formData.periodEnd}
                onChange={(e) => setFormData(prev => ({ ...prev, periodEnd: e.target.value }))}
              />
            </div>

            <div>
              <GlassInput
                label="Due Date"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
              />
              <span className="text-xs text-white/40 mt-1 block">When should all reviews be completed?</span>
            </div>

            <div className="flex justify-end pt-4 border-t border-white/10">
              <GlassButton
                variant="primary"
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
              >
                Next
              </GlassButton>
            </div>
          </div>
        )}

        {/* Step 2: Options */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <GlassSelect
                label="Assign Reviews To"
                value={formData.assignedToRole}
                onChange={(e) => setFormData(prev => ({ ...prev, assignedToRole: e.target.value as "hr" | "manager" | "owner" | "" }))}
                options={roleOptions}
              />
              <span className="text-xs text-white/40 mt-1 block">Who is responsible for conducting reviews?</span>
            </div>

            <GlassCard className="!bg-white/5">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.autoGenerateReviews}
                  onChange={(e) => setFormData(prev => ({ ...prev, autoGenerateReviews: e.target.checked }))}
                  className="w-5 h-5 rounded border-white/20 bg-white/10 text-indigo-500 focus:ring-indigo-500/50"
                />
                <div>
                  <div className="text-sm font-medium text-white">Auto-generate reviews</div>
                  <div className="text-xs text-white/50">
                    Create review records for all active employees and notify their managers
                  </div>
                </div>
              </label>
            </GlassCard>

            <div>
              <label className="block text-sm text-white/70 mb-1.5">Notes (Optional)</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                placeholder="Any additional instructions for reviewers..."
              />
            </div>

            {/* Summary */}
            <GlassCard className="!bg-indigo-500/10 !border-indigo-500/20">
              <h4 className="text-sm font-medium text-indigo-300 mb-2">Summary</h4>
              <div className="space-y-1 text-sm text-white/70">
                <p><span className="text-white">{formData.name}</span></p>
                <p>Period: {formData.periodStart} to {formData.periodEnd}</p>
                <p>Due: {formData.dueDate}</p>
                {formData.autoGenerateReviews && (
                  <p className="flex items-center gap-1 text-indigo-300">
                    {Icons.check} Will create reviews for all active employees
                  </p>
                )}
              </div>
            </GlassCard>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-between pt-4 border-t border-white/10">
              <GlassButton variant="ghost" onClick={() => setStep(1)}>
                Back
              </GlassButton>
              <GlassButton
                variant="primary"
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
              >
                {submitting ? Icons.spinner : Icons.calendar}
                <span className="ml-2">{submitting ? "Creating..." : "Create Cycle"}</span>
              </GlassButton>
            </div>
          </div>
        )}
      </div>
    </SlideOver>
  );
}
