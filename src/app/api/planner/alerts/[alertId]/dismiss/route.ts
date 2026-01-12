/**
 * /api/planner/alerts/[alertId]/dismiss
 *
 * POST: Dismiss an alert for a specific domain
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError, getUserIdFromHeaders, isValidUUID } from "@/lib/tenant";
import { db } from "@/db";
import { plannerAlertDismissals, actors } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit";

interface RouteContext {
  params: Promise<{ alertId: string }>;
}

/**
 * POST /api/planner/alerts/[alertId]/dismiss
 * Body: { domain: string }
 */
export async function POST(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userId = getUserIdFromHeaders(req);
    const { alertId } = await context.params;

    if (!userId || !isValidUUID(userId)) {
      return NextResponse.json({ error: "Missing or invalid x-user-id header" }, { status: 400 });
    }

    if (!alertId) {
      return NextResponse.json({ error: "Invalid alert ID" }, { status: 400 });
    }

    const body = await req.json();
    const { domain } = body;

    if (!domain) {
      return NextResponse.json({ error: "Missing required field: domain" }, { status: 400 });
    }

    // Get or create actor for user
    const actor = await db
      .select()
      .from(actors)
      .where(and(eq(actors.tenantId, tenantId), eq(actors.userId, userId)))
      .limit(1);

    let actorId: string;
    if (actor.length === 0) {
      const newActor = await db
        .insert(actors)
        .values({ tenantId, type: "user", userId })
        .returning({ id: actors.id });
      actorId = newActor[0].id;
    } else {
      actorId = actor[0].id;
    }

    // Check if already dismissed
    const existing = await db
      .select({ id: plannerAlertDismissals.id })
      .from(plannerAlertDismissals)
      .where(
        and(
          eq(plannerAlertDismissals.tenantId, tenantId),
          eq(plannerAlertDismissals.domain, domain),
          eq(plannerAlertDismissals.alertId, alertId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ success: true, alreadyDismissed: true });
    }

    // Insert dismissal
    const result = await db
      .insert(plannerAlertDismissals)
      .values({
        tenantId,
        domain,
        alertId,
        dismissedByActorId: actorId,
      })
      .returning();

    // Audit log
    await logAuditEvent({
      tenantId,
      actorId,
      entityType: "planner_alert_dismissal",
      entityId: result[0].id,
      action: "planner_alert_dismissed",
      metadata: { domain, alertId },
    });

    return NextResponse.json({ success: true, dismissalId: result[0].id });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/planner/alerts/[alertId]/dismiss error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
