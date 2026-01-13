"use client";

import { useState, useEffect } from "react";
import {
  GlassCard,
  GlassButton,
  GlassInput,
  PageHeader,
} from "@/components/ui/glass";
import { Search, ChevronDown, ChevronRight } from "lucide-react";

interface JournalEntry {
  id: string;
  postingDate: string;
  entryDate: string;
  memo: string | null;
  sourceTransactionSetId: string | null;
  postedAt: string;
  totalDebit: string;
  totalCredit: string;
  lines?: JournalLine[];
}

interface JournalLine {
  id: string;
  accountCode: string | null;
  accountName: string | null;
  description: string | null;
  debit: string;
  credit: string;
  lineNo: number;
}

export default function JournalsPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/finance/journal-entries?limit=100");
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } catch (error) {
      console.error("Error loading journal entries:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSourceLabel = (sourceId: string | null) => {
    if (!sourceId) return "Manual";
    return "Transaction";
  };

  const toggleExpand = (id: string) => {
    setExpandedEntry(expandedEntry === id ? null : id);
  };

  const filteredEntries = entries.filter((entry) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      entry.id?.toLowerCase().includes(query) ||
      entry.memo?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal Entries"
        description="View all general ledger entries"
      />

      {/* Filters */}
      <GlassCard padding="sm">
        <div className="flex gap-4 items-end">
          <div className="flex-1 max-w-md">
            <GlassInput
              label="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by memo..."
            />
          </div>
          <GlassButton onClick={loadEntries} variant="ghost">
            <Search className="w-4 h-4 mr-2" />
            Refresh
          </GlassButton>
        </div>
      </GlassCard>

      {/* Entries List */}
      <GlassCard padding="none">
        {isLoading ? (
          <div className="p-8 text-center text-white/40 text-sm">Loading journal entries...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-8 text-center text-white/40 text-sm">
            No journal entries found.
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {/* Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-white/5 text-sm font-medium text-white/60">
              <div className="col-span-1"></div>
              <div className="col-span-2">Posting Date</div>
              <div className="col-span-4">Memo</div>
              <div className="col-span-2 text-right">Debit</div>
              <div className="col-span-2 text-right">Credit</div>
              <div className="col-span-1">Source</div>
            </div>

            {/* Entries */}
            {filteredEntries.map((entry) => (
              <div key={entry.id}>
                {/* Entry Row */}
                <div
                  className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-white/5 cursor-pointer"
                  onClick={() => toggleExpand(entry.id)}
                >
                  <div className="col-span-1">
                    {expandedEntry === entry.id ? (
                      <ChevronDown className="w-4 h-4 text-white/40" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-white/40" />
                    )}
                  </div>
                  <div className="col-span-2">
                    {entry.postingDate ? new Date(entry.postingDate).toLocaleDateString() : "-"}
                  </div>
                  <div className="col-span-4 truncate">{entry.memo || "-"}</div>
                  <div className="col-span-2 text-right font-mono">
                    ${parseFloat(entry.totalDebit || "0").toLocaleString()}
                  </div>
                  <div className="col-span-2 text-right font-mono">
                    ${parseFloat(entry.totalCredit || "0").toLocaleString()}
                  </div>
                  <div className="col-span-1 text-xs text-white/60">
                    {getSourceLabel(entry.sourceTransactionSetId)}
                  </div>
                </div>

                {/* Expanded Lines */}
                {expandedEntry === entry.id && entry.lines && entry.lines.length > 0 && (
                  <div className="bg-white/5 px-6 py-4 ml-12 mr-6 rounded-lg mb-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-white/60">
                          <th className="text-left py-2 w-24">Account Code</th>
                          <th className="text-left py-2">Account Name</th>
                          <th className="text-left py-2">Description</th>
                          <th className="text-right py-2 w-32">Debit</th>
                          <th className="text-right py-2 w-32">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entry.lines.map((line) => (
                          <tr key={line.id} className="border-t border-white/5">
                            <td className="py-2 font-mono text-white/60">
                              {line.accountCode || "-"}
                            </td>
                            <td className="py-2">{line.accountName || "-"}</td>
                            <td className="py-2 text-white/60">{line.description || "-"}</td>
                            <td className="py-2 text-right font-mono">
                              {parseFloat(line.debit) > 0 ? `$${parseFloat(line.debit).toLocaleString()}` : "-"}
                            </td>
                            <td className="py-2 text-right font-mono">
                              {parseFloat(line.credit) > 0 ? `$${parseFloat(line.credit).toLocaleString()}` : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
