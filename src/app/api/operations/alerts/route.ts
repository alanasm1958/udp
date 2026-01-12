import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { alerts } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

/**
 * GET /api/operations/alerts
 * Returns operations domain alerts sorted by severity and creation date
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "active";
    const limit = parseInt(searchParams.get("limit") || "20");

    // Severity order: critical > warning > info
    const severityOrder = sql`CASE
      WHEN ${alerts.severity} = 'critical' THEN 1
      WHEN ${alerts.severity} = 'warning' THEN 2
      WHEN ${alerts.severity} = 'info' THEN 3
      ELSE 4
    END`;

    const alertResults = await db
      .select({
        id: alerts.id,
        type: alerts.type,
        severity: alerts.severity,
        message: alerts.message,
        status: alerts.status,
        domain: alerts.domain,
        source: alerts.source,
        relatedEntityType: alerts.relatedEntityType,
        relatedEntityId: alerts.relatedEntityId,
        createdAt: alerts.createdAt,
      })
      .from(alerts)
      .where(
        and(
          eq(alerts.tenantId, tenantId),
          eq(alerts.domain, "operations"),
          status !== "all" ? eq(alerts.status, status) : undefined
        )
      )
      .orderBy(
        severityOrder,
        desc(alerts.createdAt)
      )
      .limit(limit);

    return NextResponse.json({
      alerts: alertResults.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Operations alerts error:", error);
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: "Failed to fetch operations alerts" },
      { status: 500 }
    );
  }
}
