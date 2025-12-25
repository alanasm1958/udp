/**
 * /api/finance/payments/[id]/allocations
 *
 * GET: List allocations for a payment
 * POST: Add allocation lines to a payment
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { payments, paymentAllocations, salesDocs, purchaseDocs } from "@/db/schema";
import { eq, and, sum } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

type AllocationTargetType = "sales_doc" | "purchase_doc";

interface AllocationInput {
  targetType: AllocationTargetType;
  targetId: string;
  amount: string;
}

interface CreateAllocationsRequest {
  allocations: AllocationInput[];
}

/**
 * GET /api/finance/payments/[id]/allocations
 * List allocations for a payment
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id: paymentId } = await params;

    // Verify payment exists
    const [payment] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.tenantId, tenantId), eq(payments.id, paymentId)))
      .limit(1);

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const allocations = await db
      .select()
      .from(paymentAllocations)
      .where(
        and(
          eq(paymentAllocations.tenantId, tenantId),
          eq(paymentAllocations.paymentId, paymentId)
        )
      );

    return NextResponse.json({ allocations });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/finance/payments/[id]/allocations error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/finance/payments/[id]/allocations
 * Add allocation lines to a payment
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
    const audit = createAuditContext(tenantId, actor.actorId);

    const { id: paymentId } = await params;
    const body: CreateAllocationsRequest = await req.json();

    // Validate input
    if (!body.allocations || !Array.isArray(body.allocations) || body.allocations.length === 0) {
      return NextResponse.json(
        { error: "allocations array is required and must not be empty" },
        { status: 400 }
      );
    }

    // Verify payment exists and is in draft status
    const [payment] = await db
      .select()
      .from(payments)
      .where(and(eq(payments.tenantId, tenantId), eq(payments.id, paymentId)))
      .limit(1);

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.status !== "draft") {
      return NextResponse.json(
        { error: "Cannot add allocations to a payment that is not in draft status" },
        { status: 400 }
      );
    }

    // Validate allocation target types match payment type
    const validTargetTypes: AllocationTargetType[] = ["sales_doc", "purchase_doc"];
    for (const alloc of body.allocations) {
      if (!validTargetTypes.includes(alloc.targetType)) {
        return NextResponse.json(
          { error: `Invalid targetType: ${alloc.targetType}. Must be one of: sales_doc, purchase_doc` },
          { status: 400 }
        );
      }

      // Receipt payments should allocate to sales_docs, payment should allocate to purchase_docs
      if (payment.type === "receipt" && alloc.targetType !== "sales_doc") {
        return NextResponse.json(
          { error: "Receipt payments can only be allocated to sales documents" },
          { status: 400 }
        );
      }
      if (payment.type === "payment" && alloc.targetType !== "purchase_doc") {
        return NextResponse.json(
          { error: "Vendor payments can only be allocated to purchase documents" },
          { status: 400 }
        );
      }

      const amount = parseFloat(alloc.amount);
      if (isNaN(amount) || amount <= 0) {
        return NextResponse.json(
          { error: "Each allocation amount must be a positive number" },
          { status: 400 }
        );
      }
    }

    // Validate targets exist
    for (const alloc of body.allocations) {
      if (alloc.targetType === "sales_doc") {
        const [doc] = await db
          .select({ id: salesDocs.id })
          .from(salesDocs)
          .where(and(eq(salesDocs.tenantId, tenantId), eq(salesDocs.id, alloc.targetId)))
          .limit(1);

        if (!doc) {
          return NextResponse.json(
            { error: `Sales document not found: ${alloc.targetId}` },
            { status: 404 }
          );
        }
      } else if (alloc.targetType === "purchase_doc") {
        const [doc] = await db
          .select({ id: purchaseDocs.id })
          .from(purchaseDocs)
          .where(and(eq(purchaseDocs.tenantId, tenantId), eq(purchaseDocs.id, alloc.targetId)))
          .limit(1);

        if (!doc) {
          return NextResponse.json(
            { error: `Purchase document not found: ${alloc.targetId}` },
            { status: 404 }
          );
        }
      }
    }

    // Get existing allocations total
    const existingResult = await db
      .select({ total: sum(paymentAllocations.amount) })
      .from(paymentAllocations)
      .where(
        and(
          eq(paymentAllocations.tenantId, tenantId),
          eq(paymentAllocations.paymentId, paymentId)
        )
      );

    const existingTotal = existingResult[0]?.total ? parseFloat(existingResult[0].total) : 0;

    // Calculate new allocations total
    const newAllocationsTotal = body.allocations.reduce(
      (sum, alloc) => sum + parseFloat(alloc.amount),
      0
    );

    const paymentAmount = parseFloat(payment.amount);
    if (existingTotal + newAllocationsTotal > paymentAmount) {
      return NextResponse.json(
        {
          error: `Total allocations (${(existingTotal + newAllocationsTotal).toFixed(2)}) cannot exceed payment amount (${paymentAmount.toFixed(2)})`,
        },
        { status: 400 }
      );
    }

    // Insert allocations
    const createdAllocations = [];
    for (const alloc of body.allocations) {
      const amount = parseFloat(alloc.amount);

      const [created] = await db
        .insert(paymentAllocations)
        .values({
          tenantId,
          paymentId,
          targetType: alloc.targetType,
          targetId: alloc.targetId,
          amount: amount.toFixed(6),
          createdByActorId: actor.actorId,
        })
        .returning();

      createdAllocations.push(created);
    }

    await audit.log("payment", paymentId, "payment_allocation_created", {
      allocationCount: createdAllocations.length,
      totalAllocated: newAllocationsTotal,
      allocationIds: createdAllocations.map((a) => a.id),
    });

    return NextResponse.json({ allocations: createdAllocations }, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/finance/payments/[id]/allocations error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
