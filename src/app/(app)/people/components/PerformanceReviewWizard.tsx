"use client";

import * as React from "react";
import {
  GlassCard,
  GlassButton,
  GlassInput,
  GlassTextarea,
  GlassSelect,
  GlassBadge,
  SlideOver,
  useToast,
} from "@/components/ui/glass";

/* =============================================================================
   TYPES
   ============================================================================= */

interface Employee {
  id: string;
  personId: string;
  personName: string;
}

interface AIOutcome {
  category: string;
  reasons: string[];
  nextStep: string;
}

interface PerformanceReviewWizardProps {
  open: boolean;
  employees: Employee[];
  onClose: () => void;
  onComplete: () => void;
}

/* =============================================================================
   ICONS
   ============================================================================= */

const Icons = {
  chevronLeft: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  ),
  chevronRight: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  ),
  sparkles: (
    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  ),
  lock: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  ),
};

/* =============================================================================
   SECTION DEFINITIONS
   ============================================================================= */

const SECTIONS = [
  {
    id: "context",
    title: "Context",
    guidance: "Only review what happened in this time window.",
  },
  {
    id: "strengths",
    title: "Strengths",
    guidance: "Use facts and outcomes, not personality.",
  },
  {
    id: "improvements",
    title: "Areas for Improvement",
    guidance: "Describe impact and frequency neutrally.",
  },
  {
    id: "fairness",
    title: "Fairness & Context",
    guidance: "Note if business conditions affected results.",
  },
  {
    id: "goals",
    title: "Goals & Next Steps",
    guidance: "Set 1 to 3 practical goals.",
  },
  {
    id: "visibility",
    title: "Visibility & Privacy",
    guidance: "Write as if the employee will read it.",
  },
  {
    id: "outcome",
    title: "AI Outcome",
    guidance: "AI will analyze and categorize this review.",
  },
];

/* =============================================================================
   OUTCOME CATEGORY STYLING
   ============================================================================= */

const outcomeCategoryVariants: Record<string, "success" | "info" | "warning" | "danger" | "default"> = {
  outstanding_contribution: "success",
  strong_performance: "success",
  solid_on_track: "info",
  below_expectations: "warning",
  critical_concerns: "danger",
};

/* =============================================================================
   MAIN COMPONENT
   ============================================================================= */

