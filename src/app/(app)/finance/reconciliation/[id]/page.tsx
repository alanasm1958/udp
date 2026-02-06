"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  GlassCard,
  GlassButton,
  SlideOver,
  ConfirmDialog,
  PageHeader,
  Spinner,
  useToast,
} from "@/components/ui/glass";
import { apiGet, apiPost, apiDelete, formatCurrency } from "@/lib/http";

interface StatementLine {
  id: string;
  transactionDate: string;
  description: string;
  reference: string | null;
  amount: number;
  transactionType: string | null;
  status: string;
  matchedPaymentId: string | null;
  matchedJournalEntryId: string | null;
  matchConfidence: number | null;
  isMatched: boolean;
}

interface BookTransaction {
  id: string;
  journalEntryId: string;
  postingDate: string;
  memo: string | null;
  description: string | null;
  debit: number;
  credit: number;
  amount: number;
  isMatched: boolean;
}

interface Session {
  id: string;
  accountId: string;
  accountCode: string;
  statementDate: string;
  statementEndingBalance: string;
  bookBalance: string;
  status: "in_progress" | "completed" | "abandoned";
  difference: string | null;
  account: {
    id: string;
    code: string;
    name: string;
  };
}

interface Summary {
  statementEndingBalance: number;
  bookBalance: number;
  reconciledBalance: number;
  difference: number;
  matchedStatementCount: number;
  unmatchedStatementCount: number;
  unmatchedBookCount: number;
  totalStatementLines: number;
  totalBookTransactions: number;
}

