/**
 * /api/admin/tenant/subscription
 *
 * POST: Manually set tenant subscription (for testing or when Stripe is not configured)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole, ROLES, AuthContext } from "@/lib/authz";
import { setTenantSubscriptionManual, SubscriptionStatus } from "@/lib/subscription";
import { db } from "@/db";
import { actors } from "@/db/schema";
import { eq, and } from "drizzle-orm";

interface ManualSubscriptionRequest {
  planCode: string;
  status?: SubscriptionStatus;
  currentPeriodEnd?: string; // ISO date string
}

/**
 * POST /api/admin/tenant/subscription
 * Manually set tenant subscription
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // RBAC: admin only
    const roleCheck = requireRole(req, [ROLES.ADMIN]);
    if (roleCheck instanceof NextResponse) return roleCheck;
    const auth = roleCheck as AuthContext;

    const body: ManualSubscriptionRequest = await req.json();

    if (!body.planCode) {
      return NextResponse.json({ error: "planCode is required" }, { status: 400 });
    }

    // Get actor ID for audit
    let actorId: string | null = null;
    if (auth.userId) {
      const [actor] = await db
        .select({ id: actors.id })
        .from(actors)
        .where(
          and(
            eq(actors.tenantId, auth.tenantId),
            eq(actors.userId, auth.userId)
          )
        )
        .limit(1);
      actorId = actor?.id ?? null;
    }

    // Parse optional overrides
    const overrides: {
      status?: SubscriptionStatus;
      currentPeriodEnd?: Date;
    } = {};

    if (body.status) {
      overrides.status = body.status;
    }

    if (body.currentPeriodEnd) {
      overrides.currentPeriodEnd = new Date(body.currentPeriodEnd);
    }

    // Set the subscription
    const subscription = await setTenantSubscriptionManual(
      auth.tenantId,
      body.planCode,
      actorId,
      overrides
    );

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        planCode: subscription.planCode,
        planName: subscription.planName,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        isPromotional: subscription.isPromotional,
      },
    });
  } catch (error) {
    console.error("POST /api/admin/tenant/subscription error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
