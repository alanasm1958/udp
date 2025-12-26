/**
 * /api/billing/portal
 *
 * POST: Create a Stripe billing portal session
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tenantSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

// Check if we're in dev billing mode
function isDevBillingMode(): boolean {
  return !process.env.STRIPE_SECRET_KEY || process.env.BILLING_PROVIDER === "dev";
}

/**
 * POST /api/billing/portal
 * Create a Stripe billing portal session
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);

    // Dev fallback mode - portal not available
    if (isDevBillingMode()) {
      return NextResponse.json(
        { error: "Billing portal not available in dev mode" },
        { status: 400 }
      );
    }

    // Get subscription to find customer ID
    const [subscription] = await db
      .select()
      .from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId))
      .limit(1);

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No Stripe customer found. Please complete checkout first." },
        { status: 400 }
      );
    }

    // Dynamic import of Stripe
    let Stripe;
    try {
      Stripe = (await import("stripe")).default;
    } catch {
      return NextResponse.json(
        { error: "Stripe is not configured properly" },
        { status: 500 }
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${appUrl}/billing`,
    });

    return NextResponse.json({
      url: portalSession.url,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/billing/portal error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
