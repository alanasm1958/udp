"use client";

import { useState, useEffect } from "react";
import {
  GlassCard,
  GlassTable,
  GlassButton,
  PageHeader,
} from "@/components/ui/glass";
import { CreditCard } from "lucide-react";

interface AgingBucket {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
  total: number;
}

interface VendorAging {
  vendorId: string;
  vendorName: string;
  vendorCode: string | null;
  aging: AgingBucket;
}

export default function APAgingPage() {
  const [vendorAgings, setVendorAgings] = useState<VendorAging[]>([]);
  const [totals, setTotals] = useState<AgingBucket>({
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    days90plus: 0,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAgingData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAgingData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/finance/ap/aging");
      if (res.ok) {
        const data = await res.json();
        setVendorAgings(data.vendors || []);
        setTotals(data.totals || totals);
      }
    } catch (error) {
      console.error("Error loading AP aging:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (value === 0) return "-";
    return `$${value.toLocaleString()}`;
  };

  // Build table headers and rows for GlassTable
  const headers = ["Vendor", "Current", "1-30 Days", "31-60 Days", "61-90 Days", "90+ Days", "Total", "Actions"];

  const rows: React.ReactNode[][] = vendorAgings.map((row) => [
    <div key="vendor">
      <p className="font-medium">{row.vendorName}</p>
      {row.vendorCode && <p className="text-xs text-white/50">{row.vendorCode}</p>}
    </div>,
    <span key="current" className="text-green-400">{formatCurrency(row.aging.current)}</span>,
    <span key="1-30" className="text-yellow-400">{formatCurrency(row.aging.days1to30)}</span>,
    <span key="31-60" className="text-orange-400">{formatCurrency(row.aging.days31to60)}</span>,
    <span key="61-90" className="text-red-400">{formatCurrency(row.aging.days61to90)}</span>,
    <span key="90+" className="text-red-500 font-medium">{formatCurrency(row.aging.days90plus)}</span>,
    <span key="total" className="font-bold">{formatCurrency(row.aging.total)}</span>,
    <GlassButton key="action" size="sm" variant="ghost" title="Schedule Payment">
      <CreditCard className="w-4 h-4" />
    </GlassButton>,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="AP Aging Report"
        description="Money you owe to vendors by age"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-6 gap-4">
        <GlassCard className="p-4 border border-green-500/30 bg-green-500/5">
          <p className="text-sm text-white/60">Current</p>
          <p className="text-2xl font-bold text-green-400">{formatCurrency(totals.current)}</p>
        </GlassCard>
        <GlassCard className="p-4 border border-yellow-500/30 bg-yellow-500/5">
          <p className="text-sm text-white/60">1-30 Days</p>
          <p className="text-2xl font-bold text-yellow-400">{formatCurrency(totals.days1to30)}</p>
        </GlassCard>
        <GlassCard className="p-4 border border-orange-500/30 bg-orange-500/5">
          <p className="text-sm text-white/60">31-60 Days</p>
          <p className="text-2xl font-bold text-orange-400">{formatCurrency(totals.days31to60)}</p>
        </GlassCard>
        <GlassCard className="p-4 border border-red-400/30 bg-red-400/5">
          <p className="text-sm text-white/60">61-90 Days</p>
          <p className="text-2xl font-bold text-red-400">{formatCurrency(totals.days61to90)}</p>
        </GlassCard>
        <GlassCard className="p-4 border border-red-500/30 bg-red-500/5">
          <p className="text-sm text-white/60">90+ Days</p>
          <p className="text-2xl font-bold text-red-500">{formatCurrency(totals.days90plus)}</p>
        </GlassCard>
        <GlassCard className="p-4 border border-white/20">
          <p className="text-sm text-white/60">Total AP</p>
          <p className="text-2xl font-bold">{formatCurrency(totals.total)}</p>
        </GlassCard>
      </div>

      {/* Aging Visual */}
      {totals.total > 0 && (
        <GlassCard className="p-4">
          <p className="text-sm text-white/60 mb-2">Aging Distribution</p>
          <div className="flex h-4 rounded-full overflow-hidden bg-white/10">
            {totals.current > 0 && (
              <div
                className="bg-green-500"
                style={{ width: `${(totals.current / totals.total) * 100}%` }}
                title={`Current: ${formatCurrency(totals.current)}`}
              />
            )}
            {totals.days1to30 > 0 && (
              <div
                className="bg-yellow-500"
                style={{ width: `${(totals.days1to30 / totals.total) * 100}%` }}
                title={`1-30 Days: ${formatCurrency(totals.days1to30)}`}
              />
            )}
            {totals.days31to60 > 0 && (
              <div
                className="bg-orange-500"
                style={{ width: `${(totals.days31to60 / totals.total) * 100}%` }}
                title={`31-60 Days: ${formatCurrency(totals.days31to60)}`}
              />
            )}
            {totals.days61to90 > 0 && (
              <div
                className="bg-red-400"
                style={{ width: `${(totals.days61to90 / totals.total) * 100}%` }}
                title={`61-90 Days: ${formatCurrency(totals.days61to90)}`}
              />
            )}
            {totals.days90plus > 0 && (
              <div
                className="bg-red-600"
                style={{ width: `${(totals.days90plus / totals.total) * 100}%` }}
                title={`90+ Days: ${formatCurrency(totals.days90plus)}`}
              />
            )}
          </div>
          <div className="flex justify-between mt-2 text-xs text-white/40">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" /> Current
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500" /> 1-30d
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-500" /> 31-60d
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-400" /> 61-90d
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-600" /> 90+d
            </span>
          </div>
        </GlassCard>
      )}

      {/* Table */}
      <GlassCard padding="none">
        {isLoading ? (
          <div className="p-8 text-center text-white/40 text-sm">Loading AP aging...</div>
        ) : vendorAgings.length === 0 ? (
          <div className="p-8 text-center text-white/40 text-sm">
            No outstanding payables found.
          </div>
        ) : (
          <GlassTable headers={headers} rows={rows} />
        )}
      </GlassCard>
    </div>
  );
}
