"use client";

import * as React from "react";
import { GlassCard, GlassBadge, Spinner, GlassButton, GlassInput, GlassTextarea, GlassSelect, SlideOver, useToast, EmptyState } from "@/components/ui/glass";
import { apiGet, apiPost, apiPatch } from "@/lib/http";
import { WhatIfSimulator } from "./WhatIfSimulator";

interface MarketingPlan {
  id: string;
  name: string;
  status: string;
  inputsSnapshot: Record<string, unknown>;
  recommendations: {
    summary?: string;
    reasoning?: string;
    confidenceLevel?: string;
    missingData?: string[];
  };
  budgetTotal: string | null;
  budgetAllocations: Array<{
    channelName: string;
    amount: number;
    percentage: number;
    reasoning: string;
  }>;
  channelPriorities: Array<{
    channelName: string;
    priority: number;
    reasoning: string;
  }>;
  excludedChannels: Array<{
    channelName: string;
    reason: string;
  }>;
  tactics: Array<{
    channel: string;
    tactic: string;
    description: string;
    expectedOutcome?: string;
  }>;
  messaging: Array<{
    audience: string;
    angle: string;
    examples: string[];
  }>;
  risksAndAssumptions: Array<{
    type: string;
    description: string;
    mitigation?: string;
  }>;
  explanations: {
    whyThisRecommendation?: string;
    expectedOutcome?: string;
    nextBestAction?: string;
  };
  createdAt: string;
}

interface PlannerSectionProps {
  onNavigate: (tab: string, params?: Record<string, string>) => void;
  initialPlanId?: string;
  initialAction?: string;
}

const objectiveTypes = [
  { value: "revenue", label: "Increase Revenue" },
  { value: "leads", label: "Generate Leads" },
  { value: "awareness", label: "Build Awareness" },
  { value: "units_sold", label: "Sell More Units" },
  { value: "launch", label: "Product Launch" },
  { value: "clear_inventory", label: "Clear Inventory" },
];

const channelOptions = [
  { value: "whatsapp", label: "WhatsApp Business", type: "messaging" },
  { value: "instagram", label: "Instagram", type: "social" },
  { value: "facebook", label: "Facebook", type: "social" },
  { value: "google_ads", label: "Google Ads", type: "ads" },
  { value: "email", label: "Email Marketing", type: "email" },
  { value: "sms", label: "SMS", type: "sms" },
  { value: "tiktok", label: "TikTok", type: "social" },
  { value: "linkedin", label: "LinkedIn", type: "social" },
];

