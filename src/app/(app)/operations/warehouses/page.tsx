"use client";

import * as React from "react";
import { Suspense } from "react";
import {
  GlassCard,
  GlassButton,
  GlassInput,
  GlassTextarea,
  SlideOver,
  Spinner,
  useToast,
} from "@/components/ui/glass";

/* =============================================================================
   TYPES
   ============================================================================= */

interface Warehouse {
  id: string;
  code: string;
  name: string;
  status: string;
  createdAt: string;
}

/* =============================================================================
   ICONS
   ============================================================================= */

const Icons = {
  plus: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  ),
  warehouse: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    </svg>
  ),
  search: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/20 text-green-300",
  inactive: "bg-gray-500/20 text-gray-400",
};

/* =============================================================================
   CREATE WAREHOUSE DRAWER
   ============================================================================= */

interface CreateWarehouseDrawerProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function CreateWarehouseDrawer({ open, onClose, onCreated }: CreateWarehouseDrawerProps) {
  const { addToast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState({
    code: "",
    name: "",
    address: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code || !formData.name) {
      addToast("error", "Code and name are required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/master/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: formData.code,
          name: formData.name,
          address: formData.address ? { street: formData.address } : {},
          metadata: formData.notes ? { notes: formData.notes } : {},
        }),
      });

      if (res.ok) {
        addToast("success", "Warehouse created successfully");
        setFormData({ code: "", name: "", address: "", notes: "" });
        onCreated();
        onClose();
      } else {
        const data = await res.json();
        addToast("error", data.error || "Failed to create warehouse");
      }
    } catch (error) {
      console.error("Create warehouse error:", error);
      addToast("error", "Failed to create warehouse");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ code: "", name: "", address: "", notes: "" });
    onClose();
  };

  return (
    <SlideOver open={open} onClose={handleClose} title="Add Warehouse" width="md">
      <form onSubmit={handleSubmit} className="space-y-6">
        <GlassInput
          label="Warehouse Code *"
          placeholder="e.g., WH-001"
          value={formData.code}
          onChange={(e) => setFormData({ ...formData, code: e.target.value })}
          required
        />

        <GlassInput
          label="Warehouse Name *"
          placeholder="e.g., Main Warehouse"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />

        <GlassInput
          label="Address"
          placeholder="e.g., 123 Storage Lane"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
        />

        <GlassTextarea
          label="Notes"
          placeholder="Additional notes about this warehouse..."
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
        />

        <div className="flex gap-3 pt-4">
          <GlassButton type="button" variant="ghost" onClick={handleClose} className="flex-1">
            Cancel
          </GlassButton>
          <GlassButton type="submit" variant="primary" disabled={loading} className="flex-1">
            {loading ? <Spinner size="sm" /> : "Create Warehouse"}
          </GlassButton>
        </div>
      </form>
    </SlideOver>
  );
}

/* =============================================================================
   MAIN PAGE
   ============================================================================= */

function WarehousesPageContent() {
  const [warehouses, setWarehouses] = React.useState<Warehouse[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const fetchWarehouses = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      params.set("limit", "100");

      const res = await fetch(`/api/master/warehouses?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setWarehouses(data.items || []);
      }
    } catch (error) {
      console.error("Failed to fetch warehouses:", error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  React.useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchWarehouses();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Warehouses</h1>
          <p className="text-sm text-white/50 mt-1">
            Manage storage locations and capacity
          </p>
        </div>
        <GlassButton variant="primary" onClick={() => setDrawerOpen(true)}>
          {Icons.plus}
          <span>Add Warehouse</span>
        </GlassButton>
      </div>

      {/* Search and Filters */}
      <GlassCard padding="sm">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/20"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
              {Icons.search}
            </div>
          </div>
          <GlassButton type="submit" variant="default">
            Search
          </GlassButton>
          <div className="text-sm text-white/50 flex items-center">
            {warehouses.length} warehouse{warehouses.length !== 1 ? "s" : ""}
          </div>
        </form>
      </GlassCard>

      {/* Warehouses Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : warehouses.length === 0 ? (
        <GlassCard>
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400">
              {Icons.warehouse}
            </div>
            <p className="text-lg font-medium text-white mb-2">No warehouses found</p>
            <p className="text-sm text-white/50 mb-6">
              {searchQuery ? "Try a different search term" : "Add your first warehouse to get started"}
            </p>
            {!searchQuery && (
              <GlassButton variant="primary" onClick={() => setDrawerOpen(true)}>
                {Icons.plus}
                <span>Add Warehouse</span>
              </GlassButton>
            )}
          </div>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {warehouses.map((warehouse) => (
            <GlassCard key={warehouse.id} className="hover:border-white/25 transition-colors cursor-pointer">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 p-3 rounded-xl bg-amber-500/20 text-amber-400">
                  {Icons.warehouse}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white truncate">{warehouse.name}</h3>
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${STATUS_COLORS[warehouse.status] || STATUS_COLORS.inactive}`}>
                      {warehouse.status}
                    </span>
                  </div>
                  <p className="text-sm text-white/50 mt-1 font-mono">{warehouse.code}</p>
                  <p className="text-xs text-white/40 mt-2">
                    Created {new Date(warehouse.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Create Drawer */}
      <CreateWarehouseDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCreated={fetchWarehouses}
      />
    </div>
  );
}

export default function WarehousesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      }
    >
      <WarehousesPageContent />
    </Suspense>
  );
}
