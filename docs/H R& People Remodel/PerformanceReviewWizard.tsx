// /components/people/PerformanceReviewWizard.tsx
"use client";

import { useState } from "react";
import {
  GlassCard,
  GlassButton,
  GlassInput,
  GlassTextArea,
  GlassSelect,
  GlassBadge,
  useToast,
} from "@/components/ui/glass";
import { ChevronRight, ChevronLeft, Sparkles, Lock } from "lucide-react";

interface Employee {
  id: string;
  person_id: string;
  person_name: string;
}

interface PerformanceReviewWizardProps {
  employees: Employee[];
  onComplete: () => void;
  onCancel: () => void;
}

const SECTIONS = [
  {
    id: "context",
    title: "Context",
    guidance: "Only review what happened in this time window.",
    fields: ["employee", "period_type", "period_start", "period_end"],
  },
  {
    id: "strengths",
    title: "Strengths",
    guidance: "Use facts and outcomes, not personality.",
    fields: ["strengths", "strengths_examples"],
  },
  {
    id: "improvements",
    title: "Areas for Improvement",
    guidance: "Describe impact and frequency neutrally.",
    fields: ["improvements", "improvements_examples"],
  },
  {
    id: "fairness",
    title: "Fairness & Context",
    guidance: "Note if business conditions affected results.",
    fields: ["fairness_constraints", "fairness_support", "fairness_outside_control"],
  },
  {
    id: "goals",
    title: "Goals & Next Steps",
    guidance: "Set 1 to 3 practical goals.",
    fields: ["goals", "goals_support_plan", "follow_up_date"],
  },
  {
    id: "visibility",
    title: "Visibility & Privacy",
    guidance: "Write as if the employee will read it.",
    fields: ["visibility", "private_notes"],
  },
  {
    id: "outcome",
    title: "AI Outcome",
    guidance: "AI will analyze and categorize this review.",
    fields: [],
  },
];

