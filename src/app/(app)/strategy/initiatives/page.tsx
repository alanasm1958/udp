"use client";

import * as React from "react";
import { GlassCard, PageHeader, GlassBadge } from "@/components/ui/glass";

// Placeholder initiatives - will be replaced with real data
const mockInitiatives = [
  {
    id: "1",
    title: "Digital Transformation Phase 1",
    status: "in_progress",
    progress: 65,
    dueDate: "2025-03-31",
    owner: "Operations Team",
  },
  {
    id: "2",
    title: "Market Expansion - New Region",
    status: "planning",
    progress: 20,
    dueDate: "2025-06-30",
    owner: "Sales Team",
  },
  {
    id: "3",
    title: "Cost Optimization Program",
    status: "completed",
    progress: 100,
    dueDate: "2024-12-31",
    owner: "Finance Team",
  },
];

const statusColors = {
  planning: "info",
  in_progress: "warning",
  completed: "success",
  on_hold: "default",
} as const;

export default function InitiativesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Strategic Initiatives"
        description="Key projects and strategic milestones"
        actions={
          <button className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">
            + New Initiative
          </button>
        }
      />

      <div className="space-y-4">
        {mockInitiatives.map((initiative) => (
          <GlassCard key={initiative.id} className="hover:bg-white/5 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-white mb-1">{initiative.title}</h3>
                <p className="text-sm text-white/50">Owner: {initiative.owner}</p>
              </div>
              <div className="flex items-center gap-2">
                <GlassBadge variant={statusColors[initiative.status as keyof typeof statusColors]}>
                  {initiative.status.replace("_", " ")}
                </GlassBadge>
                <span className="text-xs text-white/40">Due: {initiative.dueDate}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Progress</span>
                <span className="text-white">{initiative.progress}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    initiative.progress === 100
                      ? "bg-emerald-500"
                      : initiative.progress > 50
                      ? "bg-blue-500"
                      : "bg-amber-500"
                  }`}
                  style={{ width: `${initiative.progress}%` }}
                />
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
