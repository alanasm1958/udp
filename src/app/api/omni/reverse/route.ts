/**
 * POST /api/omni/reverse
 *
 * Reverse a posted journal entry.
 * Creates a new journal entry with inverted lines (debits become credits, credits become debits).
 *
 * IMPORTANT: This route does NOT directly write to ledger tables.
 * All ledger writes go through src/lib/posting.ts only.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
  isValidUUID,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { reverseJournalEntry } from "@/lib/posting";

interface ReverseRequestBody {
  originalJournalEntryId: string;
  reason: string;
  postingDate?: string;
  memo?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Extract tenant context from headers
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    // 2. Resolve actor
    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);

    // 3. Parse request body
    const body: ReverseRequestBody = await req.json();

    // 4. Validate required fields
    if (!body.originalJournalEntryId) {
      return NextResponse.json(
        { error: "originalJournalEntryId is required" },
        { status: 400 }
      );
    }

    if (!isValidUUID(body.originalJournalEntryId)) {
      return NextResponse.json(
        { error: "originalJournalEntryId must be a valid UUID" },
        { status: 400 }
      );
    }

    if (!body.reason || body.reason.trim() === "") {
      return NextResponse.json(
        { error: "reason is required" },
        { status: 400 }
      );
    }

    // 5. Validate postingDate format if provided
    if (body.postingDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.postingDate)) {
      return NextResponse.json(
        { error: "postingDate must be in YYYY-MM-DD format" },
        { status: 400 }
      );
    }

    // 6. Call reversal service (THE ONLY place that writes to ledger)
    const result = await reverseJournalEntry({
      tenantId,
      actorId: actor.actorId,
      originalJournalEntryId: body.originalJournalEntryId,
      reason: body.reason.trim(),
      postingDate: body.postingDate,
      memo: body.memo,
    });

    if (!result.success) {
      const statusCode = result.error === "Original journal entry not found" ? 404 : 400;
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          originalJournalEntryId: result.originalJournalEntryId,
        },
        { status: statusCode }
      );
    }

    return NextResponse.json({
      originalJournalEntryId: result.originalJournalEntryId,
      reversalJournalEntryId: result.reversalJournalEntryId,
      transactionSetId: result.transactionSetId ?? null,
      idempotent: result.idempotent,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Reverse error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
