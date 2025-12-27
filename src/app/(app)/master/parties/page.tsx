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

interface Party {
  id: string;
  partyType: string;
  displayName: string;
  code: string;
  status: string;
  createdAt: string;
}

export default function PartiesPage() {
  return (
    <Suspense fallback={<div className="p-6"><SkeletonTable rows={6} columns={5} /></div>}>
      <PartiesContent />
    </Suspense>
  );
}

function PartiesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();

  // Filters - sync with URL
  const typeFilter = searchParams.get("type") || "";

  // Data
  const [parties, setParties] = React.useState<Party[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Create form
  const [createOpen, setCreateOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [formData, setFormData] = React.useState({
    type: "customer" as "customer" | "vendor" | "employee" | "bank" | "government" | "other",
    code: "",
    name: "",
    defaultCurrency: "USD",
    notes: "",
  });

  // Load data
  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set("type", typeFilter);

      const res = await fetch(`/api/master/parties?${params}`);
      if (!res.ok) throw new Error("Failed to load parties");
      const data = await res.json();
      setParties(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load parties");
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
    router.push(`/master/parties?${params.toString()}`);
  };

  // Generate code
  const generateCode = (type: string) => {
    const prefix = type === "customer" ? "C" : type === "vendor" ? "V" : type === "employee" ? "E" : "P";
    return `${prefix}-${Date.now().toString().slice(-6)}`;
  };

  // Create party
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch("/api/master/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formData.type,
          code: formData.code || generateCode(formData.type),
          name: formData.name,
          defaultCurrency: formData.defaultCurrency || undefined,
          notes: formData.notes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create party");
      }

      const party = await res.json();
      addToast("success", `${formData.type.charAt(0).toUpperCase() + formData.type.slice(1)} "${party.name}" created`);
      setCreateOpen(false);
      setFormData({
        type: "customer",
        code: "",
        name: "",
        defaultCurrency: "USD",
        notes: "",
      });
      loadData();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to create party");
    } finally {
      setCreating(false);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "customer":
        return <GlassBadge variant="success">Customer</GlassBadge>;
      case "vendor":
        return <GlassBadge variant="info">Vendor</GlassBadge>;
      case "employee":
        return <GlassBadge variant="warning">Employee</GlassBadge>;
      case "bank":
        return <GlassBadge variant="default">Bank</GlassBadge>;
      default:
        return <GlassBadge>{type}</GlassBadge>;
    }
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
        title="Parties"
        description="Customers, vendors, employees, and other business entities"
        actions={
          <GlassButton variant="primary" onClick={() => setCreateOpen(true)}>
            + New Party
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
                { value: "customer", label: "Customer" },
                { value: "vendor", label: "Vendor" },
                { value: "employee", label: "Employee" },
                { value: "bank", label: "Bank" },
                { value: "other", label: "Other" },
              ]}
            />
          </div>
          {loading && <Spinner size="sm" />}
        </div>
      </GlassCard>

      {/* Error */}
      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* Stats */}
      {!loading && !error && parties.length > 0 && (
        <div className="flex gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
            <span className="text-white/50 text-xs">Total</span>
            <span className="ml-2 text-white font-medium">{parties.length}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-emerald-400/70 text-xs">Customers</span>
            <span className="ml-2 text-emerald-400 font-medium">
              {parties.filter((p) => p.partyType === "customer").length}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <span className="text-blue-400/70 text-xs">Vendors</span>
            <span className="ml-2 text-blue-400 font-medium">
              {parties.filter((p) => p.partyType === "vendor").length}
            </span>
          </div>
        </div>
      )}

      {/* Table */}
      <GlassCard padding="none">
        {loading ? (
          <div className="p-6">
            <SkeletonTable rows={6} columns={5} />
          </div>
        ) : (
          <GlassTable
            headers={["Code", "Name", "Type", "Status", ""]}
            monospaceColumns={[0]}
            rows={parties.map((party) => [
              party.code,
              party.displayName,
              getTypeBadge(party.partyType),
              getStatusBadge(party.status),
              <span key={party.id} className="text-white/30 text-sm">-</span>,
            ])}
            emptyMessage="No parties found. Create your first customer or vendor to get started."
          />
        )}
      </GlassCard>

      {/* Create SlideOver */}
      <SlideOver
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Party"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <GlassSelect
            label="Party Type"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as typeof formData.type })}
            options={[
              { value: "customer", label: "Customer" },
              { value: "vendor", label: "Vendor" },
              { value: "employee", label: "Employee" },
              { value: "bank", label: "Bank" },
              { value: "government", label: "Government" },
              { value: "other", label: "Other" },
            ]}
          />

          <GlassInput
            label="Code (auto-generated if empty)"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            placeholder={generateCode(formData.type)}
          />

          <GlassInput
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Party name"
            required
          />

          <GlassSelect
            label="Default Currency"
            value={formData.defaultCurrency}
            onChange={(e) => setFormData({ ...formData, defaultCurrency: e.target.value })}
            options={[
              { value: "USD", label: "USD - US Dollar" },
              { value: "EUR", label: "EUR - Euro" },
              { value: "GBP", label: "GBP - British Pound" },
              { value: "JPY", label: "JPY - Japanese Yen" },
              { value: "CAD", label: "CAD - Canadian Dollar" },
            ]}
          />

          <GlassInput
            label="Notes (Optional)"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Internal notes"
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
              {creating ? <Spinner size="sm" /> : "Create Party"}
            </GlassButton>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
