/**
 * /api/planner/alerts/dismissed
 *
 * GET: List dismissed alert IDs for a domain
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";
import { db } from "@/db";
import { plannerAlertDismissals } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * GET /api/planner/alerts/dismissed?domain=company
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { searchParams } = new URL(req.url);
    const domain = searchParams.get("domain");

    if (!domain) {
      return NextResponse.json({ error: "Missing required parameter: domain" }, { status: 400 });
    }

    const dismissals = await db
      .select({ alertId: plannerAlertDismissals.alertId })
      .from(plannerAlertDismissals)
      .where(
        and(
          eq(plannerAlertDismissals.tenantId, tenantId),
          eq(plannerAlertDismissals.domain, domain)
        )
      );

    return NextResponse.json({
      dismissedAlertIds: dismissals.map((d) => d.alertId),
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/planner/alerts/dismissed error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
