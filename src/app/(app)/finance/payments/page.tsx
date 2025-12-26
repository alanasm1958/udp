"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  GlassCard,
  GlassInput,
  GlassButton,
  GlassTable,
  GlassSelect,
  GlassBadge,
  PageHeader,
  Spinner,
  SkeletonTable,
  SlideOver,
  ErrorAlert,
  useToast,
} from "@/components/ui/glass";
import { formatCurrency, formatDate } from "@/lib/http";

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

interface Party {
  id: string;
  name: string;
  type: "customer" | "vendor" | "employee" | "other";
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<div className="p-6"><SkeletonTable rows={6} columns={7} /></div>}>
      <PaymentsContent />
    </Suspense>
  );
}

function PaymentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();

  // Filters from URL
  const [from, setFrom] = React.useState(searchParams.get("from") || "");
  const [to, setTo] = React.useState(searchParams.get("to") || "");
  const [method, setMethod] = React.useState(searchParams.get("method") || "");
  const [status, setStatus] = React.useState(searchParams.get("status") || "");

  // Data
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [parties, setParties] = React.useState<Party[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Create form
  const [createOpen, setCreateOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [formData, setFormData] = React.useState({
    type: "receipt" as "receipt" | "payment",
    method: "cash" as "cash" | "bank",
    paymentDate: new Date().toISOString().split("T")[0],
    partyId: "",
    amount: "",
    reference: "",
    memo: "",
  });

  // Load data
  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (method) params.set("method", method);
      if (status) params.set("status", status);

      const res = await fetch(`/api/finance/payments?${params}`);
      if (!res.ok) throw new Error("Failed to load payments");
      const data = await res.json();
      setPayments(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, [from, to, method, status]);

  // Load parties for dropdown
  const loadParties = React.useCallback(async () => {
    try {
      const res = await fetch("/api/master/parties?limit=100");
      if (res.ok) {
        const data = await res.json();
        setParties(data.items || []);
      }
    } catch {
      // Silently fail - parties are optional
    }
  }, []);

  React.useEffect(() => {
    loadData();
    loadParties();
  }, [loadData, loadParties]);

  // Update URL when filters change
  const applyFilters = () => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (method) params.set("method", method);
    if (status) params.set("status", status);
    router.push(`/finance/payments?${params.toString()}`);
    loadData();
  };

  // Create payment
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch("/api/finance/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formData.type,
          method: formData.method,
          paymentDate: formData.paymentDate,
          partyId: formData.partyId || undefined,
          amount: formData.amount,
          reference: formData.reference || undefined,
          memo: formData.memo || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create payment");
      }

      addToast("success", "Payment created successfully");
      setCreateOpen(false);
      setFormData({
        type: "receipt",
        method: "cash",
        paymentDate: new Date().toISOString().split("T")[0],
        partyId: "",
        amount: "",
        reference: "",
        memo: "",
      });
      loadData();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to create payment");
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
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
          <GlassButton variant="primary" onClick={() => setCreateOpen(true)}>
            + New Payment
          </GlassButton>
        }
      />

      {/* Filters */}
      <GlassCard padding="sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-36">
            <GlassInput
              label="From"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="w-36">
            <GlassInput
              label="To"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="w-28">
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
          <div className="w-28">
            <GlassSelect
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { value: "", label: "All" },
                { value: "draft", label: "Draft" },
                { value: "posted", label: "Posted" },
                { value: "void", label: "Void" },
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
            <SkeletonTable rows={6} columns={7} />
          </div>
        ) : (
          <GlassTable
            headers={["Date", "Reference", "Type", "Method", "Status", "Amount", ""]}
            rightAlignColumns={[5]}
            monospaceColumns={[1]}
            rows={payments.map((p) => [
              formatDate(p.paymentDate),
              p.reference || "-",
              getTypeBadge(p.type),
              <span key="method" className="capitalize">{p.method}</span>,
              getStatusBadge(p.status),
              <span key="amount" className={p.type === "receipt" ? "text-emerald-400" : "text-white/90"}>
                {p.type === "receipt" ? "+" : "-"}{formatCurrency(parseFloat(p.amount))}
              </span>,
              <Link
                key={p.id}
                href={`/finance/payments/${p.id}`}
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                View
              </Link>,
            ])}
            emptyMessage="No payments found. Create your first payment to get started."
          />
        )}
      </GlassCard>

      {/* Create Payment SlideOver */}
      <SlideOver
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Payment"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <GlassSelect
            label="Type"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as "receipt" | "payment" })}
            options={[
              { value: "receipt", label: "Receipt (Money In)" },
              { value: "payment", label: "Payment (Money Out)" },
            ]}
          />

          <GlassSelect
            label="Method"
            value={formData.method}
            onChange={(e) => setFormData({ ...formData, method: e.target.value as "cash" | "bank" })}
            options={[
              { value: "cash", label: "Cash" },
              { value: "bank", label: "Bank" },
            ]}
          />

          <GlassInput
            label="Date"
            type="date"
            value={formData.paymentDate}
            onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
            required
          />

          <GlassSelect
            label="Party (Optional)"
            value={formData.partyId}
            onChange={(e) => setFormData({ ...formData, partyId: e.target.value })}
            options={[
              { value: "", label: "Select party..." },
              ...parties.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />

          <GlassInput
            label="Amount"
            type="number"
            step="0.01"
            min="0.01"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            placeholder="0.00"
            required
          />

          <GlassInput
            label="Reference (Optional)"
            value={formData.reference}
            onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
            placeholder="Check #, receipt #, etc."
          />

          <GlassInput
            label="Memo (Optional)"
            value={formData.memo}
            onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
            placeholder="Notes about this payment"
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
              disabled={creating}
              className="flex-1"
            >
              {creating ? <Spinner size="sm" /> : "Create Payment"}
            </GlassButton>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
