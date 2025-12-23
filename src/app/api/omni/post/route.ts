/**
 * POST /api/omni/post
 *
 * Post a transaction set to the ledger.
 * Creates journal entries and journal lines via the posting service.
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
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { postTransactionSet } from "@/lib/posting";

interface PostRequestBody {
  transactionSetId: string;
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
    const body: PostRequestBody = await req.json();

    if (!body.transactionSetId) {
      return NextResponse.json(
        { error: "transactionSetId is required" },
        { status: 400 }
      );
    }

    // 4. Post via posting service (THE ONLY place that writes to ledger)
    const result = await postTransactionSet({
      tenantId,
      actorId: actor.actorId,
      transactionSetId: body.transactionSetId,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          postingRunId: result.postingRunId,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      transactionSetId: body.transactionSetId,
      journalEntryId: result.journalEntryId,
      journalLineIds: result.journalLineIds,
      postingRunId: result.postingRunId,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Post error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
