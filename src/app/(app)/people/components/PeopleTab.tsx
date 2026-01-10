"use client";

import * as React from "react";
import {
  GlassCard,
  GlassButton,
  GlassBadge,
  GlassInput,
  GlassSelect,
  GlassTable,
  SkeletonTable,
} from "@/components/ui/glass";
import { apiGet, formatDate } from "@/lib/http";
import { PersonProfileDrawer } from "./PersonProfileDrawer";

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
  departmentId: string | null;
  departmentName?: string | null;
  isQuickAdd: boolean;
  isActive: boolean;
  createdAt: string;
}

/* =============================================================================
   CONSTANTS
   ============================================================================= */

const personTypes = [
  { value: "staff", label: "Staff" },
  { value: "contractor", label: "Contractor" },
  { value: "sales_rep", label: "Sales Rep" },
  { value: "service_provider", label: "Service Provider" },
  { value: "supplier_contact", label: "Supplier Contact" },
  { value: "customer_contact", label: "Customer Contact" },
  { value: "partner_contact", label: "Partner Contact" },
];

/* =============================================================================
   ICONS
   ============================================================================= */

const Icons = {
  search: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  ),
  filter: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
    </svg>
  ),
  refresh: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  ),
};

/* =============================================================================
   MAIN COMPONENT
   ============================================================================= */

interface PeopleTabProps {
  onRecordActivity?: () => void;
}

export function PeopleTab({ onRecordActivity }: PeopleTabProps) {
  const [people, setPeople] = React.useState<Person[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "inactive">("active");
  const [showFilters, setShowFilters] = React.useState(false);

  // Profile drawer state
  const [selectedPersonId, setSelectedPersonId] = React.useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const loadPeople = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      if (typeFilter) params.set("type", typeFilter);
      if (statusFilter !== "all") params.set("isActive", statusFilter === "active" ? "true" : "false");
      params.set("limit", "100");

      const res = await apiGet<{ people: Person[] }>(`/api/people?${params}`);
      setPeople(res.people || []);
    } catch (err) {
      console.error("Failed to load people:", err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, typeFilter, statusFilter]);

  React.useEffect(() => {
    loadPeople();
  }, [loadPeople]);

  const handleRowClick = (personId: string) => {
    setSelectedPersonId(personId);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedPersonId(null);
  };

  const getTypeBadges = (types: string[]) => {
    return types.slice(0, 2).map((t) => {
      const type = personTypes.find((pt) => pt.value === t);
      const colors: Record<string, string> = {
        staff: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
        contractor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
        sales_rep: "bg-blue-500/20 text-blue-400 border-blue-500/30",
        service_provider: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      };
      return (
        <span
          key={t}
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${colors[t] || "bg-white/10 text-white/70 border-white/20"}`}
        >
          {type?.label || t}
        </span>
      );
    });
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <GlassCard padding="sm">
        <div className="flex flex-col gap-4">
          {/* Main search row */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <GlassInput
                label="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, phone..."
                onKeyDown={(e) => e.key === "Enter" && loadPeople()}
              />
            </div>
            <GlassButton onClick={loadPeople} disabled={loading}>
              {loading ? (
                <span className="animate-spin">{Icons.refresh}</span>
              ) : (
                Icons.search
              )}
              <span className="ml-2">Search</span>
            </GlassButton>
            <GlassButton
              variant="ghost"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? "bg-white/10" : ""}
            >
              {Icons.filter}
              <span className="ml-2">Filters</span>
            </GlassButton>
          </div>

          {/* Expandable filters */}
          {showFilters && (
            <div className="flex flex-wrap items-end gap-3 pt-3 border-t border-white/10">
              <div className="w-40">
                <GlassSelect
                  label="Type"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  options={[
                    { value: "", label: "All Types" },
                    ...personTypes,
                  ]}
                />
              </div>
              <div className="w-40">
                <GlassSelect
                  label="Status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
                  options={[
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" },
                    { value: "all", label: "All" },
                  ]}
                />
              </div>
              <GlassButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setTypeFilter("");
                  setStatusFilter("active");
                }}
              >
                Clear Filters
              </GlassButton>
            </div>
          )}
        </div>
      </GlassCard>

      {/* People Table */}
      <GlassCard padding="none">
        {loading ? (
          <div className="p-6">
            <SkeletonTable rows={5} columns={5} />
          </div>
        ) : people.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <p className="text-white/70 font-medium mb-2">No people found</p>
            <p className="text-sm text-white/40 mb-6">Add your first team member to get started</p>
            {onRecordActivity && (
              <GlassButton variant="primary" onClick={onRecordActivity}>
                Add Person
              </GlassButton>
            )}
          </div>
        ) : (
          <GlassTable
            headers={["Name", "Type", "Contact", "Job Title", "Status", "Added"]}
            rows={people.map((p) => [
              // Name column
              <button
                key="name"
                type="button"
                onClick={() => handleRowClick(p.id)}
                className="flex items-center gap-2 text-left hover:text-blue-400 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-sm font-medium text-white">
                  {p.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="font-medium text-white">{p.fullName}</span>
                  {p.isQuickAdd && (
                    <span className="ml-2"><GlassBadge variant="warning">Quick-Add</GlassBadge></span>
                  )}
                </div>
              </button>,
              // Types column
              <div key="types" className="flex flex-wrap gap-1">
                {getTypeBadges(p.types)}
              </div>,
              // Contact column
              <div key="contact" className="text-sm">
                {p.primaryEmail && <div className="text-white/70">{p.primaryEmail}</div>}
                {p.primaryPhone && <div className="text-white/50 text-xs">{p.primaryPhone}</div>}
                {!p.primaryEmail && !p.primaryPhone && (
                  <span className="text-white/30">No contact</span>
                )}
              </div>,
              // Job Title column
              <span key="job" className="text-white/70">{p.jobTitle || <span className="text-white/30">-</span>}</span>,
              // Status column
              <GlassBadge key="status" variant={p.isActive ? "success" : "default"}>
                {p.isActive ? "Active" : "Inactive"}
              </GlassBadge>,
              // Added column
              <span key="date" className="text-white/50 text-sm">{formatDate(p.createdAt)}</span>,
            ])}
            emptyMessage="No people found"
          />
        )}
      </GlassCard>

      {/* Stats Footer */}
      {!loading && people.length > 0 && (
        <div className="flex items-center justify-between text-sm text-white/40">
          <span>Showing {people.length} {people.length === 1 ? "person" : "people"}</span>
          <span>
            {people.filter((p) => p.types.includes("staff")).length} staff,{" "}
            {people.filter((p) => p.types.includes("contractor")).length} contractors
          </span>
        </div>
      )}

      {/* Person Profile Drawer */}
      <PersonProfileDrawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        personId={selectedPersonId}
      />
    </div>
  );
}
