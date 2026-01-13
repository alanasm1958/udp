"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { GlassCard, GlassButton, useToast } from "@/components/ui/glass";
import {
  Banknote,
  TrendingUp,
  TrendingDown,
  Clock,
  Receipt,
  FileText,
  CreditCard,
  BookOpen,
  PieChart,
  BarChart3,
  Scale,
  Calendar,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Wallet,
  Plus,
  Settings,
} from "lucide-react";
import RecordFinanceDrawer from "@/components/finance/RecordFinanceDrawer";

/* =============================================================================
   TYPES
   ============================================================================= */

interface CashMetrics {
  moneyInBank: number;
  bankTrend7d: number;
  bankTrend30d: number;
  cashRunwayMonths: number;
  avgMonthlyBurn: number;
  monthCashIn: number;
  monthCashOut: number;
  monthNetCashFlow: number;
}

interface OwedMetrics {
  totalAR: number;
  arCurrent: number;
  ar1to30: number;
  ar31to60: number;
  ar60plus: number;
  totalAP: number;
  apCurrent: number;
  ap1to30: number;
  ap31to60: number;
  ap60plus: number;
  netPosition: number;
}

interface PerformanceMetrics {
  monthSales: number;
  salesVsLastMonth: number;
  monthExpenses: number;
  expensesVsLastMonth: number;
  monthProfit: number;
  profitMargin: number;
}

interface FinanceAnalytics {
  cash: CashMetrics;
  owed: OwedMetrics;
  performance: PerformanceMetrics;
}

interface FinanceTodo {
  id: string;
  type: "urgent" | "important" | "routine";
  category: string;
  title: string;
  description: string;
  count?: number;
  amount?: number;
  dueDate?: string;
  action: string;
  actionRoute?: string;
}

interface FinanceAlert {
  id: string;
  severity: "critical" | "warning" | "info";
  type: string;
  message: string;
  impact?: string;
  actions?: string[];
  createdAt: string;
}

/* =============================================================================
   QUICK ACCESS CARDS
   ============================================================================= */

const QUICK_ACCESS_CARDS = [
  {
    id: "invoices",
    icon: FileText,
    title: "Invoices (Sales)",
    description: "View all sales invoices",
    href: "/finance/invoices",
    color: "text-blue-400",
  },
  {
    id: "bills",
    icon: Receipt,
    title: "Bills (Purchase)",
    description: "View vendor bills",
    href: "/finance/bills",
    color: "text-orange-400",
  },
  {
    id: "payments",
    icon: CreditCard,
    title: "Payments",
    description: "Receipts and disbursements",
    href: "/finance/payments",
    color: "text-green-400",
  },
  {
    id: "journals",
    icon: BookOpen,
    title: "Journal Entries",
    description: "All ledger entries",
    href: "/finance/journals",
    color: "text-purple-400",
  },
  {
    id: "coa",
    icon: PieChart,
    title: "Chart of Accounts",
    description: "Account structure",
    href: "/finance/coa",
    color: "text-cyan-400",
  },
  {
    id: "general-ledger",
    icon: BookOpen,
    title: "General Ledger",
    description: "Transaction history",
    href: "/finance/general-ledger",
    color: "text-indigo-400",
  },
  {
    id: "trial-balance",
    icon: Scale,
    title: "Trial Balance",
    description: "Account balances",
    href: "/finance/trial-balance",
    color: "text-pink-400",
  },
];

const REPORT_CARDS = [
  {
    id: "ar-aging",
    icon: Users,
    title: "AR Aging",
    description: "Receivables analysis",
    href: "/finance/ar-aging",
    color: "text-orange-400",
  },
  {
    id: "ap-aging",
    icon: Receipt,
    title: "AP Aging",
    description: "Payables analysis",
    href: "/finance/ap-aging",
    color: "text-red-400",
  },
];

/* =============================================================================
   ANALYTICS CARD COMPONENT
   ============================================================================= */

