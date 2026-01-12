"use client";

import { useState, useEffect } from "react";
import {
  GlassButton,
  GlassInput,
  useToast,
} from "@/components/ui/glass";
import { ChevronRight, ChevronLeft, Sparkles, Info, Download, Save, ArrowLeft } from "lucide-react";

interface PayrollWizardProps {
  onBack: () => void;
  onSuccess: () => void;
}

interface PayrollLine {
  person_id: string;
  person_name: string;
  employment_type: string;
  gross_salary: number;
  overtime: number;
  bonus: number;
  allowances: number;
  income_tax: number;
  social_security: number;
  pension: number;
  health_insurance: number;
  other_deductions: number;
  total_gross: number;
  total_deductions: number;
  net_pay: number;
  ai_analyzed: boolean;
  ai_suggestions?: string[];
  compliance_issues?: string[];
}

const STEPS = [
  { id: 1, title: "Filter & Period", description: "Select employees and pay period" },
  { id: 2, title: "Review & Edit", description: "Review payroll and make changes" },
  { id: 3, title: "Confirm", description: "Save or export payroll" },
];

const COLUMN_EXPLANATIONS: Record<string, string> = {
  gross_salary: "Base salary before any additions or deductions",
  overtime: "Additional pay for hours worked beyond normal schedule",
  bonus: "Performance or one-time bonus payments",
  allowances: "Regular allowances (housing, transport, etc.)",
  income_tax: "Tax withheld based on local tax laws",
  social_security: "Social security or national insurance contribution",
  pension: "Retirement savings contribution",
  health_insurance: "Health insurance premium deduction",
  other_deductions: "Any other deductions (loans, advances, etc.)",
  total_gross: "Total earnings before deductions",
  total_deductions: "Total amount deducted from gross pay",
  net_pay: "Final amount paid to employee (take-home pay)",
};

const EMPLOYMENT_TYPES = [
  { value: "staff", label: "Staff (Full-time)" },
  { value: "intern", label: "Interns" },
  { value: "part_time", label: "Part-time" },
  { value: "contractor", label: "Contractors" },
  { value: "consultant", label: "Consultants" },
  { value: "other", label: "Other" },
];

