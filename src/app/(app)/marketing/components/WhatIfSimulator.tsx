"use client";

import * as React from "react";
import { GlassCard, GlassButton, GlassInput, GlassSelect, Spinner, useToast } from "@/components/ui/glass";
import { apiGet, apiPost } from "@/lib/http";
import { useMarketing } from "../context/MarketingContext";

interface WhatIfScenario {
  id: string;
  name: string;
  scenarioType: string;
  parameters: {
    budgetChange?: { amount?: number; percentage?: number };
    channelRemove?: { channelId: string };
    channelAdd?: { channelName: string; budget: number };
    pricingChange?: { productId: string; newPrice: number };
    timeHorizonChange?: { newHorizon: string };
  };
  resultSnapshot: {
    projectedOutcome?: string;
    budgetImpact?: number;
    roiChange?: number;
    recommendedAction?: string;
  } | null;
  createdAt: string;
}

interface MarketingPlan {
  id: string;
  name: string;
  budgetTotal: string | null;
  budgetAllocations: Array<{
    channelName: string;
    amount: number;
    percentage: number;
  }>;
}

interface WhatIfSimulatorProps {
  plan: MarketingPlan;
  onScenarioCreated?: () => void;
}

type ScenarioType = "budget_change" | "channel_remove" | "channel_add" | "time_horizon_change";