function AnalyticsCard({
  label,
  value,
  subtext,
  icon,
  trend,
  trendLabel,
  variant = "default",
  tooltip,
  onClick,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ReactNode;
  trend?: number;
  trendLabel?: string;
  variant?: "default" | "success" | "warning" | "danger";
  tooltip?: string;
  onClick?: () => void;
}) {
  const getVariantClasses = () => {
    switch (variant) {
      case "success":
        return "border-green-500/30 bg-green-500/5";
      case "warning":
        return "border-yellow-500/30 bg-yellow-500/5";
      case "danger":
        return "border-red-500/30 bg-red-500/5";
      default:
        return "border-white/10 bg-white/5";
    }
  };

  const getValueColor = () => {
    switch (variant) {
      case "success":
        return "text-green-400";
      case "warning":
        return "text-yellow-400";
      case "danger":
        return "text-red-400";
      default:
        return "text-white";
    }
  };

  return (
    <GlassCard
      className={`p-4 border ${getVariantClasses()} ${onClick ? "cursor-pointer hover:bg-white/10 transition-colors" : ""}`}
      onClick={onClick}
      title={tooltip}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white/60 truncate">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${getValueColor()}`}>{value}</p>
          {subtext && <p className="text-xs text-white/40 mt-1">{subtext}</p>}
          {trend !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              {trend >= 0 ? (
                <ArrowUpRight className="w-3 h-3 text-green-400" />
              ) : (
                <ArrowDownRight className="w-3 h-3 text-red-400" />
              )}
              <span className={`text-xs ${trend >= 0 ? "text-green-400" : "text-red-400"}`}>
                {Math.abs(trend).toFixed(1)}%
              </span>
              {trendLabel && <span className="text-xs text-white/40">{trendLabel}</span>}
            </div>
          )}
        </div>
        <div className={`p-2 rounded-lg bg-white/5 ${getValueColor()}`}>{icon}</div>
      </div>
    </GlassCard>
  );
}

/* =============================================================================
   AR/AP AGING BAR COMPONENT
   ============================================================================= */

function AgingBar({
  current,
  days1to30,
  days31to60,
  days60plus,
  total,
}: {
  current: number;
  days1to30: number;
  days31to60: number;
  days60plus: number;
  total: number;
}) {
  if (total === 0) return null;

  const currentPct = (current / total) * 100;
  const days1to30Pct = (days1to30 / total) * 100;
  const days31to60Pct = (days31to60 / total) * 100;
  const days60plusPct = (days60plus / total) * 100;

  return (
    <div className="mt-2">
      <div className="flex h-2 rounded-full overflow-hidden bg-white/10">
        {currentPct > 0 && (
          <div
            className="bg-green-500"
            style={{ width: `${currentPct}%` }}
            title={`Current: $${current.toLocaleString()}`}
          />
        )}
        {days1to30Pct > 0 && (
          <div
            className="bg-yellow-500"
            style={{ width: `${days1to30Pct}%` }}
            title={`1-30 days: $${days1to30.toLocaleString()}`}
          />
        )}
        {days31to60Pct > 0 && (
          <div
            className="bg-orange-500"
            style={{ width: `${days31to60Pct}%` }}
            title={`31-60 days: $${days31to60.toLocaleString()}`}
          />
        )}
        {days60plusPct > 0 && (
          <div
            className="bg-red-500"
            style={{ width: `${days60plusPct}%` }}
            title={`60+ days: $${days60plus.toLocaleString()}`}
          />
        )}
      </div>
      <div className="flex justify-between text-xs text-white/40 mt-1">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" /> Current
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-500" /> 1-30d
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-orange-500" /> 31-60d
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" /> 60+d
        </span>
      </div>
    </div>
  );
}

/* =============================================================================
   MAIN PAGE COMPONENT
   ============================================================================= */

