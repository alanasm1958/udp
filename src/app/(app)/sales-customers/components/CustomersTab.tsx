"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  GlassCard,
  GlassTable,
  GlassBadge,
  GlassInput,
  GlassButton,
  SlideOver,
  Spinner,
  useToast,
} from "@/components/ui/glass";
import { apiGet, apiPost, apiPut } from "@/lib/http";

interface Customer {
  id: string;
  name: string;
  code: string;
  type: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  notes: string | null;
}

interface CustomersResponse {
  items: Customer[];
  total: number;
}

export function CustomersTab() {
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");

  // SlideOver states
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | null>(null);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editMode, setEditMode] = React.useState(false);

  // Form data for create/edit
  const [formData, setFormData] = React.useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
  });

  const loadCustomers = React.useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const data = await apiGet<CustomersResponse>("/api/sales-customers/customers");
      setCustomers(data.items || []);
    } catch {
      setCustomers([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // Check for ID in search params to open profile
  React.useEffect(() => {
    const id = searchParams.get("id");
    if (id && customers.length > 0) {
      const customer = customers.find((c) => c.id === id);
      if (customer) {
        setSelectedCustomer(customer);
        setProfileOpen(true);
      }
    }
  }, [searchParams, customers]);

  const filteredCustomers = React.useMemo(() => {
    if (!search.trim()) return customers;
    const lowerSearch = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(lowerSearch) ||
        c.code.toLowerCase().includes(lowerSearch) ||
        c.email?.toLowerCase().includes(lowerSearch)
    );
  }, [customers, search]);

  const handleViewProfile = (customer: Customer) => {
    setSelectedCustomer(customer);
    setEditMode(false);
    setProfileOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost("/api/sales-customers/customers", {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        notes: formData.notes || null,
      });
      setCreateOpen(false);
      setFormData({ name: "", email: "", phone: "", notes: "" });
      addToast("success", "Customer created successfully");
      await loadCustomers(false);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to create customer");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    try {
      const updated = await apiPut<Customer>(`/api/sales-customers/customers/${selectedCustomer.id}`, {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        notes: formData.notes || null,
      });
      setSelectedCustomer(updated);
      setEditMode(false);
      addToast("success", "Customer updated successfully");
      await loadCustomers(false);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to update customer");
    }
  };

  const startEdit = () => {
    if (selectedCustomer) {
      setFormData({
        name: selectedCustomer.name,
        email: selectedCustomer.email || "",
        phone: selectedCustomer.phone || "",
        notes: selectedCustomer.notes || "",
      });
      setEditMode(true);
    }
  };

  const cancelEdit = () => {
    setEditMode(false);
    setFormData({ name: "", email: "", phone: "", notes: "" });
  };

  const openCreate = () => {
    setFormData({ name: "", email: "", phone: "", notes: "" });
    setCreateOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const headers = ["Code", "Name", "Email", "Phone", "Status", ""];

  const rows = filteredCustomers.map((c) => [
    c.code,
    c.name,
    c.email || "—",
    c.phone || "—",
    <GlassBadge key={c.id} variant={c.isActive ? "success" : "default"}>
      {c.isActive ? "Active" : "Inactive"}
    </GlassBadge>,
    <button
      key={`view-${c.id}`}
      onClick={() => handleViewProfile(c)}
      className="text-blue-400 hover:text-blue-300 text-sm"
    >
      View
    </button>,
  ]);

  return (
    <div className="space-y-4">
      {/* Actions Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <GlassInput
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <GlassButton variant="primary" onClick={openCreate}>
          Add Customer
        </GlassButton>
      </div>

      {/* Customer List */}
      {filteredCustomers.length > 0 ? (
        <GlassTable headers={headers} rows={rows} />
      ) : (
        <GlassCard>
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              {search ? "No Customers Found" : "No Customers Yet"}
            </h3>
            <p className="text-white/50 mb-4">
              {search ? "Try a different search term." : "Add your first customer to get started."}
            </p>
            {!search && (
              <GlassButton variant="primary" onClick={openCreate}>
                Add Customer
              </GlassButton>
            )}
          </div>
        </GlassCard>
      )}

      {/* Customer Profile SlideOver (View/Edit) */}
      <SlideOver
        open={profileOpen}
        onClose={() => {
          setProfileOpen(false);
          setSelectedCustomer(null);
          setEditMode(false);
        }}
        title={editMode ? "Edit Customer" : "Customer Profile"}
      >
        {selectedCustomer && !editMode && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white">{selectedCustomer.name}</h3>
              <p className="text-white/50 text-sm">Code: {selectedCustomer.code}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/50 uppercase tracking-wide">Email</label>
                <p className="text-white">{selectedCustomer.email || "—"}</p>
              </div>
              <div>
                <label className="text-xs text-white/50 uppercase tracking-wide">Phone</label>
                <p className="text-white">{selectedCustomer.phone || "—"}</p>
              </div>
              <div>
                <label className="text-xs text-white/50 uppercase tracking-wide">Status</label>
                <p>
                  <GlassBadge variant={selectedCustomer.isActive ? "success" : "default"}>
                    {selectedCustomer.isActive ? "Active" : "Inactive"}
                  </GlassBadge>
                </p>
              </div>
              {selectedCustomer.notes && (
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-wide">Notes</label>
                  <p className="text-white">{selectedCustomer.notes}</p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-white/10">
              <GlassButton variant="primary" onClick={startEdit} className="w-full">
                Edit Customer
              </GlassButton>
            </div>
          </div>
        )}

        {selectedCustomer && editMode && (
          <form onSubmit={handleUpdate} className="space-y-4">
            <GlassInput
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Customer name"
              required
            />
            <GlassInput
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="customer@email.com"
            />
            <GlassInput
              label="Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="(555) 123-4567"
            />
            <GlassInput
              label="Notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
            />

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

      {/* Create Customer SlideOver */}
      <SlideOver
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Customer"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <GlassInput
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Customer name"
            required
          />
          <GlassInput
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="customer@email.com"
          />
          <GlassInput
            label="Phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="(555) 123-4567"
          />
          <GlassInput
            label="Notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Additional notes..."
          />

          <div className="pt-4 flex gap-3">
            <GlassButton type="button" variant="ghost" onClick={() => setCreateOpen(false)} className="flex-1">
              Cancel
            </GlassButton>
            <GlassButton type="submit" variant="primary" className="flex-1">
              Create Customer
            </GlassButton>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
