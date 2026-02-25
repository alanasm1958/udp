/**
 * Seed subscription plans
 *
 * Run: npm run seed:plans
 */

import "dotenv/config";
import { db } from "@/db";
import { subscriptionPlans } from "@/db/schema";
import { sql } from "drizzle-orm";

interface PlanDefinition {
  code: string;
  name: string;
  description: string;
  currency: string;
  priceAmount: string;
  billingType: "recurring" | "trial";
  interval: string;
  intervalCount: number;
  trialDays: number | null;
  durationMonths: number | null;
  isPromotional: boolean;
  isActive: boolean;
}

const plans: PlanDefinition[] = [
  {
    code: "free",
    name: "Free",
    description: "Full access to all features. No credit card required.",
    currency: "USD",
    priceAmount: "0.00",
    billingType: "trial",
    interval: "month",
    intervalCount: 1,
    trialDays: null,
    durationMonths: null,
    isPromotional: false,
    isActive: true,
  },
  // Deactivate legacy plans via upsert
  {
    code: "monthly_30",
    name: "Monthly (Legacy)",
    description: "Legacy plan - no longer available.",
    currency: "USD",
    priceAmount: "30.00",
    billingType: "recurring",
    interval: "month",
    intervalCount: 1,
    trialDays: null,
    durationMonths: null,
    isPromotional: false,
    isActive: false,
  },
  {
    code: "six_month_pack_25",
    name: "6-Month Package (Legacy)",
    description: "Legacy plan - no longer available.",
    currency: "USD",
    priceAmount: "150.00",
    billingType: "recurring",
    interval: "month",
    intervalCount: 6,
    trialDays: null,
    durationMonths: 6,
    isPromotional: false,
    isActive: false,
  },
  {
    code: "promo_free_6m",
    name: "Limited Offer (Legacy)",
    description: "Legacy plan - no longer available.",
    currency: "USD",
    priceAmount: "0.00",
    billingType: "trial",
    interval: "month",
    intervalCount: 6,
    trialDays: 180,
    durationMonths: 6,
    isPromotional: true,
    isActive: false,
  },
];

async function seedPlans() {
  console.log("Seeding subscription plans...");

  for (const plan of plans) {
    await db
      .insert(subscriptionPlans)
      .values({
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
        isActive: plan.isActive,
      })
      .onConflictDoUpdate({
        target: subscriptionPlans.code,
        set: {
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
          isActive: plan.isActive,
          updatedAt: sql`now()`,
        },
      });
    console.log(`  - ${plan.code}: ${plan.name} (active: ${plan.isActive})`);
  }

  console.log("Done seeding subscription plans.");
}

seedPlans()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error seeding plans:", err);
    process.exit(1);
  });
