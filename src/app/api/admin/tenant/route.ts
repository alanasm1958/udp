/**
 * /api/admin/tenant
 *
 * GET: Get tenant info and subscription status
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tenants, tenantSubscriptions, subscriptionPlans, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireRole, ROLES, AuthContext } from "@/lib/authz";

/**
 * GET /api/admin/tenant
 * Get tenant info including subscription status
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // RBAC: admin only
    const roleCheck = requireRole(req, [ROLES.ADMIN]);
    if (roleCheck instanceof NextResponse) return roleCheck;
    const auth = roleCheck as AuthContext;

    // Get tenant info
    const [tenant] = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        baseCurrency: tenants.baseCurrency,
        createdAt: tenants.createdAt,
      })
      .from(tenants)
      .where(eq(tenants.id, auth.tenantId))
      .limit(1);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Get subscription status
    const [subscription] = await db
      .select({
        id: tenantSubscriptions.id,
        planCode: tenantSubscriptions.planCode,
        status: tenantSubscriptions.status,
        currentPeriodStart: tenantSubscriptions.currentPeriodStart,
        currentPeriodEnd: tenantSubscriptions.currentPeriodEnd,
        cancelAtPeriodEnd: tenantSubscriptions.cancelAtPeriodEnd,
      })
      .from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, auth.tenantId))
      .limit(1);

    // Get plan details if subscription exists
    let plan = null;
    if (subscription) {
      const [planRow] = await db
        .select({
          code: subscriptionPlans.code,
          name: subscriptionPlans.name,
          priceMonthlyCents: subscriptionPlans.priceMonthlyCents,
          currency: subscriptionPlans.currency,
        })
        .from(subscriptionPlans)
        .where(
          and(
            eq(subscriptionPlans.code, subscription.planCode),
            eq(subscriptionPlans.isActive, true)
          )
        )
        .limit(1);
      plan = planRow || null;
    }

    // Get user count
    const userRows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.tenantId, auth.tenantId));

    const activeUserRows = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.tenantId, auth.tenantId),
          eq(users.isActive, true)
        )
      );

    return NextResponse.json({
      tenant: {
        ...tenant,
        userCount: userRows.length,
        activeUserCount: activeUserRows.length,
      },
      subscription: subscription
        ? {
            ...subscription,
            plan,
            isActive: subscription.status === "active" || subscription.status === "trialing",
          }
        : null,
    });
  } catch (error) {
    console.error("GET /api/admin/tenant error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
