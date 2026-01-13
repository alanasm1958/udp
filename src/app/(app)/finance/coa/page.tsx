"use client";

import { useState, useEffect } from "react";
import {
  GlassCard,
  GlassButton,
  GlassInput,
  PageHeader,
} from "@/components/ui/glass";
import { ChevronDown, ChevronRight, FolderOpen, File } from "lucide-react";

interface Account {
  id: string;
  code: string;
  name: string;
  accountType: string;
  description: string | null;
  parentId: string | null;
  isActive: boolean;
  balance?: number;
}

interface AccountTreeNode extends Account {
  children: AccountTreeNode[];
  level: number;
}

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set<string>());

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/finance/accounts?limit=500");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
        // Expand root level by default
        const rootIds = new Set<string>(
          (data.accounts || [])
            .filter((a: Account) => !a.parentId)
            .map((a: Account) => a.id)
        );
        setExpandedAccounts(rootIds);
      }
    } catch (error) {
      console.error("Error loading accounts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const buildAccountTree = (accounts: Account[]): AccountTreeNode[] => {
    const accountMap = new Map<string, AccountTreeNode>();
    const roots: AccountTreeNode[] = [];

    // First pass: create nodes
    accounts.forEach((account) => {
      accountMap.set(account.id, { ...account, children: [], level: 0 });
    });

    // Second pass: build tree
    accounts.forEach((account) => {
      const node = accountMap.get(account.id)!;
      if (account.parentId && accountMap.has(account.parentId)) {
        const parent = accountMap.get(account.parentId)!;
        node.level = parent.level + 1;
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Sort by code
    const sortByCode = (a: AccountTreeNode, b: AccountTreeNode) => a.code.localeCompare(b.code);
    roots.sort(sortByCode);
    const sortChildren = (nodes: AccountTreeNode[]) => {
      nodes.forEach((node) => {
        node.children.sort(sortByCode);
        sortChildren(node.children);
      });
    };
    sortChildren(roots);

    return roots;
  };

  const toggleExpand = (id: string) => {
    setExpandedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedAccounts(new Set<string>(accounts.map((a) => a.id)));
  };

  const collapseAll = () => {
    setExpandedAccounts(new Set<string>());
  };

  const getAccountTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      asset: "text-blue-400",
      liability: "text-red-400",
      equity: "text-purple-400",
      income: "text-green-400",
      expense: "text-orange-400",
      contra_asset: "text-blue-300",
      contra_liability: "text-red-300",
      contra_equity: "text-purple-300",
      contra_income: "text-green-300",
      contra_expense: "text-orange-300",
    };
    return colors[type] || "text-white";
  };

  const getAccountTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      asset: "Asset",
      liability: "Liability",
      equity: "Equity",
      income: "Income",
      expense: "Expense",
      contra_asset: "Contra Asset",
      contra_liability: "Contra Liability",
      contra_equity: "Contra Equity",
      contra_income: "Contra Income",
      contra_expense: "Contra Expense",
    };
    return labels[type] || type;
  };

  const filterAccounts = (accounts: Account[]): Account[] => {
    if (!searchQuery) return accounts;
    const query = searchQuery.toLowerCase();
    return accounts.filter(
      (a) =>
        a.code.toLowerCase().includes(query) ||
        a.name.toLowerCase().includes(query) ||
        a.description?.toLowerCase().includes(query)
    );
  };

  const renderAccountNode = (node: AccountTreeNode): React.ReactNode => {
    const isExpanded = expandedAccounts.has(node.id);
    const hasChildren = node.children.length > 0;

    // Filter check for search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSelf =
        node.code.toLowerCase().includes(query) ||
        node.name.toLowerCase().includes(query);
      const hasMatchingDescendant = (n: AccountTreeNode): boolean => {
        if (
          n.code.toLowerCase().includes(query) ||
          n.name.toLowerCase().includes(query)
        )
          return true;
        return n.children.some(hasMatchingDescendant);
      };
      if (!matchesSelf && !hasMatchingDescendant(node)) return null;
    }

    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-2 py-2 px-4 hover:bg-white/5 cursor-pointer ${
            !node.isActive ? "opacity-50" : ""
          }`}
          style={{ paddingLeft: `${node.level * 24 + 16}px` }}
          onClick={() => hasChildren && toggleExpand(node.id)}
        >
          {/* Expand/Collapse Icon */}
          <div className="w-5 h-5 flex items-center justify-center">
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="w-4 h-4 text-white/40" />
              ) : (
                <ChevronRight className="w-4 h-4 text-white/40" />
              )
            ) : null}
          </div>

          {/* Folder/File Icon */}
          <div className={getAccountTypeColor(node.accountType)}>
            {hasChildren ? (
              <FolderOpen className="w-4 h-4" />
            ) : (
              <File className="w-4 h-4" />
            )}
          </div>

          {/* Code */}
          <span className="font-mono text-sm text-white/60 w-20">{node.code}</span>

          {/* Name */}
          <span className="flex-1 font-medium">{node.name}</span>

          {/* Type Badge */}
          <span
            className={`text-xs px-2 py-0.5 rounded-full bg-white/5 ${getAccountTypeColor(
              node.accountType
            )}`}
          >
            {getAccountTypeLabel(node.accountType)}
          </span>

          {/* Balance (if available) */}
          {node.balance !== undefined && (
            <span className="text-sm text-white/60 w-28 text-right">
              ${node.balance.toLocaleString()}
            </span>
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>{node.children.map((child) => renderAccountNode(child))}</div>
        )}
      </div>
    );
  };

  const filteredAccounts = filterAccounts(accounts);
  const accountTree = buildAccountTree(filteredAccounts);

  // Group by type for summary
  const accountsByType = accounts.reduce((acc, account) => {
    const type = account.accountType;
    if (!acc[type]) acc[type] = 0;
    acc[type]++;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chart of Accounts"
        description="Account structure and hierarchy"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4">
        {["asset", "liability", "equity", "income", "expense"].map((type) => (
          <GlassCard key={type} className="p-4">
            <div className="flex items-center justify-between">
              <span className={`text-sm ${getAccountTypeColor(type)}`}>
                {getAccountTypeLabel(type)}
              </span>
              <span className="text-2xl font-bold">{accountsByType[type] || 0}</span>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Search and Controls */}
      <GlassCard padding="sm">
        <div className="flex gap-4 items-end">
          <div className="flex-1 max-w-md">
            <GlassInput
              label="Search Accounts"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by code or name..."
            />
          </div>
          <GlassButton onClick={expandAll} variant="ghost" size="sm">
            Expand All
          </GlassButton>
          <GlassButton onClick={collapseAll} variant="ghost" size="sm">
            Collapse All
          </GlassButton>
        </div>
      </GlassCard>

      {/* Account Tree */}
      <GlassCard padding="none">
        {isLoading ? (
          <div className="p-8 text-center text-white/40 text-sm">Loading chart of accounts...</div>
        ) : accounts.length === 0 ? (
          <div className="p-8 text-center text-white/40 text-sm">
            No accounts found. Set up your chart of accounts in Finance Settings.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {/* Header */}
            <div className="flex items-center gap-2 py-3 px-4 bg-white/5 text-sm font-medium text-white/60">
              <div className="w-5 h-5"></div>
              <div className="w-5 h-5"></div>
              <span className="w-20">Code</span>
              <span className="flex-1">Account Name</span>
              <span className="w-24">Type</span>
            </div>

            {/* Tree */}
            {accountTree.map((node) => renderAccountNode(node))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
