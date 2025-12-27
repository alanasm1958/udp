"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  GlassCard,
  GlassButton,
  GlassTable,
  GlassSelect,
  GlassInput,
  GlassBadge,
  PageHeader,
  Spinner,
  SkeletonTable,
  SlideOver,
  ErrorAlert,
  useToast,
} from "@/components/ui/glass";
import { formatCurrency } from "@/lib/http";

interface Product {
  id: string;
  sku: string | null;
  name: string;
  type: "good" | "service";
  status: string;
  defaultSalesPrice: string | null;
  defaultPurchaseCost: string | null;
  createdAt: string;
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="p-6"><SkeletonTable rows={6} columns={6} /></div>}>
      <ProductsContent />
    </Suspense>
  );
}

function ProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();

  // Filters - sync with URL
  const typeFilter = searchParams.get("type") || "";

  // Data
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Create form
  const [createOpen, setCreateOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [formData, setFormData] = React.useState({
    type: "good" as "good" | "service",
    sku: "",
    name: "",
    description: "",
    defaultUomCode: "EA",
    defaultSalesPrice: "",
    defaultPurchaseCost: "",
  });

  // Load data
  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set("type", typeFilter);

      const res = await fetch(`/api/master/products?${params}`);
      if (!res.ok) throw new Error("Failed to load products");
      const data = await res.json();
      setProducts(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Update URL (filters auto-reload via useEffect)
  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/master/products?${params.toString()}`);
  };

  // Generate SKU
  const generateSku = () => {
    return `PROD-${Date.now().toString().slice(-6)}`;
  };

  // Create product
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch("/api/master/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formData.type,
          sku: formData.sku || generateSku(),
          name: formData.name,
          description: formData.description || undefined,
          defaultUomCode: formData.defaultUomCode || undefined,
          defaultSalesPrice: formData.defaultSalesPrice || undefined,
          defaultPurchaseCost: formData.defaultPurchaseCost || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create product");
      }

      addToast("success", `Product "${formData.name}" created`);
      setCreateOpen(false);
      setFormData({
        type: "good",
        sku: "",
        name: "",
        description: "",
        defaultUomCode: "EA",
        defaultSalesPrice: "",
        defaultPurchaseCost: "",
      });
      loadData();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to create product");
    } finally {
      setCreating(false);
    }
  };

  const getTypeBadge = (type: string) => {
    return type === "good" ? (
      <GlassBadge variant="info">Good</GlassBadge>
    ) : (
      <GlassBadge variant="warning">Service</GlassBadge>
    );
  };

  const getStatusBadge = (status: string) => {
    return status === "active" ? (
      <GlassBadge variant="success">Active</GlassBadge>
    ) : (
      <GlassBadge variant="danger">Inactive</GlassBadge>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Goods and services for sales and procurement"
        actions={
          <GlassButton variant="primary" onClick={() => setCreateOpen(true)}>
            + New Product
          </GlassButton>
        }
      />

      {/* Filters */}
      <GlassCard padding="sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-36">
            <GlassSelect
              label="Type"
              value={typeFilter}
              onChange={(e) => updateFilter("type", e.target.value)}
              options={[
                { value: "", label: "All" },
                { value: "good", label: "Goods" },
                { value: "service", label: "Services" },
              ]}
            />
          </div>
          {loading && <Spinner size="sm" />}
        </div>
      </GlassCard>

      {/* Error */}
      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* Stats */}
      {!loading && !error && products.length > 0 && (
        <div className="flex gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
            <span className="text-white/50 text-xs">Total</span>
            <span className="ml-2 text-white font-medium">{products.length}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <span className="text-blue-400/70 text-xs">Goods</span>
            <span className="ml-2 text-blue-400 font-medium">
              {products.filter((p) => p.type === "good").length}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <span className="text-amber-400/70 text-xs">Services</span>
            <span className="ml-2 text-amber-400 font-medium">
              {products.filter((p) => p.type === "service").length}
            </span>
          </div>
        </div>
      )}

      {/* Table */}
      <GlassCard padding="none">
        {loading ? (
          <div className="p-6">
            <SkeletonTable rows={6} columns={6} />
          </div>
        ) : (
          <GlassTable
            headers={["SKU", "Name", "Type", "Sale Price", "Cost", "Status"]}
            monospaceColumns={[0]}
            rightAlignColumns={[3, 4]}
            rows={products.map((product) => [
              product.sku || "-",
              product.name,
              getTypeBadge(product.type),
              product.defaultSalesPrice ? formatCurrency(parseFloat(product.defaultSalesPrice)) : "-",
              product.defaultPurchaseCost ? formatCurrency(parseFloat(product.defaultPurchaseCost)) : "-",
              getStatusBadge(product.status),
            ])}
            emptyMessage="No products found. Create your first product to get started."
          />
        )}
      </GlassCard>

      {/* Create SlideOver */}
      <SlideOver
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Product"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <GlassSelect
            label="Product Type"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as "good" | "service" })}
            options={[
              { value: "good", label: "Good (Physical product)" },
              { value: "service", label: "Service" },
            ]}
          />

          <GlassInput
            label="SKU (auto-generated if empty)"
            value={formData.sku}
            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
            placeholder={generateSku()}
          />

          <GlassInput
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Product name"
            required
          />

          <GlassInput
            label="Description (Optional)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Product description"
          />

          <GlassSelect
            label="Unit of Measure"
            value={formData.defaultUomCode}
            onChange={(e) => setFormData({ ...formData, defaultUomCode: e.target.value })}
            options={[
              { value: "EA", label: "EA - Each" },
              { value: "HR", label: "HR - Hour" },
              { value: "KG", label: "KG - Kilogram" },
              { value: "L", label: "L - Liter" },
              { value: "M", label: "M - Meter" },
              { value: "BOX", label: "BOX - Box" },
            ]}
          />

          <GlassInput
            label="Default Sale Price"
            type="number"
            step="0.01"
            min="0"
            value={formData.defaultSalesPrice}
            onChange={(e) => setFormData({ ...formData, defaultSalesPrice: e.target.value })}
            placeholder="0.00"
          />

          <GlassInput
            label="Default Cost"
            type="number"
            step="0.01"
            min="0"
            value={formData.defaultPurchaseCost}
            onChange={(e) => setFormData({ ...formData, defaultPurchaseCost: e.target.value })}
            placeholder="0.00"
          />

          <div className="pt-4 flex gap-3">
            <GlassButton
              type="button"
              variant="ghost"
              onClick={() => setCreateOpen(false)}
              className="flex-1"
            >
              Cancel
            </GlassButton>
            <GlassButton
              type="submit"
              variant="primary"
              disabled={creating || !formData.name}
              className="flex-1"
            >
              {creating ? <Spinner size="sm" /> : "Create Product"}
            </GlassButton>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
