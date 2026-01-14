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
import { ArrowLeft, Info, Upload, Receipt } from "lucide-react";

interface RecordExpenseFormProps {
  onBack: () => void;
  onSuccess: () => void;
}

interface ExpenseCategory {
  id: string;
  code: string;
  name: string;
}

export default function RecordExpenseForm({ onBack, onSuccess }: RecordExpenseFormProps) {
  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paidBy, setPaidBy] = useState("company");
  const [paymentMethod, setPaymentMethod] = useState("bank");
  const [vendor, setVendor] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  // Data
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);

  // Load categories on mount
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      // Load expense accounts from chart of accounts
      const res = await fetch("/api/finance/accounts?type=expense&limit=100");
      if (res.ok) {
        const data = await res.json();
        setCategories(data.accounts || []);
      }
    } catch (error) {
      console.error("Error loading categories:", error);
      // Provide default categories if API fails
      setCategories([
        { id: "meals", code: "6100", name: "Meals & Entertainment" },
        { id: "travel", code: "6200", name: "Travel Expenses" },
        { id: "supplies", code: "6300", name: "Office Supplies" },
        { id: "software", code: "6400", name: "Software & Subscriptions" },
        { id: "utilities", code: "6500", name: "Utilities" },
        { id: "fuel", code: "6600", name: "Fuel & Transportation" },
        { id: "repairs", code: "6700", name: "Repairs & Maintenance" },
        { id: "other", code: "6900", name: "Other Expenses" },
      ]);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      if (!amount || parseFloat(amount) <= 0) {
        addToast("error", "Please enter a valid amount");
        return;
      }

      if (!description) {
        addToast("error", "Please enter a description");
        return;
      }

      const res = await fetch("/api/finance/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          expenseDate,
          description,
          categoryId: categoryId || null,
          paidBy,
          paymentMethod,
          vendor: vendor || null,
          reference: reference || null,
          notes: notes || null,
        }),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const error = await res.json();
        addToast("error", error.message || "Failed to record expense");
      }
    } catch (error) {
      console.error("Error recording expense:", error);
      addToast("error", "Failed to record expense");
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
    { value: "credit_card", label: "Credit Card" },
    { value: "petty_cash", label: "Petty Cash" },
    { value: "other", label: "Other" },
  ];

  const paidByOptions = [
    { value: "company", label: "Company paid directly" },
    { value: "employee", label: "Employee paid (needs reimbursement)" },
  ];

  // Common expense categories at top
  const quickCategories = [
    { id: "meals", name: "Meals", icon: "🍽️" },
    { id: "travel", name: "Travel", icon: "✈️" },
    { id: "supplies", name: "Supplies", icon: "📦" },
    { id: "software", name: "Software", icon: "💻" },
    { id: "fuel", name: "Fuel", icon: "⛽" },
  ];

  return (
    <div className="space-y-6">
      <GlassButton onClick={onBack} variant="ghost" size="sm">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to menu
      </GlassButton>

      {/* Step 1: Amount and Date */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Step 1: How much?
          <InfoTooltip text="Enter the expense amount" />
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
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
          />
        </div>
      </div>

      {/* Step 2: Description */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Step 2: What was it for?
        </h3>

        <GlassInput
          label="Description *"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the expense..."
        />

        <GlassInput
          label="Vendor/Merchant"
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          placeholder="Who did you pay?"
        />
      </div>

      {/* Step 3: Category */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Step 3: Category
          <InfoTooltip text="Categorizing expenses helps with tax deductions and reporting" />
        </h3>

        {/* Quick categories */}
        <div className="flex flex-wrap gap-2">
          {quickCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryId(cat.id)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                categoryId === cat.id
                  ? "bg-blue-500/30 border border-blue-500/50"
                  : "bg-white/5 border border-white/10 hover:bg-white/10"
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>

        <GlassSelect
          label="Or select from full list"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          options={[
            { value: "", label: "Select a category..." },
            ...categories.map((c) => ({
              value: c.id,
              label: c.code ? `${c.code} - ${c.name}` : c.name,
            })),
          ]}
        />
      </div>

      {/* Step 4: Receipt */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Step 4: Receipt (Optional)
          <InfoTooltip text="Receipts help with taxes and audits" />
        </h3>

        <GlassCard className="p-6 border border-dashed border-white/20 text-center">
          <Upload className="w-8 h-8 text-white/40 mx-auto mb-2" />
          <p className="text-sm text-white/60">Drag & drop receipt or click to upload</p>
          <p className="text-xs text-white/40 mt-1">Coming soon...</p>
        </GlassCard>
      </div>

      {/* Step 5: Who Paid */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Step 5: Who paid?
          <InfoTooltip text="For tracking reimbursements" />
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <GlassCard
            className={`p-4 cursor-pointer transition-colors ${
              paidBy === "company"
                ? "border-green-500/50 bg-green-500/10"
                : "hover:bg-white/10"
            }`}
            onClick={() => setPaidBy("company")}
          >
            <p className="font-medium">Company paid</p>
            <p className="text-xs text-white/50">Paid directly by the company</p>
          </GlassCard>

          <GlassCard
            className={`p-4 cursor-pointer transition-colors ${
              paidBy === "employee"
                ? "border-orange-500/50 bg-orange-500/10"
                : "hover:bg-white/10"
            }`}
            onClick={() => setPaidBy("employee")}
          >
            <p className="font-medium">Employee paid</p>
            <p className="text-xs text-white/50">Needs reimbursement</p>
          </GlassCard>
        </div>

        {paidBy === "company" && (
          <GlassSelect
            label="Payment Method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            options={paymentMethodOptions}
          />
        )}
      </div>

      {/* Reference */}
      <div className="space-y-4">
        <GlassInput
          label="Reference (Optional)"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Invoice #, receipt #, etc."
        />

        <GlassTextarea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Any additional notes..."
        />
      </div>

      {/* Summary */}
      {amount && parseFloat(amount) > 0 && (
        <GlassCard className="p-4 border border-white/20 bg-white/5">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            What this records
          </h4>
          <p className="text-sm text-white/70">
            This <span className="text-orange-400 font-medium">${parseFloat(amount).toLocaleString()}</span> expense
            {description && <> for &quot;{description}&quot;</>}
            {vendor && <> from {vendor}</>}
            {" "}will show in this month&apos;s profit/loss report.
          </p>
          {paidBy === "employee" && (
            <p className="text-sm text-yellow-400 mt-2">
              Note: This will create a reimbursement due to the employee.
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
          {isSubmitting ? "Recording..." : "Record Expense"}
        </GlassButton>
      </div>
    </div>
  );
}
