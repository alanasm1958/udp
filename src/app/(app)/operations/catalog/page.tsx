"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/glass";

interface Item {
  id: string;
  type: "product" | "service" | "consumable" | "asset";
  sku: string | null;
  name: string;
  description: string | null;
  status: string;
  defaultSalesPrice: string | null;
  defaultPurchaseCost: string | null;
  trackInventory: boolean;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  product: "Product",
  service: "Service",
  consumable: "Consumable",
  asset: "Asset",
};

const TYPE_COLORS: Record<string, string> = {
  product: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  service: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  consumable: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  asset: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/20 text-green-300",
  inactive: "bg-gray-500/20 text-gray-400",
  discontinued: "bg-red-500/20 text-red-300",
};

function CatalogContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const typeFilter = searchParams.get("type") || "all";

  useEffect(() => {
    fetchItems();
  }, [typeFilter]);

  async function fetchItems() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter && typeFilter !== "all") {
        params.set("type", typeFilter);
      }
      if (searchQuery) {
        params.set("q", searchQuery);
      }
      params.set("limit", "100");

      const res = await fetch(`/api/master/items?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (error) {
      console.error("Failed to fetch items:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleTypeFilter(type: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (type === "all") {
      params.delete("type");
    } else {
      params.set("type", type);
    }
    router.push(`/operations/catalog?${params.toString()}`);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchItems();
  }

  const formatCurrency = (value: string | null) => {
    if (!value) return "-";
    const num = parseFloat(value);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Catalog</h1>
          <p className="text-white/50 text-sm mt-1">
            Unified view of products, services, consumables, and assets
          </p>
        </div>
      </div>

      {/* Filters */}
      <GlassCard className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Type Filter Tabs */}
          <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
            {["all", "product", "service", "consumable", "asset"].map((type) => (
              <button
                key={type}
                onClick={() => handleTypeFilter(type)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  typeFilter === type
                    ? "bg-white/10 text-white"
                    : "text-white/50 hover:text-white hover:bg-white/5"
                }`}
              >
                {type === "all" ? "All" : TYPE_LABELS[type]}
              </button>
            ))}
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name, SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/20"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </form>

          {/* Item Count */}
          <div className="text-sm text-white/50">
            {items.length} item{items.length !== 1 ? "s" : ""}
          </div>
        </div>
      </GlassCard>

      {/* Items Table */}
      <GlassCard className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/50" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-white/30 text-lg mb-2">No items found</div>
            <p className="text-white/50 text-sm">
              {typeFilter !== "all"
                ? `No ${TYPE_LABELS[typeFilter]?.toLowerCase()}s in catalog`
                : "Add items using Record Activity"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">
                    Cost
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">
                    Tracked
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => router.push(`/operations/catalog/${item.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{item.name}</div>
                      {item.description && (
                        <div className="text-sm text-white/50 truncate max-w-xs">
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-medium rounded border ${
                          TYPE_COLORS[item.type]
                        }`}
                      >
                        {TYPE_LABELS[item.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/70 font-mono text-sm">
                      {item.sku || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                          STATUS_COLORS[item.status] || STATUS_COLORS.inactive
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-white/70 font-mono text-sm">
                      {formatCurrency(item.defaultPurchaseCost)}
                    </td>
                    <td className="px-4 py-3 text-right text-white/70 font-mono text-sm">
                      {formatCurrency(item.defaultSalesPrice)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.trackInventory ? (
                        <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-green-500/20 text-green-400">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </span>
                      ) : (
                        <span className="text-white/30">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

export default function CatalogPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/50" />
      </div>
    }>
      <CatalogContent />
    </Suspense>
  );
}
