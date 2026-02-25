/**
 * /api/billing/checkout
 *
 * POST: Create a checkout session (Stripe or dev fallback)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptionPlans, tenantSubscriptions, subscriptionEvents, tenants } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getSessionFromCookie } from "@/lib/auth";

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
    // Require authenticated session
    const session = await getSessionFromCookie();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const tenantId = session.tenantId;

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
      const now = new Date();
      const periodEnd = new Date(now);

      // Calculate period end based on plan type
      if (plan.billingType === "trial" && plan.trialDays) {
        periodEnd.setDate(periodEnd.getDate() + plan.trialDays);
      } else if (plan.durationMonths) {
        periodEnd.setMonth(periodEnd.getMonth() + plan.durationMonths);
      } else if (plan.billingType === "trial" && !plan.trialDays && !plan.durationMonths) {
        // Free plan with no expiry
        periodEnd.setFullYear(periodEnd.getFullYear() + 100);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + (plan.intervalCount || 1));
      }

      const status = plan.billingType === "trial" ? "trialing" : "active";

      // Mark any existing current subscription as not current
      await db
        .update(tenantSubscriptions)
        .set({
          isCurrent: false,
          endedAt: now,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(tenantSubscriptions.tenantId, tenantId),
            eq(tenantSubscriptions.isCurrent, true)
          )
        );

      // Create new subscription
      await db.insert(tenantSubscriptions).values({
        tenantId,
        planCode: body.planCode,
        status,
        isCurrent: true,
        startedAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        metadata: { source: "dev_checkout" },
        createdByActorId: session.userId,
      });

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

    // Stripe mode - check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Stripe is not configured. Use dev mode or configure STRIPE_SECRET_KEY." },
        { status: 501 }
      );
    }

    // For trial plans (OFFER_6M_FREE), we'll set up a trial on the monthly plan
    let stripePriceId = plan.stripePriceId;
    let trialDays: number | undefined;

    if (plan.billingType === "trial" && plan.code !== "free") {
      // For trial offers with a paid fallback, look up a recurring plan
      const [monthlyPlan] = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.code, "monthly_30"))
        .limit(1);

      if (monthlyPlan?.stripePriceId) {
        stripePriceId = monthlyPlan.stripePriceId;
        trialDays = plan.trialDays ?? undefined;
      }
    }

    if (!stripePriceId) {
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
      .where(
        and(
          eq(tenantSubscriptions.tenantId, tenantId),
          eq(tenantSubscriptions.isCurrent, true)
        )
      )
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
          isCurrent: true,
          startedAt: now,
          currentPeriodStart: now,
          currentPeriodEnd: now,
          stripeCustomerId,
          cancelAtPeriodEnd: false,
          createdByActorId: session.userId,
        });
      }
    }

    // Create Checkout Session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Build checkout session params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionParams: any = {
      customer: stripeCustomerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/settings/billing?success=true`,
      cancel_url: `${appUrl}/settings/billing?canceled=true`,
      metadata: {
        tenantId,
        planCode: body.planCode,
      },
    };

    // Add trial period if applicable
    if (trialDays) {
      sessionParams.subscription_data = {
        trial_period_days: trialDays,
      };
    }

    const checkoutSession = await stripe.checkout.sessions.create(sessionParams);

    // Log checkout event
    await db.insert(subscriptionEvents).values({
      tenantId,
      type: "checkout_session_created",
      payload: {
        sessionId: checkoutSession.id,
        planCode: body.planCode,
        stripePriceId,
        trialDays,
      },
    });

    return NextResponse.json({
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (error) {
    console.error("POST /api/billing/checkout error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
