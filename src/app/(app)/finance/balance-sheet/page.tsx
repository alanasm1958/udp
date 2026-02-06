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
  balance: number;
}

interface BalanceSheetSection {
  accounts: AccountLine[];
  total: number;
}

interface BalanceSheetData {
  asOf: string;
  assets: {
    current: BalanceSheetSection;
    fixed: BalanceSheetSection;
    other: BalanceSheetSection;
    total: number;
  };
  liabilities: {
    current: BalanceSheetSection;
    longTerm: BalanceSheetSection;
    total: number;
  };
  equity: {
    capitalAccounts: BalanceSheetSection;
    retainedEarnings: number;
    currentYearEarnings: number;
    total: number;
  };
  totalLiabilitiesAndEquity: number;
  balanced: boolean;
}

function AccountSection({
  title,
  accounts,
  total,
}: {
  title: string;
  accounts: AccountLine[];
  total: number;
}) {
  const [expanded, setExpanded] = React.useState(true);

  if (accounts.length === 0) return null;

  return (
    <div className="mb-4">
      <div
        className="flex items-center justify-between py-2 px-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-white/50 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-medium text-white">{title}</span>
        </div>
        <span className="font-semibold text-white tabular-nums">
          {formatCurrency(total)}
        </span>
      </div>
      {expanded && (
        <div className="mt-2 space-y-1 pl-6">
          {accounts.map((account) => (
            <div
              key={account.code}
              className="flex items-center justify-between py-1 px-3 text-sm"
            >
              <div className="text-white/70">
                <span className="text-white/40 mr-2">{account.code}</span>
                {account.name}
              </div>
              <span className="text-white/70 tabular-nums">
                {formatCurrency(account.balance)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BalanceSheetPage() {
  const { addToast } = useToast();

  const [asOf, setAsOf] = React.useState(new Date().toISOString().split("T")[0]);
  const [data, setData] = React.useState<BalanceSheetData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<BalanceSheetData>(`/api/reports/balance-sheet?asOf=${asOf}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [asOf]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const exportCSV = () => {
    if (!data) return;

    const rows: string[][] = [
      ["Balance Sheet"],
      [`As of: ${data.asOf}`],
      [],
      ["Account Code", "Account Name", "Balance"],
      [],
      ["ASSETS"],
      [],
      ["Current Assets"],
      ...data.assets.current.accounts.map((a) => [a.code, a.name, a.balance.toFixed(2)]),
      ["", "Total Current Assets", data.assets.current.total.toFixed(2)],
      [],
      ["Fixed Assets"],
      ...data.assets.fixed.accounts.map((a) => [a.code, a.name, a.balance.toFixed(2)]),
      ["", "Total Fixed Assets", data.assets.fixed.total.toFixed(2)],
      [],
      ["Other Assets"],
      ...data.assets.other.accounts.map((a) => [a.code, a.name, a.balance.toFixed(2)]),
      ["", "Total Other Assets", data.assets.other.total.toFixed(2)],
      [],
      ["", "TOTAL ASSETS", data.assets.total.toFixed(2)],
      [],
      ["LIABILITIES"],
      [],
      ["Current Liabilities"],
      ...data.liabilities.current.accounts.map((a) => [a.code, a.name, a.balance.toFixed(2)]),
      ["", "Total Current Liabilities", data.liabilities.current.total.toFixed(2)],
      [],
      ["Long-Term Liabilities"],
      ...data.liabilities.longTerm.accounts.map((a) => [a.code, a.name, a.balance.toFixed(2)]),
      ["", "Total Long-Term Liabilities", data.liabilities.longTerm.total.toFixed(2)],
      [],
      ["", "TOTAL LIABILITIES", data.liabilities.total.toFixed(2)],
      [],
      ["EQUITY"],
      [],
      ["Capital Accounts"],
      ...data.equity.capitalAccounts.accounts.map((a) => [a.code, a.name, a.balance.toFixed(2)]),
      ["", "Total Capital Accounts", data.equity.capitalAccounts.total.toFixed(2)],
      ["", "Retained Earnings", data.equity.retainedEarnings.toFixed(2)],
      ["", "Current Year Earnings", data.equity.currentYearEarnings.toFixed(2)],
      [],
      ["", "TOTAL EQUITY", data.equity.total.toFixed(2)],
      [],
      ["", "TOTAL LIABILITIES & EQUITY", data.totalLiabilitiesAndEquity.toFixed(2)],
      [],
      ["", "Balance Check", data.balanced ? "BALANCED" : "NOT BALANCED"],
    ];

    const csvContent = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `balance-sheet-${data.asOf}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    addToast("success", "Report exported to CSV");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Balance Sheet"
        description="Statement of financial position showing assets, liabilities, and equity"
      />

      {/* Filters */}
      <GlassCard padding="sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-48">
            <GlassInput
              label="As of Date"
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
            />
          </div>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Assets Column */}
          <GlassCard>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">Assets</h2>
              <span className="text-lg font-bold text-white tabular-nums">
                {formatCurrency(data.assets.total)}
              </span>
            </div>

            <AccountSection
              title="Current Assets"
              accounts={data.assets.current.accounts}
              total={data.assets.current.total}
            />

            <AccountSection
              title="Fixed Assets"
              accounts={data.assets.fixed.accounts}
              total={data.assets.fixed.total}
            />

            <AccountSection
              title="Other Assets"
              accounts={data.assets.other.accounts}
              total={data.assets.other.total}
            />

            <div className="mt-4 pt-4 border-t border-white/20 flex items-center justify-between">
              <span className="font-bold text-white">Total Assets</span>
              <span className="text-xl font-bold text-white tabular-nums">
                {formatCurrency(data.assets.total)}
              </span>
            </div>
          </GlassCard>

          {/* Liabilities & Equity Column */}
          <GlassCard>
            {/* Liabilities */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">Liabilities</h2>
              <span className="text-lg font-bold text-white tabular-nums">
                {formatCurrency(data.liabilities.total)}
              </span>
            </div>

            <AccountSection
              title="Current Liabilities"
              accounts={data.liabilities.current.accounts}
              total={data.liabilities.current.total}
            />

            <AccountSection
              title="Long-Term Liabilities"
              accounts={data.liabilities.longTerm.accounts}
              total={data.liabilities.longTerm.total}
            />

            {/* Equity */}
            <div className="mt-6 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                <h2 className="text-lg font-semibold text-white">Equity</h2>
                <span className="text-lg font-bold text-white tabular-nums">
                  {formatCurrency(data.equity.total)}
                </span>
              </div>

              <AccountSection
                title="Capital Accounts"
                accounts={data.equity.capitalAccounts.accounts}
                total={data.equity.capitalAccounts.total}
              />

              <div className="space-y-2 pl-3">
                <div className="flex items-center justify-between py-1 px-3 text-sm">
                  <span className="text-white/70">Retained Earnings</span>
                  <span className="text-white/70 tabular-nums">
                    {formatCurrency(data.equity.retainedEarnings)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 px-3 text-sm">
                  <span className="text-white/70">Current Year Earnings</span>
                  <span className="text-white/70 tabular-nums">
                    {formatCurrency(data.equity.currentYearEarnings)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-white/20 flex items-center justify-between">
              <span className="font-bold text-white">Total Liabilities & Equity</span>
              <span className="text-xl font-bold text-white tabular-nums">
                {formatCurrency(data.totalLiabilitiesAndEquity)}
              </span>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Balance Check */}
      {data && (
        <GlassCard padding="sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {data.balanced ? (
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              )}
              <div>
                <p className={`font-medium ${data.balanced ? "text-emerald-400" : "text-red-400"}`}>
                  {data.balanced ? "Balance Sheet is Balanced" : "Balance Sheet is NOT Balanced"}
                </p>
                <p className="text-sm text-white/50">
                  Assets: {formatCurrency(data.assets.total)} | Liabilities + Equity: {formatCurrency(data.totalLiabilitiesAndEquity)}
                </p>
              </div>
            </div>
            {!data.balanced && (
              <div className="text-right">
                <p className="text-sm text-white/50">Difference</p>
                <p className="font-bold text-red-400 tabular-nums">
                  {formatCurrency(Math.abs(data.assets.total - data.totalLiabilitiesAndEquity))}
                </p>
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* Empty State */}
      {!loading && !error && data && data.assets.total === 0 && data.liabilities.total === 0 && data.equity.total === 0 && (
        <GlassCard>
          <div className="text-center py-8">
            <p className="text-white/50">
              No balance sheet data found.
            </p>
            <p className="text-white/40 text-sm mt-2">
              Create journal entries to see your balance sheet.
            </p>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
