/**
 * /api/sales-customers/invoices/stats
 *
 * Invoice statistics for overview cards
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
 * GET /api/sales-customers/invoices/stats
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);

    // Get total invoice count
    const [totalResult] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(salesDocs)
      .where(and(eq(salesDocs.tenantId, tenantId), eq(salesDocs.docType, "invoice")));

    // Get MTD invoice count and amount
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [mtdResult] = await db
      .select({
        count: sql<number>`count(*)::int`,
        amount: sql<number>`coalesce(sum(total_amount::numeric), 0)::float`,
      })
      .from(salesDocs)
      .where(
        and(
          eq(salesDocs.tenantId, tenantId),
          eq(salesDocs.docType, "invoice"),
          gte(salesDocs.docDate, startOfMonth.toISOString().split("T")[0])
        )
      );

    return NextResponse.json({
      total: totalResult?.count || 0,
      mtdCount: mtdResult?.count || 0,
      mtdAmount: mtdResult?.amount || 0,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/sales-customers/invoices/stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
