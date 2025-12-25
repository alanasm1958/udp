/**
 * /api/finance/payments/[id]/unallocate
 *
 * POST: Unallocate a payment allocation (sets amount to 0)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { unallocatePayment } from "@/lib/posting";

interface UnallocateRequest {
  allocationId?: string;
  targetType?: "sales_doc" | "purchase_doc";
  targetId?: string;
  reason?: string;
}

/**
 * POST /api/finance/payments/[id]/unallocate
 * Unallocate a payment allocation
 *
 * Sets the allocation amount to 0 instead of deleting (preserves history).
 * Only allowed when payment.status is 'draft'.
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
    const { id: paymentId } = await params;

    // Parse body
    let body: UnallocateRequest = {};
    try {
      const text = await req.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // Empty body is not valid for unallocate
      return NextResponse.json(
        { error: "Must provide either allocationId or (targetType + targetId)" },
        { status: 400 }
      );
    }

    // Validate input
    if (!body.allocationId && (!body.targetType || !body.targetId)) {
      return NextResponse.json(
        { error: "Must provide either allocationId or (targetType + targetId)" },
        { status: 400 }
      );
    }

    const result = await unallocatePayment({
      tenantId,
      actorId: actor.actorId,
      paymentId,
      allocationId: body.allocationId,
      targetType: body.targetType,
      targetId: body.targetId,
      reason: body.reason,
    });

    if (!result.ok) {
      const statusCode = result.error === "Payment not found" ? 404 : 400;
      return NextResponse.json(
        { error: result.error, paymentId: result.paymentId },
        { status: statusCode }
      );
    }

    return NextResponse.json({
      ok: result.ok,
      paymentId: result.paymentId,
      allocationId: result.allocationId,
      previousAmount: result.previousAmount,
      idempotent: result.idempotent,
      message: result.message,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/finance/payments/[id]/unallocate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
