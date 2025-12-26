/**
 * /api/billing/status
 *
 * GET: Get tenant's current subscription status
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";
import { getTenantSubscription, hasActiveSubscription, getPlanCapabilities } from "@/lib/entitlements";

/**
 * GET /api/billing/status
 * Returns the tenant's current subscription with derived flags
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const subscription = await getTenantSubscription(tenantId);

    if (!subscription) {
      return NextResponse.json({
        subscription: null,
        hasSubscription: false,
        isActive: false,
        planCode: null,
        capabilities: [],
      });
    }

    const isActive = hasActiveSubscription(subscription);
    const capabilities = getPlanCapabilities(subscription.planCode);

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        planCode: subscription.planCode,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        stripeCustomerId: subscription.stripeCustomerId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
      },
      hasSubscription: true,
      isActive,
      planCode: subscription.planCode,
      capabilities,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/billing/status error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
