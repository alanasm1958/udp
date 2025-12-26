/**
 * Entitlements & Plan Capabilities
 *
 * Central logic for subscription-based feature gating.
 * Plans grant access to capabilities which are checked at the API and page level.
 */

import { db } from "@/db";
import { tenantSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";

export type PlanCode = "free" | "starter" | "pro";
export type Capability = "reports" | "sales" | "procurement" | "inventory" | "finance";

/**
 * Plan capabilities map
 * - free: dashboard + reports only
 * - starter: + sales, procurement, inventory
 * - pro: + finance (posting, payments, AR/AP)
 */
const PLAN_CAPABILITIES: Record<PlanCode, Capability[]> = {
  free: ["reports"],
  starter: ["reports", "sales", "procurement", "inventory"],
  pro: ["reports", "sales", "procurement", "inventory", "finance"],
};

export interface TenantSubscription {
  id: string;
  tenantId: string;
  planCode: string;
  status: "trialing" | "active" | "past_due" | "canceled";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get the subscription for a tenant
 */
export async function getTenantSubscription(
  tenantId: string
): Promise<TenantSubscription | null> {
  const [sub] = await db
    .select()
    .from(tenantSubscriptions)
    .where(eq(tenantSubscriptions.tenantId, tenantId))
    .limit(1);

  return sub || null;
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
