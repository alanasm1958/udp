/**
 * Subscription helper library
 *
 * Provides functions for managing tenant subscriptions
 */

import { db } from "@/db";
import { tenantSubscriptions, subscriptionPlans, subscriptionEvents } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export type SubscriptionStatus = "none" | "trialing" | "active" | "past_due" | "canceled" | "expired";

export interface CurrentSubscription {
  id: string;
  tenantId: string;
  planCode: string;
  status: SubscriptionStatus;
  isCurrent: boolean;
  startedAt: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  endedAt: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  // Joined plan fields
  planName?: string;
  planDescription?: string;
  isPromotional?: boolean;
}

export interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  currency: string;
  priceAmount: string;
  billingType: "recurring" | "trial";
  interval: string;
  intervalCount: number;
  trialDays: number | null;
  durationMonths: number | null;
  isPromotional: boolean;
  isActive: boolean;
  stripePriceId: string | null;
}

/**
 * Get the current subscription for a tenant
 * Returns null if no subscription exists
 */
export async function getCurrentSubscription(tenantId: string): Promise<CurrentSubscription | null> {
  const [sub] = await db
    .select({
      id: tenantSubscriptions.id,
      tenantId: tenantSubscriptions.tenantId,
      planCode: tenantSubscriptions.planCode,
      status: tenantSubscriptions.status,
      isCurrent: tenantSubscriptions.isCurrent,
      startedAt: tenantSubscriptions.startedAt,
      currentPeriodStart: tenantSubscriptions.currentPeriodStart,
      currentPeriodEnd: tenantSubscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: tenantSubscriptions.cancelAtPeriodEnd,
      endedAt: tenantSubscriptions.endedAt,
      stripeCustomerId: tenantSubscriptions.stripeCustomerId,
      stripeSubscriptionId: tenantSubscriptions.stripeSubscriptionId,
      planName: subscriptionPlans.name,
      planDescription: subscriptionPlans.description,
      isPromotional: subscriptionPlans.isPromotional,
    })
    .from(tenantSubscriptions)
    .leftJoin(subscriptionPlans, eq(subscriptionPlans.code, tenantSubscriptions.planCode))
    .where(
      and(
        eq(tenantSubscriptions.tenantId, tenantId),
        eq(tenantSubscriptions.isCurrent, true)
      )
    )
    .limit(1);

  if (!sub) return null;

  return {
    ...sub,
    status: sub.status as SubscriptionStatus,
    planName: sub.planName ?? undefined,
    planDescription: sub.planDescription ?? undefined,
    isPromotional: sub.isPromotional ?? undefined,
  };
}

export interface ManualSubscriptionOverrides {
  status?: SubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
}

/**
 * Set a tenant subscription manually (for testing or when Stripe is not configured)
 */
export async function setTenantSubscriptionManual(
  tenantId: string,
  planCode: string,
  actorId: string | null,
  overrides: ManualSubscriptionOverrides = {}
): Promise<CurrentSubscription> {
  // First, verify the plan exists
  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.code, planCode))
    .limit(1);

  if (!plan) {
    throw new Error(`Plan not found: ${planCode}`);
  }

  const now = new Date();

  // Calculate default period end based on plan
  let periodEnd = new Date(now);
  if (plan.billingType === "trial" && plan.trialDays) {
    periodEnd.setDate(periodEnd.getDate() + plan.trialDays);
  } else if (plan.durationMonths) {
    periodEnd.setMonth(periodEnd.getMonth() + plan.durationMonths);
  } else {
    // Default to one interval
    periodEnd.setMonth(periodEnd.getMonth() + (plan.intervalCount || 1));
  }

  // Determine default status
  let status: SubscriptionStatus = plan.billingType === "trial" ? "trialing" : "active";

  // Apply overrides
  if (overrides.status) status = overrides.status;
  if (overrides.currentPeriodEnd) periodEnd = overrides.currentPeriodEnd;

  // Check for existing current subscription
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

  if (existingSub) {
    // Mark old subscription as not current
    await db
      .update(tenantSubscriptions)
      .set({
        isCurrent: false,
        endedAt: now,
        updatedAt: sql`now()`,
      })
      .where(eq(tenantSubscriptions.id, existingSub.id));
  }

  // Create new subscription record
  const [newSub] = await db
    .insert(tenantSubscriptions)
    .values({
      tenantId,
      planCode,
      status,
      isCurrent: true,
      startedAt: now,
      currentPeriodStart: overrides.currentPeriodStart ?? now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: overrides.cancelAtPeriodEnd ?? false,
      createdByActorId: actorId,
      metadata: { source: "manual" },
    })
    .returning();

  // Log event
  await db.insert(subscriptionEvents).values({
    tenantId,
    type: "subscription_set_manual",
    payload: {
      planCode,
      status,
      actorId,
      periodEnd: periodEnd.toISOString(),
    },
  });

  return {
    id: newSub.id,
    tenantId: newSub.tenantId,
    planCode: newSub.planCode,
    status: newSub.status as SubscriptionStatus,
    isCurrent: newSub.isCurrent,
    startedAt: newSub.startedAt,
    currentPeriodStart: newSub.currentPeriodStart,
    currentPeriodEnd: newSub.currentPeriodEnd,
    cancelAtPeriodEnd: newSub.cancelAtPeriodEnd,
    endedAt: newSub.endedAt,
    stripeCustomerId: newSub.stripeCustomerId,
    stripeSubscriptionId: newSub.stripeSubscriptionId,
    planName: plan.name,
    planDescription: plan.description ?? undefined,
    isPromotional: plan.isPromotional,
  };
}

