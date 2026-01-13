"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  GlassCard,
  GlassTable,
  GlassButton,
  GlassSelect,
  GlassInput,
  GlassBadge,
  PageHeader,
} from "@/components/ui/glass";
import { Send, Download, Eye, Search } from "lucide-react";

interface Invoice {
  id: string;
  docNumber: string;
  partyName: string;
  docDate: string;
  dueDate: string;
  totalAmount: string;
  paidAmount: string;
  status: string;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const loadInvoices = async () => {
    try {
      setIsLoading(true);
      let url = "/api/sales/docs?type=invoice&limit=100";
      if (statusFilter) {
        url += `&status=${statusFilter}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.docs || []);
      }
    } catch (error) {
      console.error("Error loading invoices:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <GlassBadge variant="default">Draft</GlassBadge>;
      case "posted":
        return <GlassBadge variant="info">Posted</GlassBadge>;
      case "partial":
        return <GlassBadge variant="warning">Partial</GlassBadge>;
      case "paid":
        return <GlassBadge variant="success">Paid</GlassBadge>;
      case "cancelled":
      case "void":
        return <GlassBadge variant="danger">{status === "void" ? "Void" : "Cancelled"}</GlassBadge>;
      default:
        return <GlassBadge>{status}</GlassBadge>;
    }
  };

  const getRemainingAmount = (invoice: Invoice) => {
    const total = parseFloat(invoice.totalAmount || "0");
    const paid = parseFloat(invoice.paidAmount || "0");
    return total - paid;
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      inv.docNumber.toLowerCase().includes(query) ||
      inv.partyName?.toLowerCase().includes(query)
    );
  });

  // Build table headers and rows for GlassTable
  const headers = ["Invoice #", "Customer", "Date", "Due Date", "Total", "Remaining", "Status", "Actions"];

  const rows: React.ReactNode[][] = filteredInvoices.map((row) => {
    const remaining = getRemainingAmount(row);
    return [
      <Link key="num" href={`/finance/invoices/${row.id}`} className="text-blue-400 hover:text-blue-300 font-medium">
        {row.docNumber}
      </Link>,
      row.partyName || "-",
      new Date(row.docDate).toLocaleDateString(),
      row.dueDate ? new Date(row.dueDate).toLocaleDateString() : "-",
      `$${parseFloat(row.totalAmount).toLocaleString()}`,
      remaining > 0 ? (
        <span key="rem" className="text-amber-400">${remaining.toLocaleString()}</span>
      ) : (
        <span key="rem" className="text-emerald-400">Paid</span>
      ),
      getStatusBadge(row.status),
      <div key="actions" className="flex gap-2">
        <Link href={`/finance/invoices/${row.id}`}>
          <GlassButton size="sm" variant="ghost" title="View">
            <Eye className="w-4 h-4" />
          </GlassButton>
        </Link>
        <GlassButton size="sm" variant="ghost" title="Download PDF">
          <Download className="w-4 h-4" />
        </GlassButton>
        {row.status !== "paid" && row.status !== "cancelled" && (
          <GlassButton size="sm" variant="ghost" title="Send Reminder">
            <Send className="w-4 h-4" />
          </GlassButton>
        )}
      </div>,
    ];
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Invoices"
        description="View and manage customer invoices"
      />

      {/* Filters */}
      <GlassCard padding="sm">
        <div className="flex gap-4 items-end">
          <div className="flex-1 max-w-xs">
            <GlassInput
              label="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Invoice # or customer..."
            />
          </div>
          <div className="w-48">
            <GlassSelect
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "", label: "All Statuses" },
                { value: "draft", label: "Draft" },
                { value: "posted", label: "Posted" },
                { value: "partial", label: "Partial Payment" },
                { value: "paid", label: "Paid" },
                { value: "cancelled", label: "Cancelled" },
              ]}
            />
          </div>
          <GlassButton onClick={loadInvoices} variant="ghost">
            <Search className="w-4 h-4 mr-2" />
            Search
          </GlassButton>
        </div>
      </GlassCard>

      {/* Table */}
      <GlassCard padding="none">
        {isLoading ? (
          <div className="p-8 text-center text-white/40 text-sm">Loading invoices...</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-8 text-center text-white/40 text-sm">
            No invoices found. Create an invoice using the Finance dashboard.
          </div>
        ) : (
          <GlassTable headers={headers} rows={rows} />
        )}
      </GlassCard>
    </div>
  );
}
