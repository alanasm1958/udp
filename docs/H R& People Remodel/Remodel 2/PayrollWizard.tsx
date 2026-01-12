// components/hr/PayrollWizard.tsx
"use client";

import { useState, useEffect } from "react";
import {
  GlassModal,
  GlassButton,
  GlassSelect,
  GlassInput,
  GlassCheckbox,
  GlassTable,
  useToast,
} from "@/components/ui/glass";
import { ChevronRight, ChevronLeft, Sparkles, Info, Download, Save, ArrowLeft } from "lucide-react";

interface PayrollWizardProps {
  onBack: () => void;
  onSuccess: () => void;
}

interface Person {
  id: string;
  full_name: string;
  employment_type: string;
  gross_salary: number;
  pension_contribution_percent: number;
  health_insurance: boolean;
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
  ai_suggestions?: any;
  compliance_issues?: any;
}

const STEPS = [
  { id: 1, title: "Filter & Period", description: "Select employees and pay period" },
  { id: 2, title: "Review & Edit", description: "Review payroll and make changes" },
  { id: 3, title: "Confirm", description: "Save or export payroll" },
];

const COLUMN_EXPLANATIONS = {
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
    const payDay = new Date(now.getFullYear(), now.getMonth() + 1, 5); // 5th of next month

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
      // Load preloaded payroll
      await loadPayrollData();
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    }
  };

  const handleBack = () => {
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
        setPayrollLines(data.lines);
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
        setPayrollLines(data.analyzed_lines);
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

  const exportPDF = async () => {
    try {
      const res = await fetch(`/api/hr-people/payroll/${runId}/export?format=pdf`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `payroll_${runId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Error exporting PDF:", error);
      addToast("error", "Failed to export PDF");
    }
  };

  const exportSpreadsheet = async () => {
    try {
      const res = await fetch(`/api/hr-people/payroll/${runId}/export?format=xlsx`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `payroll_${runId}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Error exporting spreadsheet:", error);
      addToast("error", "Failed to export spreadsheet");
    }
  };

  const InfoTooltip = ({ text, column }: { text: string; column?: string }) => (
    <div className="group relative inline-block">
      <Info className="w-4 h-4 text-white/40 cursor-help" />
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-64">
        <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl border border-white/10">
          <p className="font-semibold mb-1">{column}</p>
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
                {[
                  { value: "staff", label: "Staff (Full-time)" },
                  { value: "intern", label: "Interns" },
                  { value: "part_time", label: "Part-time" },
                  { value: "contractor", label: "Contractors" },
                  { value: "consultant", label: "Consultants" },
                  { value: "other", label: "Other" },
                ].map((type) => (
                  <div
                    key={type.value}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedTypes.includes(type.value)
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                    onClick={() => toggleEmploymentType(type.value)}
                  >
                    <GlassCheckbox
                      checked={selectedTypes.includes(type.value)}
                      onChange={() => {}}
                      label={type.label}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Pay Period</h3>
              <div className="grid grid-cols-3 gap-4">
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
                  <label className="block text-sm text-white/60 mb-2">
                    Pay Date
                  </label>
                  <GlassInput
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                  />
                </div>
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
                  Review and edit payroll entries. Click the "!" for column explanations.
                </p>
              </div>
              <GlassButton onClick={analyzeWithAI} variant="primary" disabled={isLoading}>
                <Sparkles className="w-4 h-4 mr-2" />
                Analyze with AI
              </GlassButton>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Employee
                    </th>
                    {Object.entries(COLUMN_EXPLANATIONS).map(([key, explanation]) => (
                      <th key={key} className="px-4 py-3 text-left text-sm font-semibold">
                        <div className="flex items-center gap-2">
                          {key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                          <InfoTooltip text={explanation} column={key} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payrollLines.map((line) => (
                    <tr key={line.person_id} className="border-b border-white/5">
                      <td className="px-4 py-3">
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
                        <td key={field} className="px-4 py-3">
                          <GlassInput
                            type="number"
                            value={line[field as keyof PayrollLine] as number}
                            onChange={(e) =>
                              updateLine(line.person_id, field, parseFloat(e.target.value) || 0)
                            }
                            className="w-24"
                          />
                        </td>
                      ))}
                      <td className="px-4 py-3 font-semibold">
                        {line.total_gross.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-red-400">
                        {line.total_deductions.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 font-bold text-green-400">
                        {line.net_pay.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-white/20 font-bold">
                    <td className="px-4 py-3">TOTALS</td>
                    {["gross_salary", "overtime", "bonus", "allowances", "income_tax", "social_security", "pension", "health_insurance", "other_deductions"].map((field) => (
                      <td key={field} className="px-4 py-3">
                        {payrollLines
                          .reduce((sum, line) => sum + (line[field as keyof PayrollLine] as number), 0)
                          .toFixed(2)}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      {payrollLines.reduce((sum, line) => sum + line.total_gross, 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-red-400">
                      {payrollLines.reduce((sum, line) => sum + line.total_deductions, 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-green-400">
                      {payrollLines.reduce((sum, line) => sum + line.net_pay, 0).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
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
              <GlassButton onClick={exportPDF} variant="secondary" className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Save as PDF
              </GlassButton>

              <GlassButton onClick={exportSpreadsheet} variant="secondary" className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Save as Spreadsheet
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
    <div className="p-6">
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
      <div className="min-h-[500px]">{renderStep()}</div>

      {/* Navigation */}
      <div className="flex justify-between mt-8 pt-6 border-t border-white/10">
        <GlassButton onClick={onBack} variant="ghost">
          Cancel
        </GlassButton>

        <div className="flex gap-2">
          {currentStep > 1 && (
            <GlassButton onClick={handleBack} variant="secondary">
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