export default function PayrollWizard({ onBack, onSuccess }: PayrollWizardProps) {
  const { addToast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Step 1: Filter & Period
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["staff"]);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [payDate, setPayDate] = useState("");

  // Step 2: Payroll data
  const [payrollLines, setPayrollLines] = useState<PayrollLine[]>([]);
  const [runId, setRunId] = useState("");

  useEffect(() => {
    // Set default dates (current month)
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const payDay = new Date(now.getFullYear(), now.getMonth() + 1, 5);

    setPeriodStart(firstDay.toISOString().split("T")[0]);
    setPeriodEnd(lastDay.toISOString().split("T")[0]);
    setPayDate(payDay.toISOString().split("T")[0]);
  }, []);

  const toggleEmploymentType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      await loadPayrollData();
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    }
  };

  const handleStepBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const loadPayrollData = async () => {
    try {
      setIsLoading(true);

      const res = await fetch("/api/hr-people/payroll/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employment_types: selectedTypes,
          period_start: periodStart,
          period_end: periodEnd,
          pay_date: payDate,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setRunId(data.run_id);
        setPayrollLines(data.lines || []);
      } else {
        const error = await res.json();
        addToast("error", error.message || "Failed to load payroll");
      }
    } catch (error) {
      console.error("Error loading payroll:", error);
      addToast("error", "Failed to load payroll");
    } finally {
      setIsLoading(false);
    }
  };

  const updateLine = (personId: string, field: string, value: number) => {
    setPayrollLines((prev) =>
      prev.map((line) => {
        if (line.person_id !== personId) return line;

        const updated = { ...line, [field]: value };

        // Recalculate totals
        updated.total_gross =
          updated.gross_salary +
          updated.overtime +
          updated.bonus +
          updated.allowances;

        updated.total_deductions =
          updated.income_tax +
          updated.social_security +
          updated.pension +
          updated.health_insurance +
          updated.other_deductions;

        updated.net_pay = updated.total_gross - updated.total_deductions;

        // Mark as not analyzed after changes
        updated.ai_analyzed = false;

        return updated;
      })
    );
  };

  const analyzeWithAI = async () => {
    try {
      setIsLoading(true);

      const res = await fetch("/api/hr-people/payroll/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          run_id: runId,
          lines: payrollLines,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPayrollLines(data.analyzed_lines || payrollLines);
        addToast("success", "AI analysis completed");
      } else {
        const error = await res.json();
        addToast("error", error.message || "AI analysis failed");
      }
    } catch (error) {
      console.error("Error analyzing payroll:", error);
      addToast("error", "AI analysis failed");
    } finally {
      setIsLoading(false);
    }
  };

  const saveDraft = async () => {
    try {
      setIsLoading(true);

      const res = await fetch(`/api/hr-people/payroll/${runId}/save`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: payrollLines,
          status: "draft",
        }),
      });

      if (res.ok) {
        addToast("success", "Payroll saved as draft");
        onSuccess();
      } else {
        const error = await res.json();
        addToast("error", error.message || "Failed to save draft");
      }
    } catch (error) {
      console.error("Error saving draft:", error);
      addToast("error", "Failed to save draft");
    } finally {
      setIsLoading(false);
    }
  };

  const confirmPayroll = async () => {
    try {
      setIsLoading(true);

      const res = await fetch(`/api/hr-people/payroll/${runId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: payrollLines,
        }),
      });

      if (res.ok) {
        addToast("success", "Payroll confirmed successfully");
        onSuccess();
      } else {
        const error = await res.json();
        addToast("error", error.message || "Failed to confirm payroll");
      }
    } catch (error) {
      console.error("Error confirming payroll:", error);
      addToast("error", "Failed to confirm payroll");
    } finally {
      setIsLoading(false);
    }
  };

  const exportFile = async (format: "pdf" | "xlsx") => {
    try {
      const res = await fetch(`/api/hr-people/payroll/${runId}/export?format=${format}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `payroll_${runId}.${format === "pdf" ? "html" : "csv"}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        addToast("success", `Exported as ${format.toUpperCase()}`);
      }
    } catch (error) {
      console.error(`Error exporting ${format}:`, error);
      addToast("error", `Failed to export ${format.toUpperCase()}`);
    }
  };

  const InfoTooltip = ({ text, column }: { text: string; column?: string }) => (
    <div className="group relative inline-block">
      <Info className="w-4 h-4 text-white/40 cursor-help" />
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-64">
        <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl border border-white/10">
          {column && <p className="font-semibold mb-1">{column}</p>}
          <p>{text}</p>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
            <div className="border-4 border-transparent border-t-gray-900" />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Select Employee Types</h3>
              <p className="text-sm text-white/60 mb-4">
                Choose which types of employees to include in this payroll run.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {EMPLOYMENT_TYPES.map((type) => (
                  <div
                    key={type.value}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedTypes.includes(type.value)
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                    onClick={() => toggleEmploymentType(type.value)}
                  >
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedTypes.includes(type.value)}
                        onChange={() => {}}
                        className="w-5 h-5 rounded bg-white/10 border-white/20 text-blue-500 focus:ring-blue-500/50"
                      />
                      <span className="text-sm">{type.label}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Pay Period</h3>
              <div className="grid grid-cols-3 gap-4">
                <GlassInput
                  label="Period Start"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
                <GlassInput
                  label="Period End"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
                <GlassInput
                  label="Pay Date"
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Payroll Table</h3>
                <p className="text-sm text-white/60">
                  Review and edit payroll entries. Hover over column headers for explanations.
                </p>
              </div>
              <GlassButton onClick={analyzeWithAI} variant="primary" disabled={isLoading}>
                <Sparkles className="w-4 h-4 mr-2" />
                Analyze with AI
              </GlassButton>
            </div>

            {payrollLines.length === 0 ? (
              <div className="text-center py-12 text-white/40">
                No employees found for the selected types and period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-3 py-3 text-left font-semibold">Employee</th>
                      {Object.entries(COLUMN_EXPLANATIONS).slice(0, 9).map(([key, explanation]) => (
                        <th key={key} className="px-3 py-3 text-left font-semibold">
                          <div className="flex items-center gap-1">
                            <span className="truncate max-w-[80px]">
                              {key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                            </span>
                            <InfoTooltip text={explanation} />
                          </div>
                        </th>
                      ))}
                      <th className="px-3 py-3 text-left font-semibold">
                        <div className="flex items-center gap-1">
                          Total Gross
                          <InfoTooltip text={COLUMN_EXPLANATIONS.total_gross} />
                        </div>
                      </th>
                      <th className="px-3 py-3 text-left font-semibold">
                        <div className="flex items-center gap-1">
                          Deductions
                          <InfoTooltip text={COLUMN_EXPLANATIONS.total_deductions} />
                        </div>
                      </th>
                      <th className="px-3 py-3 text-left font-semibold">
                        <div className="flex items-center gap-1">
                          Net Pay
                          <InfoTooltip text={COLUMN_EXPLANATIONS.net_pay} />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollLines.map((line) => (
                      <tr key={line.person_id} className="border-b border-white/5">
                        <td className="px-3 py-3">
                          <div>
                            <p className="font-medium">{line.person_name}</p>
                            <p className="text-xs text-white/40">{line.employment_type}</p>
                          </div>
                        </td>
                        {[
                          "gross_salary",
                          "overtime",
                          "bonus",
                          "allowances",
                          "income_tax",
                          "social_security",
                          "pension",
                          "health_insurance",
                          "other_deductions",
                        ].map((field) => (
                          <td key={field} className="px-3 py-3">
                            <input
                              type="number"
                              value={line[field as keyof PayrollLine] as number}
                              onChange={(e) =>
                                updateLine(line.person_id, field, parseFloat(e.target.value) || 0)
                              }
                              className="w-20 px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-sm focus:border-blue-500 focus:outline-none"
                            />
                          </td>
                        ))}
                        <td className="px-3 py-3 font-semibold">
                          ${line.total_gross.toFixed(2)}
                        </td>
                        <td className="px-3 py-3 font-semibold text-red-400">
                          ${line.total_deductions.toFixed(2)}
                        </td>
                        <td className="px-3 py-3 font-bold text-green-400">
                          ${line.net_pay.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-white/20 font-bold">
                      <td className="px-3 py-3">TOTALS</td>
                      {["gross_salary", "overtime", "bonus", "allowances", "income_tax", "social_security", "pension", "health_insurance", "other_deductions"].map((field) => (
                        <td key={field} className="px-3 py-3">
                          ${payrollLines
                            .reduce((sum, line) => sum + (line[field as keyof PayrollLine] as number), 0)
                            .toFixed(2)}
                        </td>
                      ))}
                      <td className="px-3 py-3">
                        ${payrollLines.reduce((sum, line) => sum + line.total_gross, 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-3 text-red-400">
                        ${payrollLines.reduce((sum, line) => sum + line.total_deductions, 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-3 text-green-400">
                        ${payrollLines.reduce((sum, line) => sum + line.net_pay, 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Confirm Payroll</h3>
              <p className="text-sm text-white/60">
                Review the summary and choose an action.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="p-4 rounded-lg bg-white/5">
                <p className="text-sm text-white/60 mb-1">Total Employees</p>
                <p className="text-2xl font-bold">{payrollLines.length}</p>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <p className="text-sm text-white/60 mb-1">Total Gross</p>
                <p className="text-2xl font-bold">
                  ${payrollLines.reduce((sum, line) => sum + line.total_gross, 0).toFixed(2)}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-sm text-green-400 mb-1">Total Net Pay</p>
                <p className="text-2xl font-bold text-green-400">
                  ${payrollLines.reduce((sum, line) => sum + line.net_pay, 0).toFixed(2)}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <GlassButton onClick={() => exportFile("pdf")} variant="ghost" className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Save as PDF (HTML)
              </GlassButton>

              <GlassButton onClick={() => exportFile("xlsx")} variant="ghost" className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Save as Spreadsheet (CSV)
              </GlassButton>

              <GlassButton onClick={saveDraft} variant="ghost" className="w-full">
                <Save className="w-4 h-4 mr-2" />
                Save Draft
              </GlassButton>

              <GlassButton onClick={confirmPayroll} variant="primary" className="w-full" disabled={isLoading}>
                Confirm Payroll
              </GlassButton>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div>
      {/* Back Button */}
      <GlassButton onClick={onBack} variant="ghost" size="sm" className="mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to menu
      </GlassButton>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    currentStep >= step.id
                      ? "bg-blue-500 text-white"
                      : "bg-white/10 text-white/40"
                  }`}
                >
                  {step.id}
                </div>
                <div className="ml-3">
                  <p className="font-semibold">{step.title}</p>
                  <p className="text-xs text-white/60">{step.description}</p>
                </div>
              </div>
              {index < STEPS.length - 1 && (
                <div className="flex-1 h-0.5 mx-4 bg-white/10">
                  <div
                    className={`h-full ${
                      currentStep > step.id ? "bg-blue-500" : "bg-transparent"
                    }`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="min-h-[400px]">{renderStep()}</div>

      {/* Navigation */}
      <div className="flex justify-between mt-8 pt-6 border-t border-white/10">
        <GlassButton onClick={onBack} variant="ghost">
          Cancel
        </GlassButton>

        <div className="flex gap-2">
          {currentStep > 1 && (
            <GlassButton onClick={handleStepBack} variant="ghost">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </GlassButton>
          )}

          {currentStep < 3 && (
            <GlassButton
              onClick={handleNext}
              variant="primary"
              disabled={isLoading || (currentStep === 1 && selectedTypes.length === 0)}
            >
              {isLoading ? "Loading..." : "Next"}
              <ChevronRight className="w-4 h-4 ml-2" />
            </GlassButton>
          )}
        </div>
      </div>
    </div>
  );
}
