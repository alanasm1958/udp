"use client";

import { useState, useEffect } from "react";
import {
  GlassInput,
  GlassSelect,
  GlassTextarea,
  GlassButton,
  useToast,
} from "@/components/ui/glass";
import { ArrowLeft, Info } from "lucide-react";

interface PerformanceReviewFormProps {
  onBack: () => void;
  onSuccess: () => void;
}

interface Person {
  id: string;
  fullName: string;
}

export default function PerformanceReviewForm({ onBack, onSuccess }: PerformanceReviewFormProps) {
  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [persons, setPersons] = useState<Person[]>([]);
  const [isLoadingPersons, setIsLoadingPersons] = useState(true);

  const [formData, setFormData] = useState({
    person_id: "",
    review_period_start: "",
    review_period_end: "",
    review_date: new Date().toISOString().split("T")[0],
    strengths: "",
    areas_for_improvement: "",
    goals_set: "",
    overall_rating: "",
    reviewer_comments: "",
    employee_comments: "",
    private_notes: "",
  });

  useEffect(() => {
    loadPersons();
    // Set default period (last quarter)
    const now = new Date();
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 - 3, 1);
    const quarterEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 0);

    setFormData(prev => ({
      ...prev,
      review_period_start: quarterStart.toISOString().split("T")[0],
      review_period_end: quarterEnd.toISOString().split("T")[0],
    }));
  }, []);

  const loadPersons = async () => {
    try {
      setIsLoadingPersons(true);
      const res = await fetch("/api/hr-people/persons?status=active");
      if (res.ok) {
        const data = await res.json();
        setPersons(data.persons || []);
      }
    } catch (error) {
      console.error("Error loading persons:", error);
    } finally {
      setIsLoadingPersons(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      // Validation
      if (!formData.person_id) {
        addToast("error", "Please select a person");
        return;
      }
      if (!formData.review_period_start || !formData.review_period_end) {
        addToast("error", "Review period is required");
        return;
      }

      const res = await fetch("/api/hr-people/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        addToast("success", "Performance review created successfully");
        onSuccess();
      } else {
        const error = await res.json();
        addToast("error", error.message || "Failed to create performance review");
      }
    } catch (error) {
      console.error("Error creating performance review:", error);
      addToast("error", "Failed to create performance review");
    } finally {
      setIsSubmitting(false);
    }
  };

  const InfoTooltip = ({ text }: { text: string }) => (
    <div className="group relative inline-block ml-2">
      <Info className="w-4 h-4 text-white/40 cursor-help" />
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-64">
        <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl border border-white/10">
          {text}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
            <div className="border-4 border-transparent border-t-gray-900" />
          </div>
        </div>
      </div>
    </div>
  );

  const personOptions = [
    { value: "", label: "Select a person..." },
    ...persons.map((p) => ({ value: p.id, label: p.fullName })),
  ];

  const ratingOptions = [
    { value: "", label: "Select rating..." },
    { value: "5", label: "5 - Exceptional" },
    { value: "4", label: "4 - Exceeds Expectations" },
    { value: "3", label: "3 - Meets Expectations" },
    { value: "2", label: "2 - Needs Improvement" },
    { value: "1", label: "1 - Unsatisfactory" },
  ];

  return (
    <div className="space-y-8">
      {/* Back Button */}
      <GlassButton onClick={onBack} variant="ghost" size="sm">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to menu
      </GlassButton>

      {/* Explanation */}
      <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
        <p className="text-sm text-purple-200">
          <strong>How dual acceptance works:</strong> Performance reviews start as drafts.
          Both the reviewer and the employee must accept the review for it to be locked.
          Until both accept, the review can still be edited.
        </p>
      </div>

      {/* Employee Selection */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Employee
          <InfoTooltip text="Select the person being reviewed" />
        </h3>

        <GlassSelect
          label="Person *"
          options={personOptions}
          value={formData.person_id}
          onChange={(e) => updateField("person_id", e.target.value)}
          disabled={isLoadingPersons}
        />
      </div>

      {/* Review Period */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Review Period
          <InfoTooltip text="The time period this review covers" />
        </h3>

        <div className="grid grid-cols-3 gap-4">
          <GlassInput
            label="Period Start *"
            type="date"
            value={formData.review_period_start}
            onChange={(e) => updateField("review_period_start", e.target.value)}
          />
          <GlassInput
            label="Period End *"
            type="date"
            value={formData.review_period_end}
            onChange={(e) => updateField("review_period_end", e.target.value)}
          />
          <GlassInput
            label="Review Date"
            type="date"
            value={formData.review_date}
            onChange={(e) => updateField("review_date", e.target.value)}
          />
        </div>
      </div>

      {/* Performance Assessment */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Performance Assessment
          <InfoTooltip text="Detailed assessment of the employee's performance" />
        </h3>

        <div className="flex items-center mb-2">
          <span className="block text-sm text-white/60">Strengths</span>
          <InfoTooltip text="What did they do well? What are their key strengths?" />
        </div>
        <GlassTextarea
          value={formData.strengths}
          onChange={(e) => updateField("strengths", e.target.value)}
          rows={4}
          placeholder="List their key strengths and accomplishments..."
        />

        <div className="flex items-center mb-2">
          <span className="block text-sm text-white/60">Areas for Improvement</span>
          <InfoTooltip text="Where can they grow? What skills should they develop?" />
        </div>
        <GlassTextarea
          value={formData.areas_for_improvement}
          onChange={(e) => updateField("areas_for_improvement", e.target.value)}
          rows={4}
          placeholder="Areas where they can improve..."
        />

        <div className="flex items-center mb-2">
          <span className="block text-sm text-white/60">Goals for Next Period</span>
          <InfoTooltip text="Specific, measurable goals for the next review period" />
        </div>
        <GlassTextarea
          value={formData.goals_set}
          onChange={(e) => updateField("goals_set", e.target.value)}
          rows={4}
          placeholder="Goals and objectives for the next period..."
        />

        <GlassSelect
          label="Overall Rating"
          options={ratingOptions}
          value={formData.overall_rating}
          onChange={(e) => updateField("overall_rating", e.target.value)}
        />
      </div>

      {/* Comments */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Comments
          <InfoTooltip text="Additional comments from reviewer and employee" />
        </h3>

        <div className="flex items-center mb-2">
          <span className="block text-sm text-white/60">Reviewer Comments</span>
          <InfoTooltip text="Your overall thoughts and feedback as the reviewer" />
        </div>
        <GlassTextarea
          value={formData.reviewer_comments}
          onChange={(e) => updateField("reviewer_comments", e.target.value)}
          rows={3}
          placeholder="Your comments as the reviewer..."
        />

        <div className="flex items-center mb-2">
          <span className="block text-sm text-white/60">Employee Comments (Optional)</span>
          <InfoTooltip text="Space for the employee to add their own comments" />
        </div>
        <GlassTextarea
          value={formData.employee_comments}
          onChange={(e) => updateField("employee_comments", e.target.value)}
          rows={3}
          placeholder="Employee can add their comments later..."
        />

        <div className="flex items-center mb-2">
          <span className="block text-sm text-white/60">Private Notes</span>
          <InfoTooltip text="Notes visible only to HR/management, not the employee" />
        </div>
        <GlassTextarea
          value={formData.private_notes}
          onChange={(e) => updateField("private_notes", e.target.value)}
          rows={3}
          placeholder="Private notes (not visible to the employee)..."
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-6 border-t border-white/10">
        <GlassButton onClick={onBack} variant="ghost">
          Cancel
        </GlassButton>
        <GlassButton
          onClick={handleSubmit}
          variant="primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating..." : "Create Review"}
        </GlassButton>
      </div>
    </div>
  );
}
