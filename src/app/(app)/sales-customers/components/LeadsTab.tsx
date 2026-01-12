"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  GlassCard,
  GlassButton,
  GlassInput,
  GlassSelect,
  GlassTabs,
  Spinner,
  SlideOver,
  useToast,
} from "@/components/ui/glass";
import { apiGet, apiPost, apiPut, formatCurrency, formatDate } from "@/lib/http";

// Lead status stages
const STAGES = [
  { id: "new", label: "New", color: "bg-slate-500" },
  { id: "contacted", label: "Contacted", color: "bg-blue-500" },
  { id: "qualified", label: "Qualified", color: "bg-purple-500" },
  { id: "disqualified", label: "Disqualified", color: "bg-amber-500" },
  { id: "won", label: "Won", color: "bg-emerald-500" },
  { id: "lost", label: "Lost", color: "bg-red-500" },
] as const;

type LeadStatus = typeof STAGES[number]["id"];

interface Lead {
  id: string;
  contactName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: LeadStatus;
  source: string | null;
  estimatedValue: string | null;
  probability: number | null;
  expectedCloseDate: string | null;
  notes: string | null;
  partyId: string | null;
  assignedToUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LeadsResponse {
  items: Lead[];
  total: number;
}

const viewTabs = [
  { id: "pipeline", label: "Pipeline" },
  { id: "list", label: "List View" },
];

export function LeadsTab() {
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const [activeView, setActiveView] = React.useState("pipeline");
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedLead, setSelectedLead] = React.useState<Lead | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [formData, setFormData] = React.useState({
    contactName: "",
    company: "",
    email: "",
    phone: "",
    estimatedValue: "",
    source: "website",
    notes: "",
    expectedCloseDate: "",
  });

  // Apply filters from URL
  const statusFilter = searchParams.get("status");

