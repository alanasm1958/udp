"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  GlassCard,
  GlassSelect,
  GlassTable,
  GlassTabs,
  PageHeader,
  Spinner,
  SkeletonTable,
} from "@/components/ui/glass";
import { formatCurrency, formatDate } from "@/lib/http";

interface CashAccount {
  accountId: string;
  accountCode: string;
  accountName: string;
  balance: number;
  method: "cash" | "bank";
}

interface CashMovement {
  date: string;
  type: "receipt" | "payment";
  reference: string;
  description: string;
  amount: number;
  runningBalance: number;
}

interface CashForecast {
  period: string;
  openingBalance: number;
  expectedReceipts: number;
  expectedPayments: number;
  closingBalance: number;
}

// Mock data for Cash Position dashboard - in production this would come from API
const mockAccounts: CashAccount[] = [
  { accountId: "1", accountCode: "1000", accountName: "Petty Cash", balance: 2500, method: "cash" },
  { accountId: "2", accountCode: "1010", accountName: "Operating Account", balance: 145000, method: "bank" },
  { accountId: "3", accountCode: "1020", accountName: "Savings Account", balance: 85000, method: "bank" },
  { accountId: "4", accountCode: "1030", accountName: "Payroll Account", balance: 32000, method: "bank" },
];

const mockMovements: CashMovement[] = [
  { date: "2025-01-15", type: "receipt", reference: "REC-001", description: "Customer Payment - ABC Corp", amount: 15000, runningBalance: 264500 },
  { date: "2025-01-14", type: "payment", reference: "PAY-012", description: "Vendor Payment - Supplies Inc", amount: -8500, runningBalance: 249500 },
  { date: "2025-01-13", type: "receipt", reference: "REC-002", description: "Customer Payment - XYZ Ltd", amount: 22000, runningBalance: 258000 },
  { date: "2025-01-12", type: "payment", reference: "PAY-011", description: "Payroll", amount: -45000, runningBalance: 236000 },
  { date: "2025-01-10", type: "receipt", reference: "REC-003", description: "Customer Payment - DEF Inc", amount: 8500, runningBalance: 281000 },
  { date: "2025-01-09", type: "payment", reference: "PAY-010", description: "Rent Payment", amount: -12000, runningBalance: 272500 },
  { date: "2025-01-08", type: "receipt", reference: "REC-004", description: "Interest Income", amount: 450, runningBalance: 284500 },
];

const mockForecast: CashForecast[] = [
  { period: "This Week", openingBalance: 264500, expectedReceipts: 35000, expectedPayments: 28000, closingBalance: 271500 },
  { period: "Next Week", openingBalance: 271500, expectedReceipts: 42000, expectedPayments: 55000, closingBalance: 258500 },
  { period: "Week 3", openingBalance: 258500, expectedReceipts: 38000, expectedPayments: 22000, closingBalance: 274500 },
  { period: "Week 4", openingBalance: 274500, expectedReceipts: 45000, expectedPayments: 48000, closingBalance: 271500 },
];

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "movements", label: "Movements" },
  { id: "forecast", label: "Forecast" },
];

function CashPositionContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = React.useState("overview");
  const [loading, setLoading] = React.useState(true);
  const [accounts, setAccounts] = React.useState<CashAccount[]>([]);
  const [movements, setMovements] = React.useState<CashMovement[]>([]);
  const [forecast, setForecast] = React.useState<CashForecast[]>([]);
  const [methodFilter, setMethodFilter] = React.useState("");

  // Sync tab from URL
  React.useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && tabs.some((t) => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Load data
  React.useEffect(() => {
    // Simulate API call - in production, fetch from /api/finance/cash-position
    const timer = setTimeout(() => {
      setAccounts(mockAccounts);
      setMovements(mockMovements);
      setForecast(mockForecast);
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const filteredAccounts = methodFilter
    ? accounts.filter((a) => a.method === methodFilter)
    : accounts;

  const totalCash = accounts
    .filter((a) => a.method === "cash")
    .reduce((sum, a) => sum + a.balance, 0);

  const totalBank = accounts
    .filter((a) => a.method === "bank")
    .reduce((sum, a) => sum + a.balance, 0);

  const totalBalance = totalCash + totalBank;

  // Calculate 30-day trend (mock)
  const trend30Day = 12500; // positive = increase

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cash Position"
        description="Real-time cash balances and liquidity forecast"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/50 uppercase tracking-wider">Total Cash</p>
              <div className="text-2xl font-bold text-white mt-1">
                {loading ? <Spinner size="sm" /> : formatCurrency(totalBalance)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/20">
              <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            {trend30Day >= 0 ? (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                </svg>
                +{formatCurrency(trend30Day)}
              </span>
            ) : (
              <span className="text-xs text-red-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
                {formatCurrency(trend30Day)}
              </span>
            )}
            <span className="text-xs text-white/40">vs 30 days ago</span>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/50 uppercase tracking-wider">Bank Accounts</p>
              <div className="text-2xl font-bold text-white mt-1">
                {loading ? <Spinner size="sm" /> : formatCurrency(totalBank)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/20">
              <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-white/40 mt-3">{accounts.filter((a) => a.method === "bank").length} accounts</p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/50 uppercase tracking-wider">Petty Cash</p>
              <div className="text-2xl font-bold text-white mt-1">
                {loading ? <Spinner size="sm" /> : formatCurrency(totalCash)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/20">
              <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-white/40 mt-3">{accounts.filter((a) => a.method === "cash").length} accounts</p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/50 uppercase tracking-wider">4-Week Forecast</p>
              <div className="text-2xl font-bold text-white mt-1">
                {loading ? <Spinner size="sm" /> : formatCurrency(forecast[forecast.length - 1]?.closingBalance || 0)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-purple-500/20">
              <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-white/40 mt-3">Projected closing balance</p>
        </GlassCard>
      </div>

      {/* Tabs */}
      <GlassTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Filter */}
          <GlassCard padding="sm">
            <div className="flex items-end gap-4">
              <div className="w-48">
                <GlassSelect
                  label="Account Type"
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  options={[
                    { value: "", label: "All Accounts" },
                    { value: "bank", label: "Bank Accounts" },
                    { value: "cash", label: "Cash Accounts" },
                  ]}
                />
              </div>
            </div>
          </GlassCard>

          {/* Accounts Table */}
          <GlassCard padding="none">
            {loading ? (
              <div className="p-6">
                <SkeletonTable rows={4} columns={4} />
              </div>
            ) : (
              <GlassTable
                headers={["Account", "Type", "Balance", ""]}
                rightAlignColumns={[2]}
                monospaceColumns={[0]}
                rows={filteredAccounts.map((account) => [
                  <div key={account.accountId}>
                    <span className="text-white/60 mr-2">{account.accountCode}</span>
                    <span className="text-white">{account.accountName}</span>
                  </div>,
                  <span key="method" className="capitalize">{account.method}</span>,
                  <span key="balance" className={account.balance >= 0 ? "text-emerald-400" : "text-red-400"}>
                    {formatCurrency(account.balance)}
                  </span>,
                  <span key="pct" className="text-white/40 text-xs">
                    {((account.balance / totalBalance) * 100).toFixed(1)}%
                  </span>,
                ])}
                emptyMessage="No cash accounts found"
              />
            )}
          </GlassCard>
        </div>
      )}

      {/* Movements Tab */}
      {activeTab === "movements" && (
        <GlassCard padding="none">
          {loading ? (
            <div className="p-6">
              <SkeletonTable rows={7} columns={5} />
            </div>
          ) : (
            <GlassTable
              headers={["Date", "Reference", "Description", "Amount", "Balance"]}
              rightAlignColumns={[3, 4]}
              monospaceColumns={[1]}
              rows={movements.map((m) => [
                formatDate(m.date),
                m.reference,
                m.description,
                <span key="amt" className={m.amount >= 0 ? "text-emerald-400" : "text-red-400"}>
                  {m.amount >= 0 ? "+" : ""}{formatCurrency(m.amount)}
                </span>,
                formatCurrency(m.runningBalance),
              ])}
              emptyMessage="No cash movements found"
            />
          )}
        </GlassCard>
      )}

      {/* Forecast Tab */}
      {activeTab === "forecast" && (
        <div className="space-y-6">
          {/* Info Banner */}
          <GlassCard className="!bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm text-white">
                Forecast is based on scheduled payments, recurring invoices, and historical patterns.
                Actual results may vary based on customer payment behavior.
              </p>
            </div>
          </GlassCard>

          <GlassCard padding="none">
            {loading ? (
              <div className="p-6">
                <SkeletonTable rows={4} columns={5} />
              </div>
            ) : (
              <GlassTable
                headers={["Period", "Opening", "Receipts", "Payments", "Closing"]}
                rightAlignColumns={[1, 2, 3, 4]}
                rows={forecast.map((f) => [
                  f.period,
                  formatCurrency(f.openingBalance),
                  <span key="rec" className="text-emerald-400">+{formatCurrency(f.expectedReceipts)}</span>,
                  <span key="pay" className="text-red-400">-{formatCurrency(f.expectedPayments)}</span>,
                  <span key="close" className={f.closingBalance >= 0 ? "text-white font-medium" : "text-red-400 font-medium"}>
                    {formatCurrency(f.closingBalance)}
                  </span>,
                ])}
                emptyMessage="No forecast data available"
              />
            )}
          </GlassCard>

          {/* Liquidity Warning */}
          {!loading && forecast.some((f) => f.closingBalance < 50000) && (
            <GlassCard className="!bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium text-amber-400">Liquidity Alert</h4>
                  <p className="text-sm text-white/70 mt-1">
                    Cash balance may drop below the recommended minimum of $50,000 in the forecast period.
                    Consider accelerating collections or deferring non-essential payments.
                  </p>
                </div>
              </div>
            </GlassCard>
          )}
        </div>
      )}
    </div>
  );
}

export default function CashPositionPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>}>
      <CashPositionContent />
    </Suspense>
  );
}
