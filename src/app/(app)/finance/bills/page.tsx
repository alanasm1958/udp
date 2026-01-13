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
import { Download, Eye, Search, CreditCard } from "lucide-react";

interface Bill {
  id: string;
  docNumber: string;
  partyName: string;
  docDate: string;
  dueDate: string;
  totalAmount: string;
  paidAmount: string;
  status: string;
}

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadBills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const loadBills = async () => {
    try {
      setIsLoading(true);
      let url = "/api/procurement/docs?type=invoice&limit=100";
      if (statusFilter) {
        url += `&status=${statusFilter}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setBills(data.docs || []);
      }
    } catch (error) {
      console.error("Error loading bills:", error);
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

  const getRemainingAmount = (bill: Bill) => {
    const total = parseFloat(bill.totalAmount || "0");
    const paid = parseFloat(bill.paidAmount || "0");
    return total - paid;
  };

  const isOverdue = (bill: Bill) => {
    if (!bill.dueDate) return false;
    const remaining = getRemainingAmount(bill);
    if (remaining <= 0) return false;
    return new Date(bill.dueDate) < new Date();
  };

  const filteredBills = bills.filter((bill) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      bill.docNumber.toLowerCase().includes(query) ||
      bill.partyName?.toLowerCase().includes(query)
    );
  });

  // Build table headers and rows for GlassTable
  const headers = ["Bill #", "Vendor", "Date", "Due Date", "Total", "Remaining", "Status", "Actions"];

  const rows: React.ReactNode[][] = filteredBills.map((row) => {
    const remaining = getRemainingAmount(row);
    const overdue = isOverdue(row);
    return [
      <Link key="num" href={`/finance/bills/${row.id}`} className="text-orange-400 hover:text-orange-300 font-medium">
        {row.docNumber}
      </Link>,
      row.partyName || "-",
      new Date(row.docDate).toLocaleDateString(),
      row.dueDate ? (
        <span key="due" className={overdue ? "text-red-400" : ""}>
          {new Date(row.dueDate).toLocaleDateString()}
          {overdue && " (Overdue)"}
        </span>
      ) : "-",
      `$${parseFloat(row.totalAmount).toLocaleString()}`,
      remaining > 0 ? (
        <span key="rem" className="text-amber-400">${remaining.toLocaleString()}</span>
      ) : (
        <span key="rem" className="text-emerald-400">Paid</span>
      ),
      getStatusBadge(row.status),
      <div key="actions" className="flex gap-2">
        <Link href={`/finance/bills/${row.id}`}>
          <GlassButton size="sm" variant="ghost" title="View">
            <Eye className="w-4 h-4" />
          </GlassButton>
        </Link>
        <GlassButton size="sm" variant="ghost" title="Download PDF">
          <Download className="w-4 h-4" />
        </GlassButton>
        {row.status !== "paid" && row.status !== "cancelled" && (
          <GlassButton size="sm" variant="ghost" title="Schedule Payment">
            <CreditCard className="w-4 h-4" />
          </GlassButton>
        )}
      </div>,
    ];
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendor Bills"
        description="View and manage bills from vendors"
      />

      {/* Filters */}
      <GlassCard padding="sm">
        <div className="flex gap-4 items-end">
          <div className="flex-1 max-w-xs">
            <GlassInput
              label="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Bill # or vendor..."
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
          <GlassButton onClick={loadBills} variant="ghost">
            <Search className="w-4 h-4 mr-2" />
            Search
          </GlassButton>
        </div>
      </GlassCard>

      {/* Table */}
      <GlassCard padding="none">
        {isLoading ? (
          <div className="p-8 text-center text-white/40 text-sm">Loading bills...</div>
        ) : filteredBills.length === 0 ? (
          <div className="p-8 text-center text-white/40 text-sm">
            No bills found. Enter a bill using the Finance dashboard.
          </div>
        ) : (
          <GlassTable headers={headers} rows={rows} />
        )}
      </GlassCard>
    </div>
  );
}