export function WhatIfSimulator({ plan, onScenarioCreated }: WhatIfSimulatorProps) {
  const [scenarios, setScenarios] = React.useState<WhatIfScenario[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [simulating, setSimulating] = React.useState(false);
  const [showCreate, setShowCreate] = React.useState(false);
  const { addToast } = useToast();

  // Get marketing context for progressive disclosure
  let triggerAdvancedMode: ((trigger: "what_if") => void) | undefined;
  try {
    const marketingContext = useMarketing();
    triggerAdvancedMode = marketingContext.triggerAdvancedMode;
  } catch {
    // Context not available, progressive disclosure disabled
  }

  // Form state
  const [scenarioType, setScenarioType] = React.useState<ScenarioType>("budget_change");
  const [scenarioName, setScenarioName] = React.useState("");
  const [budgetChangeType, setBudgetChangeType] = React.useState<"percentage" | "amount">("percentage");
  const [budgetChangeValue, setBudgetChangeValue] = React.useState("");
  const [channelToRemove, setChannelToRemove] = React.useState("");
  const [newChannelName, setNewChannelName] = React.useState("");
  const [newChannelBudget, setNewChannelBudget] = React.useState("");
  const [newTimeHorizon, setNewTimeHorizon] = React.useState("quarter");

  // Result state
  const [simulationResult, setSimulationResult] = React.useState<WhatIfScenario | null>(null);

  // Load existing scenarios
  React.useEffect(() => {
    async function loadScenarios() {
      try {
        const result = await apiGet<{ scenarios: WhatIfScenario[] }>(
          `/api/marketing/plans/${plan.id}/scenarios`
        );
        setScenarios(result.scenarios);
      } catch (err) {
        console.error("Failed to load scenarios:", err);
      } finally {
        setLoading(false);
      }
    }
    loadScenarios();
  }, [plan.id]);

  const handleSimulate = async () => {
    if (!scenarioName.trim()) {
      addToast("error", "Please enter a scenario name");
      return;
    }

    const parameters: WhatIfScenario["parameters"] = {};

    switch (scenarioType) {
      case "budget_change":
        if (!budgetChangeValue) {
          addToast("error", "Please enter a budget change value");
          return;
        }
        parameters.budgetChange = budgetChangeType === "percentage"
          ? { percentage: Number(budgetChangeValue) }
          : { amount: Number(budgetChangeValue) };
        break;
      case "channel_remove":
        if (!channelToRemove) {
          addToast("error", "Please select a channel to remove");
          return;
        }
        parameters.channelRemove = { channelId: channelToRemove };
        break;
      case "channel_add":
        if (!newChannelName.trim() || !newChannelBudget) {
          addToast("error", "Please enter channel name and budget");
          return;
        }
        parameters.channelAdd = {
          channelName: newChannelName,
          budget: Number(newChannelBudget),
        };
        break;
      case "time_horizon_change":
        parameters.timeHorizonChange = { newHorizon: newTimeHorizon };
        break;
    }

    try {
      setSimulating(true);
      const result = await apiPost<{ success: boolean; scenario: WhatIfScenario }>(
        `/api/marketing/plans/${plan.id}/scenarios`,
        {
          name: scenarioName,
          scenarioType,
          parameters,
        }
      );

      if (result.success) {
        setSimulationResult(result.scenario);
        setScenarios((prev) => [result.scenario, ...prev]);
        addToast("success", "Scenario simulated successfully");
        onScenarioCreated?.();
      }
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to simulate scenario");
    } finally {
      setSimulating(false);
    }
  };

  const resetForm = () => {
    setScenarioName("");
    setScenarioType("budget_change");
    setBudgetChangeType("percentage");
    setBudgetChangeValue("");
    setChannelToRemove("");
    setNewChannelName("");
    setNewChannelBudget("");
    setNewTimeHorizon("quarter");
    setSimulationResult(null);
    setShowCreate(false);
  };

  const currentBudget = Number(plan.budgetTotal || 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-white/70 flex items-center gap-2">
            <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 15.3m14.8 0l.8 2.6a1.5 1.5 0 01-1.433 1.923l-2.282-.113a1.5 1.5 0 00-1.448.85l-1.4 3.046a1.5 1.5 0 01-2.72-.012l-1.314-2.986a1.5 1.5 0 00-1.424-.885L5.5 19.875a1.5 1.5 0 01-1.447-1.881l.762-2.494" />
            </svg>
            What-If Simulator
          </h4>
          <p className="text-xs text-white/40 mt-1">Test different scenarios before committing</p>
        </div>
        {!showCreate && (
          <GlassButton variant="ghost" size="sm" onClick={() => {
            setShowCreate(true);
            // Trigger progressive disclosure: reveal advanced features
            if (triggerAdvancedMode) {
              triggerAdvancedMode("what_if");
            }
          }}>
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Scenario
          </GlassButton>
        )}
      </div>

      {/* Create Scenario Form */}
      {showCreate && (
        <GlassCard className="!bg-purple-500/5 border border-purple-500/20">
          <div className="space-y-4">
            <GlassInput
              label="Scenario Name"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              placeholder="e.g., 20% budget increase"
            />

            <GlassSelect
              label="Scenario Type"
              value={scenarioType}
              onChange={(e) => setScenarioType(e.target.value as ScenarioType)}
              options={[
                { value: "budget_change", label: "Change Budget" },
                { value: "channel_remove", label: "Remove Channel" },
                { value: "channel_add", label: "Add Channel" },
                { value: "time_horizon_change", label: "Change Time Horizon" },
              ]}
            />

            {/* Budget Change */}
            {scenarioType === "budget_change" && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => setBudgetChangeType("percentage")}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm transition-all ${
                      budgetChangeType === "percentage"
                        ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                        : "bg-white/5 text-white/60 border border-transparent"
                    }`}
                  >
                    Percentage
                  </button>
                  <button
                    onClick={() => setBudgetChangeType("amount")}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm transition-all ${
                      budgetChangeType === "amount"
                        ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                        : "bg-white/5 text-white/60 border border-transparent"
                    }`}
                  >
                    Fixed Amount
                  </button>
                </div>
                <GlassInput
                  label={budgetChangeType === "percentage" ? "Change (%)" : "New Budget ($)"}
                  value={budgetChangeValue}
                  onChange={(e) => setBudgetChangeValue(e.target.value)}
                  placeholder={budgetChangeType === "percentage" ? "e.g., 20 or -10" : "e.g., 15000"}
                  type="number"
                />
                {budgetChangeType === "percentage" && budgetChangeValue && (
                  <p className="text-xs text-white/50">
                    New budget: ${Math.round(currentBudget * (1 + Number(budgetChangeValue) / 100)).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {/* Channel Remove */}
            {scenarioType === "channel_remove" && (
              <GlassSelect
                label="Channel to Remove"
                value={channelToRemove}
                onChange={(e) => setChannelToRemove(e.target.value)}
                options={[
                  { value: "", label: "Select a channel..." },
                  ...plan.budgetAllocations.map((ch) => ({
                    value: ch.channelName,
                    label: `${ch.channelName} ($${ch.amount.toLocaleString()})`,
                  })),
                ]}
              />
            )}

            {/* Channel Add */}
            {scenarioType === "channel_add" && (
              <div className="space-y-3">
                <GlassInput
                  label="New Channel Name"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="e.g., TikTok Ads"
                />
                <GlassInput
                  label="Budget Allocation ($)"
                  value={newChannelBudget}
                  onChange={(e) => setNewChannelBudget(e.target.value)}
                  placeholder="e.g., 2000"
                  type="number"
                />
              </div>
            )}

            {/* Time Horizon Change */}
            {scenarioType === "time_horizon_change" && (
              <GlassSelect
                label="New Time Horizon"
                value={newTimeHorizon}
                onChange={(e) => setNewTimeHorizon(e.target.value)}
                options={[
                  { value: "30_days", label: "30 Days" },
                  { value: "quarter", label: "Quarterly (90 Days)" },
                  { value: "6_months", label: "6 Months" },
                  { value: "year", label: "Annual" },
                ]}
              />
            )}

            <div className="flex gap-2 pt-2">
              <GlassButton
                variant="primary"
                className="flex-1"
                onClick={handleSimulate}
                disabled={simulating}
              >
                {simulating ? (
                  <>
                    <span className="mr-2"><Spinner size="sm" /></span>
                    Simulating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
                    </svg>
                    Run Simulation
                  </>
                )}
              </GlassButton>
              <GlassButton variant="ghost" onClick={resetForm}>
                Cancel
              </GlassButton>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Simulation Result */}
      {simulationResult && (
        <GlassCard className="!bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
              </svg>
            </div>
            <div className="flex-1">
              <h5 className="text-sm font-semibold text-purple-400 mb-2">{simulationResult.name}</h5>

              {simulationResult.resultSnapshot && (
                <div className="space-y-2">
                  {simulationResult.resultSnapshot.projectedOutcome && (
                    <p className="text-sm text-white/80">{simulationResult.resultSnapshot.projectedOutcome}</p>
                  )}

                  <div className="flex gap-4">
                    {simulationResult.resultSnapshot.budgetImpact !== undefined && (
                      <div className="text-center">
                        <p className={`text-lg font-bold ${simulationResult.resultSnapshot.budgetImpact >= 0 ? "text-amber-400" : "text-emerald-400"}`}>
                          {simulationResult.resultSnapshot.budgetImpact >= 0 ? "+" : ""}
                          ${Math.abs(simulationResult.resultSnapshot.budgetImpact).toLocaleString()}
                        </p>
                        <p className="text-xs text-white/50">Budget Impact</p>
                      </div>
                    )}
                    {simulationResult.resultSnapshot.roiChange !== undefined && (
                      <div className="text-center">
                        <p className={`text-lg font-bold ${simulationResult.resultSnapshot.roiChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {simulationResult.resultSnapshot.roiChange >= 0 ? "+" : ""}
                          {simulationResult.resultSnapshot.roiChange}%
                        </p>
                        <p className="text-xs text-white/50">Projected ROI Change</p>
                      </div>
                    )}
                  </div>

                  {simulationResult.resultSnapshot.recommendedAction && (
                    <div className="mt-3 p-2 rounded-lg bg-white/5">
                      <p className="text-xs text-white/50 mb-1">Recommendation</p>
                      <p className="text-sm text-white">{simulationResult.resultSnapshot.recommendedAction}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      )}

      {/* Saved Scenarios */}
      {scenarios.length > 0 && !showCreate && (
        <div className="space-y-2">
          <p className="text-xs text-white/50 uppercase tracking-wider">Saved Scenarios</p>
          {scenarios.map((scenario) => (
            <div
              key={scenario.id}
              className="p-3 rounded-lg bg-white/5 hover:bg-white/8 transition-colors cursor-pointer"
              onClick={() => setSimulationResult(scenario)}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">{scenario.name}</span>
                <span className="text-xs text-white/40">
                  {new Date(scenario.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-xs text-white/50 mt-1">
                {scenario.scenarioType.replace(/_/g, " ")}
                {scenario.resultSnapshot?.roiChange !== undefined && (
                  <span className={`ml-2 ${scenario.resultSnapshot.roiChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {scenario.resultSnapshot.roiChange >= 0 ? "+" : ""}{scenario.resultSnapshot.roiChange}% ROI
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {scenarios.length === 0 && !showCreate && (
        <div className="text-center py-6">
          <p className="text-sm text-white/40">No scenarios yet. Create one to see projections.</p>
        </div>
      )}
    </div>
  );
}
