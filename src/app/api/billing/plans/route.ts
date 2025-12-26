/**
 * /api/billing/plans
 *
 * GET: List available subscription plans
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptionPlans } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/billing/plans
 * Returns all active subscription plans
 */
export async function GET(): Promise<NextResponse> {
  try {
    const plans = await db
      .select({
        id: subscriptionPlans.id,
        code: subscriptionPlans.code,
        name: subscriptionPlans.name,
        priceMonthlyCents: subscriptionPlans.priceMonthlyCents,
        currency: subscriptionPlans.currency,
        stripePriceId: subscriptionPlans.stripePriceId,
        isActive: subscriptionPlans.isActive,
      })
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(subscriptionPlans.priceMonthlyCents);

    return NextResponse.json({ plans });
  } catch (error) {
    console.error("GET /api/billing/plans error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
