"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  GlassCard,
  GlassButton,
  GlassTable,
  GlassBadge,
  GlassInput,
  GlassSelect,
  PageHeader,
  Spinner,
  SlideOver,
  useToast,
} from "@/components/ui/glass";
import { apiGet, apiPost, formatCurrency, formatDate } from "@/lib/http";

interface PurchaseDoc {
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

interface PurchaseDocLine {
  id: string;
  lineNo: number;
  productId: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
}

interface Receipt {
  id: string;
  receiptType: string;
  quantity: string;
  createdAt: string;
}

interface Product {
  id: string;
  sku: string | null;
  name: string;
  type: string;
  defaultPurchaseCost: string | null;
}

export default function PurchaseDocDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const id = params.id as string;

  const [doc, setDoc] = React.useState<PurchaseDoc | null>(null);
  const [lines, setLines] = React.useState<PurchaseDocLine[]>([]);
  const [receipts, setReceipts] = React.useState<Receipt[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Add line form
  const [addLineOpen, setAddLineOpen] = React.useState(false);
  const [addingLine, setAddingLine] = React.useState(false);
  const [lineForm, setLineForm] = React.useState({
    productId: "",
    description: "",
    quantity: "1",
    unitPrice: "0",
  });

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const docResult = await apiGet<PurchaseDoc>(`/api/procurement/docs/${id}`);
      setDoc(docResult);

      const linesResult = await apiGet<{ lines: PurchaseDocLine[] }>(`/api/procurement/docs/${id}/lines`);
      setLines(linesResult.lines);

      try {
        const receiptsResult = await apiGet<{ receipts: Receipt[] }>(`/api/procurement/docs/${id}/receipts`);
        setReceipts(receiptsResult.receipts);
      } catch {
        // Receipts may not exist
        setReceipts([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load document");
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Load products for the dropdown
  const loadProducts = React.useCallback(async () => {
    try {
      const res = await fetch("/api/master/products?limit=100");
      if (res.ok) {
        const data = await res.json();
        setProducts(data.items || []);
      }
    } catch {
      // Silently fail
    }
  }, []);

  React.useEffect(() => {
    loadData();
    loadProducts();
  }, [loadData, loadProducts]);

  // Handle product selection - auto-fill description and cost
  const handleProductChange = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      setLineForm({
        ...lineForm,
        productId,
        description: product.name,
        unitPrice: product.defaultPurchaseCost || "0",
      });
    } else {
      setLineForm({ ...lineForm, productId });
    }
  };

  // Add line handler
  const handleAddLine = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingLine(true);

    try {
      const qty = parseFloat(lineForm.quantity) || 1;
      const price = parseFloat(lineForm.unitPrice) || 0;
      const lineTotal = (qty * price).toFixed(2);

      const res = await fetch(`/api/procurement/docs/${id}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: lineForm.productId || undefined,
          description: lineForm.description,
          quantity: lineForm.quantity,
          unitPrice: lineForm.unitPrice,
          lineTotal,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add line");
      }

      addToast("success", "Line added successfully");
      setAddLineOpen(false);
      setLineForm({
        productId: "",
        description: "",
        quantity: "1",
        unitPrice: "0",
      });
      loadData();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to add line");
    } finally {
      setAddingLine(false);
    }
  };

  const handlePost = async () => {
    setActionLoading(true);
    try {
      await apiPost(`/api/procurement/docs/${id}/post`, {});
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
        <GlassButton onClick={() => router.push("/procurement")} className="mt-4">
          Back to Procurement
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
        return <GlassBadge variant="info">Received</GlassBadge>;
      default:
        return <GlassBadge>{s}</GlassBadge>;
    }
  };

  const docTypeName = doc.docType === "order" ? "Purchase Order" : doc.docType.charAt(0).toUpperCase() + doc.docType.slice(1);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${docTypeName} ${doc.docNumber}`}
        description={`Procurement ${doc.docType}`}
        actions={
          <div className="flex gap-2">
            {doc.status === "draft" && doc.docType === "invoice" && (
              <GlassButton variant="primary" onClick={handlePost} disabled={actionLoading}>
                Post Invoice
              </GlassButton>
            )}
            <GlassButton onClick={() => router.push("/procurement")}>Back</GlassButton>
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
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Lines</h2>
          {doc.status === "draft" && (
            <GlassButton size="sm" onClick={() => setAddLineOpen(true)}>
              + Add Line
            </GlassButton>
          )}
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

      {/* Receipts */}
      {receipts.length > 0 && (
        <GlassCard padding="none">
          <div className="p-4 border-b border-white/10">
            <h2 className="text-lg font-semibold text-white">Receipts</h2>
          </div>
          <GlassTable
            headers={["Type", "Quantity", "Date"]}
            rightAlignColumns={[1]}
            rows={receipts.map((r) => [
              r.receiptType,
              parseFloat(r.quantity).toFixed(2),
              formatDate(r.createdAt),
            ])}
            emptyMessage="No receipts"
          />
        </GlassCard>
      )}

      {/* Add Line SlideOver */}
      <SlideOver
        open={addLineOpen}
        onClose={() => setAddLineOpen(false)}
        title="Add Line"
      >
        <form onSubmit={handleAddLine} className="space-y-4">
          <GlassSelect
            label="Product (Optional)"
            value={lineForm.productId}
            onChange={(e) => handleProductChange(e.target.value)}
            options={[
              { value: "", label: "Select product..." },
              ...products.map((p) => ({ value: p.id, label: `${p.sku || "N/A"} - ${p.name}` })),
            ]}
          />

          <GlassInput
            label="Description"
            value={lineForm.description}
            onChange={(e) => setLineForm({ ...lineForm, description: e.target.value })}
            placeholder="Line description"
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <GlassInput
              label="Quantity"
              type="number"
              step="0.01"
              min="0.01"
              value={lineForm.quantity}
              onChange={(e) => setLineForm({ ...lineForm, quantity: e.target.value })}
              required
            />

            <GlassInput
              label="Unit Cost"
              type="number"
              step="0.01"
              min="0"
              value={lineForm.unitPrice}
              onChange={(e) => setLineForm({ ...lineForm, unitPrice: e.target.value })}
              required
            />
          </div>

          <div className="p-3 bg-white/5 rounded-lg">
            <span className="text-white/50 text-sm">Line Total: </span>
            <span className="text-white font-mono">
              {formatCurrency((parseFloat(lineForm.quantity) || 0) * (parseFloat(lineForm.unitPrice) || 0))}
            </span>
          </div>

          <div className="pt-4 flex gap-3">
            <GlassButton
              type="button"
              variant="ghost"
              onClick={() => setAddLineOpen(false)}
              className="flex-1"
            >
              Cancel
            </GlassButton>
            <GlassButton
              type="submit"
              variant="primary"
              disabled={addingLine || !lineForm.description}
              className="flex-1"
            >
              {addingLine ? <Spinner size="sm" /> : "Add Line"}
            </GlassButton>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
