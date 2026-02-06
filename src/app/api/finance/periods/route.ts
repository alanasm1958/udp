/**
 * /api/finance/periods
 *
 * GET: List accounting periods for a year
 * POST: Initialize periods for a fiscal year
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getAuthFromHeaders } from "@/lib/authz";
import { db } from "@/db";
import { accountingPeriods } from "@/db/schema";
import { eq, and, gte, lte, asc } from "drizzle-orm";
import { getPeriodEnd, getPeriodLabel } from "@/lib/periods";

/**
 * GET /api/finance/periods?year=2025
 * List all accounting periods for a year
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { tenantId } = authResult;

  try {
    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString(), 10);

    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    // Get existing periods for the year
    const periods = await db
      .select()
      .from(accountingPeriods)
      .where(
        and(
          eq(accountingPeriods.tenantId, tenantId),
          gte(accountingPeriods.periodStart, yearStart),
          lte(accountingPeriods.periodStart, yearEnd)
        )
      )
      .orderBy(asc(accountingPeriods.periodStart));

    // Build full year calendar with existing periods
    const calendar = [];
    for (let month = 0; month < 12; month++) {
      const periodStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const existing = periods.find((p) => p.periodStart === periodStart);

      if (existing) {
        calendar.push({
          id: existing.id,
          periodStart: existing.periodStart,
          periodEnd: existing.periodEnd,
          periodLabel: existing.periodLabel,
          status: existing.status,
          softClosedAt: existing.softClosedAt,
          hardClosedAt: existing.hardClosedAt,
          checklistSnapshot: existing.checklistSnapshot,
          periodTotals: existing.periodTotals,
        });
      } else {
        // Period not yet created
        calendar.push({
          id: null,
          periodStart,
          periodEnd: getPeriodEnd(periodStart),
          periodLabel: getPeriodLabel(periodStart),
          status: "not_created",
          softClosedAt: null,
          hardClosedAt: null,
          checklistSnapshot: null,
          periodTotals: null,
        });
      }
    }

    // Determine current period
    const today = new Date();
    const currentPeriodStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;

    return NextResponse.json({
      year,
      periods: calendar,
      currentPeriod: currentPeriodStart,
    });
  } catch (error) {
    console.error("GET /api/finance/periods error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/finance/periods
 * Initialize periods for a fiscal year
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const authResult = requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { tenantId } = authResult;

  try {
    const body = await req.json();
    const year = body.year || new Date().getFullYear();
    const fiscalYearStart = body.fiscalYearStart || 1; // Month 1-12

    const created = [];

    for (let i = 0; i < 12; i++) {
      const monthIndex = ((fiscalYearStart - 1 + i) % 12);
      const periodYear = fiscalYearStart - 1 + i >= 12 ? year + 1 : year;
      const periodStart = `${periodYear}-${String(monthIndex + 1).padStart(2, "0")}-01`;

      // Check if period already exists
      const [existing] = await db
        .select({ id: accountingPeriods.id })
        .from(accountingPeriods)
        .where(
          and(
            eq(accountingPeriods.tenantId, tenantId),
            eq(accountingPeriods.periodStart, periodStart)
          )
        )
        .limit(1);

      if (!existing) {
        const [newPeriod] = await db
          .insert(accountingPeriods)
          .values({
            tenantId,
            periodStart,
            periodEnd: getPeriodEnd(periodStart),
            periodLabel: getPeriodLabel(periodStart),
            status: "open",
          })
          .returning();

        created.push(newPeriod);
      }
    }

    return NextResponse.json({
      success: true,
      created: created.length,
      message: `Initialized ${created.length} periods for fiscal year ${year}`,
    });
  } catch (error) {
    console.error("POST /api/finance/periods error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
