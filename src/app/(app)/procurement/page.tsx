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

interface PurchaseDoc {
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

export default function ProcurementPage() {
  return (
    <Suspense fallback={<div className="p-6"><SkeletonTable rows={6} columns={7} /></div>}>
      <ProcurementContent />
    </Suspense>
  );
}

function ProcurementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();

  // Filters - sync with URL
  const docType = searchParams.get("docType") || "";
  const status = searchParams.get("status") || "";

  // Data
  const [docs, setDocs] = React.useState<PurchaseDoc[]>([]);
  const [parties, setParties] = React.useState<Party[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Create form
  const [createOpen, setCreateOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [formData, setFormData] = React.useState({
    docType: "order" as "rfq" | "order" | "invoice",
    docNumber: "",
    partyId: "",
    docDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    notes: "",
  });

  // Generate doc number
  const generateDocNumber = (type: string) => {
    const prefix = type === "rfq" ? "RFQ" : type === "order" ? "PO" : "PINV";
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

      const res = await fetch(`/api/procurement/docs?${params}`);
      if (!res.ok) throw new Error("Failed to load purchase documents");
      const data = await res.json();
      setDocs(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [docType, status]);

  // Load parties (vendors)
  const loadParties = React.useCallback(async () => {
    try {
      const res = await fetch("/api/master/parties?type=vendor&limit=100");
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

  // Handle create param from URL (Quick Action from Dashboard)
  React.useEffect(() => {
    const createParam = searchParams.get("create");
    if (createParam) {
      // Pre-set the doc type if specified
      if (createParam === "invoice" || createParam === "order" || createParam === "rfq") {
        setFormData((prev) => ({ ...prev, docType: createParam as "invoice" | "order" | "rfq" }));
      }
      setCreateOpen(true);
      // Clear the param from URL without reloading
      const params = new URLSearchParams(searchParams.toString());
      params.delete("create");
      const newUrl = params.toString() ? `/procurement?${params.toString()}` : "/procurement";
      router.replace(newUrl, { scroll: false });
    }
  }, [searchParams, router]);

  // Update URL (filters auto-reload via useEffect)
  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/procurement?${params.toString()}`);
  };

  // Create document
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch("/api/procurement/docs", {
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
      addToast("success", "Purchase document created successfully");
      setCreateOpen(false);
      setFormData({
        docType: "order",
        docNumber: "",
        partyId: "",
        docDate: new Date().toISOString().split("T")[0],
        dueDate: "",
        notes: "",
      });
      // Navigate to the new document
      router.push(`/procurement/${doc.id}`);
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
        return <GlassBadge variant="info">Received</GlassBadge>;
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
        return <GlassBadge variant="info">PO</GlassBadge>;
      case "rfq":
        return <GlassBadge variant="default">RFQ</GlassBadge>;
      default:
        return <GlassBadge>{t}</GlassBadge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Procurement"
        description="RFQs, purchase orders, and invoices"
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
              onChange={(e) => updateFilter("docType", e.target.value)}
              options={[
                { value: "", label: "All" },
                { value: "rfq", label: "RFQ" },
                { value: "order", label: "PO" },
                { value: "invoice", label: "Invoice" },
              ]}
            />
          </div>
          <div className="w-36">
            <GlassSelect
              label="Status"
              value={status}
              onChange={(e) => updateFilter("status", e.target.value)}
              options={[
                { value: "", label: "All" },
                { value: "draft", label: "Draft" },
                { value: "posted", label: "Posted" },
                { value: "fulfilled", label: "Received" },
              ]}
            />
          </div>
          {loading && <Spinner size="sm" />}
        </div>
      </GlassCard>

      {/* Error */}
      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* Stats */}
      {!loading && !error && docs.length > 0 && (
        <div className="flex gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
            <span className="text-white/50 text-xs">Total</span>
            <span className="ml-2 text-white font-medium">{docs.length}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <span className="text-amber-400/70 text-xs">Draft</span>
            <span className="ml-2 text-amber-400 font-medium">
              {docs.filter((d) => d.status === "draft").length}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-emerald-400/70 text-xs">Posted</span>
            <span className="ml-2 text-emerald-400 font-medium">
              {docs.filter((d) => d.status === "posted").length}
            </span>
          </div>
        </div>
      )}

      {/* Table */}
      <GlassCard padding="none">
        {loading ? (
          <div className="p-6">
            <SkeletonTable rows={6} columns={7} />
          </div>
        ) : (
          <GlassTable
            headers={["Doc #", "Date", "Vendor", "Type", "Status", "Amount", ""]}
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
                href={`/procurement/${doc.id}`}
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                View
              </Link>,
            ])}
            emptyMessage="No purchase documents found. Create your first purchase order to get started."
          />
        )}
      </GlassCard>

      {/* Create SlideOver */}
      <SlideOver
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Purchase Document"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <GlassSelect
            label="Document Type"
            value={formData.docType}
            onChange={(e) => setFormData({ ...formData, docType: e.target.value as "rfq" | "order" | "invoice" })}
            options={[
              { value: "rfq", label: "Request for Quote" },
              { value: "order", label: "Purchase Order" },
              { value: "invoice", label: "Purchase Invoice" },
            ]}
          />

          <GlassInput
            label="Document Number (auto-generated if empty)"
            value={formData.docNumber}
            onChange={(e) => setFormData({ ...formData, docNumber: e.target.value })}
            placeholder={generateDocNumber(formData.docType)}
          />

          <GlassSelect
            label="Vendor"
            value={formData.partyId}
            onChange={(e) => setFormData({ ...formData, partyId: e.target.value })}
            options={[
              { value: "", label: "Select vendor..." },
              ...parties.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
          {parties.length === 0 && (
            <p className="text-xs text-white/50">No vendors found. Create a vendor in Master Data first.</p>
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
