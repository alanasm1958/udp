/**
 * Entitlements & Plan Capabilities
 *
 * Central logic for subscription-based feature gating.
 * Plans grant access to capabilities which are checked at the API and page level.
 */

import { db } from "@/db";
import { tenantSubscriptions } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export type PlanCode = "free" | "starter" | "pro" | "OFFER_6M_FREE" | "MONTHLY_30";
export type Capability = "reports" | "sales" | "procurement" | "inventory" | "finance" | "ai";

/**
 * Plan capabilities map
 * - free: dashboard + reports only
 * - starter: + sales, procurement, inventory
 * - pro: + finance (posting, payments, AR/AP)
 * - OFFER_6M_FREE, MONTHLY_30: custom plans with full access
 */
const PLAN_CAPABILITIES: Record<PlanCode, Capability[]> = {
  free: ["reports"],
  starter: ["reports", "sales", "procurement", "inventory", "ai"],
  pro: ["reports", "sales", "procurement", "inventory", "finance", "ai"],
  OFFER_6M_FREE: ["reports", "sales", "procurement", "inventory", "finance", "ai"],
  MONTHLY_30: ["reports", "sales", "procurement", "inventory", "finance", "ai"],
};

export interface TenantSubscription {
  id: string;
  tenantId: string;
  planCode: string;
  status: "none" | "trialing" | "active" | "past_due" | "canceled" | "expired";
  isCurrent: boolean;
  startedAt: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  endedAt: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get the current subscription for a tenant
 * In development, returns a mock pro subscription if the table doesn't exist
 */
export async function getTenantSubscription(
  tenantId: string
): Promise<TenantSubscription | null> {
  try {
    const [sub] = await db
      .select()
      .from(tenantSubscriptions)
      .where(
        and(
          eq(tenantSubscriptions.tenantId, tenantId),
          eq(tenantSubscriptions.isCurrent, true)
        )
      )
      .limit(1);

    return sub || null;
  } catch (error) {
    // In development, if table doesn't exist, return mock pro subscription
    if (process.env.NODE_ENV === "development") {
      console.warn("tenant_subscriptions table not found, using mock subscription");
      const now = new Date();
      const futureDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      return {
        id: "mock-subscription",
        tenantId,
        planCode: "pro",
        status: "active",
        isCurrent: true,
        startedAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: futureDate,
        endedAt: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now,
      };
    }
    throw error;
  }
}

/**
 * Check if a subscription is currently active
 * Active means: status is 'active' or 'trialing' AND within the period
 */
export function hasActiveSubscription(sub: TenantSubscription | null): boolean {
  if (!sub) return false;

  const now = new Date();
  const periodEnd = new Date(sub.currentPeriodEnd);

  // Must be active or trialing
  if (sub.status !== "active" && sub.status !== "trialing") {
    return false;
  }

  // Must be within the billing period
  return now <= periodEnd;
}

/**
 * Check if a plan allows a specific capability
 */
export function planAllows(planCode: string, capability: Capability): boolean {
  const capabilities = PLAN_CAPABILITIES[planCode as PlanCode];
  if (!capabilities) return false;
  return capabilities.includes(capability);
}

/**
 * Get all capabilities for a plan
 */
export function getPlanCapabilities(planCode: string): Capability[] {
  return PLAN_CAPABILITIES[planCode as PlanCode] || [];
}

/**
 * Derive capability from API path
 * Returns null if no capability check is needed (public/auth routes)
 */
export function getCapabilityFromPath(pathname: string): Capability | null {
  // Skip auth and billing routes
  if (pathname.startsWith("/api/auth/")) return null;
  if (pathname.startsWith("/api/billing/")) return null;

  // Finance routes
  if (pathname.startsWith("/api/finance/")) return "finance";

  // Sales routes
  if (pathname.startsWith("/api/sales/")) return "sales";

  // Procurement routes
  if (pathname.startsWith("/api/procurement/")) return "procurement";

  // Inventory routes (omni/inventory and reports/inventory)
  if (pathname.startsWith("/api/omni/inventory/")) return "inventory";
  if (pathname.startsWith("/api/reports/inventory/")) return "inventory";

  // Reports (general) - allowed on free
  if (pathname.startsWith("/api/reports/")) return "reports";

  // Master data routes - allowed on starter+
  if (pathname.startsWith("/api/master/")) return "sales"; // Treat as sales level

  // Strategy routes - allowed on pro
  if (pathname.startsWith("/api/strategy/")) return "finance";

  // Omni routes (non-inventory) - treat as finance
  if (pathname.startsWith("/api/omni/")) return "finance";

  // Admin routes - no capability check (role-based only)
  if (pathname.startsWith("/api/admin/")) return null;

  // AI routes - require AI capability
  if (pathname.startsWith("/api/ai/")) return "ai";

  // Default: no specific capability needed
  return null;
}

/**
 * Subscription check result for use in middleware
 */
export interface SubscriptionCheckResult {
  ok: boolean;
  hasSubscription: boolean;
  isActive: boolean;
  planCode: string | null;
  missingCapability?: Capability;
  error?: string;
}

/**
 * Full subscription and capability check
 */
export async function checkSubscriptionAccess(
  tenantId: string,
  pathname: string,
  method: string
): Promise<SubscriptionCheckResult> {
  const sub = await getTenantSubscription(tenantId);

  // No subscription at all
  if (!sub) {
    return {
      ok: false,
      hasSubscription: false,
      isActive: false,
      planCode: null,
      error: "Subscription required",
    };
  }

  // Check if active
  const active = hasActiveSubscription(sub);
  if (!active) {
    return {
      ok: false,
      hasSubscription: true,
      isActive: false,
      planCode: sub.planCode,
      error: "Subscription inactive or expired",
    };
  }

  // For GET requests, just check if active (reads are generally allowed)
  // For state-changing (POST/PATCH/DELETE), check capabilities
  if (method !== "GET") {
    const capability = getCapabilityFromPath(pathname);
    if (capability && !planAllows(sub.planCode, capability)) {
      return {
        ok: false,
        hasSubscription: true,
        isActive: true,
        planCode: sub.planCode,
        missingCapability: capability,
        error: "Plan upgrade required",
      };
    }
  }

  return {
    ok: true,
    hasSubscription: true,
    isActive: true,
    planCode: sub.planCode,
  };
}

/**
 * Check if tenant can use AI Copilot
 */
export async function canUseAI(tenantId: string): Promise<boolean> {
  // In development/test, always allow AI
  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
    return true;
  }

  const sub = await getTenantSubscription(tenantId);
  if (!sub || !hasActiveSubscription(sub)) {
    return false;
  }

  return planAllows(sub.planCode, "ai");
}
