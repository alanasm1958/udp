"use client";

import * as React from "react";
import { GlassCard, GlassBadge, Spinner, GlassButton, GlassInput, GlassSelect, SlideOver, useToast, EmptyState } from "@/components/ui/glass";
import { apiGet, apiPost, apiPatch } from "@/lib/http";

interface MarketingCampaign {
  id: string;
  name: string;
  status: string;
  planId: string | null;
  goalRefs: string[];
  channelRefs: string[];
  budget: string | null;
  spentToDate: string | null;
  startDate: string | null;
  endDate: string | null;
  analyticsScope: Record<string, unknown>;
  attributionAssumptions: { model: string; notes?: string };
  performanceSnapshot: {
    lastUpdated?: string;
    impressions?: number;
    clicks?: number;
    conversions?: number;
    revenue?: number;
    costPerConversion?: number;
    roas?: number;
  };
  createdAt: string;
}

interface MarketingPlan {
  id: string;
  name: string;
  status: string;
  budgetTotal: string | null;
}

interface CampaignsSectionProps {
  onNavigate: (tab: string, params?: Record<string, string>) => void;
  createFromPlanId?: string;
  initialCampaignId?: string;
}

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export function CampaignsSection({ onNavigate, createFromPlanId, initialCampaignId }: CampaignsSectionProps) {
  const [campaigns, setCampaigns] = React.useState<MarketingCampaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = React.useState<MarketingCampaign | null>(null);
  const [plans, setPlans] = React.useState<MarketingPlan[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showCreateForm, setShowCreateForm] = React.useState(!!createFromPlanId);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const { addToast } = useToast();

  // Form state for new campaign
  const [formData, setFormData] = React.useState({
    name: "",
    planId: createFromPlanId || "",
    budget: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
  });

  // Load campaigns and plans
  React.useEffect(() => {
    async function loadData() {
      try {
        const [campaignsResult, plansResult] = await Promise.all([
          apiGet<{ items: MarketingCampaign[] }>("/api/marketing/campaigns"),
          apiGet<{ items: MarketingPlan[] }>("/api/marketing/plans?status=approved"),
        ]);

        setCampaigns(campaignsResult.items);
        setPlans(plansResult.items);

        // If initialCampaignId provided, select that campaign
        if (initialCampaignId) {
          const campaign = campaignsResult.items.find((c) => c.id === initialCampaignId);
          if (campaign) setSelectedCampaign(campaign);
        }

        // If creating from plan, pre-fill form
        if (createFromPlanId) {
          const plan = plansResult.items.find((p) => p.id === createFromPlanId);
          if (plan) {
            setFormData((f) => ({
              ...f,
              name: `Campaign: ${plan.name}`,
              planId: plan.id,
              budget: plan.budgetTotal || "",
            }));
          }
        }
      } catch (err) {
        console.error("Failed to load campaigns:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [createFromPlanId, initialCampaignId]);

  const handleCreateCampaign = async () => {
    if (!formData.name.trim()) {
      addToast("error", "Please enter a campaign name");
      return;
    }

    try {
      const result = await apiPost<{ success: boolean; campaign: MarketingCampaign }>("/api/marketing/campaigns", {
        name: formData.name,
        planId: formData.planId || null,
        budget: formData.budget ? Number(formData.budget) : null,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
      });

      if (result.success) {
        setCampaigns((prev) => [result.campaign, ...prev]);
        setSelectedCampaign(result.campaign);
        setShowCreateForm(false);
        addToast("success", "Campaign created successfully");
      }
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to create campaign");
    }
  };

  const handleUpdateCampaignStatus = async (status: string) => {
    if (!selectedCampaign) return;

    try {
      const result = await apiPatch<{ success: boolean; campaign: MarketingCampaign }>(
        `/api/marketing/campaigns/${selectedCampaign.id}`,
        { status }
      );

      if (result.success) {
        setSelectedCampaign(result.campaign);
        setCampaigns((prev) => prev.map((c) => (c.id === result.campaign.id ? result.campaign : c)));
        addToast("success", `Campaign ${status === "active" ? "activated" : status}`);
      }
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to update campaign");
    }
  };

  const filteredCampaigns = statusFilter === "all"
    ? campaigns
    : campaigns.filter((c) => c.status === statusFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Campaigns</h2>
          <p className="text-sm text-white/50">Track and manage your marketing campaigns</p>
        </div>
        <div className="flex gap-2">
          <GlassSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "all", label: "All Campaigns" },
              ...statusOptions,
            ]}
            className="w-40"
          />
          <GlassButton variant="primary" onClick={() => setShowCreateForm(true)}>
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Campaign
          </GlassButton>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Create a campaign from an approved plan or start a standalone campaign"
          icon={
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3" />
            </svg>
          }
          action={
            <div className="flex gap-2">
              {plans.length > 0 && (
                <GlassButton
                  variant="primary"
                  onClick={() => {
                    setFormData((f) => ({ ...f, planId: plans[0].id }));
                    setShowCreateForm(true);
                  }}
                >
                  Create from Plan
                </GlassButton>
              )}
              <GlassButton
                variant={plans.length > 0 ? "ghost" : "primary"}
                onClick={() => setShowCreateForm(true)}
              >
                Create Standalone
              </GlassButton>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Campaign List */}
          <div className="lg:col-span-1 space-y-2">
            {filteredCampaigns.map((campaign) => (
              <div
                key={campaign.id}
                onClick={() => setSelectedCampaign(campaign)}
                className={`p-4 rounded-xl cursor-pointer transition-all ${
                  selectedCampaign?.id === campaign.id
                    ? "bg-blue-500/20 border border-blue-500/30"
                    : "bg-white/5 hover:bg-white/10 border border-transparent"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-white text-sm">{campaign.name}</h4>
                  <GlassBadge
                    variant={
                      campaign.status === "active" ? "success" :
                      campaign.status === "paused" ? "warning" :
                      campaign.status === "completed" ? "info" : "default"
                    }
                  >
                    {campaign.status}
                  </GlassBadge>
                </div>
                {campaign.budget && (
                  <div className="text-xs text-white/50">
                    Budget: ${Number(campaign.budget).toLocaleString()}
                  </div>
                )}
                {campaign.startDate && (
                  <div className="text-xs text-white/40">
                    Started: {new Date(campaign.startDate).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Campaign Detail */}
          <div className="lg:col-span-2">
            {selectedCampaign ? (
              <div className="space-y-4">
                <GlassCard>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-white">{selectedCampaign.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <GlassBadge
                          variant={
                            selectedCampaign.status === "active" ? "success" :
                            selectedCampaign.status === "paused" ? "warning" :
                            selectedCampaign.status === "completed" ? "info" : "default"
                          }
                        >
                          {selectedCampaign.status}
                        </GlassBadge>
                        {selectedCampaign.planId && (
                          <span className="text-xs text-white/40">From Plan</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {selectedCampaign.status === "active" && (
                        <GlassButton size="sm" variant="ghost" onClick={() => handleUpdateCampaignStatus("paused")}>
                          Pause
                        </GlassButton>
                      )}
                      {selectedCampaign.status === "paused" && (
                        <GlassButton size="sm" variant="primary" onClick={() => handleUpdateCampaignStatus("active")}>
                          Resume
                        </GlassButton>
                      )}
                      {(selectedCampaign.status === "active" || selectedCampaign.status === "paused") && (
                        <GlassButton size="sm" variant="ghost" onClick={() => handleUpdateCampaignStatus("completed")}>
                          Complete
                        </GlassButton>
                      )}
                    </div>
                  </div>

                  {/* Budget Progress */}
                  {selectedCampaign.budget && (
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-white/60">Budget Usage</span>
                        <span className="text-white">
                          ${Number(selectedCampaign.spentToDate || 0).toLocaleString()} / ${Number(selectedCampaign.budget).toLocaleString()}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            (Number(selectedCampaign.spentToDate || 0) / Number(selectedCampaign.budget)) > 0.9
                              ? "bg-red-500"
                              : "bg-blue-500"
                          }`}
                          style={{
                            width: `${Math.min(100, (Number(selectedCampaign.spentToDate || 0) / Number(selectedCampaign.budget)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-white/40">Start Date</span>
                      <p className="text-white">
                        {selectedCampaign.startDate
                          ? new Date(selectedCampaign.startDate).toLocaleDateString()
                          : "Not set"}
                      </p>
                    </div>
                    <div>
                      <span className="text-white/40">End Date</span>
                      <p className="text-white">
                        {selectedCampaign.endDate
                          ? new Date(selectedCampaign.endDate).toLocaleDateString()
                          : "Ongoing"}
                      </p>
                    </div>
                  </div>
                </GlassCard>

                {/* Performance Metrics */}
                <GlassCard>
                  <h4 className="text-sm font-semibold text-white/70 mb-4">Performance</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 rounded-lg bg-white/5">
                      <p className="text-xl font-bold text-white">
                        {(selectedCampaign.performanceSnapshot?.impressions || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-white/50">Impressions</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-white/5">
                      <p className="text-xl font-bold text-white">
                        {(selectedCampaign.performanceSnapshot?.clicks || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-white/50">Clicks</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-white/5">
                      <p className="text-xl font-bold text-white">
                        {(selectedCampaign.performanceSnapshot?.conversions || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-white/50">Conversions</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-white/5">
                      <p className="text-xl font-bold text-emerald-400">
                        ${(selectedCampaign.performanceSnapshot?.revenue || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-white/50">Revenue</p>
                    </div>
                  </div>

                  {/* CTR and ROAS if calculable */}
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="p-3 rounded-lg bg-white/5">
                      <p className="text-sm text-white/60">Click-Through Rate</p>
                      <p className="text-lg font-semibold text-white">
                        {selectedCampaign.performanceSnapshot?.impressions
                          ? ((selectedCampaign.performanceSnapshot.clicks || 0) /
                              selectedCampaign.performanceSnapshot.impressions *
                              100
                            ).toFixed(2)
                          : "0.00"}%
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5">
                      <p className="text-sm text-white/60">ROAS</p>
                      <p className="text-lg font-semibold text-white">
                        {selectedCampaign.spentToDate && Number(selectedCampaign.spentToDate) > 0
                          ? ((selectedCampaign.performanceSnapshot?.revenue || 0) /
                              Number(selectedCampaign.spentToDate)
                            ).toFixed(2)
                          : "N/A"}x
                      </p>
                    </div>
                  </div>

                  {selectedCampaign.performanceSnapshot?.lastUpdated && (
                    <p className="text-xs text-white/40 mt-4">
                      Last updated: {new Date(selectedCampaign.performanceSnapshot.lastUpdated).toLocaleString()}
                    </p>
                  )}
                </GlassCard>

                {/* Attribution */}
                <GlassCard className="!bg-purple-500/10 border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                    </svg>
                    <span className="text-sm font-semibold text-purple-400">Attribution Model</span>
                  </div>
                  <p className="text-sm text-white/80 capitalize">
                    {selectedCampaign.attributionAssumptions?.model || "Simple"} Attribution
                  </p>
                  <p className="text-xs text-white/50 mt-1">
                    Results are measured using {selectedCampaign.attributionAssumptions?.model || "simple"} attribution.
                    This means conversions are credited based on a simplified model suitable for most SME use cases.
                  </p>
                </GlassCard>
              </div>
            ) : (
              <GlassCard className="flex items-center justify-center h-64">
                <p className="text-white/40">Select a campaign to view details</p>
              </GlassCard>
            )}
          </div>
        </div>
      )}

      {/* Create Campaign SlideOver */}
      <SlideOver
        open={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        title="Create Campaign"
      >
        <div className="space-y-4">
          <GlassInput
            label="Campaign Name"
            value={formData.name}
            onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
            placeholder="Summer Sale Campaign"
          />

          {plans.length > 0 && (
            <GlassSelect
              label="Based on Plan (optional)"
              value={formData.planId}
              onChange={(e) => {
                const plan = plans.find((p) => p.id === e.target.value);
                setFormData((f) => ({
                  ...f,
                  planId: e.target.value,
                  budget: plan?.budgetTotal || f.budget,
                }));
              }}
              options={[
                { value: "", label: "Standalone Campaign" },
                ...plans.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          )}

          <GlassInput
            label="Budget (USD)"
            value={formData.budget}
            onChange={(e) => setFormData((f) => ({ ...f, budget: e.target.value }))}
            placeholder="1000"
            type="number"
          />

          <GlassInput
            label="Start Date"
            value={formData.startDate}
            onChange={(e) => setFormData((f) => ({ ...f, startDate: e.target.value }))}
            type="date"
          />

          <GlassInput
            label="End Date (optional)"
            value={formData.endDate}
            onChange={(e) => setFormData((f) => ({ ...f, endDate: e.target.value }))}
            type="date"
          />

          <div className="flex gap-2 pt-4">
            <GlassButton variant="primary" className="flex-1" onClick={handleCreateCampaign}>
              Create Campaign
            </GlassButton>
            <GlassButton variant="ghost" onClick={() => setShowCreateForm(false)}>
              Cancel
            </GlassButton>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
