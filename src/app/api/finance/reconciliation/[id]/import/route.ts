/**
 * /api/finance/reconciliation/[id]/import
 *
 * POST: Import bank statement lines from CSV
 */

import { NextRequest, NextResponse } from "next/server";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { db } from "@/db";
import { bankReconciliationSessions, bankStatementLines } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createAuditContext } from "@/lib/audit";
import { parseBankCSV, BankStatementLine } from "@/lib/csv-parser";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/finance/reconciliation/[id]/import
 * Body:
 *   - csvContent: string (CSV file content)
 *   - format?: "generic" | "chase" | "bofa" | "wells" (optional, auto-detected)
 */
export async function POST(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);
    const { id } = await params;
    const body = await req.json();

    const { csvContent, format } = body;

    if (!csvContent) {
      return NextResponse.json({ error: "csvContent is required" }, { status: 400 });
    }

    // Verify session exists and is in progress
    const [session] = await db
      .select()
      .from(bankReconciliationSessions)
      .where(
        and(
          eq(bankReconciliationSessions.id, id),
          eq(bankReconciliationSessions.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.status !== "in_progress") {
      return NextResponse.json(
        { error: "Cannot import to a completed or abandoned session" },
        { status: 400 }
      );
    }

    // Parse CSV
    let parsedLines: BankStatementLine[];
    try {
      parsedLines = parseBankCSV(csvContent, format);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to parse CSV" },
        { status: 400 }
      );
    }

    if (parsedLines.length === 0) {
      return NextResponse.json({ error: "No valid lines found in CSV" }, { status: 400 });
    }

    // Insert lines - using the schema's bankStatementLines table
    const insertedLines = await db
      .insert(bankStatementLines)
      .values(
        parsedLines.map((line) => ({
          tenantId,
          reconciliationSessionId: id,
          transactionDate: line.date,
          description: line.description,
          reference: line.reference || null,
          amount: line.type === "debit" ? (-line.amount).toFixed(6) : line.amount.toFixed(6),
          transactionType: line.type.toUpperCase(),
          status: "unmatched" as const,
        }))
      )
      .returning();

    await audit.log(
      "bank_reconciliation_session",
      id,
      "reconciliation_lines_imported",
      {
        lineCount: insertedLines.length,
        format: format || "auto",
      }
    );

    return NextResponse.json({
      imported: insertedLines.length,
      lines: insertedLines.map((line) => ({
        id: line.id,
        transactionDate: line.transactionDate,
        description: line.description,
        reference: line.reference,
        amount: parseFloat(line.amount),
        transactionType: line.transactionType,
        status: line.status,
      })),
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/finance/reconciliation/[id]/import error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