/**
 * Apply a Stripe webhook event to update tenant subscription
 */
export async function applyStripeEventToTenantSubscription(
  stripeEvent: {
    type: string;
    customerId: string;
    subscriptionId?: string;
    status?: string;
    priceId?: string;
    periodStart?: Date;
    periodEnd?: Date;
    cancelAtPeriodEnd?: boolean;
  }
): Promise<void> {
  // Find the tenant subscription by Stripe customer ID
  const [tenantSub] = await db
    .select()
    .from(tenantSubscriptions)
    .where(eq(tenantSubscriptions.stripeCustomerId, stripeEvent.customerId))
    .limit(1);

  if (!tenantSub) {
    console.error(`No tenant subscription found for Stripe customer: ${stripeEvent.customerId}`);
    return;
  }

  // Get plan code from price ID if available
  let planCode = tenantSub.planCode;
  if (stripeEvent.priceId) {
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.stripePriceId, stripeEvent.priceId))
      .limit(1);
    if (plan) {
      planCode = plan.code;
    }
  }

  // Map Stripe status to our status
  let status: SubscriptionStatus = tenantSub.status as SubscriptionStatus;
  if (stripeEvent.status) {
    switch (stripeEvent.status) {
      case "trialing":
        status = "trialing";
        break;
      case "active":
        status = "active";
        break;
      case "past_due":
        status = "past_due";
        break;
      case "canceled":
      case "unpaid":
        status = "canceled";
        break;
    }
  }

  // Update subscription
  await db
    .update(tenantSubscriptions)
    .set({
      planCode,
      status,
      stripeSubscriptionId: stripeEvent.subscriptionId ?? tenantSub.stripeSubscriptionId,
      currentPeriodStart: stripeEvent.periodStart ?? tenantSub.currentPeriodStart,
      currentPeriodEnd: stripeEvent.periodEnd ?? tenantSub.currentPeriodEnd,
      cancelAtPeriodEnd: stripeEvent.cancelAtPeriodEnd ?? tenantSub.cancelAtPeriodEnd,
      updatedAt: sql`now()`,
    })
    .where(eq(tenantSubscriptions.id, tenantSub.id));

  // Log event
  await db.insert(subscriptionEvents).values({
    tenantId: tenantSub.tenantId,
    type: stripeEvent.type,
    payload: {
      stripeSubscriptionId: stripeEvent.subscriptionId,
      status,
      planCode,
    },
  });
}

/**
 * Get all active subscription plans
 */
export async function getActivePlans(): Promise<SubscriptionPlan[]> {
  const plans = await db
    .select({
      id: subscriptionPlans.id,
      code: subscriptionPlans.code,
      name: subscriptionPlans.name,
      description: subscriptionPlans.description,
      currency: subscriptionPlans.currency,
      priceAmount: subscriptionPlans.priceAmount,
      billingType: subscriptionPlans.billingType,
      interval: subscriptionPlans.interval,
      intervalCount: subscriptionPlans.intervalCount,
      trialDays: subscriptionPlans.trialDays,
      durationMonths: subscriptionPlans.durationMonths,
      isPromotional: subscriptionPlans.isPromotional,
      isActive: subscriptionPlans.isActive,
      stripePriceId: subscriptionPlans.stripePriceId,
    })
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.isActive, true))
    .orderBy(subscriptionPlans.priceAmount);

  return plans as SubscriptionPlan[];
}
