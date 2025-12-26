/**
 * /api/billing/webhook
 *
 * POST: Handle Stripe webhook events
 */

import { NextRequest, NextResponse } from "next/server";
import { applyStripeEventToTenantSubscription } from "@/lib/subscription";

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
        const priceId = subscription.items.data[0]?.price?.id;

        await applyStripeEventToTenantSubscription({
          type: event.type,
          customerId,
          subscriptionId: subscription.id,
          status: subscription.status,
          priceId,
          periodStart: new Date(subscription.current_period_start * 1000),
          periodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });

        break;
      }

      case "customer.subscription.deleted": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;

        await applyStripeEventToTenantSubscription({
          type: event.type,
          customerId,
          subscriptionId: subscription.id,
          status: "canceled",
        });

        break;
      }

      case "invoice.payment_succeeded": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoice = event.data.object as any;
        const customerId = invoice.customer as string;

        await applyStripeEventToTenantSubscription({
          type: event.type,
          customerId,
          status: "active",
        });

        break;
      }

      case "invoice.payment_failed": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoice = event.data.object as any;
        const customerId = invoice.customer as string;

        await applyStripeEventToTenantSubscription({
          type: event.type,
          customerId,
          status: "past_due",
        });

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
