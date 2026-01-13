"use client";

import { useState, useEffect } from "react";
import {
  GlassInput,
  GlassSelect,
  GlassTextarea,
  GlassButton,
  GlassCard,
  useToast,
} from "@/components/ui/glass";
import { ArrowLeft, Info, DollarSign, ArrowUpRight, ArrowDownRight, RefreshCw } from "lucide-react";

interface RecordPaymentFormProps {
  onBack: () => void;
  onSuccess: () => void;
}

interface Party {
  id: string;
  name: string;
  code: string | null;
  type: string;
}

interface OpenDocument {
  id: string;
  docNumber: string;
  date: string;
  total: string;
  remaining: string;
  partyName: string;
}

type PaymentType = "receipt" | "payment" | "transfer";

export default function RecordPaymentForm({ onBack, onSuccess }: RecordPaymentFormProps) {
  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);

  // Form state
  const [paymentType, setPaymentType] = useState<PaymentType>("receipt");
  const [partyId, setPartyId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [reference, setReference] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank");
  const [notes, setNotes] = useState("");

  // Data
  const [customers, setCustomers] = useState<Party[]>([]);
  const [vendors, setVendors] = useState<Party[]>([]);
  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<Record<string, string>>({});

  // Load parties on mount
  useEffect(() => {
    loadParties();
  }, []);

  // Load open documents when party changes
  useEffect(() => {
    if (partyId) {
      loadOpenDocuments();
    }
  }, [partyId, paymentType]);

  const loadParties = async () => {
    try {
      const [customersRes, vendorsRes] = await Promise.all([
        fetch("/api/master/parties?type=customer&limit=100"),
        fetch("/api/master/parties?type=vendor&limit=100"),
      ]);

      if (customersRes.ok) {
        const data = await customersRes.json();
        setCustomers(data.parties || []);
      }
      if (vendorsRes.ok) {
        const data = await vendorsRes.json();
        setVendors(data.parties || []);
      }
    } catch (error) {
      console.error("Error loading parties:", error);
    }
  };

  const loadOpenDocuments = async () => {
    try {
      const endpoint = paymentType === "receipt"
        ? `/api/finance/ar/open?partyId=${partyId}`
        : `/api/finance/ap/open?partyId=${partyId}`;

      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        setOpenDocuments(data.documents || []);
      }
    } catch (error) {
      console.error("Error loading open documents:", error);
    }
  };

  const handleDocumentAllocation = (docId: string, allocAmount: string) => {
    setSelectedDocuments((prev) => ({
      ...prev,
      [docId]: allocAmount,
    }));
  };

  const getTotalAllocated = () => {
    return Object.values(selectedDocuments).reduce(
      (sum, val) => sum + (parseFloat(val) || 0),
      0
    );
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      if (!amount || parseFloat(amount) <= 0) {
        addToast("error", "Please enter a valid amount");
        return;
      }

      if (!partyId && paymentType !== "transfer") {
        addToast("error", "Please select a customer or vendor");
        return;
      }

      // Create payment
      const res = await fetch("/api/finance/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: paymentType,
          partyId: partyId || null,
          amount: parseFloat(amount),
          paymentDate,
          paymentMethod,
          reference: reference || null,
          notes: notes || null,
          allocations: Object.entries(selectedDocuments)
            .filter(([, amt]) => parseFloat(amt) > 0)
            .map(([docId, amt]) => ({
              documentId: docId,
              documentType: paymentType === "receipt" ? "sales_doc" : "purchase_doc",
              amount: parseFloat(amt),
            })),
        }),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const error = await res.json();
        addToast("error", error.message || "Failed to record payment");
      }
    } catch (error) {
      console.error("Error recording payment:", error);
      addToast("error", "Failed to record payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const InfoTooltip = ({ text }: { text: string }) => (
    <div className="group relative inline-block ml-2">
      <Info className="w-4 h-4 text-white/40 cursor-help" />
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-64">
        <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl border border-white/10">
          {text}
        </div>
      </div>
    </div>
  );

  const paymentMethodOptions = [
    { value: "bank", label: "Bank Transfer" },
    { value: "cash", label: "Cash" },
    { value: "check", label: "Check" },
    { value: "credit_card", label: "Credit Card" },
    { value: "other", label: "Other" },
  ];

  const partyOptions = paymentType === "receipt" ? customers : vendors;

  return (
    <div className="space-y-6">
      <GlassButton onClick={onBack} variant="ghost" size="sm">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to menu
      </GlassButton>

      {/* Step 1: Payment Type */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Step 1: What kind of payment?
          <InfoTooltip text="Select whether you're receiving money or paying out" />
        </h3>

        <div className="grid grid-cols-3 gap-4">
          <GlassCard
            className={`p-4 cursor-pointer transition-colors ${
              paymentType === "receipt"
                ? "border-green-500/50 bg-green-500/10"
                : "hover:bg-white/10"
            }`}
            onClick={() => {
              setPaymentType("receipt");
              setPartyId("");
              setOpenDocuments([]);
              setSelectedDocuments({});
            }}
          >
            <div className="flex items-center gap-3">
              <ArrowUpRight className="w-6 h-6 text-green-400" />
              <div>
                <p className="font-medium">Money Received</p>
                <p className="text-xs text-white/50">From customer</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard
            className={`p-4 cursor-pointer transition-colors ${
              paymentType === "payment"
                ? "border-orange-500/50 bg-orange-500/10"
                : "hover:bg-white/10"
            }`}
            onClick={() => {
              setPaymentType("payment");
              setPartyId("");
              setOpenDocuments([]);
              setSelectedDocuments({});
            }}
          >
            <div className="flex items-center gap-3">
              <ArrowDownRight className="w-6 h-6 text-orange-400" />
              <div>
                <p className="font-medium">Money Paid</p>
                <p className="text-xs text-white/50">To vendor/supplier</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard
            className={`p-4 cursor-pointer transition-colors ${
              paymentType === "transfer"
                ? "border-cyan-500/50 bg-cyan-500/10"
                : "hover:bg-white/10"
            }`}
            onClick={() => {
              setPaymentType("transfer");
              setPartyId("");
              setOpenDocuments([]);
              setSelectedDocuments({});
            }}
          >
            <div className="flex items-center gap-3">
              <RefreshCw className="w-6 h-6 text-cyan-400" />
              <div>
                <p className="font-medium">Transfer</p>
                <p className="text-xs text-white/50">Between accounts</p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Step 2: Who */}
      {paymentType !== "transfer" && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center">
            Step 2: {paymentType === "receipt" ? "From which customer?" : "To which vendor?"}
          </h3>

          <GlassSelect
            label={paymentType === "receipt" ? "Customer *" : "Vendor *"}
            value={partyId}
            onChange={(e) => setPartyId(e.target.value)}
            options={[
              { value: "", label: `Select a ${paymentType === "receipt" ? "customer" : "vendor"}...` },
              ...partyOptions.map((p) => ({
                value: p.id,
                label: p.code ? `${p.code} - ${p.name}` : p.name,
              })),
            ]}
          />
        </div>
      )}

      {/* Step 3: How much and when */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Step {paymentType === "transfer" ? "2" : "3"}: How much and when?
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            label="Amount *"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            step="0.01"
          />
          <GlassInput
            label="Date"
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <GlassSelect
            label="Payment Method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            options={paymentMethodOptions}
          />
          <GlassInput
            label="Reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Check #, transaction ID, etc."
          />
        </div>
      </div>

      {/* Step 4: Allocation */}
      {paymentType !== "transfer" && partyId && openDocuments.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center">
            Step 4: Apply to invoices/bills
            <InfoTooltip text="Allocate this payment to specific invoices or bills" />
          </h3>

          <div className="space-y-2">
            {openDocuments.map((doc) => (
              <GlassCard key={doc.id} className="p-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium">{doc.docNumber}</p>
                    <p className="text-sm text-white/50">
                      {new Date(doc.date).toLocaleDateString()} - Remaining: $
                      {parseFloat(doc.remaining).toLocaleString()}
                    </p>
                  </div>
                  <GlassInput
                    type="number"
                    value={selectedDocuments[doc.id] || ""}
                    onChange={(e) => handleDocumentAllocation(doc.id, e.target.value)}
                    placeholder="0.00"
                    className="w-32"
                    step="0.01"
                    max={doc.remaining}
                  />
                </div>
              </GlassCard>
            ))}
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-white/60">Total allocated:</span>
            <span className="font-medium">
              ${getTotalAllocated().toLocaleString()} of ${parseFloat(amount || "0").toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Notes (Optional)</h3>
        <GlassTextarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Any additional notes..."
        />
      </div>

      {/* Summary */}
      {amount && parseFloat(amount) > 0 && (
        <GlassCard className="p-4 border border-white/20 bg-white/5">
          <h4 className="font-semibold mb-2">Summary</h4>
          <p className="text-sm text-white/70">
            {paymentType === "receipt" && (
              <>
                You received <span className="text-green-400 font-medium">${parseFloat(amount).toLocaleString()}</span>
                {partyId && customers.find((c) => c.id === partyId) && (
                  <> from <span className="font-medium">{customers.find((c) => c.id === partyId)?.name}</span></>
                )}
                {` on ${new Date(paymentDate).toLocaleDateString()}`}
              </>
            )}
            {paymentType === "payment" && (
              <>
                You paid <span className="text-orange-400 font-medium">${parseFloat(amount).toLocaleString()}</span>
                {partyId && vendors.find((v) => v.id === partyId) && (
                  <> to <span className="font-medium">{vendors.find((v) => v.id === partyId)?.name}</span></>
                )}
                {` on ${new Date(paymentDate).toLocaleDateString()}`}
              </>
            )}
            {paymentType === "transfer" && (
              <>
                Transfer of <span className="text-cyan-400 font-medium">${parseFloat(amount).toLocaleString()}</span>
                {` on ${new Date(paymentDate).toLocaleDateString()}`}
              </>
            )}
          </p>
        </GlassCard>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-6 border-t border-white/10">
        <GlassButton onClick={onBack} variant="ghost">
          Cancel
        </GlassButton>
        <GlassButton onClick={handleSubmit} variant="primary" disabled={isSubmitting}>
          {isSubmitting ? "Recording..." : "Record Payment"}
        </GlassButton>
      </div>
    </div>
  );
}
