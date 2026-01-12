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

function CompanyPageContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = React.useState("overview");

  React.useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && tabs.some((t) => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company"
        description="Organization profile, settings, and configuration"
      />

      <GlassTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link href="/company/organization">
            <GlassCard className="hover:bg-white/10 transition-colors cursor-pointer h-full">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-blue-500/20">
                  <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-white">Organization</h3>
                  <p className="text-sm text-white/50 mt-1">Company profile, legal info, and structure</p>
                </div>
              </div>
            </GlassCard>
          </Link>

          <Link href="/company/master">
            <GlassCard className="hover:bg-white/10 transition-colors cursor-pointer h-full">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-purple-500/20">
                  <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-white">Master Data</h3>
                  <p className="text-sm text-white/50 mt-1">Products, parties, and reference data</p>
                </div>
              </div>
            </GlassCard>
          </Link>

          <Link href="/settings">
            <GlassCard className="hover:bg-white/10 transition-colors cursor-pointer h-full">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-emerald-500/20">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-white">Settings</h3>
                  <p className="text-sm text-white/50 mt-1">Tenant configuration and preferences</p>
                </div>
              </div>
            </GlassCard>
          </Link>

          <Link href="/settings/billing">
            <GlassCard className="hover:bg-white/10 transition-colors cursor-pointer h-full">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-amber-500/20">
                  <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-white">Billing</h3>
                  <p className="text-sm text-white/50 mt-1">Subscription and payment settings</p>
                </div>
              </div>
            </GlassCard>
          </Link>
        </div>
      )}

      {activeTab === "planner" && (
        <Planner domain="company" domainLabel="Company" />
      )}
    </div>
  );
}

export default function CompanyPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>}>
      <CompanyPageContent />
    </Suspense>
  );
}