export function PerformanceReviewWizard({
  open,
  employees,
  onClose,
  onComplete,
}: PerformanceReviewWizardProps) {
  const [currentSection, setCurrentSection] = React.useState(0);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [reviewId, setReviewId] = React.useState<string | null>(null);
  const { addToast } = useToast();

  const [formData, setFormData] = React.useState({
    employeeId: "",
    periodType: "quarterly",
    periodStart: "",
    periodEnd: "",
    strengths: "",
    strengthsExamples: "",
    improvements: "",
    improvementsExamples: "",
    fairnessConstraints: "",
    fairnessSupport: "",
    fairnessOutsideControl: "",
    goals: "",
    goalsSupportPlan: "",
    followUpDate: "",
    visibility: "visible_to_employee",
    privateNotes: "",
  });

  const [aiOutcome, setAiOutcome] = React.useState<AIOutcome | null>(null);

  // Reset state when closing
  React.useEffect(() => {
    if (!open) {
      setCurrentSection(0);
      setReviewId(null);
      setAiOutcome(null);
      setFormData({
        employeeId: "",
        periodType: "quarterly",
        periodStart: "",
        periodEnd: "",
        strengths: "",
        strengthsExamples: "",
        improvements: "",
        improvementsExamples: "",
        fairnessConstraints: "",
        fairnessSupport: "",
        fairnessOutsideControl: "",
        goals: "",
        goalsSupportPlan: "",
        followUpDate: "",
        visibility: "visible_to_employee",
        privateNotes: "",
      });
    }
  }, [open]);

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear AI outcome if content changes
    if (["strengths", "improvements", "fairnessConstraints"].includes(field)) {
      setAiOutcome(null);
    }
  };

  const canProceed = () => {
    const section = SECTIONS[currentSection];

    if (section.id === "context") {
      return formData.employeeId && formData.periodStart && formData.periodEnd;
    }

    if (section.id === "outcome") {
      return aiOutcome !== null;
    }

    return true;
  };

  const saveReview = async (status: string = "draft") => {
    const payload = {
      employeeId: formData.employeeId,
      periodType: formData.periodType,
      periodStart: formData.periodStart,
      periodEnd: formData.periodEnd,
      strengths: formData.strengths,
      strengthsExamples: formData.strengthsExamples,
      improvements: formData.improvements,
      improvementsExamples: formData.improvementsExamples,
      fairnessConstraints: formData.fairnessConstraints,
      fairnessSupport: formData.fairnessSupport,
      fairnessOutsideControl: formData.fairnessOutsideControl,
      goals: formData.goals,
      goalsSupportPlan: formData.goalsSupportPlan,
      followUpDate: formData.followUpDate || null,
      visibility: formData.visibility,
      privateNotes: formData.privateNotes,
      status,
    };

    if (reviewId) {
      // Update existing review
      const res = await fetch(`/api/people/performance/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to update review");
      }

      const data = await res.json();
      return data.review;
    } else {
      // Create new review
      const res = await fetch("/api/people/performance/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to create review");
      }

      const data = await res.json();
      setReviewId(data.review.id);
      return data.review;
    }
  };

  const generateAIOutcome = async () => {
    if (!reviewId) return;

    setIsGenerating(true);
    try {
      const res = await fetch(`/api/people/performance/reviews/${reviewId}/generate-outcome`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Failed to generate AI outcome");
      }

      const data = await res.json();
      setAiOutcome({
        category: data.outcome.category,
        reasons: data.outcome.reasons,
        nextStep: data.outcome.nextStep,
      });
      addToast("success", "AI outcome generated successfully");
    } catch (error) {
      console.error("Error generating AI outcome:", error);
      addToast("error", "Failed to generate AI outcome");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNext = async () => {
    // Before going to outcome section, save draft and generate AI outcome
    if (currentSection === SECTIONS.length - 2) {
      setIsSaving(true);
      try {
        await saveReview("draft");
        await generateAIOutcome();
      } catch (error) {
        console.error("Error:", error);
        addToast("error", "Failed to save review");
      } finally {
        setIsSaving(false);
      }
    }

    if (currentSection < SECTIONS.length - 1) {
      setCurrentSection(currentSection + 1);
    }
  };

  const handleBack = () => {
    if (currentSection > 0) {
      setCurrentSection(currentSection - 1);
    }
  };

  const handleComplete = async () => {
    setIsSaving(true);
    try {
      await saveReview("completed");
      addToast("success", "Performance review completed");
      onComplete();
    } catch (error) {
      console.error("Error:", error);
      addToast("error", "Failed to complete review");
    } finally {
      setIsSaving(false);
    }
  };

  const renderSection = () => {
    const section = SECTIONS[currentSection];

    switch (section.id) {
      case "context":
        return (
          <div className="space-y-4">
            <div>
              <GlassSelect
                label="Employee"
                value={formData.employeeId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateField("employeeId", e.target.value)}
                options={[
                  { value: "", label: "Select employee" },
                  ...employees.map((emp) => ({
                    value: emp.id,
                    label: emp.personName,
                  })),
                ]}
              />
            </div>

            <div>
              <GlassSelect
                label="Period Type"
                value={formData.periodType}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateField("periodType", e.target.value)}
                options={[
                  { value: "monthly", label: "Monthly" },
                  { value: "quarterly", label: "Quarterly" },
                  { value: "annual", label: "Annual" },
                  { value: "probation", label: "Probation" },
                  { value: "project", label: "Project" },
                  { value: "other", label: "Other" },
                ]}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <GlassInput
                  label="Period Start"
                  type="date"
                  value={formData.periodStart}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField("periodStart", e.target.value)}
                />
              </div>
              <div>
                <GlassInput
                  label="Period End"
                  type="date"
                  value={formData.periodEnd}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField("periodEnd", e.target.value)}
                />
              </div>
            </div>
          </div>
        );

      case "strengths":
        return (
          <div className="space-y-4">
            <div>
              <GlassTextarea
                label="What did this person do well?"
                value={formData.strengths}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateField("strengths", e.target.value)}
                rows={4}
                placeholder="Focus on specific outcomes and behaviors..."
              />
            </div>

            <div>
              <GlassTextarea
                label="Examples"
                value={formData.strengthsExamples}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateField("strengthsExamples", e.target.value)}
                rows={3}
                placeholder="Provide concrete examples..."
              />
            </div>
          </div>
        );

      case "improvements":
        return (
          <div className="space-y-4">
            <div>
              <GlassTextarea
                label="What could be improved?"
                value={formData.improvements}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateField("improvements", e.target.value)}
                rows={4}
                placeholder="Describe impact and frequency neutrally..."
              />
            </div>

            <div>
              <GlassTextarea
                label="Examples"
                value={formData.improvementsExamples}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateField("improvementsExamples", e.target.value)}
                rows={3}
                placeholder="Provide specific instances..."
              />
            </div>
          </div>
        );

      case "fairness":
        return (
          <div className="space-y-4">
            <div>
              <GlassTextarea
                label="Were there any constraints?"
                value={formData.fairnessConstraints}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateField("fairnessConstraints", e.target.value)}
                rows={2}
                placeholder="Budget limits, resource availability, organizational changes..."
              />
            </div>

            <div>
              <GlassTextarea
                label="What support was provided?"
                value={formData.fairnessSupport}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateField("fairnessSupport", e.target.value)}
                rows={2}
                placeholder="Training, mentorship, tools..."
              />
            </div>

            <div>
              <GlassTextarea
                label="External factors?"
                value={formData.fairnessOutsideControl}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateField("fairnessOutsideControl", e.target.value)}
                rows={2}
                placeholder="Market conditions, client delays, team changes..."
              />
            </div>
          </div>
        );

      case "goals":
        return (
          <div className="space-y-4">
            <div>
              <GlassTextarea
                label="Goals for next period (1-3 goals)"
                value={formData.goals}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateField("goals", e.target.value)}
                rows={4}
                placeholder="Specific, measurable goals..."
              />
            </div>

            <div>
              <GlassTextarea
                label="Support plan"
                value={formData.goalsSupportPlan}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateField("goalsSupportPlan", e.target.value)}
                rows={3}
                placeholder="How will you support achieving these goals?"
              />
            </div>

            <div>
              <GlassInput
                label="Follow-up date"
                type="date"
                value={formData.followUpDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField("followUpDate", e.target.value)}
              />
            </div>
          </div>
        );

      case "visibility":
        return (
          <div className="space-y-4">
            <div>
              <GlassSelect
                label="Visibility"
                value={formData.visibility}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateField("visibility", e.target.value)}
                options={[
                  { value: "visible_to_employee", label: "Visible to Employee" },
                  { value: "manager_only", label: "Manager Only" },
                  { value: "hr_only", label: "HR Only" },
                ]}
              />
            </div>

            <div>
              <GlassTextarea
                label="Private notes (not visible to employee)"
                value={formData.privateNotes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateField("privateNotes", e.target.value)}
                rows={4}
                placeholder="Internal notes for manager/HR only..."
              />
            </div>
          </div>
        );

      case "outcome":
        return (
          <div className="space-y-6">
            {isGenerating ? (
              <div className="text-center py-8">
                <div className="mx-auto mb-4 animate-pulse text-blue-400">
                  {Icons.sparkles}
                </div>
                <p className="text-white/60">Generating AI outcome...</p>
              </div>
            ) : aiOutcome ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-amber-400">
                  {Icons.lock}
                  <span className="text-sm">
                    AI outcome is locked (will regenerate if text changes)
                  </span>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-2">
                    Performance Category
                  </label>
                  <GlassBadge
                    variant={outcomeCategoryVariants[aiOutcome.category] || "default"}
                  >
                    {aiOutcome.category.replace(/_/g, " ").toUpperCase()}
                  </GlassBadge>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-2">
                    Key Reasons
                  </label>
                  <ul className="list-disc list-inside space-y-1 text-sm text-white/80">
                    {aiOutcome.reasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-2">
                    Suggested Next Step
                  </label>
                  <p className="text-sm text-white/80">{aiOutcome.nextStep}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-white/60">
                Click &ldquo;Generate&rdquo; to analyze this review with AI
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const section = SECTIONS[currentSection];
  const progress = ((currentSection + 1) / SECTIONS.length) * 100;

  return (
    <SlideOver open={open} onClose={onClose} title="New Performance Review" width="lg">
      <div className="space-y-6">
        {/* Progress */}
        <div>
          <div className="flex justify-between text-sm text-white/60 mb-2">
            <span>
              Step {currentSection + 1} of {SECTIONS.length}
            </span>
            <span>{section.title}</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Section Header */}
        <div>
          <h2 className="text-xl font-bold text-white mb-1">{section.title}</h2>
          <p className="text-white/60">{section.guidance}</p>
        </div>

        {/* Section Content */}
        <div className="min-h-[300px]">{renderSection()}</div>

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t border-white/10">
          <GlassButton onClick={onClose} variant="ghost">
            Cancel
          </GlassButton>

          <div className="flex gap-2">
            {currentSection > 0 && (
              <GlassButton onClick={handleBack} variant="ghost">
                {Icons.chevronLeft}
                <span className="ml-2">Back</span>
              </GlassButton>
            )}

            {currentSection < SECTIONS.length - 1 ? (
              <GlassButton
                onClick={handleNext}
                variant="primary"
                disabled={!canProceed() || isGenerating || isSaving}
              >
                <span className="mr-2">
                  {section.id === "visibility" ? "Generate Outcome" : "Next"}
                </span>
                {Icons.chevronRight}
              </GlassButton>
            ) : (
              <GlassButton
                onClick={handleComplete}
                variant="primary"
                disabled={!canProceed() || isSaving}
              >
                {isSaving ? "Saving..." : "Complete Review"}
              </GlassButton>
            )}
          </div>
        </div>
      </div>
    </SlideOver>
  );
}
