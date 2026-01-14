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
import { ArrowLeft, Info, Plus, Trash2, FileText } from "lucide-react";

interface CreateInvoiceFormProps {
  onBack: () => void;
  onSuccess: () => void;
}

interface Party {
  id: string;
  name: string;
  code: string | null;
  defaultCurrency?: string;
  metadata?: {
    paymentTerms?: string;
  };
}

interface LineItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  total: number;
}

export default function CreateInvoiceForm({ onBack, onSuccess }: CreateInvoiceFormProps) {
  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [customerId, setCustomerId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [reference, setReference] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("net_30");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: "", quantity: "1", unitPrice: "", total: 0 },
  ]);

  // Data
  const [customers, setCustomers] = useState<Party[]>([]);

  // Load customers on mount
  useEffect(() => {
    loadCustomers();
    generateInvoiceNumber();
  }, []);

  // Calculate due date based on payment terms
  useEffect(() => {
    if (invoiceDate && paymentTerms) {
      const date = new Date(invoiceDate);
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
  }, [invoiceDate, paymentTerms]);

  const loadCustomers = async () => {
    try {
      const res = await fetch("/api/master/parties?type=customer&limit=100");
      if (res.ok) {
        const data = await res.json();
        // Map API response fields to expected format
        setCustomers((data.items || []).map((p: { id: string; displayName: string; code: string | null }) => ({
          id: p.id,
          name: p.displayName,
          code: p.code,
        })));
      }
    } catch (error) {
      console.error("Error loading customers:", error);
    }
  };

  const generateInvoiceNumber = () => {
    const prefix = "INV";
    const date = new Date();
    const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
    setInvoiceNumber(`${prefix}-${yearMonth}-${random}`);
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        updated.total =
          (parseFloat(updated.quantity) || 0) * (parseFloat(updated.unitPrice) || 0);
        return updated;
      })
    );
  };

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: "", quantity: "1", unitPrice: "", total: 0 },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  const getTotal = () => {
    return lineItems.reduce((sum, item) => sum + item.total, 0);
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      if (!customerId) {
        addToast("error", "Please select a customer");
        return;
      }

      const validLines = lineItems.filter(
        (line) => line.description && parseFloat(line.unitPrice) > 0
      );

      if (validLines.length === 0) {
        addToast("error", "Please add at least one line item");
        return;
      }

      const res = await fetch("/api/sales/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "invoice",
          partyId: customerId,
          docNumber: invoiceNumber,
          docDate: invoiceDate,
          dueDate,
          reference: reference || null,
          paymentTerms,
          notes: notes || null,
          lines: validLines.map((line, index) => ({
            lineNumber: index + 1,
            description: line.description,
            quantity: parseFloat(line.quantity) || 1,
            unitPrice: parseFloat(line.unitPrice),
            lineTotal: line.total,
          })),
        }),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const error = await res.json();
        addToast("error", error.message || "Failed to create invoice");
      }
    } catch (error) {
      console.error("Error creating invoice:", error);
      addToast("error", "Failed to create invoice");
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

  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <div className="space-y-6">
      <GlassButton onClick={onBack} variant="ghost" size="sm">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to menu
      </GlassButton>

      {/* Step 1: Customer */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Step 1: Who are you billing?
          <InfoTooltip text="Select the customer to send this invoice to" />
        </h3>

        <GlassSelect
          label="Customer *"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          options={[
            { value: "", label: "Select a customer..." },
            ...customers.map((c) => ({
              value: c.id,
              label: c.code ? `${c.code} - ${c.name}` : c.name,
            })),
          ]}
        />

        {selectedCustomer && (
          <p className="text-sm text-white/50">
            Billing to: <span className="font-medium">{selectedCustomer.name}</span>
          </p>
        )}
      </div>

      {/* Step 2: Line Items */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Step 2: What are you charging for?
        </h3>

        <div className="space-y-3">
          {lineItems.map((item, index) => (
            <GlassCard key={item.id} className="p-4">
              <div className="flex items-start gap-4">
                <span className="text-white/40 text-sm pt-2">{index + 1}.</span>
                <div className="flex-1 grid grid-cols-12 gap-3">
                  <div className="col-span-6">
                    <GlassInput
                      label={index === 0 ? "Description" : ""}
                      value={item.description}
                      onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                      placeholder="Product or service description"
                    />
                  </div>
                  <div className="col-span-2">
                    <GlassInput
                      label={index === 0 ? "Qty" : ""}
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(item.id, "quantity", e.target.value)}
                      placeholder="1"
                      min="1"
                    />
                  </div>
                  <div className="col-span-2">
                    <GlassInput
                      label={index === 0 ? "Price" : ""}
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) => updateLineItem(item.id, "unitPrice", e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                    />
                  </div>
                  <div className="col-span-2 flex items-end justify-between">
                    <div>
                      {index === 0 && <label className="block text-sm font-medium text-white/70 mb-1">Total</label>}
                      <p className="text-lg font-medium py-2">${item.total.toLocaleString()}</p>
                    </div>
                    {lineItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLineItem(item.id)}
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
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

        <GlassButton onClick={addLineItem} variant="ghost" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add another line
        </GlassButton>

        <div className="flex justify-end">
          <div className="text-right">
            <p className="text-sm text-white/60">Invoice Total</p>
            <p className="text-2xl font-bold text-blue-400">${getTotal().toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Step 3: Invoice Details */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Step 3: Invoice details
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            label="Invoice Number"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
          />
          <GlassInput
            label="Reference (PO #, etc.)"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Optional"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <GlassInput
            label="Invoice Date"
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
          />
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

      {/* Notes */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Notes & Instructions</h3>
        <GlassTextarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Additional notes for the customer..."
        />
      </div>

      {/* Summary */}
      {customerId && getTotal() > 0 && (
        <GlassCard className="p-4 border border-white/20 bg-white/5">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            What this creates
          </h4>
          <p className="text-sm text-white/70">
            You&apos;re billing <span className="font-medium">{selectedCustomer?.name}</span> for{" "}
            <span className="text-blue-400 font-medium">${getTotal().toLocaleString()}</span>.
            They should pay by {new Date(dueDate).toLocaleDateString()}.
          </p>
          <p className="text-sm text-white/50 mt-2">
            This will show as &apos;Sales&apos; in your books. They&apos;ll owe you ${getTotal().toLocaleString()} until they pay.
          </p>
        </GlassCard>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-6 border-t border-white/10">
        <GlassButton onClick={onBack} variant="ghost">
          Cancel
        </GlassButton>
        <GlassButton onClick={handleSubmit} variant="primary" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Invoice"}
        </GlassButton>
      </div>
    </div>
  );
}
