"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  GlassCard,
  GlassButton,
  GlassTable,
  GlassBadge,
  PageHeader,
  Spinner,
  ConfirmDialog,
  ErrorAlert,
  Skeleton,
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
  memo: string | null;
}

interface Allocation {
  id: string;
  targetType: "sales_doc" | "purchase_doc";
  targetId: string;
  amount: string;
}

interface PaymentDetail {
  payment: Payment;
  allocations: Allocation[];
}

export default function PaymentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const id = params.id as string;

  const [data, setData] = React.useState<PaymentDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Confirmation dialogs
  const [postDialogOpen, setPostDialogOpen] = React.useState(false);
  const [voidDialogOpen, setVoidDialogOpen] = React.useState(false);
  const [unallocateDialogOpen, setUnallocateDialogOpen] = React.useState(false);
  const [selectedAllocationId, setSelectedAllocationId] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [paymentRes, allocRes] = await Promise.all([
        fetch(`/api/finance/payments/${id}`),
        fetch(`/api/finance/payments/${id}/allocations`),
      ]);

      if (!paymentRes.ok) throw new Error("Failed to load payment");

      const payment = await paymentRes.json();
      const allocResult = allocRes.ok ? await allocRes.json() : { allocations: [] };
      setData({ payment, allocations: allocResult.allocations || [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payment");
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePost = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/finance/payments/${id}/post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to post payment");
      }

      addToast("success", "Payment posted - journal entry created");
      setPostDialogOpen(false);
      loadData();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to post payment");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoid = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/finance/payments/${id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Voided from UI" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to void payment");
      }

      addToast("success", "Payment voided - journal entry reversed");
      setVoidDialogOpen(false);
      loadData();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to void payment");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnallocate = async () => {
    if (!selectedAllocationId) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/finance/payments/${id}/unallocate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allocationId: selectedAllocationId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to unallocate");
      }

      addToast("success", "Allocation removed successfully");
      setUnallocateDialogOpen(false);
      setSelectedAllocationId(null);
      loadData();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to unallocate");
    } finally {
      setActionLoading(false);
    }
  };

  const openUnallocateDialog = (allocationId: string) => {
    setSelectedAllocationId(allocationId);
    setUnallocateDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-20" />
          </div>
        </div>
        <GlassCard>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i}>
                <Skeleton className="h-3 w-16 mb-2" />
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        <ErrorAlert message={error} />
        <GlassButton onClick={() => router.push("/finance/payments")}>
          Back to Payments
        </GlassButton>
      </div>
    );
  }

  const p = data?.payment;
  if (!p) return null;

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

  const allocatedAmount = data?.allocations.reduce(
    (sum, a) => sum + parseFloat(a.amount),
    0
  ) || 0;
  const unallocatedAmount = parseFloat(p.amount) - allocatedAmount;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Payment ${p.reference || p.id.slice(0, 8)}`}
        description={`${p.type === "receipt" ? "Receipt" : "Payment"} via ${p.method}`}
        actions={
          <div className="flex gap-2">
            {p.status === "draft" && (
              <GlassButton variant="primary" onClick={() => setPostDialogOpen(true)} disabled={actionLoading}>
                Post
              </GlassButton>
            )}
            {p.status === "posted" && (
              <GlassButton
                variant="danger"
                onClick={() => setVoidDialogOpen(true)}
                disabled={actionLoading}
              >
                Void
              </GlassButton>
            )}
            <GlassButton onClick={() => router.push("/finance/payments")}>Back</GlassButton>
          </div>
        }
      />

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* Payment Details */}
      <GlassCard>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <span className="text-xs text-white/50 uppercase tracking-wide">Status</span>
            <div className="mt-1">{getStatusBadge(p.status)}</div>
          </div>
          <div>
            <span className="text-xs text-white/50 uppercase tracking-wide">Date</span>
            <p className="text-white mt-1">{formatDate(p.paymentDate)}</p>
          </div>
          <div>
            <span className="text-xs text-white/50 uppercase tracking-wide">Total Amount</span>
            <p className={`text-xl font-semibold mt-1 ${p.type === "receipt" ? "text-emerald-400" : "text-white"}`}>
              {p.type === "receipt" ? "+" : "-"}{formatCurrency(parseFloat(p.amount))}
            </p>
          </div>
          <div>
            <span className="text-xs text-white/50 uppercase tracking-wide">Method</span>
            <p className="text-white mt-1 capitalize">{p.method}</p>
          </div>
        </div>

        {/* Allocation Summary */}
        <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <span className="text-xs text-white/50 uppercase tracking-wide">Allocated</span>
            <p className="text-white mt-1 font-mono">{formatCurrency(allocatedAmount)}</p>
          </div>
          <div>
            <span className="text-xs text-white/50 uppercase tracking-wide">Unallocated</span>
            <p className={`mt-1 font-mono ${unallocatedAmount > 0 ? "text-amber-400" : "text-white/50"}`}>
              {formatCurrency(unallocatedAmount)}
            </p>
          </div>
          {p.partyName && (
            <div>
              <span className="text-xs text-white/50 uppercase tracking-wide">Party</span>
              <p className="text-white mt-1">{p.partyName}</p>
            </div>
          )}
        </div>

        {p.memo && (
          <div className="mt-6 pt-6 border-t border-white/10">
            <span className="text-xs text-white/50 uppercase tracking-wide">Memo</span>
            <p className="text-white/80 mt-1">{p.memo}</p>
          </div>
        )}
      </GlassCard>

      {/* Allocations */}
      <GlassCard padding="none">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Allocations</h2>
          <p className="text-sm text-white/50">Invoices and documents this payment is applied to</p>
        </div>
        <GlassTable
          headers={["Document Type", "Document ID", "Amount", ""]}
          rightAlignColumns={[2]}
          monospaceColumns={[1]}
          rows={
            data?.allocations.map((a) => [
              a.targetType === "sales_doc" ? "Sales Invoice" : "Purchase Invoice",
              <span key={a.id} className="text-xs">{a.targetId.slice(0, 8)}...</span>,
              formatCurrency(parseFloat(a.amount)),
              p.status === "draft" && parseFloat(a.amount) > 0 ? (
                <GlassButton
                  key={a.id}
                  size="sm"
                  variant="ghost"
                  onClick={() => openUnallocateDialog(a.id)}
                  disabled={actionLoading}
                >
                  Remove
                </GlassButton>
              ) : (
                <span key={a.id} className="text-white/30 text-xs">
                  {parseFloat(a.amount) === 0 ? "Removed" : "-"}
                </span>
              ),
            ]) || []
          }
          emptyMessage="No allocations yet. Allocate this payment to invoices to apply it."
        />
      </GlassCard>

      {/* Post Confirmation Dialog */}
      <ConfirmDialog
        open={postDialogOpen}
        onClose={() => setPostDialogOpen(false)}
        onConfirm={handlePost}
        title="Post Payment"
        message={`Post this ${p.type === "receipt" ? "receipt" : "payment"} for ${formatCurrency(parseFloat(p.amount))}? This will create a journal entry.`}
        confirmLabel="Post Payment"
        loading={actionLoading}
      />

      {/* Void Confirmation Dialog */}
      <ConfirmDialog
        open={voidDialogOpen}
        onClose={() => setVoidDialogOpen(false)}
        onConfirm={handleVoid}
        title="Void Payment"
        message="Are you sure you want to void this payment? This will reverse any journal entries and cannot be undone."
        confirmLabel="Void Payment"
        variant="danger"
        loading={actionLoading}
      />

      {/* Unallocate Confirmation Dialog */}
      <ConfirmDialog
        open={unallocateDialogOpen}
        onClose={() => {
          setUnallocateDialogOpen(false);
          setSelectedAllocationId(null);
        }}
        onConfirm={handleUnallocate}
        title="Remove Allocation"
        message="Are you sure you want to remove this allocation? The payment amount will become unallocated."
        confirmLabel="Remove"
        variant="danger"
        loading={actionLoading}
      />
    </div>
  );
}
