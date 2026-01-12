"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  GlassCard,
  GlassInput,
  GlassButton,
  GlassSelect,
  GlassTable,
  GlassTabs,
  PageHeader,
  Spinner,
  SlideOver,
  ConfirmDialog,
  useToast,
} from "@/components/ui/glass";
import { apiGet, formatCurrency, formatDate } from "@/lib/http";

interface Party {
  id: string;
  displayName: string;
  partyType: string;
}

interface OpenDocItem {
  docId: string;
  docNumber: string;
  docDate: string;
  dueDate: string | null;
  partyId: string | null;
  partyName: string | null;
  currency: string;
  totalAmount: number;
  allocatedAmount: number;
  remainingAmount: number;
}

interface OpenDocsResult {
  items: OpenDocItem[];
  summary: {
    totalOpenAmount: number;
    count: number;
  };
}

interface StatementLine {
  date: string;
  type: "invoice" | "payment";
  reference: string;
  amountDebit: number;
  amountCredit: number;
  runningBalance: number;
}

interface StatementResult {
  partyId: string;
  partyName: string | null;
  lines: StatementLine[];
  openingBalance: number;
  closingBalance: number;
}

export default function APPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [tab, setTab] = React.useState("open");
  const [partyId, setPartyId] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  const [openData, setOpenData] = React.useState<OpenDocsResult | null>(null);
  const [statementData, setStatementData] = React.useState<StatementResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Vendor dropdown
  const [vendors, setVendors] = React.useState<Party[]>([]);
  const [loadingVendors, setLoadingVendors] = React.useState(true);

  // Pay Vendor drawer state
  const [payDrawerOpen, setPayDrawerOpen] = React.useState(false);
  const [selectedDoc, setSelectedDoc] = React.useState<OpenDocItem | null>(null);
  const [payFormData, setPayFormData] = React.useState({
    method: "bank" as "cash" | "bank",
    paymentDate: new Date().toISOString().split("T")[0],
    amount: "",
    reference: "",
    memo: "",
    createAllocation: true,
  });
  const [submittingPayment, setSubmittingPayment] = React.useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = React.useState(false);

  // Load vendors on mount
  React.useEffect(() => {
    async function loadVendors() {
      try {
        const result = await apiGet<{ items: Party[] }>("/api/master/parties?type=vendor&limit=200");
        setVendors(result.items || []);
      } catch {
        // Silently fail - vendors will show as empty
      } finally {
        setLoadingVendors(false);
      }
    }
    loadVendors();
  }, []);

  const loadOpen = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (partyId) params.set("partyId", partyId);
      const result = await apiGet<OpenDocsResult>(`/api/finance/ap/open?${params}`);
      setOpenData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [partyId]);

  const loadStatement = React.useCallback(async () => {
    if (!partyId) {
      setError("Please select a vendor for statement view");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ partyId });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const result = await apiGet<StatementResult>(`/api/finance/ap/statement?${params}`);
      setStatementData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load statement");
    } finally {
      setLoading(false);
    }
  }, [partyId, from, to]);

  React.useEffect(() => {
    if (tab === "open") {
      loadOpen();
    }
  }, [tab, loadOpen]);

  // Open Pay Vendor drawer
  const handlePayVendor = (doc: OpenDocItem) => {
    setSelectedDoc(doc);
    setPayFormData({
      method: "bank",
      paymentDate: new Date().toISOString().split("T")[0],
      amount: doc.remainingAmount.toFixed(2),
      reference: `PAY-${doc.docNumber}`,
      memo: `Payment for ${doc.docNumber}`,
      createAllocation: true,
    });
    setPayDrawerOpen(true);
  };

  // Handle payment submission
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Show confirmation first
    setConfirmDialogOpen(true);
  };

  const confirmPayment = async () => {
    if (!selectedDoc) return;

    setSubmittingPayment(true);
    try {
      // Step 1: Create draft payment
      const paymentRes = await fetch("/api/finance/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "payment",
          method: payFormData.method,
          paymentDate: payFormData.paymentDate,
          partyId: selectedDoc.partyId,
          amount: payFormData.amount,
          reference: payFormData.reference || undefined,
          memo: payFormData.memo || undefined,
        }),
      });

      if (!paymentRes.ok) {
        const data = await paymentRes.json();
        throw new Error(data.error || "Failed to create payment");
      }

      const payment = await paymentRes.json();

      // Step 2: If createAllocation is true, allocate to the purchase doc
      if (payFormData.createAllocation) {
        const allocationRes = await fetch(`/api/finance/payments/${payment.id}/allocations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            allocations: [
              {
                targetType: "purchase_doc",
                targetId: selectedDoc.docId,
                amount: payFormData.amount,
              },
            ],
          }),
        });

        if (!allocationRes.ok) {
          // Payment was created but allocation failed - still navigate
          addToast("warning", "Payment created but allocation failed. Please allocate manually.");
        } else {
          addToast("success", "Draft payment created and allocated successfully");
        }
      } else {
        addToast("success", "Draft payment created successfully");
      }

      // Close drawer and refresh
      setPayDrawerOpen(false);
      setConfirmDialogOpen(false);
      loadOpen();

      // Navigate to payment detail
      router.push(`/finance/payments/${payment.id}`);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to create payment");
    } finally {
      setSubmittingPayment(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Accounts Payable" description="Vendor balances and statements" />

      {/* Tabs */}
      <GlassTabs
        tabs={[
          { id: "open", label: "Open Items" },
          { id: "statement", label: "Statement" },
        ]}
        activeTab={tab}
        onTabChange={setTab}
      />

      {/* Filters */}
      <GlassCard padding="sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-64">
            <GlassSelect
              label="Vendor"
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              options={[
                { value: "", label: loadingVendors ? "Loading..." : "All Vendors" },
                ...vendors.map((v) => ({ value: v.id, label: v.displayName })),
              ]}
            />
          </div>
          {tab === "statement" && (
            <>
              <div className="w-40">
                <GlassInput
                  label="From"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div className="w-40">
                <GlassInput
                  label="To"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            </>
          )}
          <GlassButton onClick={tab === "open" ? loadOpen : loadStatement} disabled={loading || (tab === "statement" && !partyId)}>
            {loading ? <Spinner size="sm" /> : "Search"}
          </GlassButton>
        </div>
      </GlassCard>

      {/* Error */}
      {error && (
        <GlassCard>
          <p className="text-red-400">{error}</p>
        </GlassCard>
      )}

      {/* Open Items Tab */}
      {tab === "open" && openData && (
        <>
          <GlassCard padding="sm">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-xs text-white/50 uppercase">Open Items</span>
                <p className="text-xl font-semibold text-white">{openData.summary.count}</p>
              </div>
              <div>
                <span className="text-xs text-white/50 uppercase">Total Owed</span>
                <p className="text-xl font-semibold text-red-400">
                  {formatCurrency(openData.summary.totalOpenAmount)}
                </p>
              </div>
            </div>
          </GlassCard>
          <GlassCard padding="none">
            <GlassTable
              headers={["Invoice #", "Date", "Vendor", "Total", "Paid", "Remaining", ""]}
              monospaceColumns={[0]}
              rightAlignColumns={[3, 4, 5]}
              rows={openData.items.map((item) => [
                item.docNumber,
                formatDate(item.docDate),
                item.partyName || "-",
                formatCurrency(item.totalAmount),
                formatCurrency(item.allocatedAmount),
                <span key="remaining" className="text-red-400 font-medium">
                  {formatCurrency(item.remainingAmount)}
                </span>,
                <GlassButton
                  key="pay"
                  size="sm"
                  variant="ghost"
                  onClick={() => handlePayVendor(item)}
                  className="text-blue-400 hover:text-blue-300"
                >
                  Pay
                </GlassButton>,
              ])}
              emptyMessage="No open payables"
            />
          </GlassCard>
        </>
      )}

      {/* Statement Tab */}
      {tab === "statement" && statementData && (
        <>
          <GlassCard padding="sm">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-xs text-white/50 uppercase">Vendor</span>
                <p className="text-lg font-medium text-white">{statementData.partyName || statementData.partyId}</p>
              </div>
              <div>
                <span className="text-xs text-white/50 uppercase">Balance Owed</span>
                <p className="text-xl font-semibold text-red-400">
                  {formatCurrency(statementData.closingBalance)}
                </p>
              </div>
            </div>
          </GlassCard>
          <GlassCard padding="none">
            <GlassTable
              headers={["Date", "Type", "Reference", "Debit", "Credit", "Balance"]}
              rightAlignColumns={[3, 4, 5]}
              rows={statementData.lines.map((line) => [
                formatDate(line.date),
                line.type,
                line.reference,
                line.amountDebit > 0 ? formatCurrency(line.amountDebit) : "-",
                line.amountCredit > 0 ? formatCurrency(line.amountCredit) : "-",
                formatCurrency(line.runningBalance),
              ])}
              emptyMessage="No transactions found"
            />
          </GlassCard>
        </>
      )}

      {/* Pay Vendor SlideOver */}
      <SlideOver
        open={payDrawerOpen}
        onClose={() => setPayDrawerOpen(false)}
        title="Pay Vendor"
      >
        {selectedDoc && (
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            {/* Invoice info */}
            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="text-sm text-white/50">Invoice</div>
              <div className="text-lg font-medium text-white">{selectedDoc.docNumber}</div>
              <div className="text-sm text-white/70 mt-1">
                Vendor: {selectedDoc.partyName || "Unknown"}
              </div>
              <div className="text-sm text-white/70">
                Remaining: <span className="text-red-400">{formatCurrency(selectedDoc.remainingAmount)}</span>
              </div>
            </div>

            <GlassSelect
              label="Payment Method"
              value={payFormData.method}
              onChange={(e) => setPayFormData({ ...payFormData, method: e.target.value as "cash" | "bank" })}
              options={[
                { value: "bank", label: "Bank Transfer" },
                { value: "cash", label: "Cash" },
              ]}
            />

            <GlassInput
              label="Payment Date"
              type="date"
              value={payFormData.paymentDate}
              onChange={(e) => setPayFormData({ ...payFormData, paymentDate: e.target.value })}
              required
            />

            <GlassInput
              label="Amount"
              type="number"
              step="0.01"
              min="0.01"
              max={selectedDoc.remainingAmount.toString()}
              value={payFormData.amount}
              onChange={(e) => setPayFormData({ ...payFormData, amount: e.target.value })}
              required
            />

            <GlassInput
              label="Reference"
              value={payFormData.reference}
              onChange={(e) => setPayFormData({ ...payFormData, reference: e.target.value })}
              placeholder="Check #, wire ref, etc."
            />

            <GlassInput
              label="Memo"
              value={payFormData.memo}
              onChange={(e) => setPayFormData({ ...payFormData, memo: e.target.value })}
            />

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={payFormData.createAllocation}
                onChange={(e) => setPayFormData({ ...payFormData, createAllocation: e.target.checked })}
                className="w-4 h-4 rounded border-white/30 bg-white/10 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-white/70">Allocate payment to this invoice</span>
            </label>

            <div className="pt-4 flex gap-3">
              <GlassButton
                type="button"
                variant="ghost"
                onClick={() => setPayDrawerOpen(false)}
                className="flex-1"
              >
                Cancel
              </GlassButton>
              <GlassButton
                type="submit"
                variant="primary"
                disabled={submittingPayment}
                className="flex-1"
              >
                {submittingPayment ? <Spinner size="sm" /> : "Create Draft Payment"}
              </GlassButton>
            </div>
          </form>
        )}
      </SlideOver>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        onConfirm={confirmPayment}
        title="Create Draft Payment"
        message={
          selectedDoc
            ? `Create a draft payment of ${formatCurrency(parseFloat(payFormData.amount))} for ${selectedDoc.docNumber}?${payFormData.createAllocation ? " The payment will be allocated to this invoice." : ""} You can post the payment from the payment detail page.`
            : ""
        }
        confirmLabel={submittingPayment ? "Creating..." : "Create Payment"}
        variant="default"
      />
    </div>
  );
}
