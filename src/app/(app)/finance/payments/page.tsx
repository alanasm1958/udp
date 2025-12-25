"use client";

import * as React from "react";
import Link from "next/link";
import {
  GlassCard,
  GlassInput,
  GlassButton,
  GlassTable,
  GlassSelect,
  GlassBadge,
  PageHeader,
  Spinner,
} from "@/components/ui/glass";
import { apiGet, formatCurrency, formatDate } from "@/lib/http";

interface Payment {
  id: string;
  type: "receipt" | "payment";
  method: "cash" | "bank";
  status: "draft" | "posted" | "void";
  paymentDate: string;
  partyId: string | null;
  partyName?: string | null;
  currency: string;
  amount: string;
  reference: string | null;
}

interface PaymentsResult {
  items: Payment[];
}

export default function PaymentsPage() {
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [method, setMethod] = React.useState("");
  const [data, setData] = React.useState<PaymentsResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (method) params.set("method", method);
      const result = await apiGet<PaymentsResult>(`/api/finance/payments?${params}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, [from, to, method]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "posted":
        return <GlassBadge variant="success">Posted</GlassBadge>;
      case "void":
        return <GlassBadge variant="danger">Void</GlassBadge>;
      default:
        return <GlassBadge variant="warning">Draft</GlassBadge>;
    }
  };

  const getTypeBadge = (type: string) => {
    return type === "receipt" ? (
      <GlassBadge variant="info">Receipt</GlassBadge>
    ) : (
      <GlassBadge variant="default">Payment</GlassBadge>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Cash receipts and disbursements"
        actions={
          <GlassButton variant="primary" onClick={() => alert("Create payment: Not implemented in this layer")}>
            + New Payment
          </GlassButton>
        }
      />

      {/* Filters */}
      <GlassCard padding="sm">
        <div className="flex flex-wrap items-end gap-4">
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
          <div className="w-32">
            <GlassSelect
              label="Method"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              options={[
                { value: "", label: "All" },
                { value: "cash", label: "Cash" },
                { value: "bank", label: "Bank" },
              ]}
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

      {/* Table */}
      {data && (
        <GlassCard padding="none">
          <GlassTable
            headers={["Date", "Reference", "Type", "Method", "Status", "Amount", ""]}
            rightAlignColumns={[5]}
            rows={data.items.map((p) => [
              formatDate(p.paymentDate),
              p.reference || "-",
              getTypeBadge(p.type),
              p.method,
              getStatusBadge(p.status),
              formatCurrency(parseFloat(p.amount)),
              <Link
                key={p.id}
                href={`/finance/payments/${p.id}`}
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                View
              </Link>,
            ])}
            emptyMessage="No payments found"
          />
        </GlassCard>
      )}
    </div>
  );
}
