"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  PageHeader,
  GlassTabs,
  GlassCard,
  GlassTable,
  GlassBadge,
  GlassInput,
  GlassButton,
  GlassSelect,
  SlideOver,
  Spinner,
  useToast,
} from "@/components/ui/glass";
import { apiGet, apiPost, apiPut, formatCurrency } from "@/lib/http";

// Types
export type ItemType = "product" | "service" | "consumable" | "asset";

interface ItemMetadata {
  serviceAvailable?: boolean;
  [key: string]: unknown;
}

interface Item {
  id: string;
  type: ItemType;
  sku: string | null;
  name: string;
  description: string | null;
  status: string;
  categoryId: string | null;
  tags: string[];
  defaultSalesPrice: string | null;
  defaultPurchaseCost: string | null;
  trackInventory: boolean;
  inventoryProductId: string | null;
  metadata: ItemMetadata;
  createdAt: string;
}

interface ItemsResponse {
  items: Item[];
}

interface Warehouse {
  id: string;
  code: string;
  name: string;
}

interface InventoryBalance {
  productId: string;
  onHand: number;
  available: number;
}

interface CreateItemFormData {
  name: string;
  type: ItemType;
  sku: string;
  description: string;
  defaultSalesPrice: string;
  defaultPurchaseCost: string;
  trackInventory: boolean;
  expenseCategoryCode: string;
  serviceAvailable: boolean;
  estimatedHours: string;
  fixedCost: string;
  initialWarehouseId: string;
  initialQuantity: string;
}

interface ItemsCatalogSectionProps {
  showHeader?: boolean;
  showStats?: boolean;
  syncTabToUrl?: boolean;
}

// Tab definitions
const tabs = [
  { id: "all", label: "All Items" },
  { id: "product", label: "Products" },
  { id: "service", label: "Services" },
  { id: "consumable", label: "Consumables" },
  { id: "asset", label: "Assets" },
];

// Type badge colors and labels
const typeConfig: Record<ItemType, { variant: "info" | "success" | "warning" | "danger"; label: string; icon: string }> = {
  product: { variant: "info", label: "Product", icon: "📦" },
  service: { variant: "success", label: "Service", icon: "🔧" },
  consumable: { variant: "warning", label: "Consumable", icon: "📋" },
  asset: { variant: "danger", label: "Asset", icon: "🏗️" },
};

const stockTrackedTypes: ItemType[] = ["product", "consumable", "asset"];

