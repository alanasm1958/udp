"use client";

import * as React from "react";
import {
  GlassCard,
  GlassInput,
  GlassButton,
  PageHeader,
  Spinner,
  useToast,
} from "@/components/ui/glass";
import { apiGet, formatCurrency } from "@/lib/http";

interface AccountLine {
  code: string;
  name: string;
  amount: number;
}

interface ProfitLossSection {
  accounts: AccountLine[];
  total: number;
}

interface ProfitLossData {
  startDate: string;
  endDate: string;
  revenue: ProfitLossSection;
  costOfSales: ProfitLossSection;
  grossProfit: number;
  operatingExpenses: ProfitLossSection;
  operatingIncome: number;
  otherIncome: ProfitLossSection;
  otherExpenses: ProfitLossSection;
  netIncome: number;
  comparison?: {
    startDate: string;
    endDate: string;
    revenue: ProfitLossSection;
    costOfSales: ProfitLossSection;
    grossProfit: number;
    operatingExpenses: ProfitLossSection;
    operatingIncome: number;
    otherIncome: ProfitLossSection;
    otherExpenses: ProfitLossSection;
    netIncome: number;
  };
}

function SectionRow({
  label,
  accounts,
  total,
  comparison,
  isSubtotal = false,
  isTotal = false,
}: {
  label: string;
  accounts?: AccountLine[];
  total: number;
  comparison?: number;
  isSubtotal?: boolean;
  isTotal?: boolean;
}) {
  const [expanded, setExpanded] = React.useState(true);

  const rowClass = isTotal
    ? "bg-white/10 font-bold"
    : isSubtotal
      ? "bg-white/5 font-semibold"
      : "";

  return (
    <>
      <tr
        className={`border-b border-white/10 ${rowClass} ${accounts && accounts.length > 0 ? "cursor-pointer hover:bg-white/5" : ""}`}
        onClick={() => accounts && accounts.length > 0 && setExpanded(!expanded)}
      >
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            {accounts && accounts.length > 0 && (
              <svg
                className={`w-4 h-4 text-white/50 transition-transform ${expanded ? "rotate-90" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
            <span className={accounts && accounts.length > 0 ? "" : "pl-6"}>{label}</span>
          </div>
        </td>
        <td className="py-3 px-4 text-right tabular-nums">
          {formatCurrency(total)}
        </td>
        {comparison !== undefined && (
          <td className="py-3 px-4 text-right tabular-nums text-white/60">
            {formatCurrency(comparison)}
          </td>
        )}
      </tr>
      {expanded && accounts && accounts.map((account) => (
        <tr key={account.code} className="border-b border-white/5 text-white/70">
          <td className="py-2 px-4 pl-12">
            <span className="text-xs text-white/40 mr-2">{account.code}</span>
            {account.name}
          </td>
          <td className="py-2 px-4 text-right tabular-nums text-sm">
            {formatCurrency(account.amount)}
          </td>
          {comparison !== undefined && <td className="py-2 px-4"></td>}
        </tr>
      ))}
    </>
  );
}

export default function ProfitLossPage() {
  const { addToast } = useToast();

  // Default to current month
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [startDate, setStartDate] = React.useState(
    firstOfMonth.toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = React.useState(
    today.toISOString().split("T")[0]
  );
  const [showComparison, setShowComparison] = React.useState(false);
  const [compareStartDate, setCompareStartDate] = React.useState("");
  const [compareEndDate, setCompareEndDate] = React.useState("");
  const [data, setData] = React.useState<ProfitLossData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/reports/profit-loss?startDate=${startDate}&endDate=${endDate}`;
      if (showComparison && compareStartDate && compareEndDate) {
        url += `&compareStartDate=${compareStartDate}&compareEndDate=${compareEndDate}`;
      }
      const result = await apiGet<ProfitLossData>(url);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, showComparison, compareStartDate, compareEndDate]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Set comparison period when enabled
  React.useEffect(() => {
    if (showComparison && !compareStartDate && !compareEndDate) {
      // Default to previous month
      const start = new Date(startDate);
      const prevMonth = new Date(start.getFullYear(), start.getMonth() - 1, 1);
      const prevMonthEnd = new Date(start.getFullYear(), start.getMonth(), 0);
      setCompareStartDate(prevMonth.toISOString().split("T")[0]);
      setCompareEndDate(prevMonthEnd.toISOString().split("T")[0]);
    }
  }, [showComparison, startDate, compareStartDate, compareEndDate]);

  const exportCSV = () => {
    if (!data) return;

    const rows: string[][] = [
      ["Profit & Loss Statement"],
      [`Period: ${data.startDate} to ${data.endDate}`],
      [],
      ["Account Code", "Account Name", "Amount"],
      [],
      ["REVENUE"],
      ...data.revenue.accounts.map((a) => [a.code, a.name, a.amount.toFixed(2)]),
      ["", "Total Revenue", data.revenue.total.toFixed(2)],
      [],
      ["COST OF SALES"],
      ...data.costOfSales.accounts.map((a) => [a.code, a.name, a.amount.toFixed(2)]),
      ["", "Total Cost of Sales", data.costOfSales.total.toFixed(2)],
      [],
      ["", "GROSS PROFIT", data.grossProfit.toFixed(2)],
      [],
      ["OPERATING EXPENSES"],
      ...data.operatingExpenses.accounts.map((a) => [a.code, a.name, a.amount.toFixed(2)]),
      ["", "Total Operating Expenses", data.operatingExpenses.total.toFixed(2)],
      [],
      ["", "OPERATING INCOME", data.operatingIncome.toFixed(2)],
      [],
      ["OTHER INCOME"],
      ...data.otherIncome.accounts.map((a) => [a.code, a.name, a.amount.toFixed(2)]),
      ["", "Total Other Income", data.otherIncome.total.toFixed(2)],
      [],
      ["OTHER EXPENSES"],
      ...data.otherExpenses.accounts.map((a) => [a.code, a.name, a.amount.toFixed(2)]),
      ["", "Total Other Expenses", data.otherExpenses.total.toFixed(2)],
      [],
      ["", "NET INCOME", data.netIncome.toFixed(2)],
    ];

    const csvContent = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `profit-loss-${data.startDate}-to-${data.endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    addToast("success", "Report exported to CSV");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profit & Loss"
        description="Income statement showing revenue, expenses, and net income"
      />

      {/* Filters */}
      <GlassCard padding="sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-44">
            <GlassInput
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="w-44">
            <GlassInput
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
            <input
              type="checkbox"
              checked={showComparison}
              onChange={(e) => setShowComparison(e.target.checked)}
              className="rounded border-white/30 bg-white/10"
            />
            Compare Period
          </label>
          {showComparison && (
            <>
              <div className="w-44">
                <GlassInput
                  label="Compare Start"
                  type="date"
                  value={compareStartDate}
                  onChange={(e) => setCompareStartDate(e.target.value)}
                />
              </div>
              <div className="w-44">
                <GlassInput
                  label="Compare End"
                  type="date"
                  value={compareEndDate}
                  onChange={(e) => setCompareEndDate(e.target.value)}
                />
              </div>
            </>
          )}
          <GlassButton onClick={loadData} disabled={loading}>
            {loading ? <Spinner size="sm" /> : "Refresh"}
          </GlassButton>
          <GlassButton onClick={exportCSV} disabled={!data} variant="ghost">
            Export CSV
          </GlassButton>
        </div>
      </GlassCard>

      {/* Error */}
      {error && (
        <GlassCard>
          <p className="text-red-400">{error}</p>
        </GlassCard>
      )}

      {/* Report */}
      {data && (
        <GlassCard padding="none">
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Income Statement
                </h2>
                <p className="text-sm text-white/50">
                  {data.startDate} to {data.endDate}
                </p>
              </div>
              <div
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  data.netIncome >= 0
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                Net Income: {formatCurrency(data.netIncome)}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/20 text-white/70 text-sm">
                  <th className="py-3 px-4 text-left font-medium">Account</th>
                  <th className="py-3 px-4 text-right font-medium">Amount</th>
                  {data.comparison && (
                    <th className="py-3 px-4 text-right font-medium">
                      Comparison
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="text-white">
                {/* Revenue */}
                <SectionRow
                  label="Revenue"
                  accounts={data.revenue.accounts}
                  total={data.revenue.total}
                  comparison={data.comparison?.revenue.total}
                />

                {/* Cost of Sales */}
                {data.costOfSales.accounts.length > 0 && (
                  <SectionRow
                    label="Cost of Sales"
                    accounts={data.costOfSales.accounts}
                    total={data.costOfSales.total}
                    comparison={data.comparison?.costOfSales.total}
                  />
                )}

                {/* Gross Profit */}
                <SectionRow
                  label="Gross Profit"
                  total={data.grossProfit}
                  comparison={data.comparison?.grossProfit}
                  isSubtotal
                />

                {/* Operating Expenses */}
                <SectionRow
                  label="Operating Expenses"
                  accounts={data.operatingExpenses.accounts}
                  total={data.operatingExpenses.total}
                  comparison={data.comparison?.operatingExpenses.total}
                />

                {/* Operating Income */}
                <SectionRow
                  label="Operating Income"
                  total={data.operatingIncome}
                  comparison={data.comparison?.operatingIncome}
                  isSubtotal
                />

                {/* Other Income */}
                {data.otherIncome.accounts.length > 0 && (
                  <SectionRow
                    label="Other Income"
                    accounts={data.otherIncome.accounts}
                    total={data.otherIncome.total}
                    comparison={data.comparison?.otherIncome.total}
                  />
                )}

                {/* Other Expenses */}
                {data.otherExpenses.accounts.length > 0 && (
                  <SectionRow
                    label="Other Expenses"
                    accounts={data.otherExpenses.accounts}
                    total={data.otherExpenses.total}
                    comparison={data.comparison?.otherExpenses.total}
                  />
                )}

                {/* Net Income */}
                <SectionRow
                  label="Net Income"
                  total={data.netIncome}
                  comparison={data.comparison?.netIncome}
                  isTotal
                />
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Empty State */}
      {!loading && !error && data && data.revenue.accounts.length === 0 && data.operatingExpenses.accounts.length === 0 && (
        <GlassCard>
          <div className="text-center py-8">
            <p className="text-white/50">
              No transactions found for this period.
            </p>
            <p className="text-white/40 text-sm mt-2">
              Create journal entries to see your profit and loss statement.
            </p>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