export default function FinancePage() {
  const { addToast } = useToast();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [analytics, setAnalytics] = useState<FinanceAnalytics | null>(null);
  const [todos, setTodos] = useState<FinanceTodo[]>([]);
  const [alerts, setAlerts] = useState<FinanceAlert[]>([]);
  const [, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Load analytics
      const analyticsRes = await fetch("/api/finance/analytics/dashboard");
      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data.analytics);
      }

      // Load todos
      const todosRes = await fetch("/api/finance/todos?limit=10");
      if (todosRes.ok) {
        const data = await todosRes.json();
        setTodos(data.todos || []);
      }

      // Load alerts
      const alertsRes = await fetch("/api/finance/alerts?limit=10");
      if (alertsRes.ok) {
        const data = await alertsRes.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error("Error loading finance data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivitySuccess = () => {
    setIsDrawerOpen(false);
    loadData();
    addToast("success", "Financial activity recorded successfully");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getTodoIcon = (type: string) => {
    switch (type) {
      case "urgent":
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case "important":
        return <Clock className="w-4 h-4 text-yellow-400" />;
      default:
        return <CheckCircle className="w-4 h-4 text-blue-400" />;
    }
  };

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case "warning":
        return <Clock className="w-4 h-4 text-yellow-400" />;
      default:
        return <CheckCircle className="w-4 h-4 text-blue-400" />;
    }
  };

  const getCashHealthVariant = (months: number): "success" | "warning" | "danger" => {
    if (months >= 3) return "success";
    if (months >= 1) return "warning";
    return "danger";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Finance</h1>
          <p className="text-sm text-white/50 mt-1">
            Track cash, manage payments, and understand your financial health
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/finance/settings">
            <GlassButton variant="ghost">
              <Settings className="w-5 h-5" />
            </GlassButton>
          </Link>
          <GlassButton onClick={() => setIsDrawerOpen(true)} variant="primary">
            <Plus className="w-5 h-5 mr-2" />
            Record Financial Activity
          </GlassButton>
        </div>
      </div>

      {/* Analytics Section */}
      <div className="space-y-6">
        {/* Row 1: Cash Reality */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Banknote className="w-5 h-5 text-green-400" />
            Cash Reality
            <span className="text-sm font-normal text-white/40">- What money do I actually have?</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {analytics ? (
              <>
                <AnalyticsCard
                  label="Money in Bank"
                  value={formatCurrency(analytics.cash.moneyInBank)}
                  subtext="Actual cash available right now"
                  icon={<Wallet className="w-5 h-5" />}
                  trend={analytics.cash.bankTrend7d}
                  trendLabel="vs 7d ago"
                  variant={getCashHealthVariant(analytics.cash.cashRunwayMonths)}
                  tooltip="This is the actual money you have available right now in your bank accounts"
                />
                <AnalyticsCard
                  label="Cash Runway"
                  value={`${analytics.cash.cashRunwayMonths.toFixed(1)} months`}
                  subtext={`At ${formatCurrency(analytics.cash.avgMonthlyBurn)}/month spending`}
                  icon={<Calendar className="w-5 h-5" />}
                  variant={getCashHealthVariant(analytics.cash.cashRunwayMonths)}
                  tooltip="Based on your current cash and average monthly spending, this is how long you can operate"
                />
                <AnalyticsCard
                  label="This Month's Cash Flow"
                  value={formatCurrency(analytics.cash.monthNetCashFlow)}
                  subtext={`In: ${formatCurrency(analytics.cash.monthCashIn)} | Out: ${formatCurrency(analytics.cash.monthCashOut)}`}
                  icon={analytics.cash.monthNetCashFlow >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                  variant={analytics.cash.monthNetCashFlow >= 0 ? "success" : "danger"}
                  tooltip="This shows whether you're collecting more than you're spending this month"
                />
              </>
            ) : (
              Array.from({ length: 3 }).map((_, i) => (
                <GlassCard key={i} className="p-4 animate-pulse">
                  <div className="h-4 bg-white/10 rounded w-24 mb-2" />
                  <div className="h-8 bg-white/10 rounded w-32 mb-2" />
                  <div className="h-3 bg-white/10 rounded w-40" />
                </GlassCard>
              ))
            )}
          </div>
        </div>

        {/* Row 2: Money Owed */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-orange-400" />
            Money Owed
            <span className="text-sm font-normal text-white/40">- Who owes who?</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {analytics ? (
              <>
                <Link href="/finance/ar-aging">
                  <GlassCard className="p-4 border border-blue-500/30 bg-blue-500/5 cursor-pointer hover:bg-white/10 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-white/60">Customers Owe You</p>
                        <p className="text-2xl font-bold text-blue-400 mt-1">
                          {formatCurrency(analytics.owed.totalAR)}
                        </p>
                        <p className="text-xs text-white/40 mt-1">Money your customers owe you</p>
                        <AgingBar
                          current={analytics.owed.arCurrent}
                          days1to30={analytics.owed.ar1to30}
                          days31to60={analytics.owed.ar31to60}
                          days60plus={analytics.owed.ar60plus}
                          total={analytics.owed.totalAR}
                        />
                      </div>
                      <div className="p-2 rounded-lg bg-white/5 text-blue-400">
                        <Users className="w-5 h-5" />
                      </div>
                    </div>
                  </GlassCard>
                </Link>
                <Link href="/finance/ap-aging">
                  <GlassCard className="p-4 border border-orange-500/30 bg-orange-500/5 cursor-pointer hover:bg-white/10 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-white/60">You Owe Vendors</p>
                        <p className="text-2xl font-bold text-orange-400 mt-1">
                          {formatCurrency(analytics.owed.totalAP)}
                        </p>
                        <p className="text-xs text-white/40 mt-1">Money you owe to vendors</p>
                        <AgingBar
                          current={analytics.owed.apCurrent}
                          days1to30={analytics.owed.ap1to30}
                          days31to60={analytics.owed.ap31to60}
                          days60plus={analytics.owed.ap60plus}
                          total={analytics.owed.totalAP}
                        />
                      </div>
                      <div className="p-2 rounded-lg bg-white/5 text-orange-400">
                        <Receipt className="w-5 h-5" />
                      </div>
                    </div>
                  </GlassCard>
                </Link>
                <AnalyticsCard
                  label="Net Position"
                  value={formatCurrency(analytics.owed.netPosition)}
                  subtext={
                    analytics.owed.netPosition >= 0
                      ? "Customers owe you more than you owe vendors"
                      : "You owe vendors more than customers owe you"
                  }
                  icon={<Scale className="w-5 h-5" />}
                  variant={analytics.owed.netPosition >= 0 ? "success" : "warning"}
                  tooltip="This is the difference between what people owe you and what you owe others"
                />
              </>
            ) : (
              Array.from({ length: 3 }).map((_, i) => (
                <GlassCard key={i} className="p-4 animate-pulse">
                  <div className="h-4 bg-white/10 rounded w-24 mb-2" />
                  <div className="h-8 bg-white/10 rounded w-32 mb-2" />
                  <div className="h-3 bg-white/10 rounded w-40" />
                </GlassCard>
              ))
            )}
          </div>
        </div>

        {/* Row 3: Business Performance */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-400" />
            Business Performance
            <span className="text-sm font-normal text-white/40">- Am I making money?</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {analytics ? (
              <>
                <AnalyticsCard
                  label="This Month's Sales"
                  value={formatCurrency(analytics.performance.monthSales)}
                  subtext="Sales recognized this month (accrual)"
                  icon={<TrendingUp className="w-5 h-5" />}
                  trend={analytics.performance.salesVsLastMonth}
                  trendLabel="vs last month"
                  variant="default"
                  tooltip="This is all the work you've done or products you've sold this month, even if customers haven't paid yet"
                />
                <AnalyticsCard
                  label="This Month's Expenses"
                  value={formatCurrency(analytics.performance.monthExpenses)}
                  subtext="Costs & expenses recognized this month"
                  icon={<TrendingDown className="w-5 h-5" />}
                  trend={analytics.performance.expensesVsLastMonth}
                  trendLabel="vs last month"
                  variant="default"
                  tooltip="Everything it cost to run your business this month, even if you haven't paid the bills yet"
                />
                <AnalyticsCard
                  label="Profit This Month"
                  value={formatCurrency(analytics.performance.monthProfit)}
                  subtext={`${analytics.performance.profitMargin.toFixed(1)}% profit margin`}
                  icon={<DollarSign className="w-5 h-5" />}
                  variant={analytics.performance.monthProfit >= 0 ? "success" : "danger"}
                  tooltip="This is whether you made money this month - it includes all sales and costs, regardless of whether money actually moved yet"
                />
              </>
            ) : (
              Array.from({ length: 3 }).map((_, i) => (
                <GlassCard key={i} className="p-4 animate-pulse">
                  <div className="h-4 bg-white/10 rounded w-24 mb-2" />
                  <div className="h-8 bg-white/10 rounded w-32 mb-2" />
                  <div className="h-3 bg-white/10 rounded w-40" />
                </GlassCard>
              ))
            )}
          </div>
        </div>
      </div>

      {/* To-Do & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* To-Do Panel */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Things You Need to Do</h3>
          </div>
          {todos.length > 0 ? (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {todos.map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  {getTodoIcon(todo.type)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white">{todo.title}</p>
                    <p className="text-sm text-white/50">{todo.description}</p>
                    {todo.amount && (
                      <p className="text-sm text-white/60 mt-1">
                        {formatCurrency(todo.amount)}
                      </p>
                    )}
                  </div>
                  {todo.actionRoute && (
                    <Link href={todo.actionRoute}>
                      <GlassButton size="sm" variant="ghost">
                        {todo.action}
                      </GlassButton>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-400/50 mx-auto mb-2" />
              <p className="text-white/50">All caught up!</p>
            </div>
          )}
        </GlassCard>

        {/* Alerts Panel */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Things You Should Know</h3>
          </div>
          {alerts.length > 0 ? (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  {getAlertIcon(alert.severity)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white">{alert.message}</p>
                    {alert.impact && (
                      <p className="text-sm text-white/50 mt-1">{alert.impact}</p>
                    )}
                  </div>
                  <span className="text-xs text-white/40">
                    {new Date(alert.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-400/50 mx-auto mb-2" />
              <p className="text-white/50">No alerts</p>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Quick Access */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Documents & Accounts</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {QUICK_ACCESS_CARDS.map((card) => (
            <Link key={card.id} href={card.href}>
              <GlassCard className="p-4 h-full hover:bg-white/10 transition-colors cursor-pointer">
                <div className={`p-3 rounded-lg bg-white/5 w-fit mb-3 ${card.color}`}>
                  <card.icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-white">{card.title}</h3>
                <p className="text-sm text-white/50 mt-1">{card.description}</p>
              </GlassCard>
            </Link>
          ))}
        </div>
      </div>

      {/* Reports */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Reports & Analysis</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {REPORT_CARDS.map((card) => (
            <Link key={card.id} href={card.href}>
              <GlassCard className="p-4 h-full hover:bg-white/10 transition-colors cursor-pointer">
                <div className={`p-2 rounded-lg bg-white/5 w-fit mb-2 ${card.color}`}>
                  <card.icon className="w-5 h-5" />
                </div>
                <h3 className="font-medium text-white text-sm">{card.title}</h3>
                <p className="text-xs text-white/50 mt-1">{card.description}</p>
              </GlassCard>
            </Link>
          ))}
        </div>
      </div>

      {/* Record Finance Drawer */}
      <RecordFinanceDrawer
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSuccess={handleActivitySuccess}
      />
    </div>
  );
}