export default function PerformanceReviewWizard({
  employees,
  onComplete,
  onCancel,
}: PerformanceReviewWizardProps) {
  const [currentSection, setCurrentSection] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const { addToast } = useToast();

  const [formData, setFormData] = useState({
    employee_id: "",
    period_type: "quarterly",
    period_start: "",
    period_end: "",
    strengths: "",
    strengths_examples: "",
    improvements: "",
    improvements_examples: "",
    fairness_constraints: "",
    fairness_support: "",
    fairness_outside_control: "",
    goals: "",
    goals_support_plan: "",
    follow_up_date: "",
    visibility: "visible_to_employee",
    private_notes: "",
  });

  const [aiOutcome, setAiOutcome] = useState<{
    category: string;
    reasons: string[];
    next_step: string;
  } | null>(null);

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear AI outcome if content changes
    if (["strengths", "improvements", "fairness_constraints"].includes(field)) {
      setAiOutcome(null);
    }
  };

  const canProceed = () => {
    const section = SECTIONS[currentSection];
    
    if (section.id === "context") {
      return formData.employee_id && formData.period_start && formData.period_end;
    }
    
    if (section.id === "outcome") {
      return aiOutcome !== null;
    }
    
    return true;
  };

  const handleNext = async () => {
    if (currentSection === SECTIONS.length - 2) {
      // Before going to outcome section, save draft and generate AI outcome
      await saveDraftAndGenerateOutcome();
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

  const saveDraftAndGenerateOutcome = async () => {
    try {
      setIsGenerating(true);

      // Save draft
      const res = await fetch("/api/people/performance/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          status: "draft",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save review");
      }

      const { review } = await res.json();

      // Generate AI outcome
      const outcomeRes = await fetch(
        `/api/people/performance/reviews/${review.id}/generate-outcome`,
        { method: "POST" }
      );

      if (!outcomeRes.ok) {
        throw new Error("Failed to generate AI outcome");
      }

      const { outcome } = await outcomeRes.json();
      setAiOutcome(outcome);
      addToast("success", "AI outcome generated successfully");
    } catch (error) {
      console.error("Error:", error);
      addToast("error", "Failed to generate AI outcome");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleComplete = async () => {
    try {
      // Final save with completed status
      const res = await fetch("/api/people/performance/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          status: "completed",
        }),
      });

      if (res.ok) {
        addToast("success", "Performance review completed");
        onComplete();
      } else {
        throw new Error("Failed to complete review");
      }
    } catch (error) {
      console.error("Error:", error);
      addToast("error", "Failed to complete review");
    }
  };

  const renderSection = () => {
    const section = SECTIONS[currentSection];

    switch (section.id) {
      case "context":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-2">Employee</label>
              <GlassSelect
                value={formData.employee_id}
                onChange={(e) => updateField("employee_id", e.target.value)}
              >
                <option value="">Select employee</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.person_name}
                  </option>
                ))}
              </GlassSelect>
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-2">Period Type</label>
              <GlassSelect
                value={formData.period_type}
                onChange={(e) => updateField("period_type", e.target.value)}
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
                <option value="probation">Probation</option>
                <option value="project">Project</option>
                <option value="other">Other</option>
              </GlassSelect>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white/60 mb-2">
                  Period Start
                </label>
                <GlassInput
                  type="date"
                  value={formData.period_start}
                  onChange={(e) => updateField("period_start", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">
                  Period End
                </label>
                <GlassInput
                  type="date"
                  value={formData.period_end}
                  onChange={(e) => updateField("period_end", e.target.value)}
                />
              </div>
            </div>
          </div>
        );

      case "strengths":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-2">
                What did this person do well?
              </label>
              <GlassTextArea
                value={formData.strengths}
                onChange={(e) => updateField("strengths", e.target.value)}
                rows={4}
                placeholder="Focus on specific outcomes and behaviors..."
              />
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-2">
                Examples
              </label>
              <GlassTextArea
                value={formData.strengths_examples}
                onChange={(e) => updateField("strengths_examples", e.target.value)}
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
              <label className="block text-sm text-white/60 mb-2">
                What could be improved?
              </label>
              <GlassTextArea
                value={formData.improvements}
                onChange={(e) => updateField("improvements", e.target.value)}
                rows={4}
                placeholder="Describe impact and frequency neutrally..."
              />
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-2">
                Examples
              </label>
              <GlassTextArea
                value={formData.improvements_examples}
                onChange={(e) => updateField("improvements_examples", e.target.value)}
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
              <label className="block text-sm text-white/60 mb-2">
                Were there any constraints?
              </label>
              <GlassTextArea
                value={formData.fairness_constraints}
                onChange={(e) => updateField("fairness_constraints", e.target.value)}
                rows={2}
                placeholder="Budget limits, resource availability, organizational changes..."
              />
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-2">
                What support was provided?
              </label>
              <GlassTextArea
                value={formData.fairness_support}
                onChange={(e) => updateField("fairness_support", e.target.value)}
                rows={2}
                placeholder="Training, mentorship, tools..."
              />
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-2">
                External factors?
              </label>
              <GlassTextArea
                value={formData.fairness_outside_control}
                onChange={(e) =>
                  updateField("fairness_outside_control", e.target.value)
                }
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
              <label className="block text-sm text-white/60 mb-2">
                Goals for next period (1-3 goals)
              </label>
              <GlassTextArea
                value={formData.goals}
                onChange={(e) => updateField("goals", e.target.value)}
                rows={4}
                placeholder="Specific, measurable goals..."
              />
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-2">
                Support plan
              </label>
              <GlassTextArea
                value={formData.goals_support_plan}
                onChange={(e) => updateField("goals_support_plan", e.target.value)}
                rows={3}
                placeholder="How will you support achieving these goals?"
              />
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-2">
                Follow-up date
              </label>
              <GlassInput
                type="date"
                value={formData.follow_up_date}
                onChange={(e) => updateField("follow_up_date", e.target.value)}
              />
            </div>
          </div>
        );

      case "visibility":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-2">
                Visibility
              </label>
              <GlassSelect
                value={formData.visibility}
                onChange={(e) => updateField("visibility", e.target.value)}
              >
                <option value="visible_to_employee">Visible to Employee</option>
                <option value="manager_only">Manager Only</option>
                <option value="hr_only">HR Only</option>
              </GlassSelect>
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-2">
                Private notes (not visible to employee)
              </label>
              <GlassTextArea
                value={formData.private_notes}
                onChange={(e) => updateField("private_notes", e.target.value)}
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
                <Sparkles className="w-12 h-12 mx-auto mb-4 animate-pulse text-blue-400" />
                <p className="text-white/60">Generating AI outcome...</p>
              </div>
            ) : aiOutcome ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span className="text-sm text-amber-400">
                    AI outcome is locked (will regenerate if text changes)
                  </span>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-2">
                    Performance Category
                  </label>
                  <GlassBadge
                    variant={
                      aiOutcome.category === "outstanding_contribution"
                        ? "success"
                        : aiOutcome.category === "critical_concerns"
                        ? "danger"
                        : "info"
                    }
                  >
                    {aiOutcome.category.replace(/_/g, " ").toUpperCase()}
                  </GlassBadge>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-2">
                    Key Reasons
                  </label>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {aiOutcome.reasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-2">
                    Suggested Next Step
                  </label>
                  <p className="text-sm">{aiOutcome.next_step}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-white/60">
                Click "Generate" to analyze this review with AI
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const section = SECTIONS[currentSection];

  return (
    <GlassCard className="max-w-3xl mx-auto">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-white/60 mb-2">
          <span>
            Step {currentSection + 1} of {SECTIONS.length}
          </span>
          <span>{section.title}</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{
              width: `${((currentSection + 1) / SECTIONS.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Section Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">{section.title}</h2>
        <p className="text-white/60">{section.guidance}</p>
      </div>

      {/* Section Content */}
      <div className="mb-8">{renderSection()}</div>

      {/* Navigation */}
      <div className="flex justify-between">
        <GlassButton onClick={onCancel} variant="ghost">
          Cancel
        </GlassButton>

        <div className="flex gap-2">
          {currentSection > 0 && (
            <GlassButton onClick={handleBack} variant="secondary">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </GlassButton>
          )}

          {currentSection < SECTIONS.length - 1 ? (
            <GlassButton
              onClick={handleNext}
              variant="primary"
              disabled={!canProceed() || isGenerating}
            >
              {section.id === "visibility" ? "Generate Outcome" : "Next"}
              <ChevronRight className="w-4 h-4 ml-2" />
            </GlassButton>
          ) : (
            <GlassButton
              onClick={handleComplete}
              variant="primary"
              disabled={!canProceed()}
            >
              Complete Review
            </GlassButton>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
