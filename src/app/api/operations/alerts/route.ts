import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { masterAlerts } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

/**
 * GET /api/operations/alerts
 * Returns operations domain alerts sorted by severity and creation date
 * Now uses master_alerts table with domain='operations'
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "active";
    const limit = parseInt(searchParams.get("limit") || "20");

    // Severity order: critical > warning > info
    const severityOrder = sql`CASE
      WHEN ${masterAlerts.severity} = 'critical' THEN 1
      WHEN ${masterAlerts.severity} = 'warning' THEN 2
      WHEN ${masterAlerts.severity} = 'info' THEN 3
      ELSE 4
    END`;

    const alertResults = await db
      .select({
        id: masterAlerts.id,
        title: masterAlerts.title,
        message: masterAlerts.message,
        severity: masterAlerts.severity,
        status: masterAlerts.status,
        source: masterAlerts.source,
        alertType: masterAlerts.alertType,
        relatedEntityType: masterAlerts.relatedEntityType,
        relatedEntityId: masterAlerts.relatedEntityId,
        createdAt: masterAlerts.createdAt,
      })
      .from(masterAlerts)
      .where(
        and(
          eq(masterAlerts.tenantId, tenantId),
          eq(masterAlerts.domain, "operations"),
          status !== "all" ? eq(masterAlerts.status, status as typeof masterAlerts.status.enumValues[number]) : undefined
        )
      )
      .orderBy(
        severityOrder,
        desc(masterAlerts.createdAt)
      )
      .limit(limit);

    return NextResponse.json({
      alerts: alertResults.map((a) => ({
        ...a,
        type: a.alertType,
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
