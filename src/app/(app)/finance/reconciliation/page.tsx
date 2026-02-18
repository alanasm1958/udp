"use client";

import * as React from "react";
import Link from "next/link";
import {
  GlassCard,
  GlassButton,
  SlideOver,
  GlassInput,
  PageHeader,
  Spinner,
  useToast,
} from "@/components/ui/glass";
import { apiGet, apiPost, formatCurrency } from "@/lib/http";

interface Account {
  id: string;
  code: string;
  name: string;
}

interface ReconciliationSession {
  id: string;
  accountId: string;
  accountCode: string;
  statementDate: string;
  statementEndingBalance: string;
  bookBalance: string;
  status: "in_progress" | "completed" | "abandoned";
  difference: string | null;
  completedAt: string | null;
  createdAt: string;
}

const STATUS_COLORS = {
  in_progress: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  completed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  abandoned: "bg-red-500/20 text-red-400 border-red-500/30",
};

const STATUS_LABELS = {
  in_progress: "In Progress",
  completed: "Completed",
  abandoned: "Abandoned",
};

export default function ReconciliationPage() {
  const { addToast } = useToast();

  const [bankAccounts, setBankAccounts] = React.useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = React.useState<string>("");
  const [sessions, setSessions] = React.useState<ReconciliationSession[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [accountsLoading, setAccountsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // New session modal
  const [showNewModal, setShowNewModal] = React.useState(false);
  const [newStatementDate, setNewStatementDate] = React.useState(
    new Date().toISOString().split("T")[0]
  );
  const [newEndingBalance, setNewEndingBalance] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  // Load bank accounts (accounts with code starting with 1xxx that are cash/bank)
  React.useEffect(() => {
    async function loadBankAccounts() {
      try {
        const result = await apiGet<{ accounts: Account[] }>("/api/finance/accounts?type=asset");
        // Filter for bank/cash accounts (typically 1000-1199)
        const bankAccts = result.accounts.filter((a) => {
          const code = parseInt(a.code.substring(0, 4));
          return code >= 1000 && code < 1200;
        });
        setBankAccounts(bankAccts);
        if (bankAccts.length > 0 && !selectedAccountId) {
          setSelectedAccountId(bankAccts[0].id);
        }
      } catch (err) {
        console.error("Failed to load bank accounts:", err);
      } finally {
        setAccountsLoading(false);
      }
    }
    loadBankAccounts();
  }, [selectedAccountId]);

  // Load sessions when account changes
  const loadSessions = React.useCallback(async () => {
    if (!selectedAccountId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<{
        account: Account;
        sessions: ReconciliationSession[];
      }>(`/api/finance/reconciliation?accountId=${selectedAccountId}`);
      setSessions(result.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId]);

  React.useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleCreateSession = async () => {
    if (!selectedAccountId || !newStatementDate || !newEndingBalance) {
      addToast("error", "Please fill in all fields");
      return;
    }

    setCreating(true);
    try {
      const session = await apiPost<ReconciliationSession>("/api/finance/reconciliation", {
        accountId: selectedAccountId,
        statementDate: newStatementDate,
        statementEndingBalance: parseFloat(newEndingBalance),
      });

      addToast("success", "Reconciliation session created");
      setShowNewModal(false);
      setNewEndingBalance("");
      loadSessions();

      // Navigate to the new session
      window.location.href = `/finance/reconciliation/${session.id}`;
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setCreating(false);
    }
  };

  const selectedAccount = bankAccounts.find((a) => a.id === selectedAccountId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank Reconciliation"
        description="Match bank statement transactions with book entries"
      />

      {/* Account Selector */}
      <GlassCard padding="sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-white/70 mb-1">Bank Account</label>
            {accountsLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Spinner size="sm" />
                <span className="text-white/50">Loading accounts...</span>
              </div>
            ) : bankAccounts.length === 0 ? (
              <p className="text-white/50 py-2">No bank accounts found</p>
            ) : (
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                {bankAccounts.map((account) => (
                  <option key={account.id} value={account.id} className="bg-gray-900">
                    {account.code} - {account.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <GlassButton onClick={loadSessions} disabled={loading || !selectedAccountId}>
            {loading ? <Spinner size="sm" /> : "Refresh"}
          </GlassButton>
          <GlassButton
            onClick={() => setShowNewModal(true)}
            disabled={!selectedAccountId}
          >
            New Reconciliation
          </GlassButton>
        </div>
      </GlassCard>

      {/* Error */}
      {error && (
        <GlassCard>
          <p className="text-red-400">{error}</p>
        </GlassCard>
      )}

      {/* Sessions List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : sessions.length === 0 ? (
        <GlassCard>
          <div className="text-center py-8">
            <p className="text-white/50">No reconciliation sessions found.</p>
            <p className="text-white/40 text-sm mt-2">
              Click &quot;New Reconciliation&quot; to start reconciling this account.
            </p>
          </div>
        </GlassCard>
      ) : (
        <GlassCard padding="none">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/20 text-white/70 text-sm">
                  <th className="py-3 px-4 text-left font-medium">Statement Date</th>
                  <th className="py-3 px-4 text-right font-medium">Statement Balance</th>
                  <th className="py-3 px-4 text-right font-medium">Book Balance</th>
                  <th className="py-3 px-4 text-right font-medium">Difference</th>
                  <th className="py-3 px-4 text-center font-medium">Status</th>
                  <th className="py-3 px-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="text-white">
                {sessions.map((session) => (
                  <tr key={session.id} className="border-b border-white/10 hover:bg-white/5">
                    <td className="py-3 px-4">{session.statementDate}</td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      {formatCurrency(parseFloat(session.statementEndingBalance))}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      {formatCurrency(parseFloat(session.bookBalance))}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      {session.difference ? (
                        <span
                          className={
                            Math.abs(parseFloat(session.difference)) < 0.01
                              ? "text-emerald-400"
                              : "text-amber-400"
                          }
                        >
                          {formatCurrency(parseFloat(session.difference))}
                        </span>
                      ) : (
                        <span className="text-white/40">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[session.status]}`}
                      >
                        {STATUS_LABELS[session.status]}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link href={`/finance/reconciliation/${session.id}`}>
                        <GlassButton size="sm" variant="ghost">
                          {session.status === "in_progress" ? "Continue" : "View"}
                        </GlassButton>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* New Session Modal */}
      <SlideOver
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="Start New Reconciliation"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-white/70 mb-1">Account</label>
            <p className="text-white font-medium">
              {selectedAccount ? `${selectedAccount.code} - ${selectedAccount.name}` : "-"}
            </p>
          </div>

          <GlassInput
            label="Statement Date"
            type="date"
            value={newStatementDate}
            onChange={(e) => setNewStatementDate(e.target.value)}
          />

          <GlassInput
            label="Statement Ending Balance"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={newEndingBalance}
            onChange={(e) => setNewEndingBalance(e.target.value)}
          />

          <p className="text-sm text-white/50">
            Enter the ending balance shown on your bank statement for this date.
          </p>

          <div className="flex justify-end gap-3 pt-4">
            <GlassButton variant="ghost" onClick={() => setShowNewModal(false)}>
              Cancel
            </GlassButton>
            <GlassButton onClick={handleCreateSession} disabled={creating}>
              {creating ? <Spinner size="sm" /> : "Start Reconciliation"}
            </GlassButton>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
