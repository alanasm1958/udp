"use client";

import * as React from "react";
import { GlassCard, GlassInput, GlassButton, GlassTable, PageHeader, Spinner } from "@/components/ui/glass";
import { apiGet, formatCurrency } from "@/lib/http";

interface TrialBalanceRow {
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
}

interface TrialBalanceData {
  asOf: string;
  rows: TrialBalanceRow[];
  totals: {
    debit: number;
    credit: number;
    balanced: boolean;
  };
}

export default function TrialBalancePage() {
  const [asOf, setAsOf] = React.useState(new Date().toISOString().split("T")[0]);
  const [data, setData] = React.useState<TrialBalanceData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<TrialBalanceData>(`/api/reports/trial-balance?asOf=${asOf}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trial balance");
    } finally {
      setLoading(false);
    }
  }, [asOf]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      <PageHeader title="Trial Balance" description="Summary of all account balances" />

      {/* Filters */}
      <GlassCard padding="sm">
        <div className="flex items-end gap-4">
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
        </div>
      </GlassCard>

      {/* Error */}
      {error && (
        <GlassCard>
          <p className="text-red-400">{error}</p>
        </GlassCard>
      )}

      {/* Table */}
      {data && (
        <GlassCard padding="none">
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/60">As of: {data.asOf}</span>
              <span className={`text-sm ${data.totals.balanced ? "text-emerald-400" : "text-red-400"}`}>
                {data.totals.balanced ? "Balanced" : "Not Balanced"}
              </span>
            </div>
          </div>
          <GlassTable
            headers={["Code", "Account", "Type", "Debit", "Credit"]}
            monospaceColumns={[0]}
            rightAlignColumns={[3, 4]}
            rows={[
              ...data.rows.map((row) => [
                row.code,
                row.name,
                row.type,
                row.debit > 0 ? formatCurrency(row.debit) : "-",
                row.credit > 0 ? formatCurrency(row.credit) : "-",
              ]),
              // Totals row
              [
                "",
                <strong key="total">Total</strong>,
                "",
                <strong key="debit">{formatCurrency(data.totals.debit)}</strong>,
                <strong key="credit">{formatCurrency(data.totals.credit)}</strong>,
              ],
            ]}
            emptyMessage="No transactions found for this period"
          />
        </GlassCard>
      )}
    </div>
  );
}