export function ItemsCatalogSection({
  showHeader = true,
  showStats = true,
  syncTabToUrl = false,
}: ItemsCatalogSectionProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { addToast } = useToast();

  const [items, setItems] = React.useState<Item[]>([]);
  const [warehouses, setWarehouses] = React.useState<Warehouse[]>([]);
  const [inventory, setInventory] = React.useState<Record<string, InventoryBalance>>({});
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [activeTab, setActiveTab] = React.useState("all");

  // SlideOver states
  const [selectedItem, setSelectedItem] = React.useState<Item | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editMode, setEditMode] = React.useState(false);

  // Form data
  const [formData, setFormData] = React.useState<CreateItemFormData>({
    name: "",
    type: "product",
    sku: "",
    description: "",
    defaultSalesPrice: "",
    defaultPurchaseCost: "",
    trackInventory: true,
    expenseCategoryCode: "",
    serviceAvailable: true,
    estimatedHours: "",
    fixedCost: "",
    initialWarehouseId: "",
    initialQuantity: "",
  });

  const loadInventory = React.useCallback(async () => {
    try {
      const data = await apiGet<{ items: Array<{ productId: string; onHand: number; available: number }> }>(
        "/api/reports/inventory/balances?limit=2000&includeZero=true"
      );
      const mapped: Record<string, InventoryBalance> = {};
      (data.items || []).forEach((row) => {
        mapped[row.productId] = { productId: row.productId, onHand: row.onHand, available: row.available };
      });
      setInventory(mapped);
    } catch {
      setInventory({});
    }
  }, []);

  const loadWarehouses = React.useCallback(async () => {
    try {
      const data = await apiGet<{ items: Warehouse[] }>("/api/master/warehouses?limit=200");
      setWarehouses(data.items || []);
    } catch {
      setWarehouses([]);
    }
  }, []);

  // Load items
  const loadItems = React.useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const typeFilter = activeTab !== "all" ? `?type=${activeTab}` : "";
      const data = await apiGet<ItemsResponse>(`/api/master/items${typeFilter}`);
      setItems(data.items || []);
    } catch {
      setItems([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [activeTab]);

  React.useEffect(() => {
    Promise.all([loadItems(), loadInventory(), loadWarehouses()]).catch(() => undefined);
  }, [loadItems, loadInventory, loadWarehouses]);

  // Handle tab from URL
  React.useEffect(() => {
    if (!syncTabToUrl) return;
    const tab = searchParams.get("tab");
    if (tab && tabs.some((t) => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams, syncTabToUrl]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (!syncTabToUrl) return;
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tabId);
    router.replace(url.pathname + url.search, { scroll: false });
  };

  // Filter items by search
  const filteredItems = React.useMemo(() => {
    if (!search.trim()) return items;
    const lowerSearch = search.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(lowerSearch) ||
        item.sku?.toLowerCase().includes(lowerSearch) ||
        item.description?.toLowerCase().includes(lowerSearch)
    );
  }, [items, search]);

  // Stats for overview
  const stats = React.useMemo(() => {
    const allItems = items;
    return {
      total: allItems.length,
      products: allItems.filter((i) => i.type === "product").length,
      services: allItems.filter((i) => i.type === "service").length,
      consumables: allItems.filter((i) => i.type === "consumable").length,
      assets: allItems.filter((i) => i.type === "asset").length,
    };
  }, [items]);

  const handleViewItem = (item: Item) => {
    setSelectedItem(item);
    setEditMode(false);
    setDetailOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost("/api/master/items", {
        name: formData.name,
        type: formData.type,
        sku: formData.sku || null,
        description: formData.description || null,
        defaultSalesPrice: formData.defaultSalesPrice || null,
        defaultPurchaseCost: formData.defaultPurchaseCost || null,
        trackInventory: stockTrackedTypes.includes(formData.type) ? formData.trackInventory : false,
        expenseCategoryCode: formData.type === "consumable" ? formData.expenseCategoryCode : null,
        serviceAvailable: formData.type === "service" ? formData.serviceAvailable : undefined,
        estimatedHours: formData.type === "service" ? formData.estimatedHours || null : null,
        fixedCost: formData.type === "service" ? formData.fixedCost || null : null,
        initialWarehouseId: stockTrackedTypes.includes(formData.type) ? formData.initialWarehouseId || null : null,
        initialQuantity: stockTrackedTypes.includes(formData.type) ? formData.initialQuantity || null : null,
      });
      setCreateOpen(false);
      resetForm();
      addToast("success", "Item created successfully");
      await Promise.all([loadItems(false), loadInventory()]);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to create item");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    try {
      const updated = await apiPut<Item>(`/api/master/items/${selectedItem.id}`, {
        name: formData.name,
        sku: formData.sku || null,
        description: formData.description || null,
        defaultSalesPrice: formData.defaultSalesPrice || null,
        defaultPurchaseCost: formData.defaultPurchaseCost || null,
        metadata: {
          ...(selectedItem.metadata || {}),
          ...(selectedItem.type === "service" ? { serviceAvailable: formData.serviceAvailable } : {}),
        },
      });
      setSelectedItem(updated);
      setEditMode(false);
      addToast("success", "Item updated successfully");
      await Promise.all([loadItems(false), loadInventory()]);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to update item");
    }
  };

  const startEdit = () => {
    if (selectedItem) {
      setFormData({
        name: selectedItem.name,
        type: selectedItem.type,
        sku: selectedItem.sku || "",
        description: selectedItem.description || "",
        defaultSalesPrice: selectedItem.defaultSalesPrice || "",
        defaultPurchaseCost: selectedItem.defaultPurchaseCost || "",
        trackInventory: selectedItem.trackInventory,
        expenseCategoryCode: "",
        serviceAvailable: selectedItem.metadata?.serviceAvailable ?? true,
        estimatedHours: "",
        fixedCost: "",
        initialWarehouseId: "",
        initialQuantity: "",
      });
      setEditMode(true);
    }
  };

  const cancelEdit = () => {
    setEditMode(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: "",
      type: "product",
      sku: "",
      description: "",
      defaultSalesPrice: "",
      defaultPurchaseCost: "",
      trackInventory: true,
      expenseCategoryCode: "",
      serviceAvailable: true,
      estimatedHours: "",
      fixedCost: "",
      initialWarehouseId: "",
      initialQuantity: "",
    });
  };

  const openCreate = () => {
    resetForm();
    setCreateOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const availabilityLabel = (item: Item) => {
    if (item.type === "service") {
      const available = item.metadata?.serviceAvailable ?? true;
      return (
        <GlassBadge variant={available ? "success" : "danger"}>
          {available ? "Available" : "Unavailable"}
        </GlassBadge>
      );
    }

    if (!stockTrackedTypes.includes(item.type)) {
      return "—";
    }

    if (!item.inventoryProductId) {
      return <GlassBadge variant="warning">Unassigned</GlassBadge>;
    }

    const balance = inventory[item.inventoryProductId];
    const available = balance?.available ?? 0;
    return (
      <div className="flex items-center gap-2">
        <span className={`tabular-nums ${available <= 0 ? "text-red-400" : "text-emerald-400"}`}>
          {available.toLocaleString()}
        </span>
        {available <= 0 && <GlassBadge variant="danger">Out of stock</GlassBadge>}
      </div>
    );
  };

  // Table setup
  const headers = ["SKU", "Name", "Type", "Availability", "Sales Price", "Status", ""];

  const rows = filteredItems.map((item) => {
    const config = typeConfig[item.type];
    return [
      <span key="sku" className="font-mono text-white/70">{item.sku || "—"}</span>,
      <div key="name" className="flex flex-col">
        <span className="font-medium">{item.name}</span>
        {item.description && (
          <span className="text-xs text-white/50 truncate max-w-[200px]">{item.description}</span>
        )}
      </div>,
      <GlassBadge key="type" variant={config.variant}>
        <span className="mr-1">{config.icon}</span>
        {config.label}
      </GlassBadge>,
      <div key="availability">{availabilityLabel(item)}</div>,
      <span key="price" className="tabular-nums">
        {item.defaultSalesPrice ? formatCurrency(item.defaultSalesPrice) : "—"}
      </span>,
      <GlassBadge key="status" variant={item.status === "active" ? "success" : "default"}>
        {item.status}
      </GlassBadge>,
      <button
        key={`view-${item.id}`}
        onClick={() => handleViewItem(item)}
        className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
      >
        View
      </button>,
    ];
  });

  return (
    <div className="space-y-6">
      {showHeader && (
        <PageHeader
          title="Items Catalog"
          description="Unified catalog for products, services, consumables, and assets"
          actions={
            <GlassButton variant="primary" onClick={openCreate}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Create Item
            </GlassButton>
          }
        />
      )}

      {showStats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <GlassCard padding="sm" className="text-center">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-white/50 uppercase tracking-wide">Total</div>
          </GlassCard>
          <GlassCard padding="sm" className="text-center">
            <div className="text-2xl font-bold text-blue-400">{stats.products}</div>
            <div className="text-xs text-white/50 uppercase tracking-wide">Products</div>
          </GlassCard>
          <GlassCard padding="sm" className="text-center">
            <div className="text-2xl font-bold text-emerald-400">{stats.services}</div>
            <div className="text-xs text-white/50 uppercase tracking-wide">Services</div>
          </GlassCard>
          <GlassCard padding="sm" className="text-center">
            <div className="text-2xl font-bold text-amber-400">{stats.consumables}</div>
            <div className="text-xs text-white/50 uppercase tracking-wide">Consumables</div>
          </GlassCard>
          <GlassCard padding="sm" className="text-center">
            <div className="text-2xl font-bold text-red-400">{stats.assets}</div>
            <div className="text-xs text-white/50 uppercase tracking-wide">Assets</div>
          </GlassCard>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <GlassTabs tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />
        {!showHeader && (
          <GlassButton variant="primary" onClick={openCreate}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Item
          </GlassButton>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 max-w-md">
          <GlassInput
            placeholder="Search items by name, SKU, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filteredItems.length > 0 ? (
        <GlassCard padding="none">
          <GlassTable
            headers={headers}
            rows={rows}
            rightAlignColumns={[4]}
          />
        </GlassCard>
      ) : (
        <GlassCard>
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              {search ? "No Items Found" : "No Items Yet"}
            </h3>
            <p className="text-white/50 mb-4">
              {search ? "Try a different search term." : "Add your first item to get started."}
            </p>
            {!search && (
              <GlassButton variant="primary" onClick={openCreate}>
                Create Item
              </GlassButton>
            )}
          </div>
        </GlassCard>
      )}

      <SlideOver
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedItem(null);
          setEditMode(false);
        }}
        title={editMode ? "Edit Item" : "Item Details"}
      >
        {selectedItem && !editMode && (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl">
                {typeConfig[selectedItem.type].icon}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white">{selectedItem.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <GlassBadge variant={typeConfig[selectedItem.type].variant}>
                    {typeConfig[selectedItem.type].label}
                  </GlassBadge>
                  <GlassBadge variant={selectedItem.status === "active" ? "success" : "default"}>
                    {selectedItem.status}
                  </GlassBadge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/50 uppercase tracking-wide">SKU</label>
                <p className="text-white font-mono">{selectedItem.sku || "—"}</p>
              </div>
              <div>
                <label className="text-xs text-white/50 uppercase tracking-wide">Availability</label>
                <div className="mt-1">{availabilityLabel(selectedItem)}</div>
              </div>
              <div>
                <label className="text-xs text-white/50 uppercase tracking-wide">Sales Price</label>
                <p className="text-white tabular-nums">
                  {selectedItem.defaultSalesPrice ? formatCurrency(selectedItem.defaultSalesPrice) : "—"}
                </p>
              </div>
              <div>
                <label className="text-xs text-white/50 uppercase tracking-wide">Purchase Cost</label>
                <p className="text-white tabular-nums">
                  {selectedItem.defaultPurchaseCost ? formatCurrency(selectedItem.defaultPurchaseCost) : "—"}
                </p>
              </div>
            </div>

            {selectedItem.description && (
              <div>
                <label className="text-xs text-white/50 uppercase tracking-wide">Description</label>
                <p className="text-white mt-1">{selectedItem.description}</p>
              </div>
            )}

            {selectedItem.type === "service" && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                <p className="text-xs text-white/60">
                  Service cost fields are estimates only. Actual cost is confirmed at sale and used for analytics,
                  not purchase posting.
                </p>
              </div>
            )}

            {selectedItem.type === "asset" && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <p className="text-xs text-white/60">
                  Purchase price is not the current value. Ask AI if you need valuation guidance.
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-white/10">
              <GlassButton variant="primary" onClick={startEdit} className="w-full">
                Edit Item
              </GlassButton>
            </div>
          </div>
        )}

        {selectedItem && editMode && (
          <form onSubmit={handleUpdate} className="space-y-4">
            <GlassInput
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Item name"
              required
            />
            <GlassInput
              label="SKU"
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              placeholder="Internal code (optional)"
            />
            <GlassInput
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Item description"
            />
            <div className="grid grid-cols-2 gap-4">
              <GlassInput
                label="Sales Price"
                type="number"
                step="0.01"
                value={formData.defaultSalesPrice}
                onChange={(e) => setFormData({ ...formData, defaultSalesPrice: e.target.value })}
                placeholder="0.00"
              />
              <GlassInput
                label="Purchase Cost"
                type="number"
                step="0.01"
                value={formData.defaultPurchaseCost}
                onChange={(e) => setFormData({ ...formData, defaultPurchaseCost: e.target.value })}
                placeholder="0.00"
              />
            </div>

            {selectedItem.type === "service" && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.serviceAvailable}
                    onChange={(e) => setFormData({ ...formData, serviceAvailable: e.target.checked })}
                    className="w-4 h-4 rounded bg-white/10 border-white/20 text-emerald-500 focus:ring-emerald-500/50"
                  />
                  <div>
                    <span className="text-white font-medium">Service Available</span>
                    <p className="text-xs text-white/50">Toggle availability for new assignments</p>
                  </div>
                </label>
              </div>
            )}

            <div className="pt-4 flex gap-3">
              <GlassButton type="button" variant="ghost" onClick={cancelEdit} className="flex-1">
                Cancel
              </GlassButton>
              <GlassButton type="submit" variant="primary" className="flex-1">
                Save Changes
              </GlassButton>
            </div>
          </form>
        )}
      </SlideOver>

      <SlideOver open={createOpen} onClose={() => setCreateOpen(false)} title="Create Item">
        <form onSubmit={handleCreate} className="space-y-4">
          <GlassSelect
            label="Item Type"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as ItemType })}
            options={[
              { value: "product", label: "📦 Product (Stock Tracked)" },
              { value: "service", label: "🔧 Service (Fulfillable)" },
              { value: "consumable", label: "📋 Consumable (Stocked)" },
              { value: "asset", label: "🏗️ Asset (Stocked)" },
            ]}
          />

          <GlassInput
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Item name"
            required
          />

          <GlassInput
            label="SKU / Internal Code"
            value={formData.sku}
            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
            placeholder="Optional unique code"
          />

          <GlassInput
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Item description"
          />

          <div className="grid grid-cols-2 gap-4">
            <GlassInput
              label="Sales Price"
              type="number"
              step="0.01"
              value={formData.defaultSalesPrice}
              onChange={(e) => setFormData({ ...formData, defaultSalesPrice: e.target.value })}
              placeholder="0.00"
            />
            <GlassInput
              label={formData.type === "asset" ? "Purchase Price (Required)" : "Purchase Cost"}
              type="number"
              step="0.01"
              value={formData.defaultPurchaseCost}
              onChange={(e) => setFormData({ ...formData, defaultPurchaseCost: e.target.value })}
              placeholder="0.00"
              required={formData.type === "asset"}
            />
          </div>

          {formData.type === "service" && (
            <div className="space-y-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.serviceAvailable}
                  onChange={(e) => setFormData({ ...formData, serviceAvailable: e.target.checked })}
                  className="w-4 h-4 rounded bg-white/10 border-white/20 text-emerald-500 focus:ring-emerald-500/50"
                />
                <div>
                  <span className="text-white font-medium">Service Available</span>
                  <p className="text-xs text-white/50">Show as available for assignment</p>
                </div>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <GlassInput
                  label="Estimated Hours"
                  type="number"
                  step="0.1"
                  value={formData.estimatedHours}
                  onChange={(e) => setFormData({ ...formData, estimatedHours: e.target.value })}
                  placeholder="0"
                />
                <GlassInput
                  label="Estimated Internal Cost"
                  type="number"
                  step="0.01"
                  value={formData.fixedCost}
                  onChange={(e) => setFormData({ ...formData, fixedCost: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-white/50">
                Estimates are used for analytics only. Actual service cost is confirmed at sale and not posted
                on purchase documents.
              </p>
            </div>
          )}

          {formData.type === "consumable" && (
            <GlassInput
              label="Expense Category Code"
              value={formData.expenseCategoryCode}
              onChange={(e) => setFormData({ ...formData, expenseCategoryCode: e.target.value })}
              placeholder="e.g., OFFICE_SUPPLIES"
              required
            />
          )}

          {stockTrackedTypes.includes(formData.type) && (
            <div className="space-y-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 text-blue-400 mb-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                <span className="text-sm font-medium">Initial Warehouse Assignment</span>
              </div>
              <p className="text-xs text-white/50">
                If you leave this empty, an AI task will remind you to assign stock to a warehouse.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <GlassSelect
                  label="Warehouse"
                  value={formData.initialWarehouseId}
                  onChange={(e) => setFormData({ ...formData, initialWarehouseId: e.target.value })}
                  options={[
                    { value: "", label: warehouses.length ? "Select warehouse" : "No warehouses" },
                    ...warehouses.map((wh) => ({ value: wh.id, label: `${wh.code} • ${wh.name}` })),
                  ]}
                />
                <GlassInput
                  label="Starting Quantity"
                  type="number"
                  step="0.01"
                  value={formData.initialQuantity}
                  onChange={(e) => setFormData({ ...formData, initialQuantity: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
          )}

          {formData.type === "asset" && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <p className="text-xs text-white/60">
                Purchase price does not represent current value. Ask AI if you need valuation guidance.
              </p>
            </div>
          )}

          <div className="pt-4 flex gap-3">
            <GlassButton type="button" variant="ghost" onClick={() => setCreateOpen(false)} className="flex-1">
              Cancel
            </GlassButton>
            <GlassButton type="submit" variant="primary" className="flex-1">
              Create Item
            </GlassButton>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