export function PlannerSection({ onNavigate, initialPlanId, initialAction }: PlannerSectionProps) {
  const [plans, setPlans] = React.useState<MarketingPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = React.useState<MarketingPlan | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [showCreateFlow, setShowCreateFlow] = React.useState(false);
  const [showAddChannel, setShowAddChannel] = React.useState(initialAction === "addChannel");
  const { addToast } = useToast();

  // Form state for new plan
  const [formData, setFormData] = React.useState({
    name: "",
    objectiveType: "revenue",
    targetValue: "",
    timeHorizon: "30_days",
    budget: "",
    preferredChannels: [] as string[],
    targetAudience: "",
    notes: "",
  });

  // Form state for adding channel
  const [channelForm, setChannelForm] = React.useState({
    name: "",
    type: "social",
  });

  // Load plans
  React.useEffect(() => {
    async function loadPlans() {
      try {
        const result = await apiGet<{ items: MarketingPlan[] }>("/api/marketing/plans");
        setPlans(result.items);

        // If initialPlanId provided, load that plan
        if (initialPlanId) {
          const planResult = await apiGet<{ plan: MarketingPlan }>(`/api/marketing/plans/${initialPlanId}`);
          setSelectedPlan(planResult.plan);
        } else if (result.items.length > 0) {
          // Auto-select latest non-archived plan
          const activePlan = result.items.find((p) => p.status !== "archived");
          if (activePlan) {
            const planResult = await apiGet<{ plan: MarketingPlan }>(`/api/marketing/plans/${activePlan.id}`);
            setSelectedPlan(planResult.plan);
          }
        }
      } catch (err) {
        console.error("Failed to load plans:", err);
      } finally {
        setLoading(false);
      }
    }
    loadPlans();
  }, [initialPlanId]);

  const handleCreatePlan = async () => {
    if (!formData.name.trim()) {
      addToast("error", "Please enter a plan name");
      return;
    }

    try {
      setGenerating(true);

      // Create the plan
      const result = await apiPost<{ success: boolean; plan: MarketingPlan }>("/api/marketing/plans", {
        name: formData.name,
        inputsSnapshot: {
          objectives: [{
            objectiveType: formData.objectiveType,
            targetValue: formData.targetValue ? Number(formData.targetValue) : undefined,
            timeHorizon: formData.timeHorizon,
          }],
          constraints: {
            totalBudget: formData.budget ? Number(formData.budget) : undefined,
            timeHorizon: formData.timeHorizon,
          },
          preferences: {
            preferredChannels: formData.preferredChannels,
            openToRecommendations: true,
            riskTolerance: "medium",
          },
          businessContext: {
            targetAudience: formData.targetAudience,
          },
          notes: formData.notes,
        },
      });

      if (result.success) {
        // Generate AI recommendations
        const genResult = await apiPost<{ success: boolean; plan: MarketingPlan }>(
          `/api/marketing/plans/${result.plan.id}/generate`,
          {}
        );

        if (genResult.success) {
          setSelectedPlan(genResult.plan);
          setPlans((prev) => [genResult.plan, ...prev]);
          setShowCreateFlow(false);
          addToast("success", "Marketing plan created with AI recommendations");
        }
      }
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to create plan");
    } finally {
      setGenerating(false);
    }
  };

  const handleApprovePlan = async () => {
    if (!selectedPlan) return;

    try {
      const result = await apiPatch<{ success: boolean; plan: MarketingPlan }>(
        `/api/marketing/plans/${selectedPlan.id}`,
        { status: "approved" }
      );

      if (result.success) {
        setSelectedPlan(result.plan);
        setPlans((prev) => prev.map((p) => (p.id === result.plan.id ? result.plan : p)));
        addToast("success", "Plan approved! You can now create campaigns from this plan.");
      }
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to approve plan");
    }
  };

  const handleImplementPlan = async () => {
    if (!selectedPlan) return;
    onNavigate("campaigns", { createFromPlan: selectedPlan.id });
  };

  const handleAddChannel = async () => {
    if (!channelForm.name.trim()) {
      addToast("error", "Please enter a channel name");
      return;
    }

    try {
      await apiPost("/api/marketing/channels", {
        name: channelForm.name,
        type: channelForm.type,
      });
      addToast("success", "Channel added successfully");
      setShowAddChannel(false);
      setChannelForm({ name: "", type: "social" });
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to add channel");
    }
  };

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
          <h2 className="text-lg font-semibold text-white">Marketing Planner</h2>
          <p className="text-sm text-white/50">Create and manage AI-powered marketing plans</p>
        </div>
        <div className="flex gap-2">
          <GlassButton variant="ghost" onClick={() => setShowAddChannel(true)}>
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
            Add Channel
          </GlassButton>
          <GlassButton variant="primary" onClick={() => setShowCreateFlow(true)}>
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Plan
          </GlassButton>
        </div>
      </div>

      {/* Plan List (if multiple plans) */}
      {plans.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {plans.map((plan) => (
            <button
              key={plan.id}
              onClick={async () => {
                const result = await apiGet<{ plan: MarketingPlan }>(`/api/marketing/plans/${plan.id}`);
                setSelectedPlan(result.plan);
              }}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                selectedPlan?.id === plan.id
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  : "text-white/50 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              {plan.name}
              <span className="ml-2">
                <GlassBadge variant={
                  plan.status === "approved" ? "success" :
                  plan.status === "recommended" ? "info" :
                  plan.status === "implemented" ? "success" : "default"
                }>
                  {plan.status}
                </GlassBadge>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* No plans state */}
      {!selectedPlan && plans.length === 0 && (
        <EmptyState
          title="Create your first marketing plan"
          description="Answer a few questions and let AI generate a comprehensive marketing strategy tailored to your business"
          icon={
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          }
          action={
            <GlassButton variant="primary" onClick={() => setShowCreateFlow(true)}>
              Create Marketing Plan
            </GlassButton>
          }
        />
      )}

      {/* Selected Plan Display */}
      {selectedPlan && (
        <div className="space-y-6">
          {/* Plan Header */}
          <GlassCard>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-semibold text-white">{selectedPlan.name}</h3>
                  <GlassBadge variant={
                    selectedPlan.status === "approved" ? "success" :
                    selectedPlan.status === "recommended" ? "info" :
                    selectedPlan.status === "implemented" ? "success" : "default"
                  }>
                    {selectedPlan.status}
                  </GlassBadge>
                </div>
                {selectedPlan.recommendations?.summary && (
                  <p className="text-sm text-white/60 max-w-2xl">{selectedPlan.recommendations.summary}</p>
                )}
              </div>
              <div className="flex gap-2">
                {(selectedPlan.status === "recommended" || selectedPlan.status === "edited") && (
                  <GlassButton variant="primary" onClick={handleApprovePlan}>
                    Approve Plan
                  </GlassButton>
                )}
                {(selectedPlan.status === "approved" || selectedPlan.status === "implemented") && (
                  <GlassButton variant="primary" onClick={handleImplementPlan}>
                    Create Campaign
                  </GlassButton>
                )}
              </div>
            </div>
          </GlassCard>

          {/* Budget Allocation */}
          {selectedPlan.budgetAllocations && selectedPlan.budgetAllocations.length > 0 && (
            <GlassCard>
              <h4 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Budget Allocation (Total: ${Number(selectedPlan.budgetTotal || 0).toLocaleString()})
              </h4>
              <div className="space-y-3">
                {selectedPlan.budgetAllocations.map((allocation, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="w-32 text-sm text-white">{allocation.channelName}</div>
                    <div className="flex-1">
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                          style={{ width: `${allocation.percentage}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-20 text-right text-sm text-white">${allocation.amount.toLocaleString()}</div>
                    <div className="w-12 text-right text-xs text-white/50">{allocation.percentage}%</div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Tactics */}
          {selectedPlan.tactics && selectedPlan.tactics.length > 0 && (
            <GlassCard>
              <h4 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                </svg>
                Recommended Tactics
              </h4>
              <div className="grid gap-3">
                {selectedPlan.tactics.map((tactic, index) => (
                  <div key={index} className="p-3 rounded-lg bg-white/5">
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-sm font-medium text-white">{tactic.tactic}</span>
                      <GlassBadge variant="default">{tactic.channel}</GlassBadge>
                    </div>
                    <p className="text-xs text-white/50">{tactic.description}</p>
                    {tactic.expectedOutcome && (
                      <p className="text-xs text-emerald-400 mt-1">Expected: {tactic.expectedOutcome}</p>
                    )}
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Risks & Assumptions */}
          {selectedPlan.risksAndAssumptions && selectedPlan.risksAndAssumptions.length > 0 && (
            <GlassCard>
              <h4 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                Risks & Assumptions
              </h4>
              <div className="space-y-2">
                {selectedPlan.risksAndAssumptions.map((item, index) => (
                  <div key={index} className="flex items-start gap-2 p-2 rounded-lg bg-white/5">
                    <span className="mt-0.5">
                      <GlassBadge variant={item.type === "risk" ? "warning" : "info"}>
                        {item.type}
                      </GlassBadge>
                    </span>
                    <div>
                      <p className="text-sm text-white">{item.description}</p>
                      {item.mitigation && (
                        <p className="text-xs text-white/50 mt-1">Mitigation: {item.mitigation}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Explanation Box */}
          {selectedPlan.explanations?.whyThisRecommendation && (
            <GlassCard className="!bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-blue-400 mb-1">Why this recommendation?</h4>
                  <p className="text-sm text-white/80">{selectedPlan.explanations.whyThisRecommendation}</p>
                  {selectedPlan.explanations.expectedOutcome && (
                    <p className="text-sm text-white/60 mt-2">
                      <strong>Expected outcome:</strong> {selectedPlan.explanations.expectedOutcome}
                    </p>
                  )}
                </div>
              </div>
            </GlassCard>
          )}

          {/* What-If Simulator */}
          <GlassCard>
            <WhatIfSimulator
              plan={{
                id: selectedPlan.id,
                name: selectedPlan.name,
                budgetTotal: selectedPlan.budgetTotal,
                budgetAllocations: selectedPlan.budgetAllocations || [],
              }}
            />
          </GlassCard>
        </div>
      )}

      {/* Create Plan SlideOver */}
      <SlideOver
        open={showCreateFlow}
        onClose={() => setShowCreateFlow(false)}
        title="Create Marketing Plan"
      >
        <div className="space-y-4">
          <GlassInput
            label="Plan Name"
            value={formData.name}
            onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
            placeholder="Q1 2025 Marketing Campaign"
          />

          <GlassSelect
            label="Primary Objective"
            value={formData.objectiveType}
            onChange={(e) => setFormData((f) => ({ ...f, objectiveType: e.target.value }))}
            options={objectiveTypes}
          />

          <GlassInput
            label="Target Value (optional)"
            value={formData.targetValue}
            onChange={(e) => setFormData((f) => ({ ...f, targetValue: e.target.value }))}
            placeholder="e.g., 10000 for revenue, 100 for leads"
            type="number"
          />

          <GlassSelect
            label="Time Horizon"
            value={formData.timeHorizon}
            onChange={(e) => setFormData((f) => ({ ...f, timeHorizon: e.target.value }))}
            options={[
              { value: "30_days", label: "30 Days" },
              { value: "quarter", label: "Quarterly (90 Days)" },
              { value: "6_months", label: "6 Months" },
              { value: "year", label: "Annual" },
            ]}
          />

          <GlassInput
            label="Budget (USD)"
            value={formData.budget}
            onChange={(e) => setFormData((f) => ({ ...f, budget: e.target.value }))}
            placeholder="Leave blank for AI to recommend"
            type="number"
          />

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Preferred Channels (optional)</label>
            <div className="flex flex-wrap gap-2">
              {channelOptions.map((channel) => (
                <button
                  key={channel.value}
                  onClick={() => {
                    setFormData((f) => ({
                      ...f,
                      preferredChannels: f.preferredChannels.includes(channel.value)
                        ? f.preferredChannels.filter((c) => c !== channel.value)
                        : [...f.preferredChannels, channel.value],
                    }));
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                    formData.preferredChannels.includes(channel.value)
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      : "bg-white/5 text-white/60 hover:bg-white/10 border border-transparent"
                  }`}
                >
                  {channel.label}
                </button>
              ))}
            </div>
          </div>

          <GlassInput
            label="Target Audience (optional)"
            value={formData.targetAudience}
            onChange={(e) => setFormData((f) => ({ ...f, targetAudience: e.target.value }))}
            placeholder="e.g., Young professionals aged 25-35"
          />

          <GlassTextarea
            label="Additional Notes (optional)"
            value={formData.notes}
            onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Any specific requirements or constraints..."
            rows={3}
          />

          <div className="flex gap-2 pt-4">
            <GlassButton
              variant="primary"
              className="flex-1"
              disabled={generating}
              onClick={handleCreatePlan}
            >
              {generating ? (
                <>
                  <span className="mr-2"><Spinner size="sm" /></span>
                  Generating Plan...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  Generate AI Plan
                </>
              )}
            </GlassButton>
            <GlassButton variant="ghost" onClick={() => setShowCreateFlow(false)}>
              Cancel
            </GlassButton>
          </div>
        </div>
      </SlideOver>

      {/* Add Channel SlideOver */}
      <SlideOver
        open={showAddChannel}
        onClose={() => setShowAddChannel(false)}
        title="Add Marketing Channel"
      >
        <div className="space-y-4">
          <p className="text-sm text-white/60">
            Add a marketing channel to track manually or connect to a platform.
          </p>

          <GlassInput
            label="Channel Name"
            value={channelForm.name}
            onChange={(e) => setChannelForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g., Instagram Business, Google Ads"
          />

          <GlassSelect
            label="Channel Type"
            value={channelForm.type}
            onChange={(e) => setChannelForm((f) => ({ ...f, type: e.target.value }))}
            options={[
              { value: "social", label: "Social Media" },
              { value: "ads", label: "Paid Advertising" },
              { value: "email", label: "Email Marketing" },
              { value: "messaging", label: "Messaging (WhatsApp, etc.)" },
              { value: "sms", label: "SMS" },
              { value: "offline", label: "Offline / Traditional" },
              { value: "agency", label: "Agency Managed" },
              { value: "influencer", label: "Influencer" },
            ]}
          />

          <div className="flex gap-2 pt-4">
            <GlassButton variant="primary" className="flex-1" onClick={handleAddChannel}>
              Add Channel
            </GlassButton>
            <GlassButton variant="ghost" onClick={() => setShowAddChannel(false)}>
              Cancel
            </GlassButton>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
