"use client";

import * as React from "react";
import { GlassCard, GlassSelect, GlassButton, GlassTable, PageHeader, Spinner } from "@/components/ui/glass";
import { apiGet } from "@/lib/http";

interface Warehouse {
  id: string;
  code: string;
  name: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
}

interface InventoryBalanceRow {
  productId: string;
  productSku: string | null;
  productName: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  locationId: string | null;
  locationCode: string | null;
  onHand: number;
  reserved: number;
  available: number;
}

interface InventoryData {
  items: InventoryBalanceRow[];
  totals: {
    onHand: number;
    reserved: number;
    available: number;
  };
  pagination: { limit: number; offset: number; hasMore: boolean };
}

export default function InventoryBalancesPage() {
  const [warehouseId, setWarehouseId] = React.useState("");
  const [productId, setProductId] = React.useState("");
  const [data, setData] = React.useState<InventoryData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [warehouses, setWarehouses] = React.useState<Warehouse[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loadingMaster, setLoadingMaster] = React.useState(true);

  // Load warehouses and products on mount
  React.useEffect(() => {
    async function loadMasterData() {
      try {
        const [warehouseRes, productRes] = await Promise.all([
          apiGet<{ items: Warehouse[] }>("/api/master/warehouses?limit=100"),
          apiGet<{ items: Product[] }>("/api/master/products?limit=200"),
        ]);
        setWarehouses(warehouseRes.items || []);
        setProducts(productRes.items || []);
      } catch {
        // Silently fail - will show empty dropdowns
      } finally {
        setLoadingMaster(false);
      }
    }
    loadMasterData();
  }, []);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (warehouseId) params.set("warehouseId", warehouseId);
      if (productId) params.set("productId", productId);
      const result = await apiGet<InventoryData>(`/api/reports/inventory/balances?${params}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, [warehouseId, productId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const formatQty = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory Balances" description="Stock levels by product and warehouse" />

      {/* Filters */}
      <GlassCard padding="sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-64">
            <GlassSelect
              label="Warehouse"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              options={[
                { value: "", label: loadingMaster ? "Loading..." : "All Warehouses" },
                ...warehouses.map((w) => ({ value: w.id, label: `${w.code} - ${w.name}` })),
              ]}
            />
          </div>
          <div className="w-64">
            <GlassSelect
              label="Product"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              options={[
                { value: "", label: loadingMaster ? "Loading..." : "All Products" },
                ...products.map((p) => ({ value: p.id, label: `${p.sku || "N/A"} - ${p.name}` })),
              ]}
            />
          </div>
          <GlassButton onClick={loadData} disabled={loading}>
            {loading ? <Spinner size="sm" /> : "Search"}
          </GlassButton>
        </div>
      </GlassCard>

      {/* Error */}
      {error && (
        <GlassCard>
          <p className="text-red-400">{error}</p>
        </GlassCard>
      )}

      {/* Summary */}
      {data && (
        <GlassCard padding="sm">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-xs text-white/50 uppercase">Total On-Hand</span>
              <p className="text-xl font-semibold text-white">{formatQty(data.totals.onHand)}</p>
            </div>
            <div>
              <span className="text-xs text-white/50 uppercase">Reserved</span>
              <p className="text-xl font-semibold text-amber-400">{formatQty(data.totals.reserved)}</p>
            </div>
            <div>
              <span className="text-xs text-white/50 uppercase">Available</span>
              <p className="text-xl font-semibold text-emerald-400">{formatQty(data.totals.available)}</p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Table */}
      {data && (
        <GlassCard padding="none">
          <GlassTable
            headers={["SKU", "Product", "Warehouse", "Location", "On-Hand", "Reserved", "Available"]}
            monospaceColumns={[0, 2, 3]}
            rightAlignColumns={[4, 5, 6]}
            rows={data.items.map((row) => [
              row.productSku || "-",
              row.productName,
              row.warehouseCode,
              row.locationCode || "-",
              formatQty(row.onHand),
              formatQty(row.reserved),
              formatQty(row.available),
            ])}
            emptyMessage="No inventory found"
          />
        </GlassCard>
      )}
    </div>
  );
}
