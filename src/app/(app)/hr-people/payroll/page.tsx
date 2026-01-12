"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GlassCard, GlassButton, EmptyState } from "@/components/ui/glass";
import { DollarSign, ArrowLeft, Calendar, Users, Download } from "lucide-react";

interface PayrollRun {
  id: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: string;
  currency: string;
  totalGross: string | null;
  totalDeductions: string | null;
  totalNet: string | null;
  employeeCount: number;
  createdAt: string;
}

export default function PayrollHistoryPage() {
  const router = useRouter();
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPayrollRuns();
  }, []);

  const loadPayrollRuns = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/hr-people/payroll");
      if (res.ok) {
        const data = await res.json();
        setPayrollRuns(data.runs || []);
      }
    } catch (error) {
      console.error("Error loading payroll runs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-gray-500/20 text-gray-400";
      case "confirmed":
        return "bg-blue-500/20 text-blue-400";
      case "posted_to_finance":
        return "bg-green-500/20 text-green-400";
      default:
        return "bg-white/20 text-white/60";
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: string | null, currency: string) => {
    if (!amount) return "-";
    const num = parseFloat(amount);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(num);
  };

  const handleExport = async (runId: string, format: "pdf" | "xlsx") => {
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
      }
    } catch (error) {
      console.error(`Error exporting ${format}:`, error);
    }
  };

  return (
    <div className="min-h-screen p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <GlassButton onClick={() => router.push("/hr-people")} variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </GlassButton>
          <div>
            <h1 className="text-3xl font-bold">Payroll History</h1>
            <p className="text-white/60">View and manage past payroll runs</p>
          </div>
        </div>
      </div>

      {/* Payroll Runs List */}
      <GlassCard>
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full mx-auto" />
            <p className="text-white/40 mt-4">Loading payroll history...</p>
          </div>
        ) : payrollRuns.length === 0 ? (
          <EmptyState
            icon={<DollarSign className="w-6 h-6" />}
            title="No payroll runs yet"
            description="Run your first payroll using the Record Activity button on the HR & People page"
          />
        ) : (
          <div className="divide-y divide-white/10">
            {payrollRuns.map((run) => (
              <div key={run.id} className="p-6 hover:bg-white/5 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">
                        {formatDate(run.periodStart)} - {formatDate(run.periodEnd)}
                      </h3>
                      <span className={`text-xs px-2 py-1 rounded ${getStatusColor(run.status)}`}>
                        {run.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-white/60">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Pay Date: {formatDate(run.payDate)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {run.employeeCount} employees
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-white/40">Total Net</p>
                      <p className="text-xl font-bold text-green-400">
                        {formatCurrency(run.totalNet, run.currency)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <GlassButton
                        onClick={() => handleExport(run.id, "pdf")}
                        variant="ghost"
                        size="sm"
                      >
                        <Download className="w-4 h-4" />
                      </GlassButton>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/10">
                  <div>
                    <p className="text-sm text-white/40">Gross</p>
                    <p className="font-semibold">
                      {formatCurrency(run.totalGross, run.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-white/40">Deductions</p>
                    <p className="font-semibold text-red-400">
                      {formatCurrency(run.totalDeductions, run.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-white/40">Net Pay</p>
                    <p className="font-semibold text-green-400">
                      {formatCurrency(run.totalNet, run.currency)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
