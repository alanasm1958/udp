"use client";

import * as React from "react";
import Link from "next/link";
import {
  GlassCard,
  GlassBadge,
  GlassButton,
  PageHeader,
  Spinner,
} from "@/components/ui/glass";
import { apiGet, formatDateTime } from "@/lib/http";

interface Plan {
  code: string;
  name: string;
  priceMonthlyCents: number;
  currency: string;
}

interface Subscription {
  id: string;
  planCode: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  plan: Plan | null;
  isActive: boolean;
}

interface Tenant {
  id: string;
  name: string;
  baseCurrency: string;
  createdAt: string;
  userCount: number;
  activeUserCount: number;
}

interface TenantResponse {
  tenant: Tenant;
  subscription: Subscription | null;
}

export default function TenantSettingsPage() {
  const [data, setData] = React.useState<TenantResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const result = await apiGet<TenantResponse>("/api/admin/tenant");
        setData(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load tenant info");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tenant Settings" description="View your organization settings" />
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-red-400">{error || "Failed to load data"}</p>
        </div>
      </div>
    );
  }

  const { tenant, subscription } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenant Settings"
        description="View your organization settings"
      />

      {/* Tenant Info */}
      <GlassCard>
        <h2 className="text-lg font-semibold text-white mb-4">Organization</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-medium text-white/50 block mb-1">Tenant Name</label>
            <p className="text-white font-medium">{tenant.name}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-white/50 block mb-1">Tenant ID</label>
            <p className="text-white/70 font-mono text-sm">{tenant.id}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-white/50 block mb-1">Base Currency</label>
            <p className="text-white font-medium">{tenant.baseCurrency}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-white/50 block mb-1">Created</label>
            <p className="text-white/70">{formatDateTime(tenant.createdAt)}</p>
          </div>
        </div>
      </GlassCard>

      {/* Users Summary */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Users</h2>
          <Link href="/settings/users">
            <GlassButton size="sm">Manage Users</GlassButton>
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="text-center p-4 rounded-xl bg-white/5">
            <p className="text-3xl font-bold text-white">{tenant.userCount}</p>
            <p className="text-sm text-white/50 mt-1">Total Users</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-white/5">
            <p className="text-3xl font-bold text-emerald-400">{tenant.activeUserCount}</p>
            <p className="text-sm text-white/50 mt-1">Active Users</p>
          </div>
        </div>
      </GlassCard>

      {/* Subscription */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Subscription</h2>
          <Link href="/billing">
            <GlassButton size="sm">Manage Billing</GlassButton>
          </Link>
        </div>

        {subscription ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-white">
                {subscription.plan?.name || subscription.planCode}
              </span>
              <GlassBadge
                variant={subscription.isActive ? "success" : "danger"}
              >
                {subscription.status}
              </GlassBadge>
              {subscription.cancelAtPeriodEnd && (
                <GlassBadge variant="warning">Canceling</GlassBadge>
              )}
            </div>

            {subscription.plan && (
              <p className="text-white/70">
                {formatPrice(subscription.plan.priceMonthlyCents, subscription.plan.currency)}/month
              </p>
            )}

            <div className="pt-4 border-t border-white/10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-white/50 block mb-1">
                    Current Period
                  </label>
                  <p className="text-white/70">
                    {formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-white/50 block mb-1">
                    {subscription.cancelAtPeriodEnd ? "Ends On" : "Renews On"}
                  </label>
                  <p className="text-white/70">{formatDate(subscription.currentPeriodEnd)}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-white/50 mb-4">No active subscription</p>
            <Link href="/billing">
              <GlassButton variant="primary">Choose a Plan</GlassButton>
            </Link>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