  // Load leads from API
  const loadLeads = React.useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      let url = "/api/sales-customers/leads";
      if (statusFilter) {
        url += `?status=${statusFilter}`;
      }
      const data = await apiGet<LeadsResponse>(url);
      setLeads(data.items || []);
    } catch {
      // Silently handle
      setLeads([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [statusFilter]);

  React.useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  // Create new lead
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost("/api/sales-customers/leads", {
        contactName: formData.contactName,
        company: formData.company || null,
        email: formData.email || null,
        phone: formData.phone || null,
        estimatedValue: formData.estimatedValue ? parseFloat(formData.estimatedValue) : null,
        source: formData.source || null,
        notes: formData.notes || null,
        expectedCloseDate: formData.expectedCloseDate || null,
      });
      setCreateOpen(false);
      setFormData({ contactName: "", company: "", email: "", phone: "", estimatedValue: "", source: "website", notes: "", expectedCloseDate: "" });
      addToast("success", "Lead created successfully");
      await loadLeads(false);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to create lead");
    }
  };

  // Update lead status
  const updateStatus = async (leadId: string, newStatus: LeadStatus) => {
    try {
      await apiPut(`/api/sales-customers/leads/${leadId}`, { status: newStatus });
      addToast("success", `Lead moved to ${STAGES.find((s) => s.id === newStatus)?.label}`);
      loadLeads();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to update lead");
    }
  };

  // Group leads by status
  const leadsByStatus = React.useMemo(() => {
    return STAGES.reduce((acc, stage) => {
      acc[stage.id] = leads.filter((l) => l.status === stage.id);
      return acc;
    }, {} as Record<LeadStatus, Lead[]>);
  }, [leads]);

  // Calculate metrics
  const activeLeads = leads.filter((l) => !["won", "lost", "disqualified"].includes(l.status));
  const totalPipelineValue = activeLeads.reduce((sum, l) => sum + parseFloat(l.estimatedValue || "0"), 0);
  const wonValue = leads.filter((l) => l.status === "won").reduce((sum, l) => sum + parseFloat(l.estimatedValue || "0"), 0);

  const getStageValue = (stageId: LeadStatus) => {
    return leadsByStatus[stageId]?.reduce((sum, l) => sum + parseFloat(l.estimatedValue || "0"), 0) || 0;
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <GlassTabs tabs={viewTabs} activeTab={activeView} onTabChange={setActiveView} />
        <GlassButton variant="primary" onClick={() => setCreateOpen(true)}>
          + New Lead
        </GlassButton>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard padding="sm">
          <p className="text-xs text-white/50 uppercase">Pipeline Value</p>
          <p className="text-2xl font-bold text-white">{loading ? <Spinner size="sm" /> : formatCurrency(totalPipelineValue)}</p>
          <p className="text-xs text-white/40 mt-1">{activeLeads.length} active leads</p>
        </GlassCard>
        <GlassCard padding="sm">
          <p className="text-xs text-white/50 uppercase">New Leads</p>
          <p className="text-2xl font-bold text-blue-400">{loading ? <Spinner size="sm" /> : leadsByStatus.new?.length || 0}</p>
        </GlassCard>
        <GlassCard padding="sm">
          <p className="text-xs text-white/50 uppercase">Qualified</p>
          <p className="text-2xl font-bold text-purple-400">{loading ? <Spinner size="sm" /> : leadsByStatus.qualified?.length || 0}</p>
        </GlassCard>
        <GlassCard padding="sm">
          <p className="text-xs text-white/50 uppercase">Won Value</p>
          <p className="text-2xl font-bold text-emerald-400">{loading ? <Spinner size="sm" /> : formatCurrency(wonValue)}</p>
        </GlassCard>
      </div>

      {/* Pipeline View */}
      {activeView === "pipeline" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {STAGES.map((stage) => (
            <div key={stage.id} className="space-y-3">
              {/* Stage Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                  <h3 className="text-sm font-medium text-white">{stage.label}</h3>
                  <span className="text-xs text-white/40">({leadsByStatus[stage.id]?.length || 0})</span>
                </div>
                <span className="text-xs text-white/50">{formatCurrency(getStageValue(stage.id))}</span>
              </div>

              {/* Stage Cards */}
              <div className="space-y-2 min-h-[200px]">
                {loading ? (
                  <div className="text-center py-4"><Spinner size="sm" /></div>
                ) : (
                  leadsByStatus[stage.id]?.map((lead) => (
                    <div
                      key={lead.id}
                      className="p-3 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
                      onClick={() => setSelectedLead(lead)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium text-white">{lead.company || lead.contactName}</p>
                          <p className="text-xs text-white/50">{lead.company ? lead.contactName : (lead.email || "No email")}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-emerald-400">{formatCurrency(parseFloat(lead.estimatedValue || "0"))}</span>
                        <span className="text-xs text-white/40">{lead.probability || 10}%</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {activeView === "list" && (
        <GlassCard padding="none">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 text-xs font-medium text-white/50 uppercase">Contact</th>
                  <th className="text-left p-4 text-xs font-medium text-white/50 uppercase">Company</th>
                  <th className="text-left p-4 text-xs font-medium text-white/50 uppercase">Status</th>
                  <th className="text-right p-4 text-xs font-medium text-white/50 uppercase">Value</th>
                  <th className="text-left p-4 text-xs font-medium text-white/50 uppercase">Source</th>
                  <th className="text-left p-4 text-xs font-medium text-white/50 uppercase">Created</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center"><Spinner size="md" /></td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-white/50">No leads found</td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-4">
                        <p className="text-white font-medium">{lead.contactName}</p>
                        <p className="text-xs text-white/40">{lead.email || "—"}</p>
                      </td>
                      <td className="p-4 text-white/70">{lead.company || "—"}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs ${STAGES.find((s) => s.id === lead.status)?.color} text-white`}>
                          {STAGES.find((s) => s.id === lead.status)?.label}
                        </span>
                      </td>
                      <td className="p-4 text-right text-emerald-400">{formatCurrency(parseFloat(lead.estimatedValue || "0"))}</td>
                      <td className="p-4 text-white/50">{lead.source || "—"}</td>
                      <td className="p-4 text-white/50">{formatDate(lead.createdAt)}</td>
                      <td className="p-4">
                        <GlassButton size="sm" variant="ghost" onClick={() => setSelectedLead(lead)}>
                          View
                        </GlassButton>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Lead Detail SlideOver */}
      <SlideOver
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        title={selectedLead?.company || selectedLead?.contactName || "Lead Details"}
      >
        {selectedLead && (
          <div className="space-y-6">
            {/* Contact Info */}
            <div className="p-4 rounded-lg bg-white/5">
              <h4 className="text-sm font-medium text-white mb-3">Contact Information</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-white/50">Name</span>
                  <p className="text-white">{selectedLead.contactName}</p>
                </div>
                <div>
                  <span className="text-white/50">Company</span>
                  <p className="text-white">{selectedLead.company || "—"}</p>
                </div>
                <div>
                  <span className="text-white/50">Email</span>
                  <p className="text-blue-400">{selectedLead.email || "—"}</p>
                </div>
                <div>
                  <span className="text-white/50">Phone</span>
                  <p className="text-white">{selectedLead.phone || "—"}</p>
                </div>
              </div>
            </div>

            {/* Deal Info */}
            <div className="p-4 rounded-lg bg-white/5">
              <h4 className="text-sm font-medium text-white mb-3">Lead Information</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-white/50">Estimated Value</span>
                  <p className="text-xl font-bold text-emerald-400">{formatCurrency(parseFloat(selectedLead.estimatedValue || "0"))}</p>
                </div>
                <div>
                  <span className="text-white/50">Probability</span>
                  <p className="text-white font-medium">{selectedLead.probability || 10}%</p>
                </div>
                <div>
                  <span className="text-white/50">Expected Close</span>
                  <p className="text-white">{selectedLead.expectedCloseDate ? formatDate(selectedLead.expectedCloseDate) : "—"}</p>
                </div>
                <div>
                  <span className="text-white/50">Source</span>
                  <p className="text-white">{selectedLead.source || "—"}</p>
                </div>
              </div>
            </div>

            {/* Stage Actions */}
            <div>
              <h4 className="text-sm font-medium text-white mb-3">Update Status</h4>
              <div className="flex flex-wrap gap-2">
                {STAGES.map((stage) => (
                  <GlassButton
                    key={stage.id}
                    size="sm"
                    variant={selectedLead.status === stage.id ? "primary" : "ghost"}
                    onClick={() => {
                      updateStatus(selectedLead.id, stage.id);
                      setSelectedLead({ ...selectedLead, status: stage.id });
                    }}
                    disabled={selectedLead.status === stage.id}
                  >
                    <div className={`w-2 h-2 rounded-full ${stage.color} mr-2`} />
                    {stage.label}
                  </GlassButton>
                ))}
              </div>
            </div>

            {/* Notes */}
            {selectedLead.notes && (
              <div>
                <h4 className="text-sm font-medium text-white mb-2">Notes</h4>
                <p className="text-white/70 text-sm">{selectedLead.notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="pt-4 border-t border-white/10">
              <h4 className="text-sm font-medium text-white mb-3">Actions</h4>
              <div className="space-y-2">
                <GlassButton
                  variant="primary"
                  className="w-full"
                  disabled={selectedLead.status !== "qualified"}
                  onClick={() => {
                    // TODO: Navigate to create quote with lead pre-filled
                    window.location.href = `/sales-customers?tab=quotes&fromLead=${selectedLead.id}`;
                  }}
                >
                  Convert to Quote
                </GlassButton>
              </div>
            </div>

            {/* Timeline */}
            <div className="text-xs text-white/40">
              <p>Created: {formatDate(selectedLead.createdAt)}</p>
              <p>Last Updated: {formatDate(selectedLead.updatedAt)}</p>
            </div>
          </div>
        )}
      </SlideOver>

      {/* Create Lead SlideOver */}
      <SlideOver
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Lead"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <GlassInput
            label="Contact Name"
            value={formData.contactName}
            onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
            placeholder="John Smith"
            required
          />
          <GlassInput
            label="Company"
            value={formData.company}
            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
            placeholder="Acme Corp"
          />
          <GlassInput
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="john@acme.com"
          />
          <GlassInput
            label="Phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="(555) 123-4567"
          />
          <GlassInput
            label="Estimated Value"
            type="number"
            value={formData.estimatedValue}
            onChange={(e) => setFormData({ ...formData, estimatedValue: e.target.value })}
            placeholder="25000"
          />
          <GlassSelect
            label="Source"
            value={formData.source}
            onChange={(e) => setFormData({ ...formData, source: e.target.value })}
            options={[
              { value: "website", label: "Website" },
              { value: "referral", label: "Referral" },
              { value: "linkedin", label: "LinkedIn" },
              { value: "cold_outreach", label: "Cold Outreach" },
              { value: "trade_show", label: "Trade Show" },
              { value: "other", label: "Other" },
            ]}
          />
          <GlassInput
            label="Expected Close Date"
            type="date"
            value={formData.expectedCloseDate}
            onChange={(e) => setFormData({ ...formData, expectedCloseDate: e.target.value })}
          />
          <GlassInput
            label="Notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Initial contact notes..."
          />

          <div className="pt-4 flex gap-3">
            <GlassButton type="button" variant="ghost" onClick={() => setCreateOpen(false)} className="flex-1">
              Cancel
            </GlassButton>
            <GlassButton type="submit" variant="primary" className="flex-1">
              Create Lead
            </GlassButton>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
