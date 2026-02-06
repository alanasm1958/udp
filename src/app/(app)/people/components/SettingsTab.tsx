"use client";

import * as React from "react";
import Link from "next/link";
import {
  GlassCard,
  GlassButton,
  GlassBadge,
  GlassInput,
} from "@/components/ui/glass";
import { apiGet, apiPatch } from "@/lib/http";

/* =============================================================================
   ICONS
   ============================================================================= */

const Icons = {
  globe: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  ),
  calendar: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  document: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  shield: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
  currency: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  users: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  chevronRight: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  ),
  chevronDown: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  ),
  plus: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  ),
  x: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  edit: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  ),
};

/* =============================================================================
   TYPES
   ============================================================================= */

interface LeaveType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  accrualType: string;
  defaultAnnualAllowance: string | null;
  maxCarryoverDays: string | null;
  requiresApproval: boolean;
  isPaid: boolean;
  isActive: boolean;
}

interface Jurisdiction {
  id: string;
  code: string;
  name: string;
  countryCode: string;
  subdivisionCode: string | null;
  jurisdictionType: string;
  currencyCode: string;
  timezone: string | null;
  isActive: boolean;
}

/* =============================================================================
   EXPANDABLE CARD COMPONENT
   ============================================================================= */

interface ExpandableCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: string;
  loading?: boolean;
}

