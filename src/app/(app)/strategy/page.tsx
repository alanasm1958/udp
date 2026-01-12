"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GlassCard, PageHeader, GlassTabs, Spinner } from "@/components/ui/glass";
import { Planner } from "@/components/ai/Planner";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "planner", label: "Planner" },
];

function StrategyPageContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = React.useState("overview");

  // Handle tab query param (e.g., ?tab=planner)
  React.useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && tabs.some((t) => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Strategy"
        description="Strategic planning, initiatives, and growth execution"
      />

      <GlassTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link href="/strategy/initiatives">
            <GlassCard className="hover:bg-white/10 transition-colors cursor-pointer h-full">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-purple-500/20">
                  <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-white">Initiatives</h3>
                  <p className="text-sm text-white/50 mt-1">Strategic projects and milestones</p>
                </div>
              </div>
            </GlassCard>
          </Link>

          <Link href="/dashboard">
            <GlassCard className="hover:bg-white/10 transition-colors cursor-pointer h-full">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-blue-500/20">
                  <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-white">KPIs & Metrics</h3>
                  <p className="text-sm text-white/50 mt-1">Key performance indicators</p>
                </div>
              </div>
            </GlassCard>
          </Link>

          <GlassCard className="border border-dashed border-white/20">
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                </svg>
              </div>
              <h3 className="font-semibold text-white mb-1">Growth Playbooks</h3>
              <p className="text-sm text-white/40">
                Repeatable growth strategies (coming soon)
              </p>
            </div>
          </GlassCard>
        </div>
      )}

      {activeTab === "planner" && (
        <Planner domain="strategy" domainLabel="Strategy" />
      )}
    </div>
  );
}

export default function StrategyPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>}>
      <StrategyPageContent />
    </Suspense>
  );
}
