/**
 * /api/onboarding/complete
 *
 * POST: Mark onboarding as complete
 */

import { NextRequest, NextResponse } from "next/server";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { createAuditContext } from "@/lib/audit";

/**
 * POST /api/onboarding/complete
 * Marks the tenant's onboarding as complete
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    // Update tenant to mark onboarding complete
    await db
      .update(tenants)
      .set({
        // @ts-expect-error - onboardingCompleted may not be in type yet
        onboardingCompleted: true,
        updatedAt: sql`now()`,
      })
      .where(eq(tenants.id, tenantId));

    await audit.log(
      "tenant",
      tenantId,
      "onboarding_completed",
      {
        completedAt: new Date().toISOString(),
      }
    );

    return NextResponse.json({
      success: true,
      message: "Onboarding completed successfully",
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/onboarding/complete error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
