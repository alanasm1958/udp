/**
 * /api/operations/payments
 *
 * POST: Record an operations payment from the Record Activity drawer
 * Creates an ops_payment record with evidence state tracking
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { opsPayments, tasks } from "@/db/schema";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface CreatePaymentRequest {
  payeePersonId?: string;
  paymentDate: string;
  amount: number;
  status: "paid" | "unpaid";
  method?: "cash" | "bank";
  domain: "operations" | "sales" | "finance" | "hr" | "marketing";
  notes?: string;
}

/**
 * POST /api/operations/payments
 * Record an operations payment
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: CreatePaymentRequest = await req.json();

    if (!body.paymentDate || body.amount === undefined) {
      return NextResponse.json(
        { error: "paymentDate and amount are required" },
        { status: 400 }
      );
    }

    // Create the ops payment
    const [payment] = await db
      .insert(opsPayments)
      .values({
        tenantId,
        payeePersonId: body.payeePersonId || null,
        paymentDate: body.paymentDate,
        amount: body.amount.toString(),
        status: body.status || "unpaid",
        method: body.status === "paid" ? body.method : null,
        domain: body.domain || "operations",
        notes: body.notes,
        evidenceState: "pending_evidence", // Always starts pending until attachment is provided
        createdByActorId: actor.actorId,
      })
      .returning();

    // If unpaid, create a follow-up task
    if (body.status === "unpaid") {
      await db.insert(tasks).values({
        tenantId,
        domain: body.domain || "operations",
        title: `Complete payment: ${body.amount.toLocaleString()}`,
        description: `Payment of ${body.amount.toLocaleString()} recorded as unpaid on ${body.paymentDate}. Complete the payment and mark as paid.`,
        priority: "medium",
        status: "open",
        relatedEntityType: "ops_payment",
        relatedEntityId: payment.id,
        createdByActorId: actor.actorId,
      });
    }

    await audit.log("ops_payment", payment.id, "ops_payment_created", {
      amount: body.amount,
      status: body.status,
      domain: body.domain,
    });

    return NextResponse.json({
      id: payment.id,
      status: payment.status,
      pendingEvidence: true, // Evidence is always pending until attachment
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/operations/payments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
