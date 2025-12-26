/**
 * /api/billing/plans
 *
 * GET: List available subscription plans
 */

import { NextResponse } from "next/server";
import { getActivePlans } from "@/lib/subscription";
import { getSessionFromCookie } from "@/lib/auth";

/**
 * GET /api/billing/plans
 * Returns all active subscription plans
 */
export async function GET(): Promise<NextResponse> {
  try {
    // Require authenticated session
    const session = await getSessionFromCookie();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const plans = await getActivePlans();

    return NextResponse.json({
      plans: plans.map((plan) => ({
        id: plan.id,
        code: plan.code,
        name: plan.name,
        description: plan.description,
        currency: plan.currency,
        priceAmount: plan.priceAmount,
        billingType: plan.billingType,
        interval: plan.interval,
        intervalCount: plan.intervalCount,
        trialDays: plan.trialDays,
        durationMonths: plan.durationMonths,
        isPromotional: plan.isPromotional,
        stripePriceId: plan.stripePriceId,
      })),
    });
  } catch (error) {
    console.error("GET /api/billing/plans error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
