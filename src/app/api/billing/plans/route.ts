/**
 * /api/billing/plans
 *
 * GET: List available subscription plans
 */

import { NextResponse } from "next/server";
import { getActivePlans } from "@/lib/subscription";

/**
 * GET /api/billing/plans
 * Returns all active subscription plans
 * Note: Public endpoint - no auth required (needed for signup page)
 */
export async function GET(): Promise<NextResponse> {
  try {
    const plans = await getActivePlans();

    return NextResponse.json({
      plans: plans.map((plan) => ({
        id: plan.id,
        code: plan.code,
        name: plan.name,
        description: plan.description,
        currency: plan.currency,
        priceAmount: plan.priceAmount,
        priceMonthlyCents: Math.round(parseFloat(plan.priceAmount) * 100),
        billingType: plan.billingType,
        interval: plan.interval,
        intervalCount: plan.intervalCount,
        trialDays: plan.trialDays,
        durationMonths: plan.durationMonths,
        isPromotional: plan.isPromotional,
        isActive: plan.isActive,
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
