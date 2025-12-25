"use client";

import * as React from "react";
import { GlassCard, GlassInput, GlassButton, GlassTable, PageHeader, Spinner } from "@/components/ui/glass";
import { apiGet, formatCurrency, formatDate } from "@/lib/http";

interface LedgerLine {
  journalEntryId: string;
  postingDate: string;
  memo: string | null;
  lineDescription: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
}

interface LedgerData {
  account: {
    code: string;
    name: string;
    type: string;
  };
  dateRange: { from: string | null; to: string | null };
  items: LedgerLine[];
  pagination: { limit: number; offset: number; hasMore: boolean };
}

export default function GeneralLedgerPage() {
  const [accountCode, setAccountCode] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [data, setData] = React.useState<LedgerData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    if (!accountCode) {
      setError("Please enter an account code");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ accountCode });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const result = await apiGet<LedgerData>(`/api/reports/general-ledger?${params}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load general ledger");
    } finally {
      setLoading(false);
    }
  }, [accountCode, from, to]);

  return (
    <div className="space-y-6">
      <PageHeader title="General Ledger" description="Detailed account transactions" />

      {/* Filters */}
      <GlassCard padding="sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-40">
            <GlassInput
              label="Account Code"
              placeholder="e.g. 1100"
              value={accountCode}
              onChange={(e) => setAccountCode(e.target.value)}
            />
          </div>
          <div className="w-40">
            <GlassInput
              label="From"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="w-40">
            <GlassInput
              label="To"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <GlassButton onClick={loadData} disabled={loading}>
            {loading ? <Spinner size="sm" /> : "Search"}
          </GlassButton>
        </div>
      </GlassCard>

      {/* Error */}
      {error && (
        <GlassCard>
          <p className="text-red-400">{error}</p>
        </GlassCard>
      )}

      {/* Account info */}
      {data && (
        <GlassCard padding="sm">
          <div className="flex items-center gap-4">
            <span className="font-mono text-white/60">{data.account.code}</span>
            <span className="text-white font-medium">{data.account.name}</span>
            <span className="text-xs text-white/40 uppercase">{data.account.type}</span>
          </div>
        </GlassCard>
      )}

      {/* Table */}
      {data && (
        <GlassCard padding="none">
          <GlassTable
            headers={["Date", "Description", "Debit", "Credit", "Balance"]}
            rightAlignColumns={[2, 3, 4]}
            rows={data.items.map((line) => [
              formatDate(line.postingDate),
              line.lineDescription || line.memo || "-",
              line.debit > 0 ? formatCurrency(line.debit) : "-",
              line.credit > 0 ? formatCurrency(line.credit) : "-",
              formatCurrency(line.runningBalance),
            ])}
            emptyMessage="No transactions found"
          />
        </GlassCard>
      )}
    </div>
  );
}
