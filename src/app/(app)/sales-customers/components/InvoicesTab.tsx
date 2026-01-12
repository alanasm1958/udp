"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  GlassCard,
  GlassTable,
  GlassBadge,
  GlassInput,
  GlassButton,
  GlassSelect,
  SlideOver,
  Spinner,
  useToast,
} from "@/components/ui/glass";
import { apiGet, apiPost, formatCurrency, formatDate } from "@/lib/http";
import { CustomerSelector } from "./CustomerSelector";

interface SalesDoc {
  id: string;
  docNumber: string;
  docType: string;
  docDate: string;
  dueDate: string | null;
  partyId: string;
  partyName?: string;
  status: string;
  totalAmount: string;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  notes: string | null;
}

interface SalesDocsResponse {
  items: SalesDoc[];
  total: number;
}

interface Customer {
  id: string;
  name: string;
  code: string;
}

interface CustomersResponse {
  items: Customer[];
}

const STATUS_VARIANTS: Record<string, "default" | "success" | "warning" | "danger"> = {
  draft: "default",
  posted: "success",
  fulfilled: "success",
  partially_fulfilled: "warning",
  cancelled: "danger",
};

export function InvoicesTab() {
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const [invoices, setInvoices] = React.useState<SalesDoc[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState(searchParams.get("status") || "");
  const [periodFilter, setPeriodFilter] = React.useState(searchParams.get("period") || "");
  const [search, setSearch] = React.useState("");

  // SlideOver states
  const [selectedInvoice, setSelectedInvoice] = React.useState<SalesDoc | null>(null);
  const [viewOpen, setViewOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);

  // Form data for create
  const [formData, setFormData] = React.useState({
    partyId: "",
    docDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    subtotal: "",
    discountAmount: "0",
    taxAmount: "0",
    notes: "",
  });

  const loadInvoices = React.useCallback(async () => {
    try {
      setLoading(true);
      let url = "/api/sales/docs?docType=invoice";
      if (statusFilter) {
        url += `&status=${statusFilter}`;
      }
      if (periodFilter === "mtd") {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
        url += `&fromDate=${startOfMonth}`;
      }
      const [invoicesData, customersData] = await Promise.all([
        apiGet<SalesDocsResponse>(url),
        apiGet<CustomersResponse>("/api/sales-customers/customers"),
      ]);
      setInvoices(invoicesData.items || []);
      setCustomers(customersData.items || []);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, periodFilter]);

  React.useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const filteredInvoices = React.useMemo(() => {
    if (!search.trim()) return invoices;
    const lowerSearch = search.toLowerCase();
    return invoices.filter(
      (i) =>
        i.docNumber.toLowerCase().includes(lowerSearch) ||
        i.partyName?.toLowerCase().includes(lowerSearch)
    );
  }, [invoices, search]);

  // Enrich invoices with customer names
  const enrichedInvoices = React.useMemo(() => {
    const customerMap = new Map(customers.map((c) => [c.id, c.name]));
    return filteredInvoices.map((i) => ({
      ...i,
      partyName: customerMap.get(i.partyId) || i.partyName || "Unknown",
    }));
  }, [filteredInvoices, customers]);

  // Calculate totals
  const totalAmount = enrichedInvoices.reduce((sum, i) => sum + parseFloat(i.totalAmount), 0);
  const postedCount = enrichedInvoices.filter((i) => i.status === "posted").length;

  const handleViewInvoice = (invoice: SalesDoc) => {
    setSelectedInvoice(invoice);
    setViewOpen(true);
  };

  const generateInvoiceNumber = () => {
    return `INV-${Date.now().toString(36).toUpperCase()}`;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const subtotal = parseFloat(formData.subtotal) || 0;
      const discount = parseFloat(formData.discountAmount) || 0;
      const tax = parseFloat(formData.taxAmount) || 0;
      const total = subtotal - discount + tax;

      await apiPost("/api/sales/docs", {
        docType: "invoice",
        docNumber: generateInvoiceNumber(),
        partyId: formData.partyId,
        docDate: formData.docDate,
        dueDate: formData.dueDate || null,
        subtotal: subtotal.toString(),
        discountAmount: discount.toString(),
        taxAmount: tax.toString(),
        totalAmount: total.toString(),
        notes: formData.notes || null,
      });

      setCreateOpen(false);
      resetForm();
      addToast("success", "Invoice created as draft. Post it to create AR entries.");
      loadInvoices();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to create invoice");
    }
  };

  const resetForm = () => {
    setFormData({
      partyId: "",
      docDate: new Date().toISOString().split("T")[0],
      dueDate: "",
      subtotal: "",
      discountAmount: "0",
      taxAmount: "0",
      notes: "",
    });
  };

  const openCreate = () => {
    resetForm();
    setCreateOpen(true);
  };

  // Build customer options
  const customerOptions = React.useMemo(() => {
    return [
      { value: "", label: "Select customer..." },
      ...customers.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` })),
    ];
  }, [customers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const headers = ["Invoice #", "Date", "Due Date", "Customer", "Status", "Amount", ""];

  const rows = enrichedInvoices.map((i) => [
    i.docNumber,
    formatDate(i.docDate),
    i.dueDate ? formatDate(i.dueDate) : "—",
    i.partyName || "—",
    <GlassBadge key={i.id} variant={STATUS_VARIANTS[i.status] || "default"}>
      {i.status.replace("_", " ").charAt(0).toUpperCase() + i.status.replace("_", " ").slice(1)}
    </GlassBadge>,
    formatCurrency(parseFloat(i.totalAmount)),
    <button
      key={`view-${i.id}`}
      onClick={() => handleViewInvoice(i)}
      className="text-blue-400 hover:text-blue-300 text-sm"
    >
      View
    </button>,
  ]);

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard padding="sm">
          <p className="text-xs text-white/50 uppercase">Total Invoices</p>
          <p className="text-2xl font-bold text-white">{enrichedInvoices.length}</p>
        </GlassCard>
        <GlassCard padding="sm">
          <p className="text-xs text-white/50 uppercase">Posted</p>
          <p className="text-2xl font-bold text-emerald-400">{postedCount}</p>
        </GlassCard>
        <GlassCard padding="sm">
          <p className="text-xs text-white/50 uppercase">Total Amount</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(totalAmount)}</p>
        </GlassCard>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex-1 max-w-md">
            <GlassInput
              placeholder="Search invoices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <GlassSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "", label: "All Statuses" },
              { value: "draft", label: "Draft" },
              { value: "posted", label: "Posted" },
              { value: "fulfilled", label: "Fulfilled" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />
          <GlassSelect
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            options={[
              { value: "", label: "All Time" },
              { value: "mtd", label: "This Month" },
            ]}
          />
        </div>
        <GlassButton variant="primary" onClick={openCreate}>
          Create Invoice
        </GlassButton>
      </div>

      {/* Invoice List */}
      {enrichedInvoices.length > 0 ? (
        <GlassTable headers={headers} rows={rows} />
      ) : (
        <GlassCard>
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              {search || statusFilter || periodFilter ? "No Invoices Found" : "No Invoices Yet"}
            </h3>
            <p className="text-white/50 mb-4">
              {search || statusFilter || periodFilter ? "Try a different filter." : "Create your first invoice to get started."}
            </p>
            {!search && !statusFilter && !periodFilter && (
              <GlassButton variant="primary" onClick={openCreate}>
                Create Invoice
              </GlassButton>
            )}
          </div>
        </GlassCard>
      )}

      {/* View Invoice SlideOver (Read-only for posted) */}
      <SlideOver
        open={viewOpen}
        onClose={() => {
          setViewOpen(false);
          setSelectedInvoice(null);
        }}
        title="Invoice Details"
      >
        {selectedInvoice && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">{selectedInvoice.docNumber}</h3>
                <p className="text-white/50 text-sm">
                  {customers.find((c) => c.id === selectedInvoice.partyId)?.name || "Unknown"}
                </p>
              </div>
              <GlassBadge variant={STATUS_VARIANTS[selectedInvoice.status] || "default"}>
                {selectedInvoice.status.replace("_", " ").charAt(0).toUpperCase() + selectedInvoice.status.replace("_", " ").slice(1)}
              </GlassBadge>
            </div>

            <div className="p-4 rounded-lg bg-white/5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-wide">Invoice Date</label>
                  <p className="text-white">{formatDate(selectedInvoice.docDate)}</p>
                </div>
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-wide">Due Date</label>
                  <p className="text-white">{selectedInvoice.dueDate ? formatDate(selectedInvoice.dueDate) : "—"}</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-white/5 space-y-3">
              <div className="flex justify-between">
                <span className="text-white/50">Subtotal</span>
                <span className="text-white">{formatCurrency(parseFloat(selectedInvoice.subtotal))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Discount</span>
                <span className="text-white">-{formatCurrency(parseFloat(selectedInvoice.discountAmount))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Tax</span>
                <span className="text-white">+{formatCurrency(parseFloat(selectedInvoice.taxAmount))}</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-white/10">
                <span className="text-white font-medium">Total</span>
                <span className="text-xl font-bold text-emerald-400">
                  {formatCurrency(parseFloat(selectedInvoice.totalAmount))}
                </span>
              </div>
            </div>

            {selectedInvoice.notes && (
              <div>
                <label className="text-xs text-white/50 uppercase tracking-wide">Notes</label>
                <p className="text-white">{selectedInvoice.notes}</p>
              </div>
            )}

            {selectedInvoice.status !== "draft" && (
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-sm text-amber-400">
                  This invoice has been posted and cannot be edited. Financial transactions have been recorded.
                </p>
              </div>
            )}
          </div>
        )}
      </SlideOver>

      {/* Create Invoice SlideOver */}
      <SlideOver
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Invoice"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 mb-4">
            <p className="text-sm text-blue-400">
              Invoices will be created as drafts. Post them to create AR entries and record financial transactions.
            </p>
          </div>

          <CustomerSelector
            customers={customers}
            value={formData.partyId}
            onChange={(id) => setFormData({ ...formData, partyId: id })}
            onCustomerCreated={() => loadInvoices()}
          />
          <GlassInput
            label="Invoice Date"
            type="date"
            value={formData.docDate}
            onChange={(e) => setFormData({ ...formData, docDate: e.target.value })}
            required
          />
          <GlassInput
            label="Due Date"
            type="date"
            value={formData.dueDate}
            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
          />
          <GlassInput
            label="Subtotal"
            type="number"
            step="0.01"
            value={formData.subtotal}
            onChange={(e) => setFormData({ ...formData, subtotal: e.target.value })}
            placeholder="0.00"
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <GlassInput
              label="Discount"
              type="number"
              step="0.01"
              value={formData.discountAmount}
              onChange={(e) => setFormData({ ...formData, discountAmount: e.target.value })}
              placeholder="0.00"
            />
            <GlassInput
              label="Tax"
              type="number"
              step="0.01"
              value={formData.taxAmount}
              onChange={(e) => setFormData({ ...formData, taxAmount: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <GlassInput
            label="Notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Additional notes..."
          />

          <div className="pt-4 flex gap-3">
            <GlassButton type="button" variant="ghost" onClick={() => setCreateOpen(false)} className="flex-1">
              Cancel
            </GlassButton>
            <GlassButton type="submit" variant="primary" className="flex-1">
              Create Invoice
            </GlassButton>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
