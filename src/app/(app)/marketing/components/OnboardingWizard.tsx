"use client";

import * as React from "react";
import { GlassCard, GlassButton, GlassInput, GlassSelect, Spinner, useToast } from "@/components/ui/glass";
import { useMarketing, type OnboardingData } from "../context/MarketingContext";
import { apiPost, apiGet } from "@/lib/http";

interface OnboardingWizardProps {
  onComplete: (data: { planId: string; campaignId?: string }) => void;
  onSkip: () => void;
}

// Objective options with plain language descriptions
const objectiveOptions = [
  {
    value: "revenue",
    label: "Increase Revenue",
    description: "Grow your sales and income",
    icon: "M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    value: "leads",
    label: "Generate Leads",
    description: "Find potential customers",
    icon: "M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z",
  },
  {
    value: "awareness",
    label: "Build Awareness",
    description: "Get your brand known",
    icon: "M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3",
  },
  {
    value: "units_sold",
    label: "Sell More Units",
    description: "Move more inventory",
    icon: "M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z",
  },
];

// Channel options
const channelOptions = [
  { value: "whatsapp", label: "WhatsApp Business", type: "messaging" },
  { value: "instagram", label: "Instagram", type: "social" },
  { value: "facebook", label: "Facebook", type: "social" },
  { value: "google_ads", label: "Google Ads", type: "ads" },
  { value: "email", label: "Email Marketing", type: "email" },
  { value: "sms", label: "SMS", type: "sms" },
  { value: "tiktok", label: "TikTok", type: "social" },
];

