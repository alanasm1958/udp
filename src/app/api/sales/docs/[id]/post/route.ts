/**
 * /api/sales/docs/[id]/post
 *
 * POST: Post a sales invoice to the ledger
 */

import { NextRequest, NextResponse } from "next/server";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { postSalesDoc } from "@/lib/posting";
import { requireRole, ROLES } from "@/lib/authz";

interface PostRequest {
  memo?: string;
}

/**
 * POST /api/sales/docs/[id]/post
 * Post a sales invoice to the ledger
 *
 * Creates journal entries:
 * - Dr Accounts Receivable (totalAmount)
 * - Cr Revenue (totalAmount)
 * - If shipped goods: Dr COGS, Cr Inventory
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // RBAC: admin, finance, or sales can post sales documents
    const roleCheck = requireRole(req, [ROLES.FINANCE, ROLES.SALES]);
    if (roleCheck instanceof NextResponse) return roleCheck;

    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);

    const { id: salesDocId } = await params;

    let body: PostRequest = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is fine
    }

    const result = await postSalesDoc({
      tenantId,
      actorId: actor.actorId,
      salesDocId,
      memo: body.memo,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to post sales document" },
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
    console.error("POST /api/sales/docs/[id]/post error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
