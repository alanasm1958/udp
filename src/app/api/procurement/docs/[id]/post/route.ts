/**
 * /api/procurement/docs/[id]/post
 *
 * POST: Post a purchase invoice to the ledger
 */

import { NextRequest, NextResponse } from "next/server";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { postPurchaseDoc } from "@/lib/posting";

interface PostRequest {
  memo?: string;
}

/**
 * POST /api/procurement/docs/[id]/post
 * Post a purchase invoice to the ledger
 *
 * Creates journal entries:
 * - Dr Inventory (for goods) or Expense (for services)
 * - Cr Accounts Payable
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);

    const { id: purchaseDocId } = await params;

    let body: PostRequest = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is fine
    }

    const result = await postPurchaseDoc({
      tenantId,
      actorId: actor.actorId,
      purchaseDocId,
      memo: body.memo,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to post purchase document" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        status: "posted",
        journalEntryId: result.journalEntryId,
        transactionSetId: result.transactionSetId,
        idempotent: result.idempotent,
      },
      { status: result.idempotent ? 200 : 201 }
    );
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/procurement/docs/[id]/post error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
