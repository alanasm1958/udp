/**
 * /api/people/payroll/runs/[id]/void
 *
 * Void a posted payroll run (creates reversal journal entry)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { payrollRunsV2, payrollRunLines, hrAuditLog } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";
import { reverseJournalEntry } from "@/lib/posting";

interface VoidRequest {
  reason: string;
}

/**
 * POST /api/people/payroll/runs/[id]/void
 * Void a posted payroll run
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const userIdFromHeader = getUserIdFromHeaders(request);
    const actorIdFromHeader = getActorIdFromHeaders(request);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const { id: runId } = await params;
    const body: VoidRequest = await request.json();

    if (!body.reason) {
      return NextResponse.json(
        { error: "Void reason is required" },
        { status: 400 }
      );
    }

    // Check run status
    const [run] = await db
      .select()
      .from(payrollRunsV2)
      .where(and(eq(payrollRunsV2.id, runId), eq(payrollRunsV2.tenantId, tenantId)));

    if (!run) {
      return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    }

    if (run.status !== "posted") {
      return NextResponse.json(
        { error: "Only posted payroll runs can be voided" },
        { status: 400 }
      );
    }

    if (!run.journalEntryId) {
      return NextResponse.json(
        { error: "Payroll run has no journal entry to reverse" },
        { status: 400 }
      );
    }

    // Use posting service to create reversal journal entry
    const reversalResult = await reverseJournalEntry({
      tenantId,
      actorId: actor.actorId,
      originalJournalEntryId: run.journalEntryId,
      reason: body.reason,
      memo: `VOID - Payroll reversal for ${run.periodStart} to ${run.periodEnd}: ${body.reason}`,
    });

    if (!reversalResult.success) {
      return NextResponse.json(
        { error: reversalResult.error || "Failed to create reversal" },
        { status: 400 }
      );
    }

    const reversalJournalEntryId = reversalResult.reversalJournalEntryId!;

    // Update payroll run status
    await db
      .update(payrollRunsV2)
      .set({
        status: "voided",
        voidedAt: new Date(),
        voidedByActorId: actor.actorId,
        voidReason: body.reason,
        updatedAt: new Date(),
        updatedByActorId: actor.actorId,
      })
      .where(eq(payrollRunsV2.id, runId));

    // Get payroll line count for summary
    const lineCount = await db
      .select({ count: sql`COUNT(*)` })
      .from(payrollRunLines)
      .where(eq(payrollRunLines.payrollRunId, runId));

    // Add to HR audit log
    await db.insert(hrAuditLog).values({
      tenantId,
      actorId: actor.actorId,
      entityType: "payroll_run",
      entityId: runId,
      action: "voided",
      beforeSnapshot: {
        status: "posted",
        journalEntryId: run.journalEntryId,
      },
      afterSnapshot: {
        status: "voided",
        voidReason: body.reason,
        reversalJournalEntryId,
      },
    });

    await audit.log("payroll_run", runId, "payroll_run_voided", {
      reason: body.reason,
      originalJournalEntryId: run.journalEntryId,
      reversalJournalEntryId,
    });

    return NextResponse.json({
      success: true,
      message: "Payroll run voided successfully",
      reversalJournalEntryId,
      summary: {
        voidReason: body.reason,
        originalJournalEntryId: run.journalEntryId,
        reversalJournalEntryId,
        employeesAffected: parseInt(String(lineCount[0]?.count || 0)),
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error voiding payroll:", error);
    return NextResponse.json(
      { error: "Failed to void payroll" },
      { status: 500 }
    );
  }
}
