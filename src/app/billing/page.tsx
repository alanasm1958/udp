"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GlassCard,
  GlassButton,
  GlassBadge,
  PageHeader,
  Spinner,
} from "@/components/ui/glass";
import { apiGet, apiPost } from "@/lib/http";

interface Plan {
  id: string;
  code: string;
  name: string;
  priceMonthlyCents: number;
  currency: string;
  stripePriceId: string | null;
  isActive: boolean;
}

interface Subscription {
  id: string;
  planCode: string;
  status: "trialing" | "active" | "past_due" | "canceled";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

interface BillingStatus {
  subscription: Subscription | null;
  hasSubscription: boolean;
  isActive: boolean;
  planCode: string | null;
  capabilities: string[];
}

interface PlansResponse {
  plans: Plan[];
}

// Plan features for display
const PLAN_FEATURES: Record<string, string[]> = {
  free: ["Dashboard", "Basic Reports", "Read-only Access"],
  starter: [
    "Everything in Free",
    "Sales Documents",
    "Procurement",
    "Inventory Management",
    "Master Data",
  ],
  pro: [
    "Everything in Starter",
    "Financial Posting",
    "Payments & AR/AP",
    "Advanced Reports",
    "Budget & Strategy",
  ],
};

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [status, setStatus] = React.useState<BillingStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  // Check for success/cancel from Stripe redirect
  React.useEffect(() => {
    if (searchParams.get("success") === "true") {
      setSuccessMessage("Payment successful! Your subscription is now active.");
    } else if (searchParams.get("canceled") === "true") {
      setError("Checkout was canceled.");
    }
  }, [searchParams]);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [plansData, statusData] = await Promise.all([
        apiGet<PlansResponse>("/api/billing/plans"),
        apiGet<BillingStatus>("/api/billing/status"),
      ]);
      setPlans(plansData.plans);
      setStatus(statusData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load billing data");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCheckout = async (planCode: string) => {
    try {
      setActionLoading(planCode);
      setError(null);

      const result = await apiPost<{ url?: string; ok?: boolean; dev?: boolean }>(
        "/api/billing/checkout",
        { planCode }
      );

      if (result.url) {
        // Stripe checkout - redirect
        window.location.href = result.url;
      } else if (result.dev && result.ok) {
        // Dev mode - reload to see updated status
        setSuccessMessage(`Subscription activated: ${planCode} plan (dev mode)`);
        await loadData();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePortal = async () => {
    try {
      setActionLoading("portal");
      setError(null);

      const result = await apiPost<{ url?: string; error?: string }>(
        "/api/billing/portal",
        {}
      );

      if (result.url) {
        window.location.href = result.url;
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open billing portal");
    } finally {
      setActionLoading(null);
    }
  };

  const formatPrice = (cents: number, currency: string) => {
    if (cents === 0) return "Free";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(cents / 100);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getStatusBadge = (sub: Subscription) => {
    const variants: Record<string, "success" | "warning" | "danger" | "info"> = {
      active: "success",
      trialing: "info",
      past_due: "warning",
      canceled: "danger",
    };
    return (
      <GlassBadge variant={variants[sub.status] || "default"}>
        {sub.status.replace("_", " ")}
      </GlassBadge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const currentPlan = plans.find((p) => p.code === status?.planCode);

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Background blobs */}
      <div className="glass-bg-blob-1" />
      <div className="glass-bg-blob-2" />

      <div className="max-w-5xl mx-auto space-y-8">
        <PageHeader
          title="Billing & Subscription"
          description="Manage your subscription plan"
        />

        {/* Messages */}
        {error && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-red-400">{error}</p>
            <button
              className="text-xs text-red-300 underline mt-1"
              onClick={() => setError(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-emerald-400">{successMessage}</p>
            <button
              className="text-xs text-emerald-300 underline mt-1"
              onClick={() => setSuccessMessage(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* No subscription warning */}
        {!status?.hasSubscription && (
          <div className="p-6 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <h3 className="text-lg font-semibold text-amber-400 mb-2">
              Subscription Required
            </h3>
            <p className="text-amber-300/80 text-sm">
              Please select a plan to access all features. You can start with the Free plan
              to explore basic functionality.
            </p>
          </div>
        )}

        {/* Current subscription status */}
        {status?.subscription && (
          <GlassCard>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white mb-2">Current Plan</h2>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-white">
                    {currentPlan?.name || status.subscription.planCode}
                  </span>
                  {getStatusBadge(status.subscription)}
                  {status.subscription.cancelAtPeriodEnd && (
                    <GlassBadge variant="warning">Canceling</GlassBadge>
                  )}
                </div>
                <p className="text-sm text-white/50 mt-2">
                  {status.isActive
                    ? `Renews on ${formatDate(status.subscription.currentPeriodEnd)}`
                    : `Expired on ${formatDate(status.subscription.currentPeriodEnd)}`}
                </p>
              </div>
              {status.subscription.stripeCustomerId && (
                <GlassButton
                  onClick={handlePortal}
                  disabled={actionLoading === "portal"}
                >
                  {actionLoading === "portal" ? (
                    <>
                      <Spinner size="sm" />
                      Loading...
                    </>
                  ) : (
                    "Manage Billing"
                  )}
                </GlassButton>
              )}
            </div>
          </GlassCard>
        )}

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrentPlan = status?.planCode === plan.code;
            const features = PLAN_FEATURES[plan.code] || [];

            return (
              <GlassCard
                key={plan.id}
                className={`relative ${
                  isCurrentPlan ? "ring-2 ring-blue-500/50" : ""
                }`}
              >
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 text-xs font-medium bg-blue-500 text-white rounded-full">
                      Current Plan
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="text-3xl font-bold text-white">
                    {formatPrice(plan.priceMonthlyCents, plan.currency)}
                    {plan.priceMonthlyCents > 0 && (
                      <span className="text-sm font-normal text-white/50">/mo</span>
                    )}
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-white/80">
                      <span className="text-emerald-400">&#10003;</span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <GlassButton
                  className="w-full"
                  variant={isCurrentPlan ? "default" : "primary"}
                  disabled={isCurrentPlan || actionLoading === plan.code}
                  onClick={() => handleCheckout(plan.code)}
                >
                  {actionLoading === plan.code ? (
                    <>
                      <Spinner size="sm" />
                      Processing...
                    </>
                  ) : isCurrentPlan ? (
                    "Current Plan"
                  ) : status?.planCode && plan.priceMonthlyCents > (currentPlan?.priceMonthlyCents || 0) ? (
                    "Upgrade"
                  ) : (
                    "Select Plan"
                  )}
                </GlassButton>
              </GlassCard>
            );
          })}
        </div>

        {/* Back link */}
        <div className="text-center">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-white/50 hover:text-white/80 transition-colors"
          >
            &larr; Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <BillingContent />
    </Suspense>
  );
}
