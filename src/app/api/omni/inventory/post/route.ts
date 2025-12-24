/**
 * POST /api/omni/inventory/post
 *
 * Post inventory movements from a transaction set.
 * This updates inventory balances and creates journal entries if needed.
 * All ledger writes go through src/lib/posting.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { postInventoryMovements } from "@/lib/posting";

interface InventoryPostRequest {
  transactionSetId: string;
  memo?: string;
}

// Validate UUID format
function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * POST /api/omni/inventory/post
 * Post inventory movements and update balances
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);

    const body: InventoryPostRequest = await req.json();

    // Validate required fields
    if (!body.transactionSetId) {
      return NextResponse.json(
        { error: "transactionSetId is required" },
        { status: 400 }
      );
    }

    if (!isValidUuid(body.transactionSetId)) {
      return NextResponse.json(
        { error: "Invalid transactionSetId format" },
        { status: 400 }
      );
    }

    // Call the posting function from posting.ts
    const result = await postInventoryMovements({
      tenantId,
      actorId: actor.actorId,
      transactionSetId: body.transactionSetId,
      memo: body.memo,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      transactionSetId: result.transactionSetId,
      movementIds: result.movementIds,
      journalEntryId: result.journalEntryId,
      status: result.status,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/omni/inventory/post error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
