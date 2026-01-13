"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  GlassCard,
  GlassSelect,
  GlassButton,
  GlassInput,
  GlassTable,
  GlassTabs,
  PageHeader,
  Spinner,
  SkeletonTable,
  useToast,
  ErrorAlert,
} from "@/components/ui/glass";
import { formatCurrency, formatDate, apiGet } from "@/lib/http";

interface AgingBucket {
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  total: number;
}

interface CustomerAging {
  customerId: string;
  customerName: string;
  customerCode: string;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  total: number;
  oldestInvoiceDate: string;
  invoiceCount: number;
}

interface InvoiceAging {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  daysOverdue: number;
  originalAmount: number;
  paidAmount: number;
  openAmount: number;
  bucket: "current" | "30" | "60" | "90" | "90+";
}

interface AgingResult {
  asOf: string;
  summary: AgingBucket;
  byCustomer: CustomerAging[];
  byInvoice: InvoiceAging[];
}

const tabs = [
  { id: "summary", label: "Summary" },
  { id: "by-customer", label: "By Customer" },
  { id: "by-invoice", label: "By Invoice" },
];

function ARAgingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = React.useState("summary");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [asOfDate, setAsOfDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [data, setData] = React.useState<AgingResult | null>(null);
  const [bucketFilter, setBucketFilter] = React.useState("");

  // Sync tab from URL
  React.useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && tabs.some((t) => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Load data from API
  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (asOfDate) params.set("asOf", asOfDate);
      const result = await apiGet<AgingResult>(`/api/finance/ar/aging?${params}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load aging data");
    } finally {
      setLoading(false);
    }
  }, [asOfDate]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const summary = data?.summary || null;
  const customerAging = data?.byCustomer || [];
  const invoices = data?.byInvoice || [];

  const filteredInvoices = bucketFilter
    ? invoices.filter((inv) => inv.bucket === bucketFilter)
    : invoices;

  // CSV Export functions
  const exportCustomerCSV = () => {
    if (customerAging.length === 0) {
      addToast("warning", "No data to export");
      return;
    }
    const headers = ["Customer", "Code", "Current", "1-30 Days", "31-60 Days", "61-90 Days", "90+ Days", "Total", "Invoices", "Oldest Invoice"];
    const rows = customerAging.map(c => [
      c.customerName,
      c.customerCode,
      c.current.toFixed(2),
      c.days30.toFixed(2),
      c.days60.toFixed(2),
      c.days90.toFixed(2),
      c.over90.toFixed(2),
      c.total.toFixed(2),
      c.invoiceCount.toString(),
      c.oldestInvoiceDate,
    ]);
    downloadCSV(`ar-aging-by-customer-${asOfDate}.csv`, [headers, ...rows]);
    addToast("success", "Customer aging exported");
  };

  const exportInvoiceCSV = () => {
    if (invoices.length === 0) {
      addToast("warning", "No data to export");
      return;
    }
    const headers = ["Invoice #", "Customer", "Invoice Date", "Due Date", "Days Overdue", "Bucket", "Original", "Paid", "Open"];
    const rows = invoices.map(inv => [
      inv.invoiceNumber,
      inv.customerName,
      inv.invoiceDate,
      inv.dueDate,
      inv.daysOverdue.toString(),
      getBucketLabel(inv.bucket),
      inv.originalAmount.toFixed(2),
      inv.paidAmount.toFixed(2),
      inv.openAmount.toFixed(2),
    ]);
    downloadCSV(`ar-aging-by-invoice-${asOfDate}.csv`, [headers, ...rows]);
    addToast("success", "Invoice aging exported");
  };

  const downloadCSV = (filename: string, rows: string[][]) => {
    const csvContent = rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Navigation handlers
  const handleCustomerClick = (customerId: string) => {
    router.push(`/finance/ar?partyId=${customerId}&tab=open`);
  };

  const handleInvoiceClick = (invoiceId: string) => {
    router.push(`/sales/${invoiceId}`);
  };

  const getBucketColor = (bucket: string) => {
    switch (bucket) {
      case "current":
        return "text-emerald-400";
      case "30":
        return "text-blue-400";
      case "60":
        return "text-amber-400";
      case "90":
        return "text-orange-400";
      case "90+":
        return "text-red-400";
      default:
        return "text-white";
    }
  };

  const getBucketLabel = (bucket: string) => {
    switch (bucket) {
      case "current":
        return "Current";
      case "30":
        return "1-30 Days";
      case "60":
        return "31-60 Days";
      case "90":
        return "61-90 Days";
      case "90+":
        return "Over 90 Days";
      default:
        return bucket;
    }
  };

  // Calculate percentages for the bar chart
  const getPercentage = (value: number, total: number) => {
    return total > 0 ? (value / total) * 100 : 0;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AR Aging Report"
        description="Accounts receivable aging analysis by 30/60/90+ days"
      />

      {/* Filter Bar */}
      <GlassCard padding="sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-40">
            <GlassInput
              label="As of Date"
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
            />
          </div>
          <GlassButton onClick={loadData} disabled={loading}>
            {loading ? <Spinner size="sm" /> : "Refresh"}
          </GlassButton>
        </div>
      </GlassCard>

      {/* Error */}
      {error && (
        <ErrorAlert message={error} onDismiss={() => setError(null)} />
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <GlassCard padding="sm">
          <div className="text-xs text-white/50 uppercase">Current</div>
          <div className="text-xl font-bold text-emerald-400">
            {loading ? <Spinner size="sm" /> : formatCurrency(summary?.current || 0)}
          </div>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="text-xs text-white/50 uppercase">1-30 Days</div>
          <div className="text-xl font-bold text-blue-400">
            {loading ? <Spinner size="sm" /> : formatCurrency(summary?.days30 || 0)}
          </div>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="text-xs text-white/50 uppercase">31-60 Days</div>
          <div className="text-xl font-bold text-amber-400">
            {loading ? <Spinner size="sm" /> : formatCurrency(summary?.days60 || 0)}
          </div>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="text-xs text-white/50 uppercase">61-90 Days</div>
          <div className="text-xl font-bold text-orange-400">
            {loading ? <Spinner size="sm" /> : formatCurrency(summary?.days90 || 0)}
          </div>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="text-xs text-white/50 uppercase">Over 90 Days</div>
          <div className="text-xl font-bold text-red-400">
            {loading ? <Spinner size="sm" /> : formatCurrency(summary?.over90 || 0)}
          </div>
        </GlassCard>
        <GlassCard padding="sm" className="bg-white/5">
          <div className="text-xs text-white/50 uppercase">Total AR</div>
          <div className="text-xl font-bold text-white">
            {loading ? <Spinner size="sm" /> : formatCurrency(summary?.total || 0)}
          </div>
        </GlassCard>
      </div>

      {/* Aging Distribution Bar */}
      {summary && !loading && (
        <GlassCard>
          <h3 className="text-sm font-medium text-white mb-3">Aging Distribution</h3>
          <div className="h-8 rounded-lg overflow-hidden flex">
            <div
              className="bg-emerald-500 transition-all"
              style={{ width: `${getPercentage(summary.current, summary.total)}%` }}
              title={`Current: ${formatCurrency(summary.current)}`}
            />
            <div
              className="bg-blue-500 transition-all"
              style={{ width: `${getPercentage(summary.days30, summary.total)}%` }}
              title={`1-30 Days: ${formatCurrency(summary.days30)}`}
            />
            <div
              className="bg-amber-500 transition-all"
              style={{ width: `${getPercentage(summary.days60, summary.total)}%` }}
              title={`31-60 Days: ${formatCurrency(summary.days60)}`}
            />
            <div
              className="bg-orange-500 transition-all"
              style={{ width: `${getPercentage(summary.days90, summary.total)}%` }}
              title={`61-90 Days: ${formatCurrency(summary.days90)}`}
            />
            <div
              className="bg-red-500 transition-all"
              style={{ width: `${getPercentage(summary.over90, summary.total)}%` }}
              title={`Over 90 Days: ${formatCurrency(summary.over90)}`}
            />
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-emerald-500" />
              <span className="text-white/70">Current ({getPercentage(summary.current, summary.total).toFixed(1)}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-blue-500" />
              <span className="text-white/70">1-30 Days ({getPercentage(summary.days30, summary.total).toFixed(1)}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-amber-500" />
              <span className="text-white/70">31-60 Days ({getPercentage(summary.days60, summary.total).toFixed(1)}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-orange-500" />
              <span className="text-white/70">61-90 Days ({getPercentage(summary.days90, summary.total).toFixed(1)}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-red-500" />
              <span className="text-white/70">Over 90 Days ({getPercentage(summary.over90, summary.total).toFixed(1)}%)</span>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Risk Alert */}
      {summary && !loading && summary.over90 > 0 && (
        <GlassCard className="!bg-red-500/10 border border-red-500/20">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-red-500/20">
              <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h4 className="font-medium text-red-400">High-Risk Receivables Alert</h4>
              <p className="text-sm text-white/70 mt-1">
                {formatCurrency(summary.over90)} ({getPercentage(summary.over90, summary.total).toFixed(1)}%) of receivables
                are over 90 days past due. Consider escalating collection efforts or reviewing credit terms for affected customers.
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Tabs */}
      <GlassTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Summary Tab */}
      {activeTab === "summary" && (
        <GlassCard>
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">AR Aging Summary</h3>
            <p className="text-white/50 max-w-md mx-auto">
              View the distribution of outstanding receivables above. Use the tabs to drill down by customer or individual invoice.
            </p>
          </div>
        </GlassCard>
      )}

      {/* By Customer Tab */}
      {activeTab === "by-customer" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <GlassButton size="sm" variant="ghost" onClick={exportCustomerCSV} disabled={loading || customerAging.length === 0}>
              Export CSV
            </GlassButton>
          </div>
          <GlassCard padding="none">
            {loading ? (
              <div className="p-6">
                <SkeletonTable rows={4} columns={8} />
              </div>
            ) : (
              <GlassTable
                headers={["Customer", "Current", "1-30 Days", "31-60 Days", "61-90 Days", "90+ Days", "Total", "Oldest"]}
                rightAlignColumns={[1, 2, 3, 4, 5, 6]}
                rows={customerAging.map((c) => [
                  <button
                    key="name"
                    onClick={() => handleCustomerClick(c.customerId)}
                    className="text-left text-blue-400 hover:text-blue-300 hover:underline"
                  >
                    {c.customerName}
                  </button>,
                  <span key="current" className={c.current > 0 ? "text-emerald-400" : "text-white/30"}>
                    {c.current > 0 ? formatCurrency(c.current) : "-"}
                  </span>,
                  <span key="30" className={c.days30 > 0 ? "text-blue-400" : "text-white/30"}>
                    {c.days30 > 0 ? formatCurrency(c.days30) : "-"}
                  </span>,
                  <span key="60" className={c.days60 > 0 ? "text-amber-400" : "text-white/30"}>
                    {c.days60 > 0 ? formatCurrency(c.days60) : "-"}
                  </span>,
                  <span key="90" className={c.days90 > 0 ? "text-orange-400" : "text-white/30"}>
                    {c.days90 > 0 ? formatCurrency(c.days90) : "-"}
                  </span>,
                  <span key="90plus" className={c.over90 > 0 ? "text-red-400" : "text-white/30"}>
                    {c.over90 > 0 ? formatCurrency(c.over90) : "-"}
                  </span>,
                  <span key="total" className="text-white font-medium">{formatCurrency(c.total)}</span>,
                  <span key="oldest" className="text-white/50">{formatDate(c.oldestInvoiceDate)}</span>,
                ])}
                emptyMessage="No customer aging data found"
              />
            )}
          </GlassCard>
        </div>
      )}

      {/* By Invoice Tab */}
      {activeTab === "by-invoice" && (
        <div className="space-y-4">
          {/* Filter and Export */}
          <GlassCard padding="sm">
            <div className="flex items-end justify-between gap-4">
              <div className="w-48">
                <GlassSelect
                  label="Aging Bucket"
                  value={bucketFilter}
                  onChange={(e) => setBucketFilter(e.target.value)}
                  options={[
                    { value: "", label: "All Buckets" },
                    { value: "current", label: "Current" },
                    { value: "30", label: "1-30 Days" },
                    { value: "60", label: "31-60 Days" },
                    { value: "90", label: "61-90 Days" },
                    { value: "90+", label: "Over 90 Days" },
                  ]}
                />
              </div>
              <GlassButton size="sm" variant="ghost" onClick={exportInvoiceCSV} disabled={loading || invoices.length === 0}>
                Export CSV
              </GlassButton>
            </div>
          </GlassCard>

          <GlassCard padding="none">
            {loading ? (
              <div className="p-6">
                <SkeletonTable rows={7} columns={7} />
              </div>
            ) : (
              <GlassTable
                headers={["Invoice #", "Customer", "Invoice Date", "Due Date", "Days Overdue", "Bucket", "Open Amount"]}
                rightAlignColumns={[4, 6]}
                monospaceColumns={[0]}
                rows={filteredInvoices.map((inv) => [
                  <button
                    key="inv"
                    onClick={() => handleInvoiceClick(inv.invoiceId)}
                    className="text-left font-mono text-blue-400 hover:text-blue-300 hover:underline"
                  >
                    {inv.invoiceNumber}
                  </button>,
                  <button
                    key="cust"
                    onClick={() => handleCustomerClick(inv.customerId)}
                    className="text-left text-white/70 hover:text-white hover:underline"
                  >
                    {inv.customerName}
                  </button>,
                  formatDate(inv.invoiceDate),
                  formatDate(inv.dueDate),
                  <span key="days" className={inv.daysOverdue > 60 ? "text-red-400" : inv.daysOverdue > 30 ? "text-amber-400" : "text-white"}>
                    {inv.daysOverdue > 0 ? `${inv.daysOverdue} days` : "Current"}
                  </span>,
                  <span key="bucket" className={getBucketColor(inv.bucket)}>
                    {getBucketLabel(inv.bucket)}
                  </span>,
                  <span key="amount" className="text-white font-medium">{formatCurrency(inv.openAmount)}</span>,
                ])}
                emptyMessage="No invoices found"
              />
            )}
          </GlassCard>
        </div>
      )}
    </div>
  );
}

export default function ARAgingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>}>
      <ARAgingContent />
    </Suspense>
  );
}
