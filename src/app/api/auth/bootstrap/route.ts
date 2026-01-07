/**
 * POST /api/auth/bootstrap
 * DEV-ONLY: Create initial admin user for testing
 * Only works when NODE_ENV !== "production"
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { tenants, users, actors, roles, userRoles, subscriptionPlans, tenantSubscriptions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "@/lib/password";

const ADMIN_EMAIL = "admin@local";
const ADMIN_PASSWORD = "admin1234";
const ADMIN_NAME = "Admin User";
const TENANT_NAME = "Dev Tenant";

export async function POST(): Promise<NextResponse> {
  // Block in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Bootstrap not available in production" },
      { status: 403 }
    );
  }

  try {
    // Seed subscription plans first (global - not tenant-scoped)
    // This runs even if user exists to ensure plans are always available
    // Plans must match scripts/seed/subscription_plans.ts
    const plansToSeed = [
      {
        code: "free",
        name: "Free",
        description: "Basic features, free forever.",
        priceAmount: "0.00",
        billingType: "recurring" as const,
        interval: "month",
        intervalCount: 1,
        currency: "USD",
        stripePriceId: null,
        isActive: true,
      },
      {
        code: "monthly_30",
        name: "Monthly",
        description: "Full access billed monthly. Cancel anytime.",
        priceAmount: "30.00",
        billingType: "recurring" as const,
        interval: "month",
        intervalCount: 1,
        currency: "USD",
        stripePriceId: null,
        isActive: true,
      },
      {
        code: "six_month_pack_25",
        name: "6-Month Package",
        description: "Best value - $25/month billed upfront for 6 months.",
        priceAmount: "150.00",
        billingType: "recurring" as const,
        interval: "month",
        intervalCount: 6,
        durationMonths: 6,
        currency: "USD",
        stripePriceId: null,
        isActive: true,
      },
      {
        code: "promo_free_6m",
        name: "Limited Offer",
        description: "6 months free - promotional offer. Ends March 2026.",
        priceAmount: "0.00",
        billingType: "trial" as const,
        interval: "month",
        intervalCount: 6,
        trialDays: 180,
        durationMonths: 6,
        isPromotional: true,
        currency: "USD",
        stripePriceId: null,
        isActive: true,
      },
    ];

    for (const planData of plansToSeed) {
      const [existingPlan] = await db
        .select({ id: subscriptionPlans.id })
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.code, planData.code))
        .limit(1);

      if (!existingPlan) {
        await db.insert(subscriptionPlans).values(planData);
      }
    }

    // Ensure default tenant has a subscription
    // This runs even if user exists to ensure subscription is always available
    let [tenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .limit(1);

    if (tenant) {
      const [existingSub] = await db
        .select({ id: tenantSubscriptions.id })
        .from(tenantSubscriptions)
        .where(eq(tenantSubscriptions.tenantId, tenant.id))
        .limit(1);

      if (!existingSub) {
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setDate(periodEnd.getDate() + 30);

        await db.insert(tenantSubscriptions).values({
          tenantId: tenant.id,
          planCode: "monthly_30", // Give dev tenant full access
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        });
      }
    }

    // Check if admin user already exists
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, ADMIN_EMAIL))
      .limit(1);

    if (existingUser) {
      return NextResponse.json({
        success: true,
        message: "Bootstrap already completed",
        credentials: {
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
        },
      });
    }

    // Get existing tenant or create one
    [tenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .limit(1);

    if (!tenant) {
      const [newTenant] = await db
        .insert(tenants)
        .values({
          name: TENANT_NAME,
          baseCurrency: "USD",
        })
        .returning({ id: tenants.id });
      tenant = newTenant;
    }

    // Hash password
    const passwordHash = await hashPassword(ADMIN_PASSWORD);

    // Create admin user
    const [user] = await db
      .insert(users)
      .values({
        tenantId: tenant.id,
        email: ADMIN_EMAIL,
        fullName: ADMIN_NAME,
        passwordHash,
        isActive: true,
      })
      .returning({ id: users.id });

    // Create actor for user
    const [actor] = await db
      .insert(actors)
      .values({
        tenantId: tenant.id,
        type: "user",
        userId: user.id,
      })
      .returning({ id: actors.id });

    // Create admin role if it doesn't exist
    let [adminRole] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(
        and(
          eq(roles.tenantId, tenant.id),
          eq(roles.name, "admin")
        )
      )
      .limit(1);

    if (!adminRole) {
      const [newRole] = await db
        .insert(roles)
        .values({
          tenantId: tenant.id,
          name: "admin",
        })
        .returning({ id: roles.id });
      adminRole = newRole;
    }

    // Create other standard roles
    const standardRoles = ["finance", "inventory", "sales", "procurement"];
    for (const roleName of standardRoles) {
      const [existing] = await db
        .select({ id: roles.id })
        .from(roles)
        .where(
          and(
            eq(roles.tenantId, tenant.id),
            eq(roles.name, roleName)
          )
        )
        .limit(1);

      if (!existing) {
        await db.insert(roles).values({
          tenantId: tenant.id,
          name: roleName,
        });
      }
    }

    // Assign admin role to user
    await db.insert(userRoles).values({
      tenantId: tenant.id,
      userId: user.id,
      roleId: adminRole.id,
    });

    // Create a default subscription for the tenant (pro plan for dev)
    const [existingSub] = await db
      .select({ id: tenantSubscriptions.id })
      .from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenant.id))
      .limit(1);

    if (!existingSub) {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() + 30);

      await db.insert(tenantSubscriptions).values({
        tenantId: tenant.id,
        planCode: "monthly_30", // Give dev tenant full access
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Bootstrap completed successfully",
      data: {
        tenantId: tenant.id,
        userId: user.id,
        actorId: actor.id,
        roleId: adminRole.id,
      },
      credentials: {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      },
    });
  } catch (error) {
    console.error("POST /api/auth/bootstrap error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bootstrap failed" },
      { status: 500 }
    );
  }
}
