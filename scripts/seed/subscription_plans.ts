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
    code: "monthly_30",
    name: "Monthly",
    description: "Full access billed monthly. Cancel anytime.",
    currency: "USD",
    priceAmount: "30.00",
    billingType: "recurring",
    interval: "month",
    intervalCount: 1,
    trialDays: null,
    durationMonths: null,
    isPromotional: false,
    isActive: true,
  },
  {
    code: "six_month_pack_25",
    name: "6-Month Package",
    description: "Best value - $25/month billed upfront for 6 months.",
    currency: "USD",
    priceAmount: "150.00",
    billingType: "recurring",
    interval: "month",
    intervalCount: 6,
    trialDays: null,
    durationMonths: 6,
    isPromotional: false,
    isActive: true,
  },
  {
    code: "promo_free_6m",
    name: "Limited Offer",
    description: "6 months free - promotional offer. Ends March 2026.",
    currency: "USD",
    priceAmount: "0.00",
    billingType: "trial",
    interval: "month",
    intervalCount: 6,
    trialDays: 180,
    durationMonths: 6,
    isPromotional: true,
    isActive: true,
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
    console.log(`  - ${plan.code}: ${plan.name}`);
  }

  console.log("Done seeding subscription plans.");
}

seedPlans()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error seeding plans:", err);
    process.exit(1);
  });
