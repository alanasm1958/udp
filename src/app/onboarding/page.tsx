"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  GlassCard,
  GlassButton,
  GlassInput,
  Spinner,
  useToast,
} from "@/components/ui/glass";
import { apiGet, apiPost, apiPut } from "@/lib/http";

// ============================================================================
// Types
// ============================================================================

interface OnboardingStatus {
  isComplete: boolean;
  currentStep: number;
  steps: { step: number; name: string; completed: boolean }[];
}

interface CoATemplate {
  id: string;
  name: string;
  description: string;
  industry: string;
  accountCount: number;
}

// ============================================================================
// Step Indicator Component
// ============================================================================

function StepIndicator({
  steps,
  currentStep,
}: {
  steps: { step: number; name: string; completed: boolean }[];
  currentStep: number;
}) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, index) => (
        <React.Fragment key={step.step}>
          <div className="flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step.completed
                  ? "bg-emerald-500 text-white"
                  : step.step === currentStep
                    ? "bg-blue-500 text-white"
                    : "bg-white/10 text-white/50"
              }`}
            >
              {step.completed ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                step.step
              )}
            </div>
            <span className="text-xs text-white/50 mt-1 max-w-[80px] text-center">
              {step.name}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`h-0.5 w-8 ${
                step.completed ? "bg-emerald-500" : "bg-white/20"
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ============================================================================
// Step 1: Company Profile
// ============================================================================

function CompanyStep({
  onNext,
}: {
  onNext: () => void;
}) {
  const { addToast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    companyName: "",
    industry: "general",
    currency: "USD",
    addressLine1: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
    phone: "",
    email: "",
  });

  const handleSubmit = async () => {
    if (!form.companyName.trim()) {
      addToast("error", "Company name is required");
      return;
    }

    setSaving(true);
    try {
      await apiPut("/api/onboarding/company", form);
      addToast("success", "Company profile saved");
      onNext();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Company Profile</h2>
        <p className="text-white/60">Tell us about your business</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <GlassInput
            label="Company Name *"
            placeholder="Acme Corporation"
            value={form.companyName}
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm text-white/70 mb-1">Industry</label>
          <select
            value={form.industry}
            onChange={(e) => setForm({ ...form, industry: e.target.value })}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            <option value="general" className="bg-gray-900">General Business</option>
            <option value="retail" className="bg-gray-900">Retail</option>
            <option value="services" className="bg-gray-900">Professional Services</option>
            <option value="manufacturing" className="bg-gray-900">Manufacturing</option>
            <option value="restaurant" className="bg-gray-900">Restaurant & Food Service</option>
            <option value="construction" className="bg-gray-900">Construction</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-white/70 mb-1">Currency</label>
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            <option value="USD" className="bg-gray-900">USD - US Dollar</option>
            <option value="EUR" className="bg-gray-900">EUR - Euro</option>
            <option value="GBP" className="bg-gray-900">GBP - British Pound</option>
            <option value="CAD" className="bg-gray-900">CAD - Canadian Dollar</option>
            <option value="AUD" className="bg-gray-900">AUD - Australian Dollar</option>
          </select>
        </div>

        <GlassInput
          label="Address"
          placeholder="123 Main Street"
          value={form.addressLine1}
          onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
        />

        <GlassInput
          label="City"
          placeholder="San Francisco"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
        />

        <GlassInput
          label="State/Province"
          placeholder="CA"
          value={form.state}
          onChange={(e) => setForm({ ...form, state: e.target.value })}
        />

        <GlassInput
          label="Postal Code"
          placeholder="94102"
          value={form.postalCode}
          onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
        />

        <GlassInput
          label="Phone"
          type="tel"
          placeholder="+1 (555) 123-4567"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />

        <GlassInput
          label="Email"
          type="email"
          placeholder="contact@company.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>

      <div className="flex justify-end">
        <GlassButton onClick={handleSubmit} disabled={saving}>
          {saving ? <Spinner size="sm" /> : "Continue"}
        </GlassButton>
      </div>
    </div>
  );
}

// ============================================================================
// Step 2: Chart of Accounts
// ============================================================================

function CoAStep({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const { addToast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [templates, setTemplates] = React.useState<CoATemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = React.useState<string>("general");

  React.useEffect(() => {
    async function loadTemplates() {
      try {
        const result = await apiGet<{ templates: CoATemplate[] }>("/api/onboarding/coa-templates");
        setTemplates(result.templates);
      } catch (err) {
        console.error("Failed to load templates:", err);
      } finally {
        setLoading(false);
      }
    }
    loadTemplates();
  }, []);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await apiPost("/api/onboarding/coa", { templateId: selectedTemplate });
      addToast("success", "Chart of Accounts created");
      onNext();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to create accounts");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Chart of Accounts</h2>
        <p className="text-white/60">Choose a template that fits your business</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((template) => (
          <div
            key={template.id}
            onClick={() => setSelectedTemplate(template.id)}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              selectedTemplate === template.id
                ? "border-blue-500 bg-blue-500/20"
                : "border-white/20 bg-white/5 hover:bg-white/10"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-white">{template.name}</h3>
                <p className="text-sm text-white/50 mt-1">{template.description}</p>
              </div>
              {selectedTemplate === template.id && (
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
            <p className="text-xs text-white/40 mt-2">
              {template.accountCount} accounts | {template.industry}
            </p>
          </div>
        ))}
      </div>

      <div className="flex justify-between">
        <GlassButton variant="ghost" onClick={onBack}>
          Back
        </GlassButton>
        <GlassButton onClick={handleSubmit} disabled={saving}>
          {saving ? <Spinner size="sm" /> : "Create Accounts"}
        </GlassButton>
      </div>
    </div>
  );
}

// ============================================================================
// Step 3: First Customer (Optional)
// ============================================================================

function CustomerStep({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const { addToast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    phone: "",
  });

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      // Skip if no customer entered
      onNext();
      return;
    }

    setSaving(true);
    try {
      await apiPost("/api/sales-customers/customers", {
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
      });
      addToast("success", "Customer created");
      onNext();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to create customer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Add Your First Customer</h2>
        <p className="text-white/60">Optional - you can skip this step</p>
      </div>

      <div className="space-y-4">
        <GlassInput
          label="Customer Name"
          placeholder="Customer or Company Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />

        <GlassInput
          label="Email"
          type="email"
          placeholder="customer@example.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />

        <GlassInput
          label="Phone"
          type="tel"
          placeholder="+1 (555) 123-4567"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
      </div>

      <div className="flex justify-between">
        <GlassButton variant="ghost" onClick={onBack}>
          Back
        </GlassButton>
        <div className="flex gap-3">
          <GlassButton variant="ghost" onClick={onNext}>
            Skip
          </GlassButton>
          <GlassButton onClick={handleSubmit} disabled={saving}>
            {saving ? <Spinner size="sm" /> : form.name ? "Add Customer" : "Continue"}
          </GlassButton>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Step 4: Success
// ============================================================================

function SuccessStep({ onComplete }: { onComplete: () => void }) {
  const { addToast } = useToast();
  const [completing, setCompleting] = React.useState(false);

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await apiPost("/api/onboarding/complete", {});
      addToast("success", "Setup complete! Redirecting to dashboard...");
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1000);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to complete");
      setCompleting(false);
    }
  };

  return (
    <div className="space-y-6 text-center">
      <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
        <svg
          className="w-10 h-10 text-emerald-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-white mb-2">You&apos;re All Set!</h2>
        <p className="text-white/60">
          Your account is ready to use. Start managing your finances and grow your business.
        </p>
      </div>

      <div className="bg-white/5 rounded-xl p-4 text-left space-y-3">
        <h3 className="font-semibold text-white">Quick Start Guide:</h3>
        <ul className="space-y-2 text-sm text-white/70">
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-blue-500/20 flex items-center justify-center text-blue-400">1</span>
            Create your first invoice in <strong>Sales</strong>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-blue-500/20 flex items-center justify-center text-blue-400">2</span>
            Record expenses in <strong>Finance → Bills</strong>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-blue-500/20 flex items-center justify-center text-blue-400">3</span>
            View reports in <strong>Finance → Trial Balance</strong>
          </li>
        </ul>
      </div>

      <GlassButton
        onClick={handleComplete}
        disabled={completing}
        className="w-full"
      >
        {completing ? <Spinner size="sm" /> : "Go to Dashboard"}
      </GlassButton>
    </div>
  );
}

// ============================================================================
// Main Onboarding Page
// ============================================================================

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState<OnboardingStatus | null>(null);
  const [currentStep, setCurrentStep] = React.useState(1);

  React.useEffect(() => {
    async function loadStatus() {
      try {
        const result = await apiGet<OnboardingStatus>("/api/onboarding/status");
        setStatus(result);

        if (result.isComplete) {
          // Already complete, redirect to dashboard
          router.push("/dashboard");
          return;
        }

        setCurrentStep(result.currentStep);
      } catch (err) {
        console.error("Failed to load onboarding status:", err);
        // If we can't load status, show step 1
        setCurrentStep(1);
        setStatus({
          isComplete: false,
          currentStep: 1,
          steps: [
            { step: 1, name: "Company Profile", completed: false },
            { step: 2, name: "Chart of Accounts", completed: false },
            { step: 3, name: "First Customer", completed: false },
            { step: 4, name: "Complete", completed: false },
          ],
        });
      } finally {
        setLoading(false);
      }
    }
    loadStatus();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-bg-blob-1" />
        <div className="glass-bg-blob-2" />
        <Spinner size="lg" />
      </div>
    );
  }

  const steps = status?.steps || [
    { step: 1, name: "Company Profile", completed: false },
    { step: 2, name: "Chart of Accounts", completed: false },
    { step: 3, name: "First Customer", completed: false },
    { step: 4, name: "Complete", completed: false },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      {/* Background blobs */}
      <div className="glass-bg-blob-1" />
      <div className="glass-bg-blob-2" />

      <GlassCard className="max-w-2xl w-full">
        <StepIndicator steps={steps} currentStep={currentStep} />

        {currentStep === 1 && (
          <CompanyStep onNext={() => setCurrentStep(2)} />
        )}

        {currentStep === 2 && (
          <CoAStep
            onNext={() => setCurrentStep(3)}
            onBack={() => setCurrentStep(1)}
          />
        )}

        {currentStep === 3 && (
          <CustomerStep
            onNext={() => setCurrentStep(4)}
            onBack={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 4 && (
          <SuccessStep onComplete={() => router.push("/dashboard")} />
        )}
      </GlassCard>
    </div>
  );
}
