/**
 * /api/billing/checkout
 *
 * POST: Create a checkout session (Stripe or dev fallback)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptionPlans, tenantSubscriptions, subscriptionEvents, tenants } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

interface CheckoutRequest {
  planCode: string;
}

// Check if we're in dev billing mode
function isDevBillingMode(): boolean {
  return !process.env.STRIPE_SECRET_KEY || process.env.BILLING_PROVIDER === "dev";
}

/**
 * POST /api/billing/checkout
 * Create a checkout session for subscription
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const body: CheckoutRequest = await req.json();

    if (!body.planCode) {
      return NextResponse.json({ error: "planCode is required" }, { status: 400 });
    }

    // Verify plan exists
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(
        and(
          eq(subscriptionPlans.code, body.planCode),
          eq(subscriptionPlans.isActive, true)
        )
      )
      .limit(1);

    if (!plan) {
      return NextResponse.json({ error: "Invalid plan code" }, { status: 400 });
    }

    // Dev fallback mode
    if (isDevBillingMode()) {
      // Get or create subscription
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() + 30); // 30-day period

      const [existingSub] = await db
        .select()
        .from(tenantSubscriptions)
        .where(eq(tenantSubscriptions.tenantId, tenantId))
        .limit(1);

      if (existingSub) {
        // Update existing subscription
        await db
          .update(tenantSubscriptions)
          .set({
            planCode: body.planCode,
            status: "active",
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
            updatedAt: sql`now()`,
          })
          .where(eq(tenantSubscriptions.id, existingSub.id));
      } else {
        // Create new subscription
        await db.insert(tenantSubscriptions).values({
          tenantId,
          planCode: body.planCode,
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        });
      }

      // Log subscription event
      await db.insert(subscriptionEvents).values({
        tenantId,
        type: "checkout_completed_dev",
        payload: { planCode: body.planCode, mode: "dev" },
      });

      return NextResponse.json({
        ok: true,
        dev: true,
        planCode: body.planCode,
        message: "Subscription activated (dev mode)",
      });
    }

    // Stripe mode
    if (!plan.stripePriceId) {
      return NextResponse.json(
        { error: "Plan does not have a Stripe price configured" },
        { status: 400 }
      );
    }

    // Dynamic import of Stripe to avoid issues if not installed
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

    // Get tenant info for customer creation
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Get existing subscription to find or create customer
    const [existingSub] = await db
      .select()
      .from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId))
      .limit(1);

    let stripeCustomerId = existingSub?.stripeCustomerId;

    // Create Stripe customer if needed
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: tenant.name,
        metadata: {
          tenantId,
        },
      });
      stripeCustomerId = customer.id;

      // Store customer ID
      if (existingSub) {
        await db
          .update(tenantSubscriptions)
          .set({ stripeCustomerId, updatedAt: sql`now()` })
          .where(eq(tenantSubscriptions.id, existingSub.id));
      } else {
        // Create placeholder subscription record
        const now = new Date();
        await db.insert(tenantSubscriptions).values({
          tenantId,
          planCode: "free", // Will be updated by webhook
          status: "trialing",
          currentPeriodStart: now,
          currentPeriodEnd: now,
          stripeCustomerId,
          cancelAtPeriodEnd: false,
        });
      }
    }

    // Create Checkout Session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/billing?success=true`,
      cancel_url: `${appUrl}/billing?canceled=true`,
      metadata: {
        tenantId,
        planCode: body.planCode,
      },
    });

    // Log checkout event
    await db.insert(subscriptionEvents).values({
      tenantId,
      type: "checkout_session_created",
      payload: {
        sessionId: session.id,
        planCode: body.planCode,
        stripePriceId: plan.stripePriceId,
      },
    });

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/billing/checkout error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
