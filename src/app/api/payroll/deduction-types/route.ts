/**
 * /api/payroll/deduction-types
 *
 * List available deduction types for employee enrollment.
 * These are seeded from payroll_types.ts and include benefits, retirement, garnishments, etc.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { deductionTypes } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

/**
 * GET /api/payroll/deduction-types
 * List all available deduction types
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    requireTenantIdFromHeaders(req); // Verify tenant access
    const url = new URL(req.url);

    const categoryFilter = url.searchParams.get("category");
    const activeOnly = url.searchParams.get("activeOnly") !== "false";

    const conditions = [];

    if (activeOnly) {
      conditions.push(eq(deductionTypes.isActive, true));
    }

    if (categoryFilter) {
      conditions.push(eq(deductionTypes.category, categoryFilter));
    }

    const types = await db
      .select({
        id: deductionTypes.id,
        code: deductionTypes.code,
        name: deductionTypes.name,
        category: deductionTypes.category,
        isPretaxFederal: deductionTypes.isPretaxFederal,
        isPretaxState: deductionTypes.isPretaxState,
        isPretaxFica: deductionTypes.isPretaxFica,
        annualLimitEmployee: deductionTypes.annualLimitEmployee,
        annualLimitEmployer: deductionTypes.annualLimitEmployer,
        catchUpAge: deductionTypes.catchUpAge,
        catchUpLimit: deductionTypes.catchUpLimit,
        defaultCalcMethod: deductionTypes.defaultCalcMethod,
        isActive: deductionTypes.isActive,
      })
      .from(deductionTypes)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(deductionTypes.category), asc(deductionTypes.name));

    // Group by category for easier UI consumption
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
      deductionTypes: types,
      byCategory,
      categories: Object.keys(byCategory),
      total: types.length,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/payroll/deduction-types error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
