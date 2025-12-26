"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  GlassCard,
  GlassButton,
  GlassSelect,
  GlassBadge,
  PageHeader,
  Spinner,
} from "@/components/ui/glass";
import { apiGet, apiPost, formatDateTime } from "@/lib/http";

interface Plan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  currency: string;
  priceAmount: string;
  billingType: "recurring" | "trial";
  interval: string;
  intervalCount: number;
  trialDays: number | null;
  durationMonths: number | null;
  isPromotional: boolean;
  stripePriceId: string | null;
}

interface Subscription {
  id?: string;
  planCode?: string;
  planName?: string;
  status: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  isPromotional?: boolean;
  isActive: boolean;
}

interface TenantResponse {
  tenant: {
    id: string;
    name: string;
    baseCurrency: string;
    createdAt: string;
    userCount: number;
    activeUserCount: number;
  };
  subscription: Subscription;
}

interface PlansResponse {
  plans: Plan[];
}

function BillingContent() {
  const searchParams = useSearchParams();
  const [tenantData, setTenantData] = React.useState<TenantResponse | null>(null);
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = React.useState<string | null>(null);

  // Admin manual set state
  const [showManualSet, setShowManualSet] = React.useState(false);
  const [manualPlanCode, setManualPlanCode] = React.useState("");
  const [manualStatus, setManualStatus] = React.useState("active");
  const [manualSetting, setManualSetting] = React.useState(false);

  // Check for success/cancel params
  const checkoutSuccess = searchParams.get("success") === "true";
  const checkoutCanceled = searchParams.get("canceled") === "true";

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [tenantResult, plansResult] = await Promise.all([
        apiGet<TenantResponse>("/api/admin/tenant"),
        apiGet<PlansResponse>("/api/billing/plans"),
      ]);
      setTenantData(tenantResult);
      setPlans(plansResult.plans);
      if (!manualPlanCode && plansResult.plans.length > 0) {
        setManualPlanCode(plansResult.plans[0].code);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load billing info");
    } finally {
      setLoading(false);
    }
  }, [manualPlanCode]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCheckout = async (planCode: string) => {
    setCheckoutLoading(planCode);
    try {
      const result = await apiPost<{ url?: string; dev?: boolean; message?: string }>(
        "/api/billing/checkout",
        { planCode }
      );

      if (result.dev) {
        // Dev mode - just reload data
        await loadData();
      } else if (result.url) {
        // Redirect to Stripe checkout
        window.location.href = result.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManualSet = async () => {
    setManualSetting(true);
    try {
      await apiPost("/api/admin/tenant/subscription", {
        planCode: manualPlanCode,
        status: manualStatus,
      });
      await loadData();
      setShowManualSet(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set subscription");
    } finally {
      setManualSetting(false);
    }
  };

  const formatPrice = (amount: string, currency: string) => {
    const num = parseFloat(amount);
    if (num === 0) return "Free";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(num);
  };

  const getStatusBadgeVariant = (status: string): "success" | "warning" | "danger" | "info" | "default" => {
    switch (status) {
      case "active":
        return "success";
      case "trialing":
        return "info";
      case "past_due":
        return "warning";
      case "canceled":
      case "expired":
        return "danger";
      default:
        return "default";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !tenantData) {
    return (
      <div className="space-y-6">
        <PageHeader title="Billing" description="Manage your subscription" />
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-red-400">{error || "Failed to load data"}</p>
        </div>
      </div>
    );
  }

  const { subscription } = tenantData;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Manage your subscription and billing"
        actions={
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => setShowManualSet(!showManualSet)}
          >
            {showManualSet ? "Cancel" : "Admin: Manual Set"}
          </GlassButton>
        }
      />

      {/* Success/Cancel Messages */}
      {checkoutSuccess && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <p className="text-emerald-400">Subscription activated successfully!</p>
        </div>
      )}
      {checkoutCanceled && (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <p className="text-amber-400">Checkout was canceled.</p>
        </div>
      )}

      {/* Admin Manual Set Panel */}
      {showManualSet && (
        <GlassCard className="border-amber-500/30">
          <h3 className="text-sm font-semibold text-amber-400 mb-4">
            Admin: Manual Subscription Set
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <GlassSelect
              label="Plan"
              value={manualPlanCode}
              onChange={(e) => setManualPlanCode(e.target.value)}
              options={plans.map((p) => ({ value: p.code, label: p.name }))}
              disabled={manualSetting}
            />
            <GlassSelect
              label="Status"
              value={manualStatus}
              onChange={(e) => setManualStatus(e.target.value)}
              options={[
                { value: "trialing", label: "Trialing" },
                { value: "active", label: "Active" },
                { value: "past_due", label: "Past Due" },
                { value: "canceled", label: "Canceled" },
              ]}
              disabled={manualSetting}
            />
            <div className="flex items-end">
              <GlassButton
                variant="primary"
                onClick={handleManualSet}
                disabled={manualSetting}
                className="w-full"
              >
                {manualSetting ? (
                  <>
                    <Spinner size="sm" />
                    Setting...
                  </>
                ) : (
                  "Set Subscription"
                )}
              </GlassButton>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Current Plan Card */}
      <GlassCard>
        <h2 className="text-lg font-semibold text-white mb-4">Current Plan</h2>

        {subscription.status === "none" ? (
          <div className="text-center py-6">
            <p className="text-white/50 mb-2">No active subscription</p>
            <p className="text-sm text-white/40">Choose a plan below to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-white">
                {subscription.planName || subscription.planCode}
              </span>
              <GlassBadge variant={getStatusBadgeVariant(subscription.status)}>
                {subscription.status}
              </GlassBadge>
              {subscription.isPromotional && (
                <GlassBadge variant="info">Promotional</GlassBadge>
              )}
              {subscription.cancelAtPeriodEnd && (
                <GlassBadge variant="warning">Canceling</GlassBadge>
              )}
            </div>

            {subscription.currentPeriodEnd && (
              <div className="pt-4 border-t border-white/10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {subscription.currentPeriodStart && (
                    <div>
                      <label className="text-xs font-medium text-white/50 block mb-1">
                        Current Period
                      </label>
                      <p className="text-white/70">
                        {formatDateTime(subscription.currentPeriodStart)} -{" "}
                        {formatDateTime(subscription.currentPeriodEnd)}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-white/50 block mb-1">
                      {subscription.cancelAtPeriodEnd ? "Ends On" : "Renews On"}
                    </label>
                    <p className="text-white/70">
                      {formatDateTime(subscription.currentPeriodEnd)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </GlassCard>

      {/* Plans Grid */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isCurrentPlan = subscription.planCode === plan.code;
            const isCheckingOut = checkoutLoading === plan.code;

            return (
              <GlassCard
                key={plan.id}
                className={`flex flex-col ${isCurrentPlan ? "ring-2 ring-blue-500/50" : ""}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                    {plan.isPromotional && (
                      <GlassBadge variant="info">Limited Offer</GlassBadge>
                    )}
                  </div>
                  {isCurrentPlan && (
                    <GlassBadge variant="success">Current</GlassBadge>
                  )}
                </div>

                <div className="mb-4">
                  <span className="text-3xl font-bold text-white">
                    {formatPrice(plan.priceAmount, plan.currency)}
                  </span>
                  {parseFloat(plan.priceAmount) > 0 && (
                    <span className="text-white/50 ml-1">
                      {plan.intervalCount > 1
                        ? `/ ${plan.intervalCount} months`
                        : "/ month"}
                    </span>
                  )}
                </div>

                <p className="text-sm text-white/60 mb-4 flex-grow">
                  {plan.description}
                </p>

                {plan.billingType === "trial" && plan.trialDays && (
                  <p className="text-sm text-blue-400 mb-4">
                    {plan.trialDays} days free trial
                  </p>
                )}

                <GlassButton
                  variant={isCurrentPlan ? "default" : "primary"}
                  onClick={() => handleCheckout(plan.code)}
                  disabled={isCurrentPlan || isCheckingOut || !!checkoutLoading}
                  className="w-full"
                >
                  {isCheckingOut ? (
                    <>
                      <Spinner size="sm" />
                      Processing...
                    </>
                  ) : isCurrentPlan ? (
                    "Current Plan"
                  ) : (
                    "Select Plan"
                  )}
                </GlassButton>
              </GlassCard>
            );
          })}
        </div>
      </div>

      {/* Stripe info */}
      {!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY && (
        <div className="text-center text-xs text-white/30 mt-8">
          Running in dev mode - Stripe is not configured
        </div>
      )}
    </div>
  );
}

export default function BillingSettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    }>
      <BillingContent />
    </Suspense>
  );
}
