"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GlassCard, GlassButton, GlassInput, GlassSelect, Spinner, useToast } from "@/components/ui/glass";

/* =============================================================================
   TYPES
   ============================================================================= */

type OnboardingStep =
  | "welcome"
  | "company_profile"
  | "settings"
  | "departments"
  | "invite_team"
  | "complete";

interface OnboardingData {
  // Company Profile
  companyName: string;
  industry: string;
  companySize: string;
  // Settings
  baseCurrency: string;
  timezone: string;
  fiscalYearStart: string;
  // Departments
  departments: Array<{ name: string; code: string }>;
  // Invite Team
  inviteEmails: string[];
}

const defaultData: OnboardingData = {
  companyName: "",
  industry: "",
  companySize: "",
  baseCurrency: "USD",
  timezone: "America/New_York",
  fiscalYearStart: "1",
  departments: [],
  inviteEmails: [],
};

const STEPS: OnboardingStep[] = [
  "welcome",
  "company_profile",
  "settings",
  "departments",
  "invite_team",
  "complete",
];

/* =============================================================================
   OPTIONS
   ============================================================================= */

const industryOptions = [
  { value: "", label: "Select industry..." },
  { value: "retail", label: "Retail & E-commerce" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "services", label: "Professional Services" },
  { value: "technology", label: "Technology" },
  { value: "healthcare", label: "Healthcare" },
  { value: "food_beverage", label: "Food & Beverage" },
  { value: "construction", label: "Construction" },
  { value: "agriculture", label: "Agriculture" },
  { value: "logistics", label: "Logistics & Distribution" },
  { value: "other", label: "Other" },
];

const companySizeOptions = [
  { value: "", label: "Select size..." },
  { value: "1-5", label: "1-5 employees" },
  { value: "6-20", label: "6-20 employees" },
  { value: "21-50", label: "21-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-500", label: "201-500 employees" },
  { value: "500+", label: "500+ employees" },
];

const currencyOptions = [
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "CAD", label: "CAD - Canadian Dollar" },
  { value: "AUD", label: "AUD - Australian Dollar" },
  { value: "JPY", label: "JPY - Japanese Yen" },
  { value: "CNY", label: "CNY - Chinese Yuan" },
  { value: "INR", label: "INR - Indian Rupee" },
  { value: "MXN", label: "MXN - Mexican Peso" },
  { value: "BRL", label: "BRL - Brazilian Real" },
];

const timezoneOptions = [
  { value: "America/New_York", label: "Eastern Time (US)" },
  { value: "America/Chicago", label: "Central Time (US)" },
  { value: "America/Denver", label: "Mountain Time (US)" },
  { value: "America/Los_Angeles", label: "Pacific Time (US)" },
  { value: "America/Toronto", label: "Eastern Time (Canada)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Central European Time" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "Asia/Tokyo", label: "Japan Standard Time" },
  { value: "Asia/Shanghai", label: "China Standard Time" },
  { value: "Asia/Singapore", label: "Singapore Time" },
  { value: "Asia/Dubai", label: "Gulf Standard Time" },
  { value: "Australia/Sydney", label: "Australian Eastern Time" },
];

const fiscalYearOptions = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const suggestedDepartments = [
  { name: "Sales", code: "SLS" },
  { name: "Operations", code: "OPS" },
  { name: "Finance", code: "FIN" },
  { name: "Human Resources", code: "HR" },
  { name: "Marketing", code: "MKT" },
  { name: "Engineering", code: "ENG" },
  { name: "Customer Support", code: "SUP" },
  { name: "Procurement", code: "PRO" },
];

/* =============================================================================
   MAIN COMPONENT
   ============================================================================= */

