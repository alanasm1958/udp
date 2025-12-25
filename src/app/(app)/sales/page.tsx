"use client";

import * as React from "react";
import Link from "next/link";
import {
  GlassCard,
  GlassButton,
  GlassTable,
  GlassSelect,
  GlassBadge,
  PageHeader,
  Spinner,
} from "@/components/ui/glass";
import { apiGet, formatCurrency, formatDate } from "@/lib/http";

interface SalesDoc {
  id: string;
  docType: string;
  docNumber: string;
  docDate: string;
  partyId: string;
  partyName?: string;
  currency: string;
  totalAmount: string;
  status: string;
}

interface SalesDocsResult {
  items: SalesDoc[];
}

export default function SalesPage() {
  const [docType, setDocType] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [data, setData] = React.useState<SalesDocsResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (docType) params.set("docType", docType);
      if (status) params.set("status", status);
      const result = await apiGet<SalesDocsResult>(`/api/sales/docs?${params}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sales documents");
    } finally {
      setLoading(false);
    }
  }, [docType, status]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "posted":
        return <GlassBadge variant="success">Posted</GlassBadge>;
      case "draft":
        return <GlassBadge variant="warning">Draft</GlassBadge>;
      case "fulfilled":
        return <GlassBadge variant="info">Fulfilled</GlassBadge>;
      case "partially_fulfilled":
        return <GlassBadge variant="default">Partial</GlassBadge>;
      case "cancelled":
        return <GlassBadge variant="danger">Cancelled</GlassBadge>;
      default:
        return <GlassBadge>{s}</GlassBadge>;
    }
  };

  const getTypeBadge = (t: string) => {
    switch (t) {
      case "invoice":
        return <GlassBadge variant="success">Invoice</GlassBadge>;
      case "order":
        return <GlassBadge variant="info">Order</GlassBadge>;
      case "quote":
        return <GlassBadge variant="default">Quote</GlassBadge>;
      default:
        return <GlassBadge>{t}</GlassBadge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales"
        description="Quotes, orders, and invoices"
        actions={
          <GlassButton variant="primary" onClick={() => alert("Create document: Not implemented in this layer")}>
            + New Document
          </GlassButton>
        }
      />

      {/* Filters */}
      <GlassCard padding="sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-40">
            <GlassSelect
              label="Type"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              options={[
                { value: "", label: "All" },
                { value: "quote", label: "Quote" },
                { value: "order", label: "Order" },
                { value: "invoice", label: "Invoice" },
              ]}
            />
          </div>
          <div className="w-40">
            <GlassSelect
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { value: "", label: "All" },
                { value: "draft", label: "Draft" },
                { value: "posted", label: "Posted" },
                { value: "fulfilled", label: "Fulfilled" },
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
            headers={["Doc #", "Date", "Type", "Status", "Amount", ""]}
            monospaceColumns={[0]}
            rightAlignColumns={[4]}
            rows={data.items.map((doc) => [
              doc.docNumber,
              formatDate(doc.docDate),
              getTypeBadge(doc.docType),
              getStatusBadge(doc.status),
              formatCurrency(parseFloat(doc.totalAmount)),
              <Link
                key={doc.id}
                href={`/sales/${doc.id}`}
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                View
              </Link>,
            ])}
            emptyMessage="No documents found"
          />
        </GlassCard>
      )}
    </div>
  );
}
