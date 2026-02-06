/**
 * /api/finance/periods/[id]/soft-close
 *
 * POST: Soft-close an accounting period
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { db } from "@/db";
import { accountingPeriods } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { calculateChecklist } from "@/lib/periods";
import { logAuditEvent } from "@/lib/audit";

/**
 * POST /api/finance/periods/[id]/soft-close
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

    // Validate status
    if (period.status !== "open") {
      return NextResponse.json(
        { error: `Cannot soft-close period with status '${period.status}'. Must be 'open'.` },
        { status: 400 }
      );
    }

    // Calculate checklist
    const checklistSnapshot = await calculateChecklist(
      tenantId,
      period.periodStart,
      period.periodEnd
    );

    // Build warnings
    const warnings: string[] = [];
    if (checklistSnapshot.draftTransactions > 0) {
      warnings.push(`${checklistSnapshot.draftTransactions} draft transactions found`);
    }
    if (checklistSnapshot.unmatchedPayments > 0) {
      warnings.push(`${checklistSnapshot.unmatchedPayments} unmatched payments`);
    }

    // Update period
    const [updated] = await db
      .update(accountingPeriods)
      .set({
        status: "soft_closed",
        softClosedAt: sql`now()`,
        softClosedByActorId: actorId,
        checklistSnapshot,
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
      action: "period_soft_closed",
      metadata: {
        periodLabel: period.periodLabel,
        checklistSnapshot,
      },
    });

    return NextResponse.json({
      success: true,
      period: updated,
      checklistSnapshot,
      warnings,
    });
  } catch (error) {
    console.error("POST /api/finance/periods/[id]/soft-close error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
