"use client";

import * as React from "react";
import {
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
import { apiGet, apiPost, apiPut } from "@/lib/http";

interface Salesperson {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  linkedUserId: string | null;
  linkedUserName?: string | null;
  isActive: boolean;
}

interface SalespersonsResponse {
  items: Salesperson[];
  total: number;
}

interface User {
  id: string;
  email: string;
  fullName?: string;
}

interface UsersResponse {
  items: User[];
}

export function SalespersonsTab() {
  const { addToast } = useToast();
  const [salespersons, setSalespersons] = React.useState<Salesperson[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");

  // SlideOver states
  const [createOpen, setCreateOpen] = React.useState(false);
  const [viewOpen, setViewOpen] = React.useState(false);
  const [selectedSalesperson, setSelectedSalesperson] = React.useState<Salesperson | null>(null);
  const [linkOpen, setLinkOpen] = React.useState(false);

  // Form data for create
  const [formData, setFormData] = React.useState({
    name: "",
    email: "",
    phone: "",
    linkedUserId: "",
  });

  // Link user selection
  const [selectedLinkUserId, setSelectedLinkUserId] = React.useState("");

  const loadSalespersons = React.useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const data = await apiGet<SalespersonsResponse>("/api/sales-customers/salespersons");
      setSalespersons(data.items || []);
    } catch {
      setSalespersons([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  const loadUsers = React.useCallback(async () => {
    try {
      const data = await apiGet<UsersResponse>("/api/admin/users");
      setUsers(data.items || []);
    } catch {
      setUsers([]);
    }
  }, []);

  React.useEffect(() => {
    loadSalespersons();
    loadUsers();
  }, [loadSalespersons, loadUsers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost("/api/sales-customers/salespersons", {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        linkedUserId: formData.linkedUserId || null,
      });
      setCreateOpen(false);
      setFormData({ name: "", email: "", phone: "", linkedUserId: "" });
      addToast("success", "Salesperson added successfully");
      await loadSalespersons(false);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to add salesperson");
    }
  };

  const handleView = (salesperson: Salesperson) => {
    setSelectedSalesperson(salesperson);
    setViewOpen(true);
  };

  const handleLinkUser = async () => {
    if (!selectedSalesperson) return;
    try {
      const updated = await apiPut<Salesperson>(
        `/api/sales-customers/salespersons/${selectedSalesperson.id}`,
        { linkedUserId: selectedLinkUserId || null }
      );
      setSelectedSalesperson(updated);
      setLinkOpen(false);
      setSelectedLinkUserId("");
      addToast("success", selectedLinkUserId ? "User linked successfully" : "User unlinked successfully");
      await loadSalespersons(false);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to update link");
    }
  };

  const handleUnlink = async () => {
    if (!selectedSalesperson) return;
    try {
      const updated = await apiPut<Salesperson>(
        `/api/sales-customers/salespersons/${selectedSalesperson.id}`,
        { linkedUserId: null }
      );
      setSelectedSalesperson(updated);
      addToast("success", "User unlinked successfully");
      await loadSalespersons(false);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to unlink user");
    }
  };

  const openLinkDialog = () => {
    setSelectedLinkUserId(selectedSalesperson?.linkedUserId || "");
    setLinkOpen(true);
  };

  const filteredSalespersons = React.useMemo(() => {
    if (!search.trim()) return salespersons;
    const lowerSearch = search.toLowerCase();
    return salespersons.filter(
      (s) =>
        s.name.toLowerCase().includes(lowerSearch) ||
        s.email?.toLowerCase().includes(lowerSearch)
    );
  }, [salespersons, search]);

  // Build user options for dropdown
  const userOptions = React.useMemo(() => {
    const options = [{ value: "", label: "N/A (External Rep)" }];
    users.forEach((u) => {
      options.push({
        value: u.id,
        label: u.fullName ? `${u.fullName} (${u.email})` : u.email,
      });
    });
    return options;
  }, [users]);

  // Filter users not already linked (for link dialog)
  const availableUsersForLink = React.useMemo(() => {
    const linkedUserIds = new Set(
      salespersons
        .filter((s) => s.linkedUserId && s.id !== selectedSalesperson?.id)
        .map((s) => s.linkedUserId)
    );
    const options = [{ value: "", label: "N/A (Unlink)" }];
    users.forEach((u) => {
      if (!linkedUserIds.has(u.id)) {
        options.push({
          value: u.id,
          label: u.fullName ? `${u.fullName} (${u.email})` : u.email,
        });
      }
    });
    return options;
  }, [users, salespersons, selectedSalesperson]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const headers = ["Name", "Email", "Phone", "Platform User", "Status", ""];

  const rows = filteredSalespersons.map((s) => [
    s.name,
    s.email || "—",
    s.phone || "—",
    s.linkedUserName ? (
      <span key={`user-${s.id}`} className="text-blue-400">{s.linkedUserName}</span>
    ) : (
      <span key={`user-${s.id}`} className="text-white/40">N/A</span>
    ),
    <GlassBadge key={s.id} variant={s.isActive ? "success" : "default"}>
      {s.isActive ? "Active" : "Inactive"}
    </GlassBadge>,
    <button
      key={`view-${s.id}`}
      onClick={() => handleView(s)}
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
            placeholder="Search salespersons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <GlassButton variant="primary" onClick={() => setCreateOpen(true)}>
          Add Salesperson
        </GlassButton>
      </div>

      {/* Info Card */}
      <GlassCard padding="sm">
        <p className="text-sm text-white/60">
          Salespersons can be assigned to leads and quotes. They can be external reps (not platform users) or linked to existing users.
        </p>
      </GlassCard>

      {/* Salespersons List */}
      {filteredSalespersons.length > 0 ? (
        <GlassTable headers={headers} rows={rows} />
      ) : (
        <GlassCard>
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              {search ? "No Salespersons Found" : "No Salespersons Yet"}
            </h3>
            <p className="text-white/50 mb-4">
              {search ? "Try a different search term." : "Add your first salesperson to start assigning leads."}
            </p>
            {!search && (
              <GlassButton variant="primary" onClick={() => setCreateOpen(true)}>
                Add Salesperson
              </GlassButton>
            )}
          </div>
        </GlassCard>
      )}

      {/* Create Salesperson SlideOver */}
      <SlideOver
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add Salesperson"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <GlassInput
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="John Smith"
            required
          />
          <GlassInput
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="john@company.com"
          />
          <GlassInput
            label="Phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="(555) 123-4567"
          />
          <GlassSelect
            label="Link to Platform User"
            value={formData.linkedUserId}
            onChange={(e) => setFormData({ ...formData, linkedUserId: e.target.value })}
            options={userOptions}
          />

          <div className="pt-4 flex gap-3">
            <GlassButton type="button" variant="ghost" onClick={() => setCreateOpen(false)} className="flex-1">
              Cancel
            </GlassButton>
            <GlassButton type="submit" variant="primary" className="flex-1">
              Add Salesperson
            </GlassButton>
          </div>
        </form>
      </SlideOver>

      {/* View Salesperson SlideOver */}
      <SlideOver
        open={viewOpen}
        onClose={() => {
          setViewOpen(false);
          setSelectedSalesperson(null);
        }}
        title="Salesperson Details"
      >
        {selectedSalesperson && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white">{selectedSalesperson.name}</h3>
              <div className="mt-1">
                <GlassBadge variant={selectedSalesperson.isActive ? "success" : "default"}>
                  {selectedSalesperson.isActive ? "Active" : "Inactive"}
                </GlassBadge>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/50 uppercase tracking-wide">Email</label>
                <p className="text-white">{selectedSalesperson.email || "—"}</p>
              </div>
              <div>
                <label className="text-xs text-white/50 uppercase tracking-wide">Phone</label>
                <p className="text-white">{selectedSalesperson.phone || "—"}</p>
              </div>
            </div>

            {/* User Link Section */}
            <div className="p-4 rounded-lg bg-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-wide">Platform User</label>
                  <p className="text-white">
                    {selectedSalesperson.linkedUserName || (
                      <span className="text-white/40">Not linked</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                {selectedSalesperson.linkedUserId ? (
                  <>
                    <GlassButton size="sm" variant="ghost" onClick={openLinkDialog}>
                      Change Link
                    </GlassButton>
                    <GlassButton size="sm" variant="danger" onClick={handleUnlink}>
                      Unlink
                    </GlassButton>
                  </>
                ) : (
                  <GlassButton size="sm" variant="primary" onClick={openLinkDialog}>
                    Link to User
                  </GlassButton>
                )}
              </div>
            </div>

            {/* Info about linking */}
            <GlassCard padding="sm">
              <p className="text-xs text-white/50">
                Linking a salesperson to a platform user enables them to view and manage their assigned leads and quotes.
              </p>
            </GlassCard>
          </div>
        )}
      </SlideOver>

      {/* Link User Dialog */}
      <SlideOver
        open={linkOpen}
        onClose={() => {
          setLinkOpen(false);
          setSelectedLinkUserId("");
        }}
        title="Link to Platform User"
      >
        <div className="space-y-4">
          <p className="text-sm text-white/60">
            Select a platform user to link to {selectedSalesperson?.name}:
          </p>

          <GlassSelect
            label="Platform User"
            value={selectedLinkUserId}
            onChange={(e) => setSelectedLinkUserId(e.target.value)}
            options={availableUsersForLink}
          />

          <div className="pt-4 flex gap-3">
            <GlassButton
              type="button"
              variant="ghost"
              onClick={() => setLinkOpen(false)}
              className="flex-1"
            >
              Cancel
            </GlassButton>
            <GlassButton
              type="button"
              variant="primary"
              onClick={handleLinkUser}
              className="flex-1"
            >
              {selectedLinkUserId ? "Link User" : "Unlink"}
            </GlassButton>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
