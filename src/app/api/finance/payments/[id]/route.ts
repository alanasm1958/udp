/**
 * /api/finance/payments/[id]
 *
 * GET: Get payment details
 * PATCH: Update payment (only if status=draft)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

type PaymentMethod = "cash" | "bank";

interface UpdatePaymentRequest {
  paymentDate?: string;
  method?: PaymentMethod;
  memo?: string;
  reference?: string;
}

/**
 * GET /api/finance/payments/[id]
 * Get payment details
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id: paymentId } = await params;

    const [payment] = await db
      .select()
      .from(payments)
      .where(and(eq(payments.tenantId, tenantId), eq(payments.id, paymentId)))
      .limit(1);

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    return NextResponse.json(payment);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/finance/payments/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/finance/payments/[id]
 * Update payment (only if status=draft)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const { id: paymentId } = await params;
    const body: UpdatePaymentRequest = await req.json();

    // Fetch existing payment
    const [existing] = await db
      .select()
      .from(payments)
      .where(and(eq(payments.tenantId, tenantId), eq(payments.id, paymentId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Only allow updates if status is draft
    if (existing.status !== "draft") {
      return NextResponse.json(
        { error: "Cannot update payment that is not in draft status" },
        { status: 400 }
      );
    }

    // Build update object
    const updates: Record<string, unknown> = {
      updatedAt: sql`now()`,
    };

    if (body.paymentDate !== undefined) {
      updates.paymentDate = body.paymentDate;
    }
    if (body.method !== undefined) {
      const validMethods: PaymentMethod[] = ["cash", "bank"];
      if (!validMethods.includes(body.method)) {
        return NextResponse.json(
          { error: "method must be one of: cash, bank" },
          { status: 400 }
        );
      }
      updates.method = body.method;
    }
    if (body.memo !== undefined) {
      updates.memo = body.memo;
    }
    if (body.reference !== undefined) {
      updates.reference = body.reference;
    }

    const [updated] = await db
      .update(payments)
      .set(updates)
      .where(and(eq(payments.tenantId, tenantId), eq(payments.id, paymentId)))
      .returning();

    await audit.log("payment", paymentId, "payment_updated", {
      changes: Object.keys(body),
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/finance/payments/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