export function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const {
    onboardingStep,
    onboardingData,
    onboardingProgress,
    nextOnboardingStep,
    prevOnboardingStep,
    updateOnboardingData,
    completeOnboarding,
  } = useMarketing();

  const { addToast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [products, setProducts] = React.useState<Array<{ id: string; sku: string; name: string; price: string }>>([]);
  const [loadingProducts, setLoadingProducts] = React.useState(true);
  const [recommendedBudget, setRecommendedBudget] = React.useState<number | null>(null);

  // Load products on mount
  React.useEffect(() => {
    async function loadProducts() {
      try {
        const result = await apiGet<{ items: Array<{ id: string; sku: string; name: string; listPrice: string }> }>(
          "/api/master/products?limit=50"
        );
        setProducts(result.items.map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          price: p.listPrice,
        })));
      } catch {
        // Ignore - user can proceed without products
      } finally {
        setLoadingProducts(false);
      }
    }
    loadProducts();
  }, []);

  // Calculate recommended budget when objective is selected
  React.useEffect(() => {
    if (onboardingData.objectiveType && onboardingData.targetValue) {
      // Simple heuristic for budget recommendation
      const multipliers: Record<string, number> = {
        revenue: 0.1, // 10% of target revenue
        leads: 15, // $15 per lead
        awareness: 500, // Base awareness budget
        units_sold: 5, // $5 per unit
      };
      const multiplier = multipliers[onboardingData.objectiveType] || 0.1;
      setRecommendedBudget(Math.round(onboardingData.targetValue * multiplier));
    }
  }, [onboardingData.objectiveType, onboardingData.targetValue]);

  const handleGeneratePlan = async () => {
    if (!onboardingData.objectiveType) {
      addToast("error", "Please select an objective");
      return;
    }

    setLoading(true);
    try {
      // Create the plan with onboarding data
      const planResult = await apiPost<{ success: boolean; plan: { id: string; name: string } }>(
        "/api/marketing/plans",
        {
          name: `${onboardingData.objectiveType.replace("_", " ")} Campaign - ${new Date().toLocaleDateString()}`,
          inputsSnapshot: {
            objectives: [{
              objectiveType: onboardingData.objectiveType,
              targetValue: onboardingData.targetValue,
              timeHorizon: "30_days",
            }],
            constraints: {
              totalBudget: onboardingData.budget,
              timeHorizon: "30_days",
            },
            preferences: {
              preferredChannels: onboardingData.preferredChannels || [],
              excludedChannels: onboardingData.excludedChannels || [],
              openToRecommendations: true,
              riskTolerance: "medium",
            },
            productsServices: onboardingData.productServiceId ? [{
              itemId: onboardingData.productServiceId,
              type: onboardingData.productServiceType || "product",
              name: onboardingData.productServiceName || "",
              priority: 1,
            }] : undefined,
          },
        }
      );

      if (planResult.success) {
        // Generate AI recommendations
        const genResult = await apiPost<{ success: boolean; plan: { id: string } }>(
          `/api/marketing/plans/${planResult.plan.id}/generate`,
          {}
        );

        if (genResult.success) {
          updateOnboardingData({
            planId: planResult.plan.id,
            planName: planResult.plan.name,
          });
          nextOnboardingStep();
        }
      }
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to generate plan");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAndCreate = async () => {
    if (!onboardingData.planId) return;

    setLoading(true);
    try {
      // Approve the plan
      await apiPost(`/api/marketing/plans/${onboardingData.planId}`, {
        status: "approved",
      });

      // Optionally create a campaign
      if (onboardingData.approved) {
        const campaignResult = await apiPost<{ success: boolean; campaign: { id: string } }>(
          "/api/marketing/campaigns",
          {
            name: onboardingData.planName,
            planId: onboardingData.planId,
            budget: onboardingData.budget,
          }
        );

        if (campaignResult.success) {
          updateOnboardingData({ campaignCreated: true });
          completeOnboarding();
          onComplete({
            planId: onboardingData.planId,
            campaignId: campaignResult.campaign.id,
          });
          return;
        }
      }

      completeOnboarding();
      onComplete({ planId: onboardingData.planId });
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to complete setup");
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (onboardingStep) {
      // Step 1: Select Objective
      case "select_objective":
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-white mb-2">What do you want to achieve?</h3>
              <p className="text-sm text-white/60">Select your primary marketing goal</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {objectiveOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => updateOnboardingData({ objectiveType: option.value })}
                  className={`p-4 rounded-xl text-left transition-all ${
                    onboardingData.objectiveType === option.value
                      ? "bg-blue-500/20 border-2 border-blue-500/50 ring-2 ring-blue-500/20"
                      : "bg-white/5 border-2 border-transparent hover:bg-white/10"
                  }`}
                >
                  <svg className="w-8 h-8 text-blue-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={option.icon} />
                  </svg>
                  <h4 className="font-medium text-white">{option.label}</h4>
                  <p className="text-xs text-white/50 mt-1">{option.description}</p>
                </button>
              ))}
            </div>

            {onboardingData.objectiveType && (
              <div className="mt-4">
                <GlassInput
                  label="Target Value (optional)"
                  value={String(onboardingData.targetValue || "")}
                  onChange={(e) => updateOnboardingData({ targetValue: Number(e.target.value) || undefined })}
                  placeholder={
                    onboardingData.objectiveType === "revenue"
                      ? "e.g., 10000 (revenue target)"
                      : onboardingData.objectiveType === "leads"
                      ? "e.g., 100 (number of leads)"
                      : "e.g., 1000 (target number)"
                  }
                  type="number"
                />
                <p className="text-xs text-white/40 mt-1">
                  This helps us recommend an appropriate budget
                </p>
              </div>
            )}
          </div>
        );

      // Step 2: Select Product/Service (optional)
      case "select_product_service":
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-white mb-2">What are you promoting?</h3>
              <p className="text-sm text-white/60">Select a product or service, or skip to promote your business</p>
            </div>

            {loadingProducts ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="md" />
              </div>
            ) : products.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {products.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => updateOnboardingData({
                      productServiceId: product.id,
                      productServiceName: product.name,
                      productServiceType: "product",
                    })}
                    className={`w-full p-3 rounded-lg text-left transition-all ${
                      onboardingData.productServiceId === product.id
                        ? "bg-blue-500/20 border border-blue-500/50"
                        : "bg-white/5 border border-transparent hover:bg-white/10"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-sm font-medium text-white">{product.name}</span>
                        <span className="text-xs text-white/40 ml-2">{product.sku}</span>
                      </div>
                      <span className="text-sm text-white/60">${Number(product.price).toLocaleString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <GlassCard className="!bg-white/5 text-center py-8">
                <p className="text-white/50">No products found.</p>
                <p className="text-sm text-white/40 mt-1">You can still create a marketing plan for your business.</p>
              </GlassCard>
            )}

            <button
              onClick={() => updateOnboardingData({
                productServiceId: undefined,
                productServiceName: "General Business",
                productServiceType: undefined,
              })}
              className={`w-full p-3 rounded-lg text-center transition-all ${
                onboardingData.productServiceName === "General Business"
                  ? "bg-purple-500/20 border border-purple-500/50"
                  : "bg-white/5 border border-transparent hover:bg-white/10"
              }`}
            >
              <span className="text-sm text-white/70">Promote my entire business</span>
            </button>
          </div>
        );

      // Step 3: Set Budget
      case "set_budget":
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-white mb-2">What's your budget?</h3>
              <p className="text-sm text-white/60">Set a monthly marketing budget or let us recommend one</p>
            </div>

            {recommendedBudget && (
              <GlassCard className="!bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/20">
                    <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-blue-400 font-medium">Recommended Budget</p>
                    <p className="text-lg font-bold text-white">${recommendedBudget.toLocaleString()}/month</p>
                    <p className="text-xs text-white/50">Based on your target and industry benchmarks</p>
                  </div>
                  <GlassButton
                    variant="ghost"
                    size="sm"
                    onClick={() => updateOnboardingData({ budget: recommendedBudget, budgetRecommended: true })}
                  >
                    Use This
                  </GlassButton>
                </div>
              </GlassCard>
            )}

            <div>
              <GlassInput
                label="Monthly Budget (USD)"
                value={String(onboardingData.budget || "")}
                onChange={(e) => updateOnboardingData({ budget: Number(e.target.value) || undefined, budgetRecommended: false })}
                placeholder="Enter your budget"
                type="number"
              />
              {onboardingData.budgetRecommended && (
                <p className="text-xs text-blue-400 mt-1">Using recommended budget</p>
              )}
            </div>

            <div className="flex gap-2">
              {[500, 1000, 2500, 5000].map((amount) => (
                <button
                  key={amount}
                  onClick={() => updateOnboardingData({ budget: amount })}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm transition-all ${
                    onboardingData.budget === amount
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      : "bg-white/5 text-white/60 border border-transparent hover:bg-white/10"
                  }`}
                >
                  ${amount.toLocaleString()}
                </button>
              ))}
            </div>
          </div>
        );

      // Step 4: Channel Preferences (optional)
      case "channel_preferences":
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-white mb-2">Any channel preferences?</h3>
              <p className="text-sm text-white/60">Select channels you'd like to use, or skip to let AI decide</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {channelOptions.map((channel) => {
                const isSelected = onboardingData.preferredChannels?.includes(channel.value);
                return (
                  <button
                    key={channel.value}
                    onClick={() => {
                      const current = onboardingData.preferredChannels || [];
                      updateOnboardingData({
                        preferredChannels: isSelected
                          ? current.filter((c) => c !== channel.value)
                          : [...current, channel.value],
                      });
                    }}
                    className={`p-3 rounded-lg text-left transition-all ${
                      isSelected
                        ? "bg-blue-500/20 border border-blue-500/50"
                        : "bg-white/5 border border-transparent hover:bg-white/10"
                    }`}
                  >
                    <span className="text-sm font-medium text-white">{channel.label}</span>
                    <p className="text-xs text-white/40 capitalize">{channel.type}</p>
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-white/40 text-center">
              {(onboardingData.preferredChannels?.length || 0) === 0
                ? "No preference? AI will recommend the best channels for you."
                : `${onboardingData.preferredChannels?.length} channel(s) selected`}
            </p>
          </div>
        );

      // Step 5: AI Plan (auto-generated)
      case "ai_plan":
        return (
          <div className="space-y-6">
            <div className="text-center">
              {loading ? (
                <>
                  <div className="flex items-center justify-center mb-4">
                    <div className="relative">
                      <Spinner size="lg" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Creating Your Plan</h3>
                  <p className="text-sm text-white/60">AI is analyzing your inputs and creating recommendations...</p>
                </>
              ) : onboardingData.planId ? (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Plan Created!</h3>
                  <p className="text-sm text-white/60">Your AI-powered marketing plan is ready</p>
                  <p className="text-sm text-blue-400 mt-2">{onboardingData.planName}</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Ready to Create Your Plan</h3>
                  <p className="text-sm text-white/60">Click below to generate AI recommendations based on your inputs</p>
                </>
              )}
            </div>

            {!loading && !onboardingData.planId && (
              <GlassCard className="!bg-white/5">
                <h4 className="text-sm font-semibold text-white/70 mb-3">Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/50">Objective</span>
                    <span className="text-white capitalize">{onboardingData.objectiveType?.replace("_", " ")}</span>
                  </div>
                  {onboardingData.targetValue && (
                    <div className="flex justify-between">
                      <span className="text-white/50">Target</span>
                      <span className="text-white">{onboardingData.targetValue.toLocaleString()}</span>
                    </div>
                  )}
                  {onboardingData.productServiceName && (
                    <div className="flex justify-between">
                      <span className="text-white/50">Focus</span>
                      <span className="text-white">{onboardingData.productServiceName}</span>
                    </div>
                  )}
                  {onboardingData.budget && (
                    <div className="flex justify-between">
                      <span className="text-white/50">Budget</span>
                      <span className="text-white">${onboardingData.budget.toLocaleString()}/month</span>
                    </div>
                  )}
                  {(onboardingData.preferredChannels?.length || 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-white/50">Channels</span>
                      <span className="text-white">{onboardingData.preferredChannels?.length} selected</span>
                    </div>
                  )}
                </div>
              </GlassCard>
            )}
          </div>
        );

      // Step 6: Approve and Implement
      case "approve_implement":
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-white mb-2">Approve Your Plan</h3>
              <p className="text-sm text-white/60">Review and approve to start your campaign</p>
            </div>

            <GlassCard className="!bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-emerald-400 mb-1">Plan Ready</h4>
                  <p className="text-sm text-white/80">{onboardingData.planName}</p>
                  <p className="text-xs text-white/50 mt-1">
                    Budget: ${(onboardingData.budget || 0).toLocaleString()}/month
                  </p>
                </div>
              </div>
            </GlassCard>

            <div className="space-y-3">
              <button
                onClick={() => updateOnboardingData({ approved: true })}
                className={`w-full p-4 rounded-xl text-left transition-all ${
                  onboardingData.approved
                    ? "bg-blue-500/20 border-2 border-blue-500/50"
                    : "bg-white/5 border-2 border-transparent hover:bg-white/10"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    onboardingData.approved ? "border-blue-500 bg-blue-500" : "border-white/30"
                  }`}>
                    {onboardingData.approved && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <span className="text-sm font-medium text-white">Approve & Create Campaign</span>
                    <p className="text-xs text-white/50">Start tracking and executing immediately</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => updateOnboardingData({ approved: false })}
                className={`w-full p-4 rounded-xl text-left transition-all ${
                  onboardingData.approved === false
                    ? "bg-white/10 border-2 border-white/30"
                    : "bg-white/5 border-2 border-transparent hover:bg-white/10"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    onboardingData.approved === false ? "border-white/50 bg-white/20" : "border-white/30"
                  }`}>
                    {onboardingData.approved === false && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <span className="text-sm font-medium text-white">Save Plan Only</span>
                    <p className="text-xs text-white/50">Review in detail before creating a campaign</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (onboardingStep) {
      case "select_objective":
        return !!onboardingData.objectiveType;
      case "select_product_service":
        return true; // Optional step
      case "set_budget":
        return true; // Optional but recommended
      case "channel_preferences":
        return true; // Optional step
      case "ai_plan":
        return !!onboardingData.planId;
      case "approve_implement":
        return onboardingData.approved !== undefined;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (onboardingStep === "ai_plan" && !onboardingData.planId) {
      handleGeneratePlan();
    } else if (onboardingStep === "approve_implement") {
      handleApproveAndCreate();
    } else {
      nextOnboardingStep();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4">
        <GlassCard className="relative overflow-hidden">
          {/* Progress bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-white/10">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
              style={{ width: `${onboardingProgress}%` }}
            />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-6 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/40">Step {Math.ceil(onboardingProgress / (100/6))} of 6</span>
            </div>
            <button
              onClick={onSkip}
              className="text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              Skip Setup
            </button>
          </div>

          {/* Content */}
          <div className="min-h-[300px]">
            {renderStepContent()}
          </div>

          {/* Footer */}
          <div className="flex gap-2 mt-6 pt-4 border-t border-white/10">
            {onboardingStep !== "select_objective" && (
              <GlassButton
                variant="ghost"
                onClick={prevOnboardingStep}
                disabled={loading}
              >
                Back
              </GlassButton>
            )}
            <GlassButton
              variant="primary"
              className="flex-1"
              onClick={handleNext}
              disabled={!canProceed() || loading}
            >
              {loading ? (
                <>
                  <Spinner size="sm" />
                  <span className="ml-2">Please wait...</span>
                </>
              ) : onboardingStep === "approve_implement" ? (
                "Complete Setup"
              ) : onboardingStep === "ai_plan" && !onboardingData.planId ? (
                "Generate Plan"
              ) : (
                "Continue"
              )}
            </GlassButton>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
