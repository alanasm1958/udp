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
import { ArrowLeft, Info, Plus, Trash2, BookOpen, AlertTriangle } from "lucide-react";

interface ManualJournalFormProps {
  onBack: () => void;
  onSuccess: () => void;
}

interface Account {
  id: string;
  code: string;
  name: string;
  accountType: string;
}

interface JournalLine {
  id: string;
  accountId: string;
  description: string;
  debit: string;
  credit: string;
}

export default function ManualJournalForm({ onBack, onSuccess }: ManualJournalFormProps) {
  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [reference, setReference] = useState("");
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<JournalLine[]>([
    { id: crypto.randomUUID(), accountId: "", description: "", debit: "", credit: "" },
    { id: crypto.randomUUID(), accountId: "", description: "", debit: "", credit: "" },
  ]);

  // Data
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Load accounts on mount
  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const res = await fetch("/api/finance/accounts?limit=500");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error("Error loading accounts:", error);
    }
  };

  const updateLine = (id: string, field: keyof JournalLine, value: string) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;
        const updated = { ...line, [field]: value };
        // Clear the opposite side when entering a value
        if (field === "debit" && value) {
          updated.credit = "";
        } else if (field === "credit" && value) {
          updated.debit = "";
        }
        return updated;
      })
    );
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { id: crypto.randomUUID(), accountId: "", description: "", debit: "", credit: "" },
    ]);
  };

  const removeLine = (id: string) => {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((line) => line.id !== id));
  };

  const getTotalDebits = () => {
    return lines.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0);
  };

  const getTotalCredits = () => {
    return lines.reduce((sum, line) => sum + (parseFloat(line.credit) || 0), 0);
  };

  const isBalanced = () => {
    const debits = getTotalDebits();
    const credits = getTotalCredits();
    return Math.abs(debits - credits) < 0.01 && debits > 0;
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      if (!isBalanced()) {
        addToast("error", "Journal entry must be balanced (debits must equal credits)");
        return;
      }

      const validLines = lines.filter(
        (line) => line.accountId && (parseFloat(line.debit) > 0 || parseFloat(line.credit) > 0)
      );

      if (validLines.length < 2) {
        addToast("error", "Journal entry must have at least two lines with amounts");
        return;
      }

      const res = await fetch("/api/finance/journal-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryDate,
          reference: reference || null,
          memo: memo || null,
          sourceType: "manual",
          lines: validLines.map((line, index) => ({
            lineNumber: index + 1,
            accountId: line.accountId,
            description: line.description || null,
            debit: parseFloat(line.debit) || 0,
            credit: parseFloat(line.credit) || 0,
          })),
        }),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const error = await res.json();
        addToast("error", error.message || "Failed to create journal entry");
      }
    } catch (error) {
      console.error("Error creating journal entry:", error);
      addToast("error", "Failed to create journal entry");
    } finally {
      setIsSubmitting(false);
    }
  };

  const InfoTooltip = ({ text }: { text: string }) => (
    <div className="group relative inline-block ml-2">
      <Info className="w-4 h-4 text-white/40 cursor-help" />
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-72">
        <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl border border-white/10">
          {text}
        </div>
      </div>
    </div>
  );

  // Group accounts by type for easier selection
  const groupedAccounts = accounts.reduce((acc, account) => {
    const type = account.accountType;
    if (!acc[type]) acc[type] = [];
    acc[type].push(account);
    return acc;
  }, {} as Record<string, Account[]>);

  const accountTypeLabels: Record<string, string> = {
    asset: "Assets",
    liability: "Liabilities",
    equity: "Equity",
    income: "Income",
    expense: "Expenses",
    contra_asset: "Contra Assets",
    contra_liability: "Contra Liabilities",
    contra_equity: "Contra Equity",
    contra_income: "Contra Income",
    contra_expense: "Contra Expenses",
  };

  return (
    <div className="space-y-6">
      <GlassButton onClick={onBack} variant="ghost" size="sm">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to menu
      </GlassButton>

      {/* Warning */}
      <GlassCard className="p-4 border border-yellow-500/30 bg-yellow-500/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-400">Advanced Feature</p>
            <p className="text-sm text-white/60 mt-1">
              Manual journal entries directly affect your books. For most transactions, use the other
              entry forms (payments, invoices, bills) which automatically create correct journal entries.
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Entry Details */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Entry Details
          <InfoTooltip text="Basic information about this journal entry" />
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            label="Entry Date"
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
          />
          <GlassInput
            label="Reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Optional reference number"
          />
        </div>

        <GlassTextarea
          label="Memo"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={2}
          placeholder="Description of this journal entry..."
        />
      </div>

      {/* Journal Lines */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Journal Lines
          <InfoTooltip text="Each journal entry must have at least two lines and total debits must equal total credits" />
        </h3>

        <div className="space-y-3">
          {/* Header */}
          <div className="grid grid-cols-12 gap-3 px-4 text-sm font-medium text-white/60">
            <div className="col-span-4">Account</div>
            <div className="col-span-3">Description</div>
            <div className="col-span-2 text-right">Debit</div>
            <div className="col-span-2 text-right">Credit</div>
            <div className="col-span-1"></div>
          </div>

          {lines.map((line, index) => (
            <GlassCard key={line.id} className="p-3">
              <div className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-4">
                  <GlassSelect
                    value={line.accountId}
                    onChange={(e) => updateLine(line.id, "accountId", e.target.value)}
                    options={[
                      { value: "", label: "Select account..." },
                      ...Object.entries(groupedAccounts).flatMap(([type, accts]) => [
                        { value: `group-${type}`, label: `── ${accountTypeLabels[type] || type} ──`, disabled: true },
                        ...accts.map((a) => ({
                          value: a.id,
                          label: `${a.code} - ${a.name}`,
                        })),
                      ]),
                    ]}
                  />
                </div>
                <div className="col-span-3">
                  <GlassInput
                    value={line.description}
                    onChange={(e) => updateLine(line.id, "description", e.target.value)}
                    placeholder="Line memo"
                  />
                </div>
                <div className="col-span-2">
                  <GlassInput
                    type="number"
                    value={line.debit}
                    onChange={(e) => updateLine(line.id, "debit", e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    className="text-right"
                  />
                </div>
                <div className="col-span-2">
                  <GlassInput
                    type="number"
                    value={line.credit}
                    onChange={(e) => updateLine(line.id, "credit", e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    className="text-right"
                  />
                </div>
                <div className="col-span-1 flex justify-center">
                  {lines.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>

        <GlassButton onClick={addLine} variant="ghost" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add line
        </GlassButton>

        {/* Totals */}
        <div className="grid grid-cols-12 gap-3 px-4 pt-4 border-t border-white/10">
          <div className="col-span-7 text-right font-medium">Totals:</div>
          <div className="col-span-2 text-right">
            <span className={`font-bold ${isBalanced() ? "text-green-400" : "text-white"}`}>
              ${getTotalDebits().toLocaleString()}
            </span>
          </div>
          <div className="col-span-2 text-right">
            <span className={`font-bold ${isBalanced() ? "text-green-400" : "text-white"}`}>
              ${getTotalCredits().toLocaleString()}
            </span>
          </div>
          <div className="col-span-1"></div>
        </div>

        {/* Balance indicator */}
        <div className="text-center">
          {isBalanced() ? (
            <span className="inline-flex items-center gap-2 text-green-400 text-sm">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              Entry is balanced
            </span>
          ) : getTotalDebits() > 0 || getTotalCredits() > 0 ? (
            <span className="inline-flex items-center gap-2 text-red-400 text-sm">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              Out of balance by ${Math.abs(getTotalDebits() - getTotalCredits()).toLocaleString()}
            </span>
          ) : null}
        </div>
      </div>

      {/* Summary */}
      {isBalanced() && (
        <GlassCard className="p-4 border border-white/20 bg-white/5">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Entry Summary
          </h4>
          <p className="text-sm text-white/70">
            This journal entry will post <span className="font-medium">${getTotalDebits().toLocaleString()}</span> to your general ledger
            on {new Date(entryDate).toLocaleDateString()}.
          </p>
        </GlassCard>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-6 border-t border-white/10">
        <GlassButton onClick={onBack} variant="ghost">
          Cancel
        </GlassButton>
        <GlassButton
          onClick={handleSubmit}
          variant="primary"
          disabled={isSubmitting || !isBalanced()}
        >
          {isSubmitting ? "Posting..." : "Post Journal Entry"}
        </GlassButton>
      </div>
    </div>
  );
}
