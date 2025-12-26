/**
 * /api/finance/payments/[id]/post
 *
 * POST: Post a payment to the ledger
 */

import { NextRequest, NextResponse } from "next/server";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { postPayment } from "@/lib/posting";
import { requireRole, ROLES } from "@/lib/authz";

interface PostPaymentRequest {
  memo?: string;
}

/**
 * POST /api/finance/payments/[id]/post
 * Post a payment to the ledger
 *
 * Receipt: Dr Cash/Bank, Cr AR (for allocated amounts)
 * Payment: Dr AP, Cr Cash/Bank (for allocated amounts)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // RBAC: admin or finance can post payments
    const roleCheck = requireRole(req, [ROLES.FINANCE]);
    if (roleCheck instanceof NextResponse) return roleCheck;

    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);

    const { id: paymentId } = await params;

    let body: PostPaymentRequest = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is fine
    }

    const result = await postPayment({
      tenantId,
      actorId: actor.actorId,
      paymentId,
      memo: body.memo,
    });

    if (!result.success) {
      const statusCode = result.error?.includes("not found") ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status: statusCode });
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
    console.error("POST /api/finance/payments/[id]/post error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
