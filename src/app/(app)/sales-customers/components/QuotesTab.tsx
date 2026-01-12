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
import { apiGet, apiPost, apiPut, formatCurrency, formatDate } from "@/lib/http";
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
  sent: "warning",
  accepted: "success",
  rejected: "danger",
  expired: "default",
};

export function QuotesTab() {
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const [quotes, setQuotes] = React.useState<SalesDoc[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState(searchParams.get("status") || "");
  const [search, setSearch] = React.useState("");

  // SlideOver states
  const [selectedQuote, setSelectedQuote] = React.useState<SalesDoc | null>(null);
  const [viewOpen, setViewOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editMode, setEditMode] = React.useState(false);

  // Form data
  const [formData, setFormData] = React.useState({
    partyId: "",
    docDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    subtotal: "",
    discountAmount: "0",
    taxAmount: "0",
    notes: "",
  });

  const loadQuotes = React.useCallback(async () => {
    try {
      setLoading(true);
      let url = "/api/sales/docs?docType=quote";
      if (statusFilter) {
        url += `&status=${statusFilter}`;
      }
      const [quotesData, customersData] = await Promise.all([
        apiGet<SalesDocsResponse>(url),
        apiGet<CustomersResponse>("/api/sales-customers/customers"),
      ]);
      setQuotes(quotesData.items || []);
      setCustomers(customersData.items || []);
    } catch {
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  React.useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  const filteredQuotes = React.useMemo(() => {
    if (!search.trim()) return quotes;
    const lowerSearch = search.toLowerCase();
    return quotes.filter(
      (q) =>
        q.docNumber.toLowerCase().includes(lowerSearch) ||
        q.partyName?.toLowerCase().includes(lowerSearch)
    );
  }, [quotes, search]);

  // Enrich quotes with customer names
  const enrichedQuotes = React.useMemo(() => {
    const customerMap = new Map(customers.map((c) => [c.id, c.name]));
    return filteredQuotes.map((q) => ({
      ...q,
      partyName: customerMap.get(q.partyId) || q.partyName || "Unknown",
    }));
  }, [filteredQuotes, customers]);

  const handleViewQuote = (quote: SalesDoc) => {
    setSelectedQuote(quote);
    setEditMode(false);
    setViewOpen(true);
  };

  const generateQuoteNumber = () => {
    return `QT-${Date.now().toString(36).toUpperCase()}`;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const subtotal = parseFloat(formData.subtotal) || 0;
      const discount = parseFloat(formData.discountAmount) || 0;
      const tax = parseFloat(formData.taxAmount) || 0;
      const total = subtotal - discount + tax;

      await apiPost("/api/sales/docs", {
        docType: "quote",
        docNumber: generateQuoteNumber(),
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
      addToast("success", "Quote created successfully");
      loadQuotes();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to create quote");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuote) return;
    try {
      const subtotal = parseFloat(formData.subtotal) || 0;
      const discount = parseFloat(formData.discountAmount) || 0;
      const tax = parseFloat(formData.taxAmount) || 0;
      const total = subtotal - discount + tax;

      await apiPut(`/api/sales/docs/${selectedQuote.id}`, {
        partyId: formData.partyId,
        dueDate: formData.dueDate || null,
        subtotal: subtotal.toString(),
        discountAmount: discount.toString(),
        taxAmount: tax.toString(),
        totalAmount: total.toString(),
        notes: formData.notes || null,
      });

      setEditMode(false);
      addToast("success", "Quote updated successfully");
      loadQuotes();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to update quote");
    }
  };

  const startEdit = () => {
    if (selectedQuote) {
      setFormData({
        partyId: selectedQuote.partyId,
        docDate: selectedQuote.docDate,
        dueDate: selectedQuote.dueDate || "",
        subtotal: selectedQuote.subtotal,
        discountAmount: selectedQuote.discountAmount,
        taxAmount: selectedQuote.taxAmount,
        notes: selectedQuote.notes || "",
      });
      setEditMode(true);
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

  const headers = ["Quote #", "Date", "Customer", "Status", "Amount", ""];

  const rows = enrichedQuotes.map((q) => [
    q.docNumber,
    formatDate(q.docDate),
    q.partyName || "—",
    <GlassBadge key={q.id} variant={STATUS_VARIANTS[q.status] || "default"}>
      {q.status.charAt(0).toUpperCase() + q.status.slice(1)}
    </GlassBadge>,
    formatCurrency(parseFloat(q.totalAmount)),
    <button
      key={`view-${q.id}`}
      onClick={() => handleViewQuote(q)}
      className="text-blue-400 hover:text-blue-300 text-sm"
    >
      View
    </button>,
  ]);

  return (
    <div className="space-y-4">
      {/* Actions Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex-1 max-w-md">
            <GlassInput
              placeholder="Search quotes..."
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
              { value: "sent", label: "Sent" },
              { value: "accepted", label: "Accepted" },
              { value: "rejected", label: "Rejected" },
              { value: "expired", label: "Expired" },
            ]}
          />
        </div>
        <GlassButton variant="primary" onClick={openCreate}>
          Create Quote
        </GlassButton>
      </div>

      {/* Quote List */}
      {enrichedQuotes.length > 0 ? (
        <GlassTable headers={headers} rows={rows} />
      ) : (
        <GlassCard>
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-purple-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              {search || statusFilter ? "No Quotes Found" : "No Quotes Yet"}
            </h3>
            <p className="text-white/50 mb-4">
              {search || statusFilter ? "Try a different filter." : "Create your first quote to get started."}
            </p>
            {!search && !statusFilter && (
              <GlassButton variant="primary" onClick={openCreate}>
                Create Quote
              </GlassButton>
            )}
          </div>
        </GlassCard>
      )}

      {/* View/Edit Quote SlideOver */}
      <SlideOver
        open={viewOpen}
        onClose={() => {
          setViewOpen(false);
          setSelectedQuote(null);
          setEditMode(false);
        }}
        title={editMode ? "Edit Quote" : "Quote Details"}
      >
        {selectedQuote && !editMode && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white">{selectedQuote.docNumber}</h3>
              <GlassBadge variant={STATUS_VARIANTS[selectedQuote.status] || "default"}>
                {selectedQuote.status.charAt(0).toUpperCase() + selectedQuote.status.slice(1)}
              </GlassBadge>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/50 uppercase tracking-wide">Customer</label>
                <p className="text-white">
                  {customers.find((c) => c.id === selectedQuote.partyId)?.name || "Unknown"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-wide">Date</label>
                  <p className="text-white">{formatDate(selectedQuote.docDate)}</p>
                </div>
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-wide">Valid Until</label>
                  <p className="text-white">{selectedQuote.dueDate ? formatDate(selectedQuote.dueDate) : "—"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-wide">Subtotal</label>
                  <p className="text-white">{formatCurrency(parseFloat(selectedQuote.subtotal))}</p>
                </div>
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-wide">Discount</label>
                  <p className="text-white">-{formatCurrency(parseFloat(selectedQuote.discountAmount))}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-wide">Tax</label>
                  <p className="text-white">+{formatCurrency(parseFloat(selectedQuote.taxAmount))}</p>
                </div>
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-wide">Total</label>
                  <p className="text-xl font-bold text-emerald-400">
                    {formatCurrency(parseFloat(selectedQuote.totalAmount))}
                  </p>
                </div>
              </div>
              {selectedQuote.notes && (
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-wide">Notes</label>
                  <p className="text-white">{selectedQuote.notes}</p>
                </div>
              )}
            </div>

            {selectedQuote.status === "draft" && (
              <div className="pt-4 border-t border-white/10">
                <GlassButton variant="primary" onClick={startEdit} className="w-full">
                  Edit Quote
                </GlassButton>
              </div>
            )}
          </div>
        )}

        {selectedQuote && editMode && (
          <form onSubmit={handleUpdate} className="space-y-4">
            <CustomerSelector
              customers={customers}
              value={formData.partyId}
              onChange={(id) => setFormData({ ...formData, partyId: id })}
              onCustomerCreated={() => loadQuotes()}
            />
            <GlassInput
              label="Valid Until"
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
              <GlassButton type="button" variant="ghost" onClick={() => setEditMode(false)} className="flex-1">
                Cancel
              </GlassButton>
              <GlassButton type="submit" variant="primary" className="flex-1">
                Save Changes
              </GlassButton>
            </div>
          </form>
        )}
      </SlideOver>

      {/* Create Quote SlideOver */}
      <SlideOver
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Quote"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <CustomerSelector
            customers={customers}
            value={formData.partyId}
            onChange={(id) => setFormData({ ...formData, partyId: id })}
            onCustomerCreated={() => loadQuotes()}
          />
          <GlassInput
            label="Quote Date"
            type="date"
            value={formData.docDate}
            onChange={(e) => setFormData({ ...formData, docDate: e.target.value })}
            required
          />
          <GlassInput
            label="Valid Until"
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
              Create Quote
            </GlassButton>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