function ExpandableCard({
  icon,
  title,
  description,
  color,
  isExpanded,
  onToggle,
  children,
  badge,
  loading,
}: ExpandableCardProps) {
  return (
    <div className="border border-white/10 rounded-2xl bg-gradient-to-br from-white/5 to-transparent overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-5 hover:bg-white/5 transition-colors"
      >
        <div className={`flex-shrink-0 p-3 rounded-xl ${color}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-white">{title}</p>
            {badge && <GlassBadge variant="info">{badge}</GlassBadge>}
          </div>
          <p className="text-sm text-white/50 mt-1">{description}</p>
        </div>
        <div className={`text-white/30 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
          {Icons.chevronDown}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-white/10 p-5 bg-black/20">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-white/20 border-t-white/80 rounded-full" />
            </div>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
}

/* =============================================================================
   SETTING CARD COMPONENT (for links)
   ============================================================================= */

interface SettingCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  href?: string;
  color: string;
}

function SettingCard({ icon, title, description, href, color }: SettingCardProps) {
  const content = (
    <div className="group relative overflow-hidden flex items-center gap-4 p-5 rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent hover:border-white/20 hover:from-white/8 cursor-pointer transition-all duration-200">
      <div className={`flex-shrink-0 p-3 rounded-xl ${color}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white">{title}</p>
        <p className="text-sm text-white/50 mt-1">{description}</p>
      </div>
      <div className="text-white/30 group-hover:text-white/60 group-hover:translate-x-1 transition-all">
        {Icons.chevronRight}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

/* =============================================================================
   LEAVE TYPES SECTION
   ============================================================================= */

function LeaveTypesSection() {
  const [leaveTypes, setLeaveTypes] = React.useState<LeaveType[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<Partial<LeaveType>>({});
  const [saving, setSaving] = React.useState(false);

  const loadLeaveTypes = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiGet<{ items: LeaveType[] }>("/api/people/leave-types?activeOnly=false");
      setLeaveTypes(res.items || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leave types");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadLeaveTypes();
  }, [loadLeaveTypes]);

  const startEdit = (lt: LeaveType) => {
    setEditingId(lt.id);
    setEditForm({
      name: lt.name,
      description: lt.description || "",
      defaultAnnualAllowance: lt.defaultAnnualAllowance || "",
      maxCarryoverDays: lt.maxCarryoverDays || "",
      requiresApproval: lt.requiresApproval,
      isPaid: lt.isPaid,
      isActive: lt.isActive,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      setSaving(true);
      await apiPatch("/api/people/leave-types", {
        id: editingId,
        ...editForm,
        defaultAnnualAllowance: editForm.defaultAnnualAllowance || null,
        maxCarryoverDays: editForm.maxCarryoverDays || null,
      });
      await loadLeaveTypes();
      setEditingId(null);
      setEditForm({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin w-5 h-5 border-2 border-white/20 border-t-white/80 rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4">
        <p className="text-red-400 text-sm">{error}</p>
        <button onClick={loadLeaveTypes} className="text-white/60 hover:text-white text-sm mt-2 underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-white/40 uppercase tracking-wide mb-2">
        {leaveTypes.length} leave types configured
      </div>

      {leaveTypes.map((lt) => (
        <div
          key={lt.id}
          className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10"
        >
          {editingId === lt.id ? (
            <div className="flex-1 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <GlassInput
                  label="Name"
                  value={editForm.name || ""}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
                <GlassInput
                  label="Description"
                  value={editForm.description || ""}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <GlassInput
                  label="Annual Allowance (days)"
                  type="number"
                  value={editForm.defaultAnnualAllowance || ""}
                  onChange={(e) => setEditForm({ ...editForm, defaultAnnualAllowance: e.target.value })}
                />
                <GlassInput
                  label="Max Carryover (days)"
                  type="number"
                  value={editForm.maxCarryoverDays || ""}
                  onChange={(e) => setEditForm({ ...editForm, maxCarryoverDays: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.requiresApproval ?? true}
                    onChange={(e) => setEditForm({ ...editForm, requiresApproval: e.target.checked })}
                    className="w-4 h-4 rounded bg-white/10 border-white/20"
                  />
                  <span className="text-white/70">Requires Approval</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.isPaid ?? true}
                    onChange={(e) => setEditForm({ ...editForm, isPaid: e.target.checked })}
                    className="w-4 h-4 rounded bg-white/10 border-white/20"
                  />
                  <span className="text-white/70">Paid Leave</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.isActive ?? true}
                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                    className="w-4 h-4 rounded bg-white/10 border-white/20"
                  />
                  <span className="text-white/70">Active</span>
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <GlassButton variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>
                  Cancel
                </GlassButton>
                <GlassButton variant="default" size="sm" onClick={saveEdit} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </GlassButton>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">{lt.name}</span>
                  <GlassBadge variant={lt.isActive ? "success" : "default"}>
                    {lt.code}
                  </GlassBadge>
                  {lt.isPaid && <GlassBadge variant="info">Paid</GlassBadge>}
                  {!lt.isActive && <GlassBadge variant="warning">Inactive</GlassBadge>}
                </div>
                <div className="text-xs text-white/40 mt-1 flex gap-4">
                  {lt.defaultAnnualAllowance && (
                    <span>{lt.defaultAnnualAllowance} days/year</span>
                  )}
                  {lt.maxCarryoverDays && (
                    <span>Max {lt.maxCarryoverDays} carryover</span>
                  )}
                  {lt.requiresApproval && (
                    <span>Requires approval</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => startEdit(lt)}
                className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                {Icons.edit}
              </button>
            </>
          )}
        </div>
      ))}

      <p className="text-xs text-white/30 mt-4">
        To add new leave types, run: <code className="bg-white/10 px-1.5 py-0.5 rounded">npx tsx scripts/seed/leave_types.ts</code>
      </p>
    </div>
  );
}

/* =============================================================================
   JURISDICTIONS SECTION
   ============================================================================= */

function JurisdictionsSection() {
  const [jurisdictions, setJurisdictions] = React.useState<Jurisdiction[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filterType, setFilterType] = React.useState<string>("country");

  const loadJurisdictions = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiGet<{ items: Jurisdiction[] }>(
        `/api/people/jurisdictions?type=${filterType}`
      );
      setJurisdictions(res.items || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jurisdictions");
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  React.useEffect(() => {
    loadJurisdictions();
  }, [loadJurisdictions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin w-5 h-5 border-2 border-white/20 border-t-white/80 rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4">
        <p className="text-red-400 text-sm">{error}</p>
        <button onClick={loadJurisdictions} className="text-white/60 hover:text-white text-sm mt-2 underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-white/40 uppercase tracking-wide">Filter by:</span>
        {["country", "state", "province", "territory", "local"].map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              filterType === type
                ? "bg-blue-500/30 text-blue-300 border border-blue-400/30"
                : "bg-white/5 text-white/50 hover:bg-white/10 border border-white/10"
            }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      <div className="text-xs text-white/40 mb-2">
        {jurisdictions.length} jurisdictions found
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
        {jurisdictions.map((j) => (
          <div
            key={j.id}
            className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-white truncate">{j.name}</span>
                <GlassBadge variant="default">{j.code}</GlassBadge>
              </div>
              <div className="text-xs text-white/40 mt-0.5 flex gap-2">
                <span>{j.countryCode}</span>
                {j.subdivisionCode && <span>{j.subdivisionCode}</span>}
                <span>{j.currencyCode}</span>
                {j.timezone && <span>{j.timezone}</span>}
              </div>
            </div>
            {!j.isActive && (
              <GlassBadge variant="warning">Inactive</GlassBadge>
            )}
          </div>
        ))}
      </div>

      {jurisdictions.length === 0 && (
        <p className="text-center text-white/40 py-4">
          No {filterType} jurisdictions found
        </p>
      )}

      <p className="text-xs text-white/30 mt-4">
        To add jurisdictions, run: <code className="bg-white/10 px-1.5 py-0.5 rounded">npx tsx scripts/seed/jurisdictions.ts</code>
      </p>
    </div>
  );
}

/* =============================================================================
   DOCUMENT CATEGORIES SECTION
   ============================================================================= */

const DOCUMENT_CATEGORIES = [
  { code: "id", name: "Government ID", description: "Passport, driver's license, national ID" },
  { code: "contract", name: "Contract", description: "Employment contract, NDA, offer letters" },
  { code: "certificate", name: "Certificate", description: "Certifications, qualifications, degrees" },
  { code: "visa", name: "Visa/Work Permit", description: "Work permits, visas, authorization docs" },
  { code: "license", name: "License", description: "Professional licenses, permits" },
  { code: "policy", name: "Policy", description: "Signed policies, handbooks, acknowledgments" },
  { code: "tax", name: "Tax Form", description: "W-4, W-2, tax elections, withholding forms" },
  { code: "other", name: "Other", description: "Miscellaneous documents" },
];

function DocumentCategoriesSection() {
  return (
    <div className="space-y-3">
      <div className="text-xs text-white/40 uppercase tracking-wide mb-2">
        {DOCUMENT_CATEGORIES.length} document categories available
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {DOCUMENT_CATEGORIES.map((cat) => (
          <div
            key={cat.code}
            className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10"
          >
            <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
              {Icons.document}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">{cat.name}</span>
                <GlassBadge variant="default">{cat.code.toUpperCase()}</GlassBadge>
              </div>
              <p className="text-xs text-white/40 mt-0.5">{cat.description}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-white/30 mt-4">
        Document categories are system-defined and used to organize uploaded documents.
        Upload documents from individual person profiles.
      </p>
    </div>
  );
}

/* =============================================================================
   MAIN COMPONENT
   ============================================================================= */

export function SettingsTab() {
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const toggleExpanded = (key: string) => {
    setExpanded(expanded === key ? null : key);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white">HR & People Settings</h2>
        <p className="text-sm text-white/50">Configure payroll rules, leave policies, and access controls</p>
      </div>

      {/* Expandable Settings */}
      <div className="space-y-3">
        <ExpandableCard
          icon={Icons.calendar}
          title="Leave Types"
          description="Configure vacation, sick leave, and other leave policies"
          color="bg-amber-500/20 text-amber-400"
          isExpanded={expanded === "leave"}
          onToggle={() => toggleExpanded("leave")}
        >
          <LeaveTypesSection />
        </ExpandableCard>

        <ExpandableCard
          icon={Icons.globe}
          title="Jurisdictions"
          description="Countries, states, and tax regions for payroll compliance"
          color="bg-blue-500/20 text-blue-400"
          isExpanded={expanded === "jurisdictions"}
          onToggle={() => toggleExpanded("jurisdictions")}
        >
          <JurisdictionsSection />
        </ExpandableCard>

        <ExpandableCard
          icon={Icons.document}
          title="Document Categories"
          description="Document types for employee records and compliance"
          color="bg-purple-500/20 text-purple-400"
          isExpanded={expanded === "documents"}
          onToggle={() => toggleExpanded("documents")}
        >
          <DocumentCategoriesSection />
        </ExpandableCard>
      </div>

      {/* Link Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SettingCard
          icon={Icons.currency}
          title="Earning & Deduction Types"
          description="Standard earning types, deductions, and employer contributions"
          href="/settings/accountant-tools"
          color="bg-emerald-500/20 text-emerald-400"
        />

        <SettingCard
          icon={Icons.shield}
          title="Access Controls"
          description="Role-based permissions for HR data"
          href="/settings/users"
          color="bg-red-500/20 text-red-400"
        />

        <SettingCard
          icon={Icons.users}
          title="Departments"
          description="Manage organizational structure and departments"
          href="/company/departments"
          color="bg-indigo-500/20 text-indigo-400"
        />
      </div>

      {/* Quick Links */}
      <GlassCard>
        <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-4">
          Related Settings
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            href="/settings/users"
            className="p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <div className="text-sm font-medium text-white">User Accounts</div>
            <div className="text-xs text-white/40">Platform access</div>
          </Link>
          <Link
            href="/company/organization"
            className="p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <div className="text-sm font-medium text-white">Org Chart</div>
            <div className="text-xs text-white/40">View structure</div>
          </Link>
          <Link
            href="/settings"
            className="p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <div className="text-sm font-medium text-white">Audit Log</div>
            <div className="text-xs text-white/40">View history</div>
          </Link>
          <Link
            href="/settings"
            className="p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <div className="text-sm font-medium text-white">All Settings</div>
            <div className="text-xs text-white/40">System config</div>
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
