"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  GlassCard,
  PageHeader,
  GlassBadge,
  GlassButton,
  GlassSelect,
  Skeleton,
  ErrorAlert,
  Spinner,
} from "@/components/ui/glass";
import { apiGet, formatCurrency, formatDateTime } from "@/lib/http";

/* ────────────────────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────────────────────── */

interface KPI {
  value: number;
  label: string;
  route: string;
  delta?: number;
  deltaPercent?: number;
  overdueCount?: number;
  dueSoonCount?: number;
  lowStockCount?: number;
}

interface ActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorName: string | null;
  actorType: string | null;
  occurredAt: string;
  metadata: Record<string, unknown>;
}

interface DashboardData {
  asOfDate: string;
  dateRange: {
    range: string;
    from: string;
    to: string;
  };
  kpis: {
    cashToday: KPI;
    openAR: KPI;
    openAP: KPI;
    salesMTD: KPI;
    inventory: KPI;
  };
  periodStats: {
    receipts: number;
    payments: number;
    netCashFlow: number;
  };
  stats: {
    openAR: number;
    openAP: number;
    receipts7d: number;
    payments7d: number;
    inventoryOnHand: number;
  };
  recentActivity: ActivityItem[];
}

interface Alert {
  id: string;
  type: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  domain: string;
  createdAt: string;
  metadata: Record<string, unknown>;
  actions: {
    plannerUrl?: string;
    createTask?: boolean;
    createCard?: boolean;
  };
}

interface AlertsResponse {
  items: Alert[];
  total: number;
  generatedAt: string;
}

interface AICard {
  id: string;
  type: "metric_snapshot" | "task_suggestion" | "document_summary" | "recommendation";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  domain: string;
  actions: Array<{ label: string; type: string; href?: string }>;
}

interface CardsResponse {
  items: AICard[];
  total: number;
}

/* ────────────────────────────────────────────────────────────────────────────
   Constants
   ──────────────────────────────────────────────────────────────────────────── */

const DATE_RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "mtd", label: "Month to Date" },
  { value: "ytd", label: "Year to Date" },
];

const severityColors = {
  high: "danger",
  medium: "warning",
  low: "info",
} as const;

const priorityColors = {
  high: "danger",
  medium: "warning",
  low: "info",
} as const;

/* ────────────────────────────────────────────────────────────────────────────
   Helper Components
   ──────────────────────────────────────────────────────────────────────────── */

function KPITile({
  kpi,
  isCurrency = true,
  showDelta = false,
}: {
  kpi: KPI;
  isCurrency?: boolean;
  showDelta?: boolean;
}) {
  const value = isCurrency ? formatCurrency(kpi.value) : Math.round(kpi.value).toLocaleString();
  const deltaValue = kpi.delta !== undefined ? kpi.delta : 0;
  const deltaPercent = kpi.deltaPercent !== undefined ? kpi.deltaPercent : 0;

  // Determine secondary info
  let secondaryText: string | null = null;
  if (showDelta && kpi.delta !== undefined) {
    const sign = deltaValue >= 0 ? "+" : "";
    secondaryText = `${sign}${formatCurrency(deltaValue)} (${sign}${deltaPercent}%)`;
  } else if (kpi.overdueCount !== undefined && kpi.overdueCount > 0) {
    secondaryText = `${kpi.overdueCount} overdue`;
  } else if (kpi.dueSoonCount !== undefined && kpi.dueSoonCount > 0) {
    secondaryText = `${kpi.dueSoonCount} due in 7d`;
  } else if (kpi.lowStockCount !== undefined && kpi.lowStockCount > 0) {
    secondaryText = `${kpi.lowStockCount} out of stock`;
  }

  return (
    <Link href={kpi.route} className="block">
      <div className="bg-white/8 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 hover:bg-white/12 hover:border-white/20 transition-all cursor-pointer">
        <span className="text-xs font-medium text-white/50 uppercase tracking-wide">
          {kpi.label}
        </span>
        <div className="text-xl font-semibold tabular-nums text-white mt-1">{value}</div>
        {secondaryText && (
          <div
            className={`text-xs mt-1 ${
              deltaValue >= 0 || kpi.overdueCount === undefined
                ? kpi.lowStockCount
                  ? "text-amber-400"
                  : kpi.overdueCount
                  ? "text-red-400"
                  : kpi.dueSoonCount
                  ? "text-amber-400"
                  : deltaValue >= 0
                  ? "text-emerald-400"
                  : "text-red-400"
                : "text-red-400"
            }`}
          >
            {secondaryText}
          </div>
        )}
      </div>
    </Link>
  );
}

