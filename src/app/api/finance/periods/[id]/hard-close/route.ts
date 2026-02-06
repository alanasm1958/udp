/**
 * /api/finance/periods/[id]/hard-close
 *
 * POST: Hard-close an accounting period (locks it from further posting)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { db } from "@/db";
import { accountingPeriods } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { calculatePeriodTotals } from "@/lib/periods";
import { logAuditEvent } from "@/lib/audit";

/**
 * POST /api/finance/periods/[id]/hard-close
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const authResult = requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { tenantId, actorId } = authResult;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { force } = body; // Allow forcing close even with checklist warnings

    // Get the period
    const [period] = await db
      .select()
      .from(accountingPeriods)
      .where(
        and(
          eq(accountingPeriods.id, id),
          eq(accountingPeriods.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!period) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }

    // Validate status - must be soft_closed first (unless forcing from open)
    if (period.status === "hard_closed") {
      return NextResponse.json(
        { error: "Period is already hard-closed" },
        { status: 400 }
      );
    }

    if (period.status === "open" && !force) {
      return NextResponse.json(
        { error: "Period must be soft-closed before hard-closing. Use force=true to skip." },
        { status: 400 }
      );
    }

    // Check checklist items if soft_closed
    if (period.status === "soft_closed" && period.checklistSnapshot && !force) {
      const checklist = period.checklistSnapshot as {
        draftTransactions?: number;
        unmatchedPayments?: number;
      };

      if ((checklist.draftTransactions || 0) > 0) {
        return NextResponse.json(
          {
            error: "Cannot hard-close: draft transactions exist",
            checklistSnapshot: checklist,
            hint: "Resolve draft transactions or use force=true to override",
          },
          { status: 400 }
        );
      }
    }

    // Calculate period totals
    const periodTotals = await calculatePeriodTotals(
      tenantId,
      period.periodStart,
      period.periodEnd
    );

    // Update period
    const [updated] = await db
      .update(accountingPeriods)
      .set({
        status: "hard_closed",
        hardClosedAt: sql`now()`,
        hardClosedByActorId: actorId,
        periodTotals,
        updatedAt: sql`now()`,
      })
      .where(eq(accountingPeriods.id, id))
      .returning();

    // Log audit event
    await logAuditEvent({
      tenantId,
      actorId,
      entityType: "accounting_period",
      entityId: id,
      action: "period_hard_closed",
      metadata: {
        periodLabel: period.periodLabel,
        periodTotals,
        forced: force || false,
      },
    });

    return NextResponse.json({
      success: true,
      period: updated,
      periodTotals,
    });
  } catch (error) {
    console.error("POST /api/finance/periods/[id]/hard-close error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
