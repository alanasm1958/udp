"use client";

import * as React from "react";

// Simple mode shows: Spend, Results, Best channel, Next best action
// Advanced mode reveals: Attribution, Complex filters, Multi-layer what-if
export type MarketingViewMode = "simple" | "advanced";

// Onboarding steps (max 6)
export type OnboardingStep =
  | "select_objective"
  | "select_product_service"
  | "set_budget"
  | "channel_preferences"
  | "ai_plan"
  | "approve_implement";

// Progressive disclosure triggers
export type AdvancedTrigger = "what_if" | "attribution" | "toggle";

interface MarketingContextValue {
  // View mode state
  mode: MarketingViewMode;
  setMode: (mode: MarketingViewMode) => void;
  triggerAdvancedMode: (trigger: AdvancedTrigger) => void;
  advancedTriggers: AdvancedTrigger[];

  // Onboarding state
  onboardingActive: boolean;
  onboardingStep: OnboardingStep;
  onboardingData: OnboardingData;
  startOnboarding: () => void;
  nextOnboardingStep: () => void;
  prevOnboardingStep: () => void;
  skipOnboarding: () => void;
  completeOnboarding: () => void;
  updateOnboardingData: (data: Partial<OnboardingData>) => void;
  onboardingProgress: number; // 0-100

  // User preferences (persisted)
  preferences: MarketingPreferences;
  updatePreferences: (prefs: Partial<MarketingPreferences>) => void;
}

export interface OnboardingData {
  // Step 1: Select objective
  objectiveType?: string;
  targetValue?: number;

  // Step 2: Select product/service
  productServiceId?: string;
  productServiceName?: string;
  productServiceType?: "product" | "service";

  // Step 3: Budget
  budget?: number;
  budgetRecommended?: boolean;

  // Step 4: Channel preferences
  preferredChannels?: string[];
  excludedChannels?: string[];

  // Step 5: AI plan result
  planId?: string;
  planName?: string;

  // Step 6: Approval
  approved?: boolean;
  campaignCreated?: boolean;
}

interface MarketingPreferences {
  showAdvancedByDefault: boolean;
  onboardingCompleted: boolean;
  dismissedTips: string[];
  preferredChannels: string[];
}

const STORAGE_KEY = "udp_marketing_prefs";
const ONBOARDING_STEPS: OnboardingStep[] = [
  "select_objective",
  "select_product_service",
  "set_budget",
  "channel_preferences",
  "ai_plan",
  "approve_implement",
];

const defaultPreferences: MarketingPreferences = {
  showAdvancedByDefault: false,
  onboardingCompleted: false,
  dismissedTips: [],
  preferredChannels: [],
};

const MarketingContext = React.createContext<MarketingContextValue | null>(null);

export function MarketingProvider({ children }: { children: React.ReactNode }) {
  // Mode state - default to simple
  const [mode, setModeInternal] = React.useState<MarketingViewMode>("simple");
  const [advancedTriggers, setAdvancedTriggers] = React.useState<AdvancedTrigger[]>([]);

  // Onboarding state
  const [onboardingActive, setOnboardingActive] = React.useState(false);
  const [onboardingStep, setOnboardingStep] = React.useState<OnboardingStep>("select_objective");
  const [onboardingData, setOnboardingData] = React.useState<OnboardingData>({});

  // Preferences (persisted to localStorage)
  const [preferences, setPreferences] = React.useState<MarketingPreferences>(defaultPreferences);

  // Load preferences on mount
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as MarketingPreferences;
        setPreferences({ ...defaultPreferences, ...parsed });
        // Set mode based on preferences
        if (parsed.showAdvancedByDefault) {
          setModeInternal("advanced");
        }
      }
    } catch {
      // Ignore errors, use defaults
    }
  }, []);

  // Persist preferences
  const updatePreferences = React.useCallback((prefs: Partial<MarketingPreferences>) => {
    setPreferences((prev) => {
      const updated = { ...prev, ...prefs };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage errors
      }
      return updated;
    });
  }, []);

  // Mode management with progressive disclosure
  const setMode = React.useCallback((newMode: MarketingViewMode) => {
    setModeInternal(newMode);
    if (newMode === "advanced") {
      // Remember preference if user explicitly switches
      updatePreferences({ showAdvancedByDefault: true });
    }
  }, [updatePreferences]);

  const triggerAdvancedMode = React.useCallback((trigger: AdvancedTrigger) => {
    setAdvancedTriggers((prev) => {
      if (prev.includes(trigger)) return prev;
      return [...prev, trigger];
    });
    // Progressive disclosure: switch to advanced when triggered
    setModeInternal("advanced");
  }, []);

  // Onboarding management
  const startOnboarding = React.useCallback(() => {
    setOnboardingActive(true);
    setOnboardingStep("select_objective");
    setOnboardingData({});
  }, []);

  const nextOnboardingStep = React.useCallback(() => {
    const currentIndex = ONBOARDING_STEPS.indexOf(onboardingStep);
    if (currentIndex < ONBOARDING_STEPS.length - 1) {
      setOnboardingStep(ONBOARDING_STEPS[currentIndex + 1]);
    }
  }, [onboardingStep]);

  const prevOnboardingStep = React.useCallback(() => {
    const currentIndex = ONBOARDING_STEPS.indexOf(onboardingStep);
    if (currentIndex > 0) {
      setOnboardingStep(ONBOARDING_STEPS[currentIndex - 1]);
    }
  }, [onboardingStep]);

  const skipOnboarding = React.useCallback(() => {
    setOnboardingActive(false);
    setOnboardingData({});
  }, []);

  const completeOnboarding = React.useCallback(() => {
    setOnboardingActive(false);
    updatePreferences({ onboardingCompleted: true });
  }, [updatePreferences]);

  const updateOnboardingData = React.useCallback((data: Partial<OnboardingData>) => {
    setOnboardingData((prev) => ({ ...prev, ...data }));
  }, []);

  // Calculate progress percentage
  const onboardingProgress = React.useMemo(() => {
    const currentIndex = ONBOARDING_STEPS.indexOf(onboardingStep);
    return Math.round(((currentIndex + 1) / ONBOARDING_STEPS.length) * 100);
  }, [onboardingStep]);

  const value: MarketingContextValue = {
    mode,
    setMode,
    triggerAdvancedMode,
    advancedTriggers,
    onboardingActive,
    onboardingStep,
    onboardingData,
    startOnboarding,
    nextOnboardingStep,
    prevOnboardingStep,
    skipOnboarding,
    completeOnboarding,
    updateOnboardingData,
    onboardingProgress,
    preferences,
    updatePreferences,
  };

  return (
    <MarketingContext.Provider value={value}>
      {children}
    </MarketingContext.Provider>
  );
}

export function useMarketing() {
  const context = React.useContext(MarketingContext);
  if (!context) {
    throw new Error("useMarketing must be used within MarketingProvider");
  }
  return context;
}

// Helper hook for simple mode - checks if feature should be visible
export function useMarketingFeature(feature: "what_if" | "attribution" | "filters" | "channel_details") {
  const { mode } = useMarketing();

  // Features visible in simple mode
  const simpleFeatures = ["basic_metrics", "next_action", "quick_create"];

  // Features only in advanced mode
  const advancedOnly = ["what_if", "attribution", "filters", "channel_details"];

  if (advancedOnly.includes(feature)) {
    return mode === "advanced";
  }

  return true;
}
