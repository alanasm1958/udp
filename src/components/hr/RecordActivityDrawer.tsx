"use client";

import { useState } from "react";
import { SlideOver, GlassCard } from "@/components/ui/glass";
import { Users, DollarSign, Award } from "lucide-react";
import AddPersonForm from "@/components/hr/AddPersonForm";
import PayrollWizard from "@/components/hr/PayrollWizard";
import PerformanceReviewForm from "@/components/hr/PerformanceReviewForm";

interface RecordActivityDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RecordActivityDrawer({
  open,
  onClose,
  onSuccess,
}: RecordActivityDrawerProps) {
  const [activeView, setActiveView] = useState<"menu" | "add-person" | "payroll" | "performance">("menu");

  const handleSuccess = () => {
    setActiveView("menu");
    onSuccess();
  };

  const handleBack = () => {
    setActiveView("menu");
  };

  const handleClose = () => {
    setActiveView("menu");
    onClose();
  };

  const renderContent = () => {
    switch (activeView) {
      case "add-person":
        return <AddPersonForm onBack={handleBack} onSuccess={handleSuccess} />;

      case "payroll":
        return <PayrollWizard onBack={handleBack} onSuccess={handleSuccess} />;

      case "performance":
        return <PerformanceReviewForm onBack={handleBack} onSuccess={handleSuccess} />;

      case "menu":
      default:
        return (
          <div className="space-y-4">
            <p className="text-white/60 mb-6">
              Select what you&apos;d like to record. This is the only place where you can add new HR & People entries.
            </p>

            {/* Add Person Card */}
            <GlassCard
              className="p-6 cursor-pointer hover:bg-white/5 transition-all"
              onClick={() => setActiveView("add-person")}
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <Users className="w-6 h-6 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">Add Person</h3>
                  <p className="text-sm text-white/60">
                    Add a new person to your organization. This includes employees,
                    interns, contractors, and part-time workers. You can also create
                    a platform account for them to access the system.
                  </p>
                  <p className="text-xs text-white/40 mt-2 italic">
                    Tip: Fill in what you know now - you can always update later!
                  </p>
                </div>
              </div>
            </GlassCard>

            {/* Run Payroll Card */}
            <GlassCard
              className="p-6 cursor-pointer hover:bg-white/5 transition-all"
              onClick={() => setActiveView("payroll")}
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <DollarSign className="w-6 h-6 text-green-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">Run Payroll</h3>
                  <p className="text-sm text-white/60">
                    Process payroll for your team. Select the type of employees, set
                    the period, and the system will preload their information. You can
                    review, make changes, and have AI analyze for compliance before
                    confirming.
                  </p>
                  <p className="text-xs text-white/40 mt-2 italic">
                    Tip: Each column has an info icon explaining what it means!
                  </p>
                </div>
              </div>
            </GlassCard>

            {/* Create Performance Review Card */}
            <GlassCard
              className="p-6 cursor-pointer hover:bg-white/5 transition-all"
              onClick={() => setActiveView("performance")}
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-purple-500/10">
                  <Award className="w-6 h-6 text-purple-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">
                    Create Performance Review
                  </h3>
                  <p className="text-sm text-white/60">
                    Create a new performance review for a team member. Document their
                    strengths, areas for improvement, and set goals for the next
                    period. Reviews are locked only when both you and the employee accept them.
                  </p>
                  <p className="text-xs text-white/40 mt-2 italic">
                    Tip: Be honest and fair - context matters!
                  </p>
                </div>
              </div>
            </GlassCard>
          </div>
        );
    }
  };

  const getTitle = () => {
    switch (activeView) {
      case "add-person":
        return "Add New Person";
      case "payroll":
        return "Run Payroll";
      case "performance":
        return "Create Performance Review";
      default:
        return "Record HR & People Activity";
    }
  };

  return (
    <SlideOver
      open={open}
      onClose={handleClose}
      title={getTitle()}
      width={activeView === "menu" ? "md" : "lg"}
    >
      {renderContent()}
    </SlideOver>
  );
}
