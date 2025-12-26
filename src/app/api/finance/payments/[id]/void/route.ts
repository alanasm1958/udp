/**
 * /api/finance/payments/[id]/void
 *
 * POST: Void a payment (draft or posted)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { voidPayment } from "@/lib/posting";
import { requireRole, ROLES } from "@/lib/authz";

interface VoidPaymentRequest {
  reason?: string;
}

/**
 * POST /api/finance/payments/[id]/void
 * Void a payment
 *
 * For draft payments: simply sets status to void
 * For posted payments: creates a reversal journal entry and sets status to void
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // RBAC: admin or finance can void payments
    const roleCheck = requireRole(req, [ROLES.FINANCE]);
    if (roleCheck instanceof NextResponse) return roleCheck;

    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const { id: paymentId } = await params;

    // Parse optional body
    let body: VoidPaymentRequest = {};
    try {
      const text = await req.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // Empty body is fine
    }

    const result = await voidPayment({
      tenantId,
      actorId: actor.actorId,
      paymentId,
      reason: body.reason,
    });

    if (!result.success) {
      const statusCode = result.error === "Payment not found" ? 404 : 400;
      return NextResponse.json(
        { error: result.error, paymentId: result.paymentId },
        { status: statusCode }
      );
    }

    return NextResponse.json({
      paymentId: result.paymentId,
      status: result.status,
      idempotent: result.idempotent,
      originalJournalEntryId: result.originalJournalEntryId,
      reversalJournalEntryId: result.reversalJournalEntryId,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/finance/payments/[id]/void error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