export default function OnboardingPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [currentStep, setCurrentStep] = React.useState<OnboardingStep>("welcome");
  const [data, setData] = React.useState<OnboardingData>(defaultData);
  const [loading, setLoading] = React.useState(false);
  const [inviteInput, setInviteInput] = React.useState("");
  const [customDeptName, setCustomDeptName] = React.useState("");
  const [customDeptCode, setCustomDeptCode] = React.useState("");

  const currentStepIndex = STEPS.indexOf(currentStep);
  const progress = ((currentStepIndex) / (STEPS.length - 1)) * 100;

  const updateData = (updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const nextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex]);
    }
  };

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex]);
    }
  };

  const toggleDepartment = (dept: { name: string; code: string }) => {
    const exists = data.departments.some((d) => d.code === dept.code);
    if (exists) {
      updateData({ departments: data.departments.filter((d) => d.code !== dept.code) });
    } else {
      updateData({ departments: [...data.departments, dept] });
    }
  };

  const addCustomDepartment = () => {
    if (customDeptName.trim()) {
      const code = customDeptCode.trim() || customDeptName.substring(0, 3).toUpperCase();
      updateData({ departments: [...data.departments, { name: customDeptName.trim(), code }] });
      setCustomDeptName("");
      setCustomDeptCode("");
    }
  };

  const addInviteEmail = () => {
    const email = inviteInput.trim().toLowerCase();
    if (email && email.includes("@") && !data.inviteEmails.includes(email)) {
      updateData({ inviteEmails: [...data.inviteEmails, email] });
      setInviteInput("");
    }
  };

  const removeInviteEmail = (email: string) => {
    updateData({ inviteEmails: data.inviteEmails.filter((e) => e !== email) });
  };

  const completeOnboarding = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to complete setup");
      }

      nextStep(); // Move to complete screen
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Setup failed");
    } finally {
      setLoading(false);
    }
  };

  const goToDashboard = () => {
    router.push("/dashboard");
  };

  const canProceed = () => {
    switch (currentStep) {
      case "welcome":
        return true;
      case "company_profile":
        return data.companyName.trim().length >= 2;
      case "settings":
        return !!data.baseCurrency;
      case "departments":
        return true; // Optional
      case "invite_team":
        return true; // Optional
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep === "invite_team") {
      completeOnboarding();
    } else {
      nextStep();
    }
  };

  /* ===========================================================================
     RENDER STEPS
     =========================================================================== */

  const renderWelcome = () => (
    <div className="text-center space-y-6">
      <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Welcome to UDP</h2>
        <p className="text-white/60">Let&apos;s set up your organization in just a few steps</p>
      </div>

      <div className="grid grid-cols-2 gap-4 text-left">
        {[
          { icon: "M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21", title: "Company Profile", desc: "Basic info about your business" },
          { icon: "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281", title: "Settings", desc: "Currency, timezone, fiscal year" },
          { icon: "M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72", title: "Departments", desc: "Organize your teams" },
          { icon: "M19 7.5v3m0 0v3m0-3h3m-3 0h-3", title: "Invite Team", desc: "Add your colleagues" },
        ].map((item, i) => (
          <div key={i} className="p-3 rounded-lg bg-white/5 border border-white/10">
            <svg className="w-5 h-5 text-blue-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
            </svg>
            <h4 className="text-sm font-medium text-white">{item.title}</h4>
            <p className="text-xs text-white/50">{item.desc}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-white/40">This will only take a few minutes</p>
    </div>
  );

  const renderCompanyProfile = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-white mb-2">Tell us about your company</h3>
        <p className="text-sm text-white/60">This helps us customize your experience</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-white/70 mb-1.5">
          Company Name <span className="text-red-400">*</span>
        </label>
        <GlassInput
          value={data.companyName}
          onChange={(e) => updateData({ companyName: e.target.value })}
          placeholder="Your company name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-white/70 mb-1.5">Industry</label>
        <GlassSelect
          value={data.industry}
          onChange={(e) => updateData({ industry: e.target.value })}
          options={industryOptions}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-white/70 mb-1.5">Company Size</label>
        <GlassSelect
          value={data.companySize}
          onChange={(e) => updateData({ companySize: e.target.value })}
          options={companySizeOptions}
        />
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-white mb-2">Configure your settings</h3>
        <p className="text-sm text-white/60">Set your regional and fiscal preferences</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-white/70 mb-1.5">Base Currency</label>
        <GlassSelect
          value={data.baseCurrency}
          onChange={(e) => updateData({ baseCurrency: e.target.value })}
          options={currencyOptions}
        />
        <p className="text-xs text-white/40 mt-1">Used for financial reports and default pricing</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-white/70 mb-1.5">Timezone</label>
        <GlassSelect
          value={data.timezone}
          onChange={(e) => updateData({ timezone: e.target.value })}
          options={timezoneOptions}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-white/70 mb-1.5">Fiscal Year Starts In</label>
        <GlassSelect
          value={data.fiscalYearStart}
          onChange={(e) => updateData({ fiscalYearStart: e.target.value })}
          options={fiscalYearOptions}
        />
        <p className="text-xs text-white/40 mt-1">Most companies use January or April</p>
      </div>
    </div>
  );

  const renderDepartments = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-white mb-2">Create departments</h3>
        <p className="text-sm text-white/60">Select or add departments for your org structure (optional)</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {suggestedDepartments.map((dept) => {
          const isSelected = data.departments.some((d) => d.code === dept.code);
          return (
            <button
              key={dept.code}
              onClick={() => toggleDepartment(dept)}
              className={`p-3 rounded-lg text-left transition-all ${
                isSelected
                  ? "bg-blue-500/20 border border-blue-500/50"
                  : "bg-white/5 border border-transparent hover:bg-white/10"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                  isSelected ? "bg-blue-500 border-blue-500" : "border-white/30"
                }`}>
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-white">{dept.name}</span>
              </div>
              <span className="text-xs text-white/40 ml-6">{dept.code}</span>
            </button>
          );
        })}
      </div>

      <div className="pt-4 border-t border-white/10">
        <label className="block text-sm font-medium text-white/70 mb-2">Add custom department</label>
        <div className="flex gap-2">
          <GlassInput
            value={customDeptName}
            onChange={(e) => setCustomDeptName(e.target.value)}
            placeholder="Department name"
            className="flex-1"
          />
          <GlassInput
            value={customDeptCode}
            onChange={(e) => setCustomDeptCode(e.target.value)}
            placeholder="Code"
            className="w-20"
          />
          <GlassButton
            variant="ghost"
            onClick={addCustomDepartment}
            disabled={!customDeptName.trim()}
          >
            Add
          </GlassButton>
        </div>
      </div>

      {data.departments.length > 0 && (
        <div className="text-sm text-white/60">
          {data.departments.length} department(s) selected
        </div>
      )}
    </div>
  );

  const renderInviteTeam = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-white mb-2">Invite your team</h3>
        <p className="text-sm text-white/60">Add email addresses of people to invite (optional)</p>
      </div>

      <div>
        <div className="flex gap-2">
          <GlassInput
            type="email"
            value={inviteInput}
            onChange={(e) => setInviteInput(e.target.value)}
            placeholder="colleague@company.com"
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addInviteEmail();
              }
            }}
          />
          <GlassButton
            variant="ghost"
            onClick={addInviteEmail}
            disabled={!inviteInput.includes("@")}
          >
            Add
          </GlassButton>
        </div>
        <p className="text-xs text-white/40 mt-1">Press Enter or click Add to add email</p>
      </div>

      {data.inviteEmails.length > 0 && (
        <div className="space-y-2">
          {data.inviteEmails.map((email) => (
            <div
              key={email}
              className="flex items-center justify-between p-2 rounded-lg bg-white/5"
            >
              <span className="text-sm text-white">{email}</span>
              <button
                onClick={() => removeInviteEmail(email)}
                className="p-1 rounded hover:bg-white/10 transition-colors"
              >
                <svg className="w-4 h-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {data.inviteEmails.length === 0 && (
        <GlassCard className="!bg-white/5 text-center py-6">
          <svg className="w-10 h-10 text-white/20 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
          <p className="text-sm text-white/40">No team members added yet</p>
          <p className="text-xs text-white/30 mt-1">You can always invite people later</p>
        </GlassCard>
      )}
    </div>
  );

  const renderComplete = () => (
    <div className="text-center space-y-6">
      <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
        <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-white mb-2">You&apos;re all set!</h2>
        <p className="text-white/60">Your organization is ready to go</p>
      </div>

      <GlassCard className="!bg-white/5 text-left">
        <h4 className="text-sm font-semibold text-white/70 mb-3">Summary</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-white/50">Company</span>
            <span className="text-white">{data.companyName}</span>
          </div>
          {data.industry && (
            <div className="flex justify-between">
              <span className="text-white/50">Industry</span>
              <span className="text-white capitalize">{data.industry.replace("_", " ")}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-white/50">Currency</span>
            <span className="text-white">{data.baseCurrency}</span>
          </div>
          {data.departments.length > 0 && (
            <div className="flex justify-between">
              <span className="text-white/50">Departments</span>
              <span className="text-white">{data.departments.length} created</span>
            </div>
          )}
          {data.inviteEmails.length > 0 && (
            <div className="flex justify-between">
              <span className="text-white/50">Invitations</span>
              <span className="text-white">{data.inviteEmails.length} sent</span>
            </div>
          )}
        </div>
      </GlassCard>

      <div className="space-y-3">
        <GlassButton variant="primary" className="w-full" onClick={goToDashboard}>
          Go to Dashboard
        </GlassButton>
        <div className="grid grid-cols-2 gap-2">
          <GlassButton variant="ghost" onClick={() => router.push("/company/organization")}>
            Organization
          </GlassButton>
          <GlassButton variant="ghost" onClick={() => router.push("/settings")}>
            Settings
          </GlassButton>
        </div>
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case "welcome":
        return renderWelcome();
      case "company_profile":
        return renderCompanyProfile();
      case "settings":
        return renderSettings();
      case "departments":
        return renderDepartments();
      case "invite_team":
        return renderInviteTeam();
      case "complete":
        return renderComplete();
      default:
        return null;
    }
  };

  /* ===========================================================================
     MAIN RENDER
     =========================================================================== */

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      {/* Background blobs */}
      <div className="glass-bg-blob-1" />
      <div className="glass-bg-blob-2" />

      <div className="w-full max-w-lg">
        <GlassCard className="relative overflow-hidden">
          {/* Progress bar */}
          {currentStep !== "complete" && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-white/10">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Header */}
          {currentStep !== "welcome" && currentStep !== "complete" && (
            <div className="flex items-center justify-between mb-6 pt-2">
              <span className="text-xs text-white/40">
                Step {currentStepIndex} of {STEPS.length - 2}
              </span>
              <button
                onClick={goToDashboard}
                className="text-xs text-white/40 hover:text-white/60 transition-colors"
              >
                Skip for now
              </button>
            </div>
          )}

          {/* Content */}
          <div className="min-h-[320px]">
            {renderStepContent()}
          </div>

          {/* Footer */}
          {currentStep !== "complete" && (
            <div className="flex gap-2 mt-6 pt-4 border-t border-white/10">
              {currentStep !== "welcome" && (
                <GlassButton variant="ghost" onClick={prevStep} disabled={loading}>
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
                    <span className="ml-2">Setting up...</span>
                  </>
                ) : currentStep === "welcome" ? (
                  "Get Started"
                ) : currentStep === "invite_team" ? (
                  "Complete Setup"
                ) : (
                  "Continue"
                )}
              </GlassButton>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
