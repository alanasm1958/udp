"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  GlassCard,
  GlassButton,
  GlassInput,
  GlassTextarea,
  GlassSelect,
  SlideOver,
  Spinner,
  GlassBadge,
  useToast,
} from "@/components/ui/glass";

/* =============================================================================
   TYPES
   ============================================================================= */

interface Person {
  id: string;
  fullName: string;
  displayName: string | null;
  types: string[];
  primaryEmail: string | null;
  primaryPhone: string | null;
  whatsappNumber: string | null;
  preferredChannel: string | null;
  linkedPartyId: string | null;
  linkedUserId: string | null;
  jobTitle: string | null;
  isQuickAdd: boolean;
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
  users: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  search: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  phone: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  ),
  email: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  ),
  whatsapp: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  ),
};

const TYPE_LABELS: Record<string, string> = {
  staff: "Staff",
  contractor: "Contractor",
  supplier_contact: "Vendor",
  vendor: "Vendor",
  sales_rep: "Sales Rep",
  service_provider: "Service Provider",
  partner_contact: "Partner",
  customer_contact: "Customer Contact",
};

const TYPE_COLORS: Record<string, string> = {
  staff: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  contractor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  supplier_contact: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  vendor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  sales_rep: "bg-green-500/20 text-green-300 border-green-500/30",
  service_provider: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  partner_contact: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  customer_contact: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
};

/* =============================================================================
   ADD PERSON DRAWER
   ============================================================================= */

interface AddPersonDrawerProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  defaultType?: string;
}

function AddPersonDrawer({ open, onClose, onCreated, defaultType }: AddPersonDrawerProps) {
  const { addToast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState({
    fullName: "",
    types: [defaultType || "supplier_contact"],
    primaryEmail: "",
    primaryPhone: "",
    whatsappNumber: "",
    preferredChannel: "whatsapp",
    jobTitle: "",
    notes: "",
  });

  React.useEffect(() => {
    if (defaultType) {
      setFormData((prev) => ({ ...prev, types: [defaultType] }));
    }
  }, [defaultType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fullName) {
      addToast("error", "Full name is required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.fullName,
          types: formData.types,
          primaryEmail: formData.primaryEmail || undefined,
          primaryPhone: formData.primaryPhone || undefined,
          whatsappNumber: formData.whatsappNumber || undefined,
          preferredChannel: formData.preferredChannel,
          jobTitle: formData.jobTitle || undefined,
          notes: formData.notes || undefined,
        }),
      });

      if (res.ok) {
        addToast("success", "Person added successfully");
        setFormData({
          fullName: "",
          types: [defaultType || "supplier_contact"],
          primaryEmail: "",
          primaryPhone: "",
          whatsappNumber: "",
          preferredChannel: "whatsapp",
          jobTitle: "",
          notes: "",
        });
        onCreated();
        onClose();
      } else {
        const data = await res.json();
        addToast("error", data.error || "Failed to add person");
      }
    } catch (error) {
      console.error("Add person error:", error);
      addToast("error", "Failed to add person");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      fullName: "",
      types: [defaultType || "supplier_contact"],
      primaryEmail: "",
      primaryPhone: "",
      whatsappNumber: "",
      preferredChannel: "whatsapp",
      jobTitle: "",
      notes: "",
    });
    onClose();
  };

  const toggleType = (type: string) => {
    setFormData((prev) => {
      const types = prev.types.includes(type)
        ? prev.types.filter((t) => t !== type)
        : [...prev.types, type];
      return { ...prev, types: types.length > 0 ? types : [type] };
    });
  };

  return (
    <SlideOver open={open} onClose={handleClose} title="Add Person" width="md">
      <form onSubmit={handleSubmit} className="space-y-6">
        <GlassInput
          label="Full Name *"
          placeholder="e.g., John Smith"
          value={formData.fullName}
          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
          required
        />

        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">Roles</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(TYPE_LABELS).filter(([key]) => ["supplier_contact", "contractor", "service_provider"].includes(key)).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleType(key)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  formData.types.includes(key)
                    ? TYPE_COLORS[key]
                    : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <GlassInput
          label="Job Title"
          placeholder="e.g., Sales Manager"
          value={formData.jobTitle}
          onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
        />

        <div className="space-y-4">
          <h4 className="text-sm font-medium text-white/70">Contact Information</h4>

          <GlassInput
            label="Email"
            type="email"
            placeholder="e.g., john@example.com"
            value={formData.primaryEmail}
            onChange={(e) => setFormData({ ...formData, primaryEmail: e.target.value })}
          />

          <GlassInput
            label="Phone"
            placeholder="e.g., +1 555-123-4567"
            value={formData.primaryPhone}
            onChange={(e) => setFormData({ ...formData, primaryPhone: e.target.value })}
          />

          <GlassInput
            label="WhatsApp Number"
            placeholder="e.g., +1 555-123-4567"
            value={formData.whatsappNumber}
            onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
          />

          <GlassSelect
            label="Preferred Contact Channel"
            value={formData.preferredChannel}
            onChange={(e) => setFormData({ ...formData, preferredChannel: e.target.value })}
            options={[
              { value: "whatsapp", label: "WhatsApp" },
              { value: "email", label: "Email" },
              { value: "phone", label: "Phone" },
            ]}
          />
        </div>

        <GlassTextarea
          label="Notes"
          placeholder="Additional notes..."
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
        />

        <div className="flex gap-3 pt-4">
          <GlassButton type="button" variant="ghost" onClick={handleClose} className="flex-1">
            Cancel
          </GlassButton>
          <GlassButton type="submit" variant="primary" disabled={loading} className="flex-1">
            {loading ? <Spinner size="sm" /> : "Add Person"}
          </GlassButton>
        </div>
      </form>
    </SlideOver>
  );
}

