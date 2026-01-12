"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PageHeader, GlassTabs, Spinner } from "@/components/ui/glass";
import { OverviewCards } from "./components/OverviewCards";
import { AITasksSection } from "./components/AITasksSection";
import { CustomersTab } from "./components/CustomersTab";
import { LeadsTab } from "./components/LeadsTab";
import { QuotesTab } from "./components/QuotesTab";
import { InvoicesTab } from "./components/InvoicesTab";
import { SalespersonsTab } from "./components/SalespersonsTab";
import { AITasksTab } from "./components/AITasksTab";

const tabs = [
  { id: "customers", label: "Customers" },
  { id: "leads", label: "Leads" },
  { id: "quotes", label: "Quotes" },
  { id: "invoices", label: "Invoices" },
  { id: "salespersons", label: "Salespersons" },
  { id: "ai-tasks", label: "AI Tasks" },
];

function SalesCustomersPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState("customers");
  const [cardsCollapsed, setCardsCollapsed] = React.useState(false);

  // Handle tab query param (e.g., ?tab=leads)
  React.useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && tabs.some((t) => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    // Update URL without full navigation
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tabId);
    router.replace(url.pathname + url.search, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales & Customers"
        description="Manage customers, leads, quotes, and invoices in one place"
        actions={
          <button
            onClick={() => setCardsCollapsed(!cardsCollapsed)}
            className="text-sm text-white/60 hover:text-white flex items-center gap-1"
          >
            <svg
              className={`w-4 h-4 transition-transform ${cardsCollapsed ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            {cardsCollapsed ? "Show Overview" : "Hide Overview"}
          </button>
        }
      />

      {/* Overview Cards - Collapsible */}
      {!cardsCollapsed && <OverviewCards />}

      {/* AI Tasks Section - Always visible on front page when not on AI Tasks tab */}
      {!cardsCollapsed && activeTab !== "ai-tasks" && (
        <AITasksSection onViewAll={() => handleTabChange("ai-tasks")} />
      )}

      {/* Tabs */}
      <GlassTabs tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Tab Content */}
      {activeTab === "customers" && <CustomersTab />}
      {activeTab === "leads" && <LeadsTab />}
      {activeTab === "quotes" && <QuotesTab />}
      {activeTab === "invoices" && <InvoicesTab />}
      {activeTab === "salespersons" && <SalespersonsTab />}
      {activeTab === "ai-tasks" && <AITasksTab />}
    </div>
  );
}

export default function SalesCustomersPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>}>
      <SalesCustomersPageContent />
    </Suspense>
  );
}
