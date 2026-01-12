/**
 * /api/sales-customers/leads/stats
 *
 * Lead statistics for overview cards
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  TenantError,
} from "@/lib/tenant";

/**
 * GET /api/sales-customers/leads/stats
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);

    const stats = await db
      .select({
        status: leads.status,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .where(eq(leads.tenantId, tenantId))
      .groupBy(leads.status);

    const result = {
      total: 0,
      new: 0,
      contacted: 0,
      qualified: 0,
      disqualified: 0,
      won: 0,
      lost: 0,
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
    console.error("GET /api/sales-customers/leads/stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
