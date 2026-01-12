/**
 * /api/sales-customers/quotes/stats
 *
 * Quote statistics for overview cards
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { salesDocs } from "@/db/schema";
import { eq, and, sql, gte } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  TenantError,
} from "@/lib/tenant";

/**
 * GET /api/sales-customers/quotes/stats
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);

    // Get quote counts by status
    const stats = await db
      .select({
        status: salesDocs.status,
        count: sql<number>`count(*)::int`,
      })
      .from(salesDocs)
      .where(and(eq(salesDocs.tenantId, tenantId), eq(salesDocs.docType, "quote")))
      .groupBy(salesDocs.status);

    // Get quotes expiring soon (within 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const [expiringResult] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(salesDocs)
      .where(
        and(
          eq(salesDocs.tenantId, tenantId),
          eq(salesDocs.docType, "quote"),
          eq(salesDocs.status, "sent"),
          // Assume dueDate is used as expiry for quotes
          gte(salesDocs.dueDate, new Date().toISOString().split("T")[0])
        )
      );

    const result = {
      total: 0,
      draft: 0,
      sent: 0,
      accepted: 0,
      rejected: 0,
      expired: 0,
      expiringSoon: expiringResult?.count || 0,
    };

    for (const row of stats) {
      result.total += row.count;
      if (row.status in result) {
        result[row.status as keyof typeof result] = row.count;
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/sales-customers/quotes/stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
