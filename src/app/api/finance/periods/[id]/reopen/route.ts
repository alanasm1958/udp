/**
 * /api/finance/periods/[id]/reopen
 *
 * POST: Reopen a closed accounting period
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { db } from "@/db";
import { accountingPeriods } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit";

/**
 * POST /api/finance/periods/[id]/reopen
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
    const body = await req.json();
    const { reason } = body;

    if (!reason || reason.trim().length < 10) {
      return NextResponse.json(
        { error: "A reason (at least 10 characters) is required to reopen a period" },
        { status: 400 }
      );
    }

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
    if (period.status === "open") {
      return NextResponse.json(
        { error: "Period is already open" },
        { status: 400 }
      );
    }

    const previousStatus = period.status;

    // Update period
    const [updated] = await db
      .update(accountingPeriods)
      .set({
        status: "open",
        reopenedAt: sql`now()`,
        reopenedByActorId: actorId,
        reopenReason: reason.trim(),
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
      action: "period_reopened",
      metadata: {
        periodLabel: period.periodLabel,
        previousStatus,
        reason: reason.trim(),
      },
    });

    return NextResponse.json({
      success: true,
      period: updated,
      message: `Period ${period.periodLabel} has been reopened`,
    });
  } catch (error) {
    console.error("POST /api/finance/periods/[id]/reopen error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
