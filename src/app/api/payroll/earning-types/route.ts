/**
 * /api/payroll/earning-types
 *
 * List available earning types for payroll processing.
 * Includes regular pay, overtime, bonuses, commissions, etc.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { earningTypes } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

/**
 * GET /api/payroll/earning-types
 * List all available earning types
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    requireTenantIdFromHeaders(req); // Verify tenant access
    const url = new URL(req.url);

    const categoryFilter = url.searchParams.get("category");
    const activeOnly = url.searchParams.get("activeOnly") !== "false";

    const conditions = [];

    if (activeOnly) {
      conditions.push(eq(earningTypes.isActive, true));
    }

    if (categoryFilter) {
      conditions.push(eq(earningTypes.category, categoryFilter));
    }

    const types = await db
      .select({
        id: earningTypes.id,
        code: earningTypes.code,
        name: earningTypes.name,
        category: earningTypes.category,
        isTaxableFederal: earningTypes.isTaxableFederal,
        isTaxableState: earningTypes.isTaxableState,
        isTaxableFica: earningTypes.isTaxableFica,
        multiplier: earningTypes.multiplier,
        defaultExpenseAccountCode: earningTypes.defaultExpenseAccountCode,
        isActive: earningTypes.isActive,
      })
      .from(earningTypes)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(earningTypes.category), asc(earningTypes.name));

    // Group by category
    const byCategory = types.reduce(
      (acc, type) => {
        if (!acc[type.category]) {
          acc[type.category] = [];
        }
        acc[type.category].push(type);
        return acc;
      },
      {} as Record<string, typeof types>
    );

    return NextResponse.json({
      earningTypes: types,
      byCategory,
      categories: Object.keys(byCategory),
      total: types.length,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/payroll/earning-types error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
