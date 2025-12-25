"use client";

import * as React from "react";
import { GlassCard, GlassInput, GlassButton, GlassTable, GlassTabs, PageHeader, Spinner } from "@/components/ui/glass";
import { apiGet, formatCurrency, formatDate } from "@/lib/http";

interface OpenDocItem {
  docId: string;
  docNumber: string;
  docDate: string;
  partyId: string | null;
  partyName: string | null;
  currency: string;
  totalAmount: number;
  allocatedAmount: number;
  remainingAmount: number;
}

interface OpenDocsResult {
  items: OpenDocItem[];
  summary: {
    totalOpenAmount: number;
    count: number;
  };
}

interface StatementLine {
  date: string;
  type: "invoice" | "payment";
  reference: string;
  amountDebit: number;
  amountCredit: number;
  runningBalance: number;
}

interface StatementResult {
  partyId: string;
  partyName: string | null;
  lines: StatementLine[];
  openingBalance: number;
  closingBalance: number;
}

export default function APPage() {
  const [tab, setTab] = React.useState("open");
  const [partyId, setPartyId] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  const [openData, setOpenData] = React.useState<OpenDocsResult | null>(null);
  const [statementData, setStatementData] = React.useState<StatementResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadOpen = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (partyId) params.set("partyId", partyId);
      const result = await apiGet<OpenDocsResult>(`/api/finance/ap/open?${params}`);
      setOpenData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [partyId]);

  const loadStatement = React.useCallback(async () => {
    if (!partyId) {
      setError("Party ID is required for statement view");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ partyId });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const result = await apiGet<StatementResult>(`/api/finance/ap/statement?${params}`);
      setStatementData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load statement");
    } finally {
      setLoading(false);
    }
  }, [partyId, from, to]);

  React.useEffect(() => {
    if (tab === "open") {
      loadOpen();
    }
  }, [tab, loadOpen]);

  return (
    <div className="space-y-6">
      <PageHeader title="Accounts Payable" description="Vendor balances and statements" />

      {/* Tabs */}
      <GlassTabs
        tabs={[
          { id: "open", label: "Open Items" },
          { id: "statement", label: "Statement" },
        ]}
        activeTab={tab}
        onTabChange={setTab}
      />

      {/* Filters */}
      <GlassCard padding="sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-64">
            <GlassInput
              label="Vendor Party ID"
              placeholder="UUID..."
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
            />
          </div>
          {tab === "statement" && (
            <>
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
            </>
          )}
          <GlassButton onClick={tab === "open" ? loadOpen : loadStatement} disabled={loading}>
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

      {/* Open Items Tab */}
      {tab === "open" && openData && (
        <>
          <GlassCard padding="sm">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-xs text-white/50 uppercase">Open Items</span>
                <p className="text-xl font-semibold text-white">{openData.summary.count}</p>
              </div>
              <div>
                <span className="text-xs text-white/50 uppercase">Total Owed</span>
                <p className="text-xl font-semibold text-red-400">
                  {formatCurrency(openData.summary.totalOpenAmount)}
                </p>
              </div>
            </div>
          </GlassCard>
          <GlassCard padding="none">
            <GlassTable
              headers={["Invoice #", "Date", "Vendor", "Total", "Paid", "Remaining"]}
              monospaceColumns={[0]}
              rightAlignColumns={[3, 4, 5]}
              rows={openData.items.map((item) => [
                item.docNumber,
                formatDate(item.docDate),
                item.partyName || "-",
                formatCurrency(item.totalAmount),
                formatCurrency(item.allocatedAmount),
                formatCurrency(item.remainingAmount),
              ])}
              emptyMessage="No open payables"
            />
          </GlassCard>
        </>
      )}

      {/* Statement Tab */}
      {tab === "statement" && statementData && (
        <>
          <GlassCard padding="sm">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-xs text-white/50 uppercase">Vendor</span>
                <p className="text-lg font-medium text-white">{statementData.partyName || statementData.partyId}</p>
              </div>
              <div>
                <span className="text-xs text-white/50 uppercase">Balance Owed</span>
                <p className="text-xl font-semibold text-red-400">
                  {formatCurrency(statementData.closingBalance)}
                </p>
              </div>
            </div>
          </GlassCard>
          <GlassCard padding="none">
            <GlassTable
              headers={["Date", "Type", "Reference", "Debit", "Credit", "Balance"]}
              rightAlignColumns={[3, 4, 5]}
              rows={statementData.lines.map((line) => [
                formatDate(line.date),
                line.type,
                line.reference,
                line.amountDebit > 0 ? formatCurrency(line.amountDebit) : "-",
                line.amountCredit > 0 ? formatCurrency(line.amountCredit) : "-",
                formatCurrency(line.runningBalance),
              ])}
              emptyMessage="No transactions found"
            />
          </GlassCard>
        </>
      )}
    </div>
  );
}