/* =============================================================================
   MAIN PAGE
   ============================================================================= */

function PeoplePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [people, setPeople] = React.useState<Person[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // Filter by roles from URL
  const rolesFilter = searchParams.get("roles");
  const typeFilter = searchParams.get("type");

  const fetchPeople = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      // Filter to vendor-related types by default for operations page
      if (typeFilter) {
        params.set("type", typeFilter);
      } else if (rolesFilter) {
        // Convert roles param to type filter
        const roles = rolesFilter.split(",");
        if (roles.includes("vendor")) params.set("type", "supplier_contact");
        else if (roles.includes("contractor")) params.set("type", "contractor");
        else if (roles.length > 0) params.set("type", roles[0]);
      }
      params.set("limit", "100");

      const res = await fetch(`/api/people?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        // If no filter, show vendors and contractors by default
        let result = data.people || [];
        if (!typeFilter && !rolesFilter) {
          result = result.filter((p: Person) =>
            p.types.some((t) => ["supplier_contact", "contractor", "service_provider"].includes(t))
          );
        }
        setPeople(result);
      }
    } catch (error) {
      console.error("Failed to fetch people:", error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, rolesFilter, typeFilter]);

  React.useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPeople();
  };

  const handleTypeFilter = (type: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (type) {
      params.set("type", type);
      params.delete("roles");
    } else {
      params.delete("type");
      params.delete("roles");
    }
    router.push(`/operations/people?${params.toString()}`);
  };

  const activeType = typeFilter || (rolesFilter === "vendor" ? "supplier_contact" : rolesFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Vendors & Contractors</h1>
          <p className="text-sm text-white/50 mt-1">
            Manage suppliers, service providers, and external partners
          </p>
        </div>
        <GlassButton variant="primary" onClick={() => setDrawerOpen(true)}>
          {Icons.plus}
          <span>Add Person</span>
        </GlassButton>
      </div>

      {/* Filters */}
      <GlassCard padding="sm">
        <div className="flex flex-wrap items-center gap-4">
          {/* Type Filter Tabs */}
          <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
            {[
              { id: null, label: "All" },
              { id: "supplier_contact", label: "Vendors" },
              { id: "contractor", label: "Contractors" },
              { id: "service_provider", label: "Service Providers" },
            ].map((tab) => (
              <button
                key={tab.id ?? "all"}
                onClick={() => handleTypeFilter(tab.id)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  activeType === tab.id || (!activeType && tab.id === null)
                    ? "bg-white/10 text-white"
                    : "text-white/50 hover:text-white hover:bg-white/5"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name, email, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/20"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
                {Icons.search}
              </div>
            </div>
          </form>

          {/* Count */}
          <div className="text-sm text-white/50">
            {people.length} {people.length === 1 ? "person" : "people"}
          </div>
        </div>
      </GlassCard>

      {/* People Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : people.length === 0 ? (
        <GlassCard>
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-rose-500/20 flex items-center justify-center text-rose-400">
              {Icons.users}
            </div>
            <p className="text-lg font-medium text-white mb-2">No people found</p>
            <p className="text-sm text-white/50 mb-6">
              {searchQuery ? "Try a different search term" : "Add your first vendor or contractor to get started"}
            </p>
            {!searchQuery && (
              <GlassButton variant="primary" onClick={() => setDrawerOpen(true)}>
                {Icons.plus}
                <span>Add Person</span>
              </GlassButton>
            )}
          </div>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {people.map((person) => (
            <GlassCard key={person.id} className="hover:border-white/25 transition-colors cursor-pointer">
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-lg font-semibold">
                      {person.fullName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">{person.fullName}</h3>
                    {person.jobTitle && (
                      <p className="text-sm text-white/50 truncate">{person.jobTitle}</p>
                    )}
                  </div>
                </div>

                {/* Types */}
                <div className="flex flex-wrap gap-1.5">
                  {person.types.map((type) => (
                    <span
                      key={type}
                      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded border ${TYPE_COLORS[type] || "bg-gray-500/20 text-gray-300 border-gray-500/30"}`}
                    >
                      {TYPE_LABELS[type] || type}
                    </span>
                  ))}
                </div>

                {/* Contact Info */}
                <div className="space-y-1.5 text-sm">
                  {person.primaryEmail && (
                    <div className="flex items-center gap-2 text-white/60">
                      <span className="text-white/40">{Icons.email}</span>
                      <span className="truncate">{person.primaryEmail}</span>
                    </div>
                  )}
                  {person.primaryPhone && (
                    <div className="flex items-center gap-2 text-white/60">
                      <span className="text-white/40">{Icons.phone}</span>
                      <span>{person.primaryPhone}</span>
                    </div>
                  )}
                  {person.whatsappNumber && (
                    <div className="flex items-center gap-2 text-white/60">
                      <span className="text-green-400">{Icons.whatsapp}</span>
                      <span>{person.whatsappNumber}</span>
                    </div>
                  )}
                </div>

                {/* Quick Add Badge */}
                {person.isQuickAdd && (
                  <div className="pt-2 border-t border-white/10">
                    <GlassBadge variant="warning">Incomplete profile</GlassBadge>
                  </div>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Add Person Drawer */}
      <AddPersonDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCreated={fetchPeople}
        defaultType="supplier_contact"
      />
    </div>
  );
}

export default function PeoplePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      }
    >
      <PeoplePageContent />
    </Suspense>
  );
}