export default function ReconciliationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const id = params.id as string;

  const [session, setSession] = React.useState<Session | null>(null);
  const [statementLines, setStatementLines] = React.useState<StatementLine[]>([]);
  const [bookTransactions, setBookTransactions] = React.useState<BookTransaction[]>([]);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Selection state for matching
  const [selectedStatementLine, setSelectedStatementLine] = React.useState<string | null>(null);
  const [selectedBookTransaction, setSelectedBookTransaction] = React.useState<string | null>(null);

  // Import modal
  const [showImportModal, setShowImportModal] = React.useState(false);
  const [csvContent, setCsvContent] = React.useState("");
  const [importing, setImporting] = React.useState(false);

  // Action states
  const [matching, setMatching] = React.useState(false);
  const [autoMatching, setAutoMatching] = React.useState(false);
  const [completing, setCompleting] = React.useState(false);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<{
        session: Session;
        statementLines: StatementLine[];
        bookTransactions: BookTransaction[];
        summary: Summary;
      }>(`/api/finance/reconciliation/${id}`);
      setSession(result.session);
      setStatementLines(result.statementLines);
      setBookTransactions(result.bookTransactions);
      setSummary(result.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reconciliation");
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleImportCSV = async () => {
    if (!csvContent.trim()) {
      addToast("error", "Please paste CSV content");
      return;
    }

    setImporting(true);
    try {
      const result = await apiPost<{ imported: number }>(`/api/finance/reconciliation/${id}/import`, {
        csvContent,
      });
      addToast("success", `Imported ${result.imported} statement lines`);
      setShowImportModal(false);
      setCsvContent("");
      loadData();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to import CSV");
    } finally {
      setImporting(false);
    }
  };

  const handleMatch = async () => {
    if (!selectedStatementLine || !selectedBookTransaction) {
      addToast("error", "Select a statement line and book transaction to match");
      return;
    }

    // Find the book transaction to get its journal entry ID
    const bookTx = bookTransactions.find((tx) => tx.id === selectedBookTransaction);
    if (!bookTx) return;

    setMatching(true);
    try {
      await apiPost(`/api/finance/reconciliation/${id}/match`, {
        statementLineId: selectedStatementLine,
        journalEntryId: bookTx.journalEntryId,
      });
      addToast("success", "Items matched");
      setSelectedStatementLine(null);
      setSelectedBookTransaction(null);
      loadData();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to match");
    } finally {
      setMatching(false);
    }
  };

  const handleUnmatch = async (statementLineId: string) => {
    try {
      await apiDelete(`/api/finance/reconciliation/${id}/match?statementLineId=${statementLineId}`);
      addToast("success", "Match removed");
      loadData();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to unmatch");
    }
  };

  const handleAutoMatch = async () => {
    setAutoMatching(true);
    try {
      const result = await apiPost<{ matched: number; remaining: number }>(
        `/api/finance/reconciliation/${id}/auto-match`,
        {}
      );
      if (result.matched > 0) {
        addToast("success", `Auto-matched ${result.matched} items`);
        loadData();
      } else {
        addToast("info", "No matching items found");
      }
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Auto-match failed");
    } finally {
      setAutoMatching(false);
    }
  };

  const handleComplete = async (force = false) => {
    setCompleting(true);
    try {
      await apiPost(`/api/finance/reconciliation/${id}/complete`, { force });
      addToast("success", "Reconciliation completed");
      loadData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to complete";
      if (errorMsg.includes("not balanced") && !force) {
        if (confirm("Reconciliation is not balanced. Complete anyway?")) {
          handleComplete(true);
          return;
        }
      }
      addToast("error", errorMsg);
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <GlassCard>
        <p className="text-red-400">{error || "Session not found"}</p>
        <GlassButton className="mt-4" onClick={() => router.push("/finance/reconciliation")}>
          Back to Reconciliation
        </GlassButton>
      </GlassCard>
    );
  }

  const isInProgress = session.status === "in_progress";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Reconciliation: ${session.account.code} - ${session.account.name}`}
        description={`Statement Date: ${session.statementDate}`}
      />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard padding="sm">
          <div className="text-sm text-white/50">Statement Balance</div>
          <div className="text-xl font-bold text-white tabular-nums">
            {formatCurrency(summary?.statementEndingBalance || 0)}
          </div>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="text-sm text-white/50">Book Balance</div>
          <div className="text-xl font-bold text-white tabular-nums">
            {formatCurrency(summary?.bookBalance || 0)}
          </div>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="text-sm text-white/50">Reconciled</div>
          <div className="text-xl font-bold text-white tabular-nums">
            {formatCurrency(summary?.reconciledBalance || 0)}
          </div>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="text-sm text-white/50">Difference</div>
          <div
            className={`text-xl font-bold tabular-nums ${
              Math.abs(summary?.difference || 0) < 0.01
                ? "text-emerald-400"
                : "text-amber-400"
            }`}
          >
            {formatCurrency(summary?.difference || 0)}
          </div>
        </GlassCard>
      </div>

      {/* Actions */}
      {isInProgress && (
        <GlassCard padding="sm">
          <div className="flex flex-wrap items-center gap-3">
            <GlassButton onClick={() => setShowImportModal(true)}>
              Import CSV
            </GlassButton>
            <GlassButton
              onClick={handleAutoMatch}
              disabled={autoMatching || statementLines.filter((l) => !l.isMatched).length === 0}
              variant="ghost"
            >
              {autoMatching ? <Spinner size="sm" /> : "Auto-Match"}
            </GlassButton>
            <GlassButton
              onClick={handleMatch}
              disabled={matching || !selectedStatementLine || !selectedBookTransaction}
              variant="ghost"
            >
              {matching ? <Spinner size="sm" /> : "Match Selected"}
            </GlassButton>
            <div className="flex-1" />
            <GlassButton
              onClick={() => handleComplete(false)}
              disabled={completing}
            >
              {completing ? <Spinner size="sm" /> : "Complete Reconciliation"}
            </GlassButton>
          </div>
        </GlassCard>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Statement Lines */}
        <GlassCard padding="none">
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Bank Statement</h3>
              <span className="text-sm text-white/50">
                {summary?.matchedStatementCount || 0} / {summary?.totalStatementLines || 0} matched
              </span>
            </div>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {statementLines.length === 0 ? (
              <div className="p-4 text-center text-white/50">
                No statement lines imported.
                {isInProgress && " Click Import CSV to add bank transactions."}
              </div>
            ) : (
              <table className="w-full">
                <thead className="sticky top-0 bg-white/10">
                  <tr className="text-xs text-white/50">
                    <th className="py-2 px-3 text-left">Date</th>
                    <th className="py-2 px-3 text-left">Description</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                    <th className="py-2 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {statementLines.map((line) => (
                    <tr
                      key={line.id}
                      className={`border-t border-white/5 cursor-pointer transition-colors ${
                        selectedStatementLine === line.id
                          ? "bg-blue-500/20"
                          : line.isMatched
                            ? "bg-emerald-500/10"
                            : "hover:bg-white/5"
                      }`}
                      onClick={() => {
                        if (isInProgress && !line.isMatched) {
                          setSelectedStatementLine(
                            selectedStatementLine === line.id ? null : line.id
                          );
                        }
                      }}
                    >
                      <td className="py-2 px-3 text-sm text-white/70">{line.transactionDate}</td>
                      <td className="py-2 px-3 text-sm text-white truncate max-w-[200px]">
                        {line.description}
                      </td>
                      <td
                        className={`py-2 px-3 text-sm text-right tabular-nums ${
                          line.amount >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {formatCurrency(line.amount)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {line.isMatched ? (
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-xs text-emerald-400">Matched</span>
                            {isInProgress && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUnmatch(line.id);
                                }}
                                className="text-xs text-white/40 hover:text-red-400"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-white/40">Unmatched</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </GlassCard>

        {/* Book Transactions */}
        <GlassCard padding="none">
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Book Transactions</h3>
              <span className="text-sm text-white/50">
                {(summary?.totalBookTransactions || 0) - (summary?.unmatchedBookCount || 0)} / {summary?.totalBookTransactions || 0} matched
              </span>
            </div>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {bookTransactions.length === 0 ? (
              <div className="p-4 text-center text-white/50">
                No book transactions found for this account.
              </div>
            ) : (
              <table className="w-full">
                <thead className="sticky top-0 bg-white/10">
                  <tr className="text-xs text-white/50">
                    <th className="py-2 px-3 text-left">Date</th>
                    <th className="py-2 px-3 text-left">Description</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                    <th className="py-2 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bookTransactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className={`border-t border-white/5 cursor-pointer transition-colors ${
                        selectedBookTransaction === tx.id
                          ? "bg-blue-500/20"
                          : tx.isMatched
                            ? "bg-emerald-500/10"
                            : "hover:bg-white/5"
                      }`}
                      onClick={() => {
                        if (isInProgress && !tx.isMatched) {
                          setSelectedBookTransaction(
                            selectedBookTransaction === tx.id ? null : tx.id
                          );
                        }
                      }}
                    >
                      <td className="py-2 px-3 text-sm text-white/70">{tx.postingDate}</td>
                      <td className="py-2 px-3 text-sm text-white truncate max-w-[200px]">
                        {tx.description || tx.memo || "-"}
                      </td>
                      <td
                        className={`py-2 px-3 text-sm text-right tabular-nums ${
                          tx.amount >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {tx.isMatched ? (
                          <span className="text-xs text-emerald-400">Matched</span>
                        ) : (
                          <span className="text-xs text-white/40">Unmatched</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Back Button */}
      <GlassButton variant="ghost" onClick={() => router.push("/finance/reconciliation")}>
        ← Back to Reconciliation
      </GlassButton>

      {/* Import Modal */}
      <SlideOver
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Import Bank Statement CSV"
      >
        <div className="space-y-4">
          <p className="text-sm text-white/70">
            Paste your bank statement CSV content below. The CSV should have columns for
            Date, Description, and Amount.
          </p>
          <textarea
            value={csvContent}
            onChange={(e) => setCsvContent(e.target.value)}
            placeholder="Date,Description,Amount
2024-01-15,Deposit,1500.00
2024-01-16,Check #1001,-125.50"
            className="w-full h-48 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white font-mono text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
          />
          <div className="flex justify-end gap-3">
            <GlassButton variant="ghost" onClick={() => setShowImportModal(false)}>
              Cancel
            </GlassButton>
            <GlassButton onClick={handleImportCSV} disabled={importing}>
              {importing ? <Spinner size="sm" /> : "Import"}
            </GlassButton>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
