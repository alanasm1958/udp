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

interface SalesDoc {
  id: string;
  docType: string;
  docNumber: string;
  docDate: string;
  dueDate: string | null;
  partyId: string;
  currency: string;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  status: string;
  notes: string | null;
  paymentStatus?: string;
  amountPaid?: number;
  amountRemaining?: number;
}

interface SalesDocLine {
  id: string;
  lineNo: number;
  productId: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
}

interface Fulfillment {
  id: string;
  fulfillmentType: string;
  quantity: string;
  createdAt: string;
}

export default function SalesDocDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [doc, setDoc] = React.useState<SalesDoc | null>(null);
  const [lines, setLines] = React.useState<SalesDocLine[]>([]);
  const [fulfillments, setFulfillments] = React.useState<Fulfillment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const docResult = await apiGet<SalesDoc>(`/api/sales/docs/${id}`);
      setDoc(docResult);

      const linesResult = await apiGet<{ lines: SalesDocLine[] }>(`/api/sales/docs/${id}/lines`);
      setLines(linesResult.lines);

      try {
        const fulfillResult = await apiGet<{ fulfillments: Fulfillment[] }>(`/api/sales/docs/${id}/fulfillments`);
        setFulfillments(fulfillResult.fulfillments);
      } catch {
        // Fulfillments may not exist
        setFulfillments([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load document");
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
      await apiPost(`/api/sales/docs/${id}/post`, {});
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post");
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

  if (error && !doc) {
    return (
      <GlassCard>
        <p className="text-red-400">{error}</p>
        <GlassButton onClick={() => router.push("/sales")} className="mt-4">
          Back to Sales
        </GlassButton>
      </GlassCard>
    );
  }

  if (!doc) return null;

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "posted":
        return <GlassBadge variant="success">Posted</GlassBadge>;
      case "draft":
        return <GlassBadge variant="warning">Draft</GlassBadge>;
      case "fulfilled":
        return <GlassBadge variant="info">Fulfilled</GlassBadge>;
      default:
        return <GlassBadge>{s}</GlassBadge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${doc.docType.charAt(0).toUpperCase() + doc.docType.slice(1)} ${doc.docNumber}`}
        description={`Sales ${doc.docType}`}
        actions={
          <div className="flex gap-2">
            {doc.status === "draft" && doc.docType === "invoice" && (
              <GlassButton variant="primary" onClick={handlePost} disabled={actionLoading}>
                Post Invoice
              </GlassButton>
            )}
            <GlassButton onClick={() => router.push("/sales")}>Back</GlassButton>
          </div>
        }
      />

      {error && (
        <GlassCard>
          <p className="text-red-400">{error}</p>
        </GlassCard>
      )}

      {/* Document Details */}
      <GlassCard>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="text-xs text-white/50 uppercase">Status</span>
            <div className="mt-1">{getStatusBadge(doc.status)}</div>
          </div>
          <div>
            <span className="text-xs text-white/50 uppercase">Date</span>
            <p className="text-white mt-1">{formatDate(doc.docDate)}</p>
          </div>
          <div>
            <span className="text-xs text-white/50 uppercase">Due Date</span>
            <p className="text-white mt-1">{doc.dueDate ? formatDate(doc.dueDate) : "-"}</p>
          </div>
          <div>
            <span className="text-xs text-white/50 uppercase">Total</span>
            <p className="text-xl font-semibold text-white mt-1">{formatCurrency(parseFloat(doc.totalAmount))}</p>
          </div>
        </div>
        {doc.paymentStatus && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="text-xs text-white/50 uppercase">Payment Status</span>
                <p className="text-white mt-1 capitalize">{doc.paymentStatus}</p>
              </div>
              <div>
                <span className="text-xs text-white/50 uppercase">Paid</span>
                <p className="text-emerald-400 mt-1">{formatCurrency(doc.amountPaid || 0)}</p>
              </div>
              <div>
                <span className="text-xs text-white/50 uppercase">Remaining</span>
                <p className="text-amber-400 mt-1">{formatCurrency(doc.amountRemaining || 0)}</p>
              </div>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Lines */}
      <GlassCard padding="none">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Lines</h2>
        </div>
        <GlassTable
          headers={["#", "Description", "Qty", "Unit Price", "Total"]}
          rightAlignColumns={[2, 3, 4]}
          rows={lines.map((line) => [
            line.lineNo,
            line.description,
            parseFloat(line.quantity).toFixed(2),
            formatCurrency(parseFloat(line.unitPrice)),
            formatCurrency(parseFloat(line.lineTotal)),
          ])}
          emptyMessage="No lines"
        />
      </GlassCard>

      {/* Fulfillments */}
      {fulfillments.length > 0 && (
        <GlassCard padding="none">
          <div className="p-4 border-b border-white/10">
            <h2 className="text-lg font-semibold text-white">Fulfillments</h2>
          </div>
          <GlassTable
            headers={["Type", "Quantity", "Date"]}
            rightAlignColumns={[1]}
            rows={fulfillments.map((f) => [
              f.fulfillmentType,
              parseFloat(f.quantity).toFixed(2),
              formatDate(f.createdAt),
            ])}
            emptyMessage="No fulfillments"
          />
        </GlassCard>
      )}
    </div>
  );
}
