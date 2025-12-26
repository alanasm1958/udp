/**
 * /api/billing/webhook
 *
 * POST: Handle Stripe webhook events
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tenantSubscriptions, subscriptionEvents, subscriptionPlans } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

// Check if we're in dev billing mode
function isDevBillingMode(): boolean {
  return !process.env.STRIPE_SECRET_KEY || process.env.BILLING_PROVIDER === "dev";
}

/**
 * POST /api/billing/webhook
 * Handle Stripe webhook events
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Dev mode - webhooks not available
    if (isDevBillingMode()) {
      return NextResponse.json(
        { error: "Webhooks not available in dev mode" },
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

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    // Get raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 400 }
      );
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    // Handle the event
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;
        const stripeSubId = subscription.id;
        const status = subscription.status;

        // Find tenant by customer ID
        const [tenantSub] = await db
          .select()
          .from(tenantSubscriptions)
          .where(eq(tenantSubscriptions.stripeCustomerId, customerId))
          .limit(1);

        if (!tenantSub) {
          console.error(`No tenant found for Stripe customer: ${customerId}`);
          return NextResponse.json({ received: true });
        }

        // Get plan code from price
        const priceId = subscription.items.data[0]?.price?.id;
        let planCode = tenantSub.planCode;

        if (priceId) {
          const [plan] = await db
            .select()
            .from(subscriptionPlans)
            .where(eq(subscriptionPlans.stripePriceId, priceId))
            .limit(1);

          if (plan) {
            planCode = plan.code;
          }
        }

        // Map Stripe status to our status
        let ourStatus: "trialing" | "active" | "past_due" | "canceled" = "active";
        if (status === "trialing") ourStatus = "trialing";
        else if (status === "past_due") ourStatus = "past_due";
        else if (status === "canceled" || status === "unpaid") ourStatus = "canceled";

        // Update subscription
        await db
          .update(tenantSubscriptions)
          .set({
            planCode,
            status: ourStatus,
            stripeSubscriptionId: stripeSubId,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            updatedAt: sql`now()`,
          })
          .where(eq(tenantSubscriptions.id, tenantSub.id));

        // Log event
        await db.insert(subscriptionEvents).values({
          tenantId: tenantSub.tenantId,
          type: event.type,
          payload: {
            stripeSubscriptionId: stripeSubId,
            status,
            planCode,
          },
        });

        break;
      }

      case "customer.subscription.deleted": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;

        const [tenantSub] = await db
          .select()
          .from(tenantSubscriptions)
          .where(eq(tenantSubscriptions.stripeCustomerId, customerId))
          .limit(1);

        if (tenantSub) {
          await db
            .update(tenantSubscriptions)
            .set({
              status: "canceled",
              cancelAtPeriodEnd: false,
              updatedAt: sql`now()`,
            })
            .where(eq(tenantSubscriptions.id, tenantSub.id));

          await db.insert(subscriptionEvents).values({
            tenantId: tenantSub.tenantId,
            type: event.type,
            payload: {
              stripeSubscriptionId: subscription.id,
            },
          });
        }
        break;
      }

      case "invoice.payment_succeeded": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoice = event.data.object as any;
        const customerId = invoice.customer as string;

        const [tenantSub] = await db
          .select()
          .from(tenantSubscriptions)
          .where(eq(tenantSubscriptions.stripeCustomerId, customerId))
          .limit(1);

        if (tenantSub) {
          // Update to active if was past_due
          if (tenantSub.status === "past_due") {
            await db
              .update(tenantSubscriptions)
              .set({
                status: "active",
                updatedAt: sql`now()`,
              })
              .where(eq(tenantSubscriptions.id, tenantSub.id));
          }

          await db.insert(subscriptionEvents).values({
            tenantId: tenantSub.tenantId,
            type: event.type,
            payload: {
              invoiceId: invoice.id,
              amountPaid: invoice.amount_paid,
            },
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoice = event.data.object as any;
        const customerId = invoice.customer as string;

        const [tenantSub] = await db
          .select()
          .from(tenantSubscriptions)
          .where(eq(tenantSubscriptions.stripeCustomerId, customerId))
          .limit(1);

        if (tenantSub) {
          await db
            .update(tenantSubscriptions)
            .set({
              status: "past_due",
              updatedAt: sql`now()`,
            })
            .where(eq(tenantSubscriptions.id, tenantSub.id));

          await db.insert(subscriptionEvents).values({
            tenantId: tenantSub.tenantId,
            type: event.type,
            payload: {
              invoiceId: invoice.id,
              attemptCount: invoice.attempt_count,
            },
          });
        }
        break;
      }

      default:
        // Unhandled event type
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("POST /api/billing/webhook error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