function SkeletonKPITiles({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white/8 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3"
        >
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-6 w-28 mb-1" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

function getEntityRoute(entityType: string, entityId: string): string | null {
  const routes: Record<string, string> = {
    payment: `/finance/payments/${entityId}`,
    sales_doc: `/sales?id=${entityId}`,
    purchase_doc: `/procurement?id=${entityId}`,
    party: `/customers/accounts?id=${entityId}`,
    product: `/inventory/products/${entityId}`,
    warehouse: `/inventory/warehouses/${entityId}`,
    inventory_movement: `/inventory/balances`,
    inventory_balance: `/inventory/balances`,
    user: `/settings/users`,
    journal_entry: `/finance/general-ledger`,
    task: `/operations/planner`,
    alert: `/grc/alerts`,
  };
  return routes[entityType] || null;
}

/* ────────────────────────────────────────────────────────────────────────────
   Main Component
   ──────────────────────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rangeParam = searchParams.get("range") || "7d";

  const [data, setData] = React.useState<DashboardData | null>(null);
  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  const [cards, setCards] = React.useState<AICard[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [range, setRange] = React.useState(rangeParam);

  // Load dashboard data
  const loadData = React.useCallback(async (selectedRange: string) => {
    setLoading(true);
    setError(null);
    try {
      const [dashboardResult, alertsResult, cardsResult] = await Promise.all([
        apiGet<DashboardData>(`/api/reports/dashboard?range=${selectedRange}`),
        apiGet<AlertsResponse>("/api/grc/alerts"),
        apiGet<CardsResponse>("/api/ai/cards"),
      ]);
      setData(dashboardResult);
      setAlerts(alertsResult.items?.slice(0, 5) || []);
      setCards(cardsResult.items?.slice(0, 3) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData(range);
  }, [range, loadData]);

  // Handle range change with URL sync
  const handleRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRange = e.target.value;
    setRange(newRange);
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", newRange);
    router.push(`/dashboard?${params.toString()}`, { scroll: false });
  };

  // Sync range from URL on mount
  React.useEffect(() => {
    if (rangeParam !== range) {
      setRange(rangeParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeParam]);

  // Format "as of" date
  const asOfText = data?.asOfDate
    ? `As of ${formatDateTime(data.asOfDate)}`
    : "";

  return (
    <div className="space-y-6">
      {/* Header with Date Range Selector */}
      <PageHeader
        title="Dashboard"
        description="Overview of your business"
        actions={
          <div className="flex items-center gap-3">
            {asOfText && (
              <span className="text-xs text-white/40">{asOfText}</span>
            )}
            <GlassSelect
              options={DATE_RANGE_OPTIONS}
              value={range}
              onChange={handleRangeChange}
              className="w-40"
            />
          </div>
        }
      />

      {/* Error State */}
      {error && (
        <ErrorAlert
          message={error}
          onDismiss={() => {
            setError(null);
            loadData(range);
          }}
        />
      )}

      {/* KPI Tiles */}
      {loading ? (
        <SkeletonKPITiles count={5} />
      ) : data ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <KPITile kpi={data.kpis.cashToday} showDelta />
          <KPITile kpi={data.kpis.openAR} />
          <KPITile kpi={data.kpis.openAP} />
          <KPITile kpi={data.kpis.salesMTD} />
          <KPITile kpi={data.kpis.inventory} isCurrency={false} />
        </div>
      ) : null}

      {/* Alerts Preview */}
      {!loading && (
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <svg
                className="w-5 h-5 text-amber-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
              Needs Attention
            </h2>
            <Link
              href="/grc/alerts"
              className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
            >
              View All
            </Link>
          </div>
          {alerts.length > 0 ? (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 rounded-xl bg-white/5 hover:bg-white/8 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <GlassBadge variant={severityColors[alert.severity]}>
                          {alert.severity}
                        </GlassBadge>
                        <span className="text-xs text-white/40 capitalize">
                          {alert.domain}
                        </span>
                      </div>
                      <h4 className="font-medium text-white text-sm truncate">
                        {alert.title}
                      </h4>
                      <p className="text-xs text-white/50 mt-0.5 line-clamp-1">
                        {alert.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {alert.actions.plannerUrl && (
                        <Link href={alert.actions.plannerUrl}>
                          <GlassButton size="sm" variant="ghost">
                            View
                          </GlassButton>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 py-4 px-2 text-white/50">
              <svg
                className="w-5 h-5 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-sm">No issues detected</span>
            </div>
          )}
        </GlassCard>
      )}

      {/* Quick Actions */}
      <GlassCard padding="sm">
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          <span className="text-xs text-white/50 font-medium uppercase tracking-wide px-2 flex-shrink-0">
            Quick Actions
          </span>
          <div className="flex items-center gap-2">
            <Link href="/sales?create=invoice">
              <GlassButton size="sm" variant="ghost">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Sales Invoice
              </GlassButton>
            </Link>
            <Link href="/procurement?create=invoice">
              <GlassButton size="sm" variant="ghost">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Purchase Invoice
              </GlassButton>
            </Link>
            <Link href="/finance/payments?create=true">
              <GlassButton size="sm" variant="ghost">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                </svg>
                Payment
              </GlassButton>
            </Link>
            <Link href="/inventory/balances">
              <GlassButton size="sm" variant="ghost">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
                View Inventory
              </GlassButton>
            </Link>
            <Link href="/finance/trial-balance">
              <GlassButton size="sm" variant="ghost">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
                Trial Balance
              </GlassButton>
            </Link>
          </div>
        </div>
      </GlassCard>

      {/* AI Insights */}
      {!loading && cards.length > 0 && (
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <svg
                className="w-5 h-5 text-purple-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                />
              </svg>
              AI Insights
            </h2>
            <Link
              href="/dashboard/cards"
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              View All Cards
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {cards.map((card) => (
              <div
                key={card.id}
                className="p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/40 capitalize">{card.domain}</span>
                  <GlassBadge variant={priorityColors[card.priority]}>
                    {card.priority}
                  </GlassBadge>
                </div>
                <h3 className="font-medium text-white mb-1">{card.title}</h3>
                <p className="text-sm text-white/50 line-clamp-2">{card.description}</p>
                {card.actions[0]?.href && (
                  <Link
                    href={card.actions[0].href}
                    className="mt-3 inline-block text-xs text-purple-400 hover:text-purple-300"
                  >
                    {card.actions[0].label} &rarr;
                  </Link>
                )}
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Recent Activity */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
          <Link
            href="/grc/audit"
            className="text-sm text-white/50 hover:text-white/70 transition-colors"
          >
            View All
          </Link>
        </div>
        <div className="space-y-2">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-2 h-2 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          ) : data?.recentActivity && data.recentActivity.length > 0 ? (
            data.recentActivity.map((event) => {
              const entityRoute = getEntityRoute(event.entityType, event.entityId);
              return (
                <div
                  key={event.id}
                  className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        event.action.includes("create") || event.action.includes("post")
                          ? "bg-emerald-400"
                          : event.action.includes("delete") || event.action.includes("void")
                          ? "bg-red-400"
                          : "bg-blue-400"
                      }`}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white/90">{formatAction(event.action)}</span>
                        {entityRoute ? (
                          <Link
                            href={entityRoute}
                            className="text-sm text-blue-400 hover:text-blue-300 hover:underline"
                          >
                            {event.entityType.replace(/_/g, " ")}
                          </Link>
                        ) : (
                          <span className="text-sm text-white/50">
                            {event.entityType.replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                      {event.actorName && (
                        <span className="text-xs text-white/40">by {event.actorName}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-white/40">{formatDateTime(event.occurredAt)}</span>
                </div>
              );
            })
          ) : (
            <p className="text-white/40 text-sm">No recent activity</p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

function formatAction(action: string): string {
  return action
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
