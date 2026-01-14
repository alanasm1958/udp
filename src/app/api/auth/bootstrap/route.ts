/**
 * POST /api/auth/bootstrap
 * DEV-ONLY: Create initial admin user for testing
 * Only works when NODE_ENV !== "production"
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { tenants, users, actors, roles, userRoles, subscriptionPlans, tenantSubscriptions, permissions, rolePermissions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "@/lib/password";
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";

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
    const plansToSeed = [
      {
        code: "free",
        name: "Free",
        priceMonthlyCents: 0,
        currency: "USD",
        stripePriceId: null,
        isActive: true,
      },
      {
        code: "starter",
        name: "Starter",
        priceMonthlyCents: 2900, // $29/mo
        currency: "USD",
        stripePriceId: process.env.STRIPE_PRICE_STARTER || null,
        isActive: true,
      },
      {
        code: "pro",
        name: "Pro",
        priceMonthlyCents: 9900, // $99/mo
        currency: "USD",
        stripePriceId: process.env.STRIPE_PRICE_PRO || null,
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

    // Seed global permissions (not tenant-scoped)
    const [existingPerm] = await db
      .select({ id: permissions.id })
      .from(permissions)
      .limit(1);

    if (!existingPerm) {
      await db.insert(permissions).values(ALL_PERMISSIONS);
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
          planCode: "pro", // Give dev tenant pro access
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

    // Create other standard roles and seed their default permissions
    const standardRoles = ["finance", "inventory", "sales", "procurement"];

    // Get all permissions for mapping code -> id
    const allPerms = await db.select().from(permissions);
    const permMap = new Map(allPerms.map((p) => [p.code, p.id]));

    for (const roleName of standardRoles) {
      let [existingRole] = await db
        .select({ id: roles.id })
        .from(roles)
        .where(
          and(
            eq(roles.tenantId, tenant.id),
            eq(roles.name, roleName)
          )
        )
        .limit(1);

      if (!existingRole) {
        const [newRole] = await db.insert(roles).values({
          tenantId: tenant.id,
          name: roleName,
        }).returning({ id: roles.id });
        existingRole = newRole;
      }

      // Seed default permissions for this role if none exist
      const [existingRolePerm] = await db
        .select({ permissionId: rolePermissions.permissionId })
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, existingRole.id))
        .limit(1);

      if (!existingRolePerm) {
        const defaultPerms = DEFAULT_ROLE_PERMISSIONS[roleName] || [];
        const permissionValues = defaultPerms
          .map((code) => permMap.get(code))
          .filter((id): id is string => id !== undefined)
          .map((permissionId) => ({
            tenantId: tenant.id,
            roleId: existingRole.id,
            permissionId,
          }));

        if (permissionValues.length > 0) {
          await db.insert(rolePermissions).values(permissionValues);
        }
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
        planCode: "pro", // Give dev tenant pro access
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
