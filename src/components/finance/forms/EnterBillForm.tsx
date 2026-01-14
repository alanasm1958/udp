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
import { ArrowLeft, Info, Plus, Trash2, Receipt, Upload } from "lucide-react";

interface EnterBillFormProps {
  onBack: () => void;
  onSuccess: () => void;
}

interface Party {
  id: string;
  name: string;
  code: string | null;
  metadata?: {
    paymentTerms?: string;
  };
}

interface ExpenseCategory {
  id: string;
  code: string;
  name: string;
}

interface LineItem {
  id: string;
  categoryId: string;
  description: string;
  amount: string;
}

export default function EnterBillForm({ onBack, onSuccess }: EnterBillFormProps) {
  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [vendorId, setVendorId] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("net_30");
  const [notes, setNotes] = useState("");
  const [paymentPlan, setPaymentPlan] = useState<"schedule" | "later">("schedule");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), categoryId: "", description: "", amount: "" },
  ]);

  // Data
  const [vendors, setVendors] = useState<Party[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);

  // Load data on mount
  useEffect(() => {
    loadVendors();
    loadCategories();
  }, []);

  // Calculate due date based on payment terms
  useEffect(() => {
    if (billDate && paymentTerms) {
      const date = new Date(billDate);
      const daysToAdd = {
        due_on_receipt: 0,
        net_15: 15,
        net_30: 30,
        net_45: 45,
        net_60: 60,
        net_90: 90,
      }[paymentTerms] || 30;
      date.setDate(date.getDate() + daysToAdd);
      setDueDate(date.toISOString().split("T")[0]);
    }
  }, [billDate, paymentTerms]);

  const loadVendors = async () => {
    try {
      const res = await fetch("/api/master/parties?type=vendor&limit=100");
      if (res.ok) {
        const data = await res.json();
        // Map API response fields to expected format
        setVendors((data.items || []).map((p: { id: string; displayName: string; code: string | null }) => ({
          id: p.id,
          name: p.displayName,
          code: p.code,
        })));
      }
    } catch (error) {
      console.error("Error loading vendors:", error);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await fetch("/api/finance/accounts?type=expense&limit=100");
      if (res.ok) {
        const data = await res.json();
        setCategories(data.accounts || []);
      }
    } catch (error) {
      console.error("Error loading categories:", error);
      // Default categories
      setCategories([
        { id: "supplies", code: "6100", name: "Office Supplies" },
        { id: "services", code: "6200", name: "Professional Services" },
        { id: "utilities", code: "6300", name: "Utilities" },
        { id: "rent", code: "6400", name: "Rent & Lease" },
        { id: "other", code: "6900", name: "Other Expenses" },
      ]);
    }
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), categoryId: "", description: "", amount: "" },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  const getTotal = () => {
    return lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      if (!vendorId) {
        addToast("error", "Please select a vendor");
        return;
      }

      if (!billNumber) {
        addToast("error", "Please enter the vendor's bill/invoice number");
        return;
      }

      const validLines = lineItems.filter((line) => parseFloat(line.amount) > 0);

      if (validLines.length === 0) {
        addToast("error", "Please add at least one line item with an amount");
        return;
      }

      const res = await fetch("/api/procurement/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "invoice",
          partyId: vendorId,
          docNumber: billNumber,
          docDate: billDate,
          dueDate,
          paymentTerms,
          notes: notes || null,
          lines: validLines.map((line, index) => ({
            lineNumber: index + 1,
            categoryId: line.categoryId || null,
            description: line.description || "Bill line item",
            quantity: 1,
            unitPrice: parseFloat(line.amount),
            lineTotal: parseFloat(line.amount),
          })),
        }),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const error = await res.json();
        addToast("error", error.message || "Failed to enter bill");
      }
    } catch (error) {
      console.error("Error entering bill:", error);
      addToast("error", "Failed to enter bill");
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

  const paymentTermsOptions = [
    { value: "due_on_receipt", label: "Due on Receipt" },
    { value: "net_15", label: "Net 15" },
    { value: "net_30", label: "Net 30" },
    { value: "net_45", label: "Net 45" },
    { value: "net_60", label: "Net 60" },
    { value: "net_90", label: "Net 90" },
  ];

  const selectedVendor = vendors.find((v) => v.id === vendorId);

  return (
    <div className="space-y-6">
      <GlassButton onClick={onBack} variant="ghost" size="sm">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to menu
      </GlassButton>

      {/* Step 1: Upload Bill */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Step 1: Upload bill (Optional)
          <InfoTooltip text="Upload the bill PDF or image for automatic extraction" />
        </h3>

        <GlassCard className="p-6 border border-dashed border-white/20 text-center">
          <Upload className="w-8 h-8 text-white/40 mx-auto mb-2" />
          <p className="text-sm text-white/60">Drag & drop bill or click to upload</p>
          <p className="text-xs text-white/40 mt-1">OCR extraction coming soon...</p>
        </GlassCard>
      </div>

      {/* Step 2: Vendor */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Step 2: Who sent this bill?
        </h3>

        <GlassSelect
          label="Vendor *"
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
          options={[
            { value: "", label: "Select a vendor..." },
            ...vendors.map((v) => ({
              value: v.id,
              label: v.code ? `${v.code} - ${v.name}` : v.name,
            })),
          ]}
        />
      </div>

      {/* Step 3: Bill Details */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Step 3: Bill details
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            label="Vendor's Bill/Invoice # *"
            value={billNumber}
            onChange={(e) => setBillNumber(e.target.value)}
            placeholder="Vendor's invoice number"
          />
          <GlassInput
            label="Bill Date"
            type="date"
            value={billDate}
            onChange={(e) => setBillDate(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <GlassSelect
            label="Payment Terms"
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            options={paymentTermsOptions}
          />
          <GlassInput
            label="Due Date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>

      {/* Step 4: Line Items */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Step 4: What is this bill for?
        </h3>

        <div className="space-y-3">
          {lineItems.map((item, index) => (
            <GlassCard key={item.id} className="p-4">
              <div className="flex items-start gap-4">
                <span className="text-white/40 text-sm pt-2">{index + 1}.</span>
                <div className="flex-1 grid grid-cols-12 gap-3">
                  <div className="col-span-4">
                    <GlassSelect
                      label={index === 0 ? "Category" : ""}
                      value={item.categoryId}
                      onChange={(e) => updateLineItem(item.id, "categoryId", e.target.value)}
                      options={[
                        { value: "", label: "Select category..." },
                        ...categories.map((c) => ({
                          value: c.id,
                          label: c.code ? `${c.code} - ${c.name}` : c.name,
                        })),
                      ]}
                    />
                  </div>
                  <div className="col-span-5">
                    <GlassInput
                      label={index === 0 ? "Description" : ""}
                      value={item.description}
                      onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                      placeholder="Line item description"
                    />
                  </div>
                  <div className="col-span-3 flex items-end gap-2">
                    <GlassInput
                      label={index === 0 ? "Amount" : ""}
                      type="number"
                      value={item.amount}
                      onChange={(e) => updateLineItem(item.id, "amount", e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                    />
                    {lineItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLineItem(item.id)}
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg mb-0.5"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>

        <div className="flex justify-between items-center">
          <GlassButton onClick={addLineItem} variant="ghost" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add another line
          </GlassButton>

          <div className="text-right">
            <p className="text-sm text-white/60">Bill Total</p>
            <p className="text-2xl font-bold text-orange-400">${getTotal().toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Step 5: Payment Plan */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Step 5: Payment plan
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <GlassCard
            className={`p-4 cursor-pointer transition-colors ${
              paymentPlan === "schedule"
                ? "border-green-500/50 bg-green-500/10"
                : "hover:bg-white/10"
            }`}
            onClick={() => setPaymentPlan("schedule")}
          >
            <p className="font-medium">Schedule for due date</p>
            <p className="text-xs text-white/50">Pay on {dueDate ? new Date(dueDate).toLocaleDateString() : "due date"}</p>
          </GlassCard>

          <GlassCard
            className={`p-4 cursor-pointer transition-colors ${
              paymentPlan === "later"
                ? "border-yellow-500/50 bg-yellow-500/10"
                : "hover:bg-white/10"
            }`}
            onClick={() => setPaymentPlan("later")}
          >
            <p className="font-medium">I&apos;ll decide later</p>
            <p className="text-xs text-white/50">Just record the bill for now</p>
          </GlassCard>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-4">
        <GlassTextarea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Any additional notes..."
        />
      </div>

      {/* Summary */}
      {vendorId && getTotal() > 0 && (
        <GlassCard className="p-4 border border-white/20 bg-white/5">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            What this records
          </h4>
          <p className="text-sm text-white/70">
            This <span className="text-orange-400 font-medium">${getTotal().toLocaleString()}</span> bill from{" "}
            <span className="font-medium">{selectedVendor?.name}</span> will be recorded.
          </p>
          <p className="text-sm text-white/50 mt-2">
            It will show in this month&apos;s expenses. You&apos;ll owe {selectedVendor?.name} ${getTotal().toLocaleString()} until you pay.
          </p>
          {paymentPlan === "schedule" && dueDate && (
            <p className="text-sm text-green-400 mt-2">
              Payment scheduled for {new Date(dueDate).toLocaleDateString()}
            </p>
          )}
        </GlassCard>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-6 border-t border-white/10">
        <GlassButton onClick={onBack} variant="ghost">
          Cancel
        </GlassButton>
        <GlassButton onClick={handleSubmit} variant="primary" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Enter Bill"}
        </GlassButton>
      </div>
    </div>
  );
}
