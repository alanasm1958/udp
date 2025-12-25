"use client";

import * as React from "react";
import { GlassCard, GlassInput, GlassButton, GlassTable, PageHeader, Spinner } from "@/components/ui/glass";
import { apiGet } from "@/lib/http";

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
            <GlassInput
              label="Warehouse ID"
              placeholder="UUID..."
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            />
          </div>
          <div className="w-64">
            <GlassInput
              label="Product ID"
              placeholder="UUID..."
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
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
