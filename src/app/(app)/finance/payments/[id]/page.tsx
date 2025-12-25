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
} from "@/components/ui/glass";
import { apiGet, apiPost, formatCurrency, formatDate } from "@/lib/http";

interface Payment {
  id: string;
  type: "receipt" | "payment";
  method: "cash" | "bank";
  status: "draft" | "posted" | "void";
  paymentDate: string;
  partyId: string | null;
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
  const id = params.id as string;

  const [data, setData] = React.useState<PaymentDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payment = await apiGet<Payment>(`/api/finance/payments/${id}`);
      const allocResult = await apiGet<{ allocations: Allocation[] }>(`/api/finance/payments/${id}/allocations`);
      setData({ payment, allocations: allocResult.allocations });
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
      await apiPost(`/api/finance/payments/${id}/post`, {});
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post payment");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoid = async () => {
    setActionLoading(true);
    try {
      await apiPost(`/api/finance/payments/${id}/void`, { reason: "Voided from UI" });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to void payment");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnallocate = async (allocationId: string) => {
    setActionLoading(true);
    try {
      await apiPost(`/api/finance/payments/${id}/unallocate`, { allocationId });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unallocate");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <GlassCard>
        <p className="text-red-400">{error}</p>
        <GlassButton onClick={() => router.push("/finance/payments")} className="mt-4">
          Back to Payments
        </GlassButton>
      </GlassCard>
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Payment ${p.reference || p.id.slice(0, 8)}`}
        description={`${p.type === "receipt" ? "Receipt" : "Payment"} via ${p.method}`}
        actions={
          <div className="flex gap-2">
            {p.status === "draft" && (
              <GlassButton variant="primary" onClick={handlePost} disabled={actionLoading}>
                Post
              </GlassButton>
            )}
            {p.status === "posted" && (
              <GlassButton variant="danger" onClick={handleVoid} disabled={actionLoading}>
                Void
              </GlassButton>
            )}
            <GlassButton onClick={() => router.push("/finance/payments")}>Back</GlassButton>
          </div>
        }
      />

      {error && (
        <GlassCard>
          <p className="text-red-400">{error}</p>
        </GlassCard>
      )}

      {/* Payment Details */}
      <GlassCard>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="text-xs text-white/50 uppercase">Status</span>
            <div className="mt-1">{getStatusBadge(p.status)}</div>
          </div>
          <div>
            <span className="text-xs text-white/50 uppercase">Date</span>
            <p className="text-white mt-1">{formatDate(p.paymentDate)}</p>
          </div>
          <div>
            <span className="text-xs text-white/50 uppercase">Amount</span>
            <p className="text-xl font-semibold text-white mt-1">{formatCurrency(parseFloat(p.amount))}</p>
          </div>
          <div>
            <span className="text-xs text-white/50 uppercase">Method</span>
            <p className="text-white mt-1 capitalize">{p.method}</p>
          </div>
        </div>
        {p.memo && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <span className="text-xs text-white/50 uppercase">Memo</span>
            <p className="text-white/80 mt-1">{p.memo}</p>
          </div>
        )}
      </GlassCard>

      {/* Allocations */}
      <GlassCard padding="none">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Allocations</h2>
        </div>
        <GlassTable
          headers={["Target Type", "Target ID", "Amount", ""]}
          rightAlignColumns={[2]}
          rows={
            data?.allocations.map((a) => [
              a.targetType === "sales_doc" ? "Sales Invoice" : "Purchase Invoice",
              <span key={a.id} className="font-mono text-xs">{a.targetId.slice(0, 8)}...</span>,
              formatCurrency(parseFloat(a.amount)),
              p.status === "draft" && parseFloat(a.amount) > 0 ? (
                <GlassButton
                  key={a.id}
                  size="sm"
                  variant="ghost"
                  onClick={() => handleUnallocate(a.id)}
                  disabled={actionLoading}
                >
                  Unallocate
                </GlassButton>
              ) : (
                <span key={a.id} className="text-white/30 text-xs">
                  {parseFloat(a.amount) === 0 ? "Unallocated" : "-"}
                </span>
              ),
            ]) || []
          }
          emptyMessage="No allocations"
        />
      </GlassCard>
    </div>
  );
}
