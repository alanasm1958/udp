"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  GlassCard,
  GlassButton,
  GlassTable,
  GlassSelect,
  GlassInput,
  GlassBadge,
  PageHeader,
  Spinner,
  SkeletonTable,
  SlideOver,
  ErrorAlert,
  useToast,
} from "@/components/ui/glass";
import { formatCurrency, formatDate } from "@/lib/http";

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

interface Party {
  id: string;
  name: string;
  type: "customer" | "vendor" | "employee" | "other";
}

export default function SalesPage() {
  return (
    <Suspense fallback={<div className="p-6"><SkeletonTable rows={6} columns={7} /></div>}>
      <SalesContent />
    </Suspense>
  );
}

function SalesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();

  // Filters
  const [docType, setDocType] = React.useState(searchParams.get("docType") || "");
  const [status, setStatus] = React.useState(searchParams.get("status") || "");

  // Data
  const [docs, setDocs] = React.useState<SalesDoc[]>([]);
  const [parties, setParties] = React.useState<Party[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Create form
  const [createOpen, setCreateOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [formData, setFormData] = React.useState({
    docType: "invoice" as "quote" | "order" | "invoice",
    docNumber: "",
    partyId: "",
    docDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    notes: "",
  });

  // Generate doc number
  const generateDocNumber = (type: string) => {
    const prefix = type === "quote" ? "QT" : type === "order" ? "SO" : "INV";
    return `${prefix}-${Date.now().toString().slice(-6)}`;
  };

  // Load data
  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (docType) params.set("docType", docType);
      if (status) params.set("status", status);

      const res = await fetch(`/api/sales/docs?${params}`);
      if (!res.ok) throw new Error("Failed to load sales documents");
      const data = await res.json();
      setDocs(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [docType, status]);

  // Load parties (customers)
  const loadParties = React.useCallback(async () => {
    try {
      const res = await fetch("/api/master/parties?type=customer&limit=100");
      if (res.ok) {
        const data = await res.json();
        setParties(data.items || []);
      }
    } catch {
      // Silently fail
    }
  }, []);

  React.useEffect(() => {
    loadData();
    loadParties();
  }, [loadData, loadParties]);

  // Update URL
  const applyFilters = () => {
    const params = new URLSearchParams();
    if (docType) params.set("docType", docType);
    if (status) params.set("status", status);
    router.push(`/sales?${params.toString()}`);
    loadData();
  };

  // Create document
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch("/api/sales/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docType: formData.docType,
          docNumber: formData.docNumber || generateDocNumber(formData.docType),
          partyId: formData.partyId,
          docDate: formData.docDate,
          dueDate: formData.dueDate || undefined,
          notes: formData.notes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create document");
      }

      const doc = await res.json();
      addToast("success", "Document created successfully");
      setCreateOpen(false);
      setFormData({
        docType: "invoice",
        docNumber: "",
        partyId: "",
        docDate: new Date().toISOString().split("T")[0],
        dueDate: "",
        notes: "",
      });
      // Navigate to the new document
      router.push(`/sales/${doc.id}`);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to create document");
    } finally {
      setCreating(false);
    }
  };

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
          <GlassButton variant="primary" onClick={() => setCreateOpen(true)}>
            + New Document
          </GlassButton>
        }
      />

      {/* Filters */}
      <GlassCard padding="sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-36">
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
          <div className="w-36">
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
          <GlassButton onClick={applyFilters} disabled={loading}>
            {loading ? <Spinner size="sm" /> : "Search"}
          </GlassButton>
        </div>
      </GlassCard>

      {/* Error */}
      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* Table */}
      <GlassCard padding="none">
        {loading ? (
          <div className="p-6">
            <SkeletonTable rows={6} columns={6} />
          </div>
        ) : (
          <GlassTable
            headers={["Doc #", "Date", "Customer", "Type", "Status", "Amount", ""]}
            monospaceColumns={[0]}
            rightAlignColumns={[5]}
            rows={docs.map((doc) => [
              doc.docNumber,
              formatDate(doc.docDate),
              doc.partyName || "-",
              getTypeBadge(doc.docType),
              getStatusBadge(doc.status),
              formatCurrency(parseFloat(doc.totalAmount || "0")),
              <Link
                key={doc.id}
                href={`/sales/${doc.id}`}
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                View
              </Link>,
            ])}
            emptyMessage="No sales documents found. Create your first quote or invoice to get started."
          />
        )}
      </GlassCard>

      {/* Create SlideOver */}
      <SlideOver
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Sales Document"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <GlassSelect
            label="Document Type"
            value={formData.docType}
            onChange={(e) => setFormData({ ...formData, docType: e.target.value as "quote" | "order" | "invoice" })}
            options={[
              { value: "quote", label: "Quote" },
              { value: "order", label: "Sales Order" },
              { value: "invoice", label: "Invoice" },
            ]}
          />

          <GlassInput
            label="Document Number (auto-generated if empty)"
            value={formData.docNumber}
            onChange={(e) => setFormData({ ...formData, docNumber: e.target.value })}
            placeholder={generateDocNumber(formData.docType)}
          />

          <GlassSelect
            label="Customer"
            value={formData.partyId}
            onChange={(e) => setFormData({ ...formData, partyId: e.target.value })}
            options={[
              { value: "", label: "Select customer..." },
              ...parties.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
          {parties.length === 0 && (
            <p className="text-xs text-white/50">No customers found. Create a customer in Master Data first.</p>
          )}

          <GlassInput
            label="Document Date"
            type="date"
            value={formData.docDate}
            onChange={(e) => setFormData({ ...formData, docDate: e.target.value })}
            required
          />

          <GlassInput
            label="Due Date (Optional)"
            type="date"
            value={formData.dueDate}
            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
          />

          <GlassInput
            label="Notes (Optional)"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Internal notes"
          />

          <div className="pt-4 flex gap-3">
            <GlassButton
              type="button"
              variant="ghost"
              onClick={() => setCreateOpen(false)}
              className="flex-1"
            >
              Cancel
            </GlassButton>
            <GlassButton
              type="submit"
              variant="primary"
              disabled={creating || !formData.partyId}
              className="flex-1"
            >
              {creating ? <Spinner size="sm" /> : "Create Document"}
            </GlassButton>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
