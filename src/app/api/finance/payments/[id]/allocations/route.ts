/**
 * /api/finance/payments/[id]/allocations
 *
 * GET: List allocations for a payment
 * POST: Add allocation lines to a payment
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { payments, paymentAllocations, salesDocs, purchaseDocs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";
import {
  getPaymentAllocatedTotal,
  getDocAllocatedTotalIncludingDraft,
} from "@/lib/arAp";
import { requireRole, ROLES } from "@/lib/authz";

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
      .select({ id: payments.id, amount: payments.amount })
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

    const paymentAllocatedTotal = await getPaymentAllocatedTotal(tenantId, paymentId);
    const paymentAmount = parseFloat(payment.amount);

    return NextResponse.json({
      allocations,
      summary: {
        paymentAmount,
        paymentAllocatedTotal,
        paymentRemaining: paymentAmount - paymentAllocatedTotal,
      },
    });
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
 *
 * Validations:
 * - Payment must exist and be in draft status
 * - Target documents must exist
 * - Currency must match between payment and document
 * - Payment type must match target type (receipt->sales_doc, payment->purchase_doc)
 * - Total allocations cannot exceed payment amount
 * - Document allocations cannot exceed document total
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // RBAC: admin or finance can add payment allocations
    const roleCheck = requireRole(req, [ROLES.FINANCE]);
    if (roleCheck instanceof NextResponse) return roleCheck;

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

    // 1. Load payment and verify exists
    const [payment] = await db
      .select()
      .from(payments)
      .where(and(eq(payments.tenantId, tenantId), eq(payments.id, paymentId)))
      .limit(1);

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // 2. Require payment is draft
    if (payment.status !== "draft") {
      return NextResponse.json(
        { error: "Cannot add allocations to a payment that is not in draft status" },
        { status: 400 }
      );
    }

    // 3. Validate payload structure and amounts
    const validTargetTypes: AllocationTargetType[] = ["sales_doc", "purchase_doc"];
    for (const alloc of body.allocations) {
      if (!alloc.targetType || !alloc.targetId || !alloc.amount) {
        return NextResponse.json(
          { error: "Each allocation must have targetType, targetId, and amount" },
          { status: 400 }
        );
      }

      if (!validTargetTypes.includes(alloc.targetType)) {
        return NextResponse.json(
          { error: `Invalid targetType: ${alloc.targetType}. Must be one of: sales_doc, purchase_doc` },
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

      // 6. Validate payment.type vs targetType compatibility
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
    }

    // 4 & 5. Validate targets exist, currency matches, and check document remaining
    for (const alloc of body.allocations) {
      const amount = parseFloat(alloc.amount);

      if (alloc.targetType === "sales_doc") {
        const [doc] = await db
          .select({
            id: salesDocs.id,
            currency: salesDocs.currency,
            totalAmount: salesDocs.totalAmount,
          })
          .from(salesDocs)
          .where(and(eq(salesDocs.tenantId, tenantId), eq(salesDocs.id, alloc.targetId)))
          .limit(1);

        if (!doc) {
          return NextResponse.json(
            { error: `Sales document not found: ${alloc.targetId}` },
            { status: 404 }
          );
        }

        // Currency validation
        if (doc.currency !== payment.currency) {
          return NextResponse.json(
            { error: `Currency mismatch: payment is ${payment.currency}, document is ${doc.currency}` },
            { status: 400 }
          );
        }

        // Check document remaining
        const docAllocatedTotal = await getDocAllocatedTotalIncludingDraft(
          tenantId,
          "sales_doc",
          alloc.targetId
        );
        const docTotal = parseFloat(doc.totalAmount);
        const docRemaining = docTotal - docAllocatedTotal;

        if (amount > docRemaining + 0.000001) {
          return NextResponse.json(
            {
              error: `Allocation amount (${amount.toFixed(2)}) exceeds document remaining balance (${docRemaining.toFixed(2)}) for document ${alloc.targetId}`,
            },
            { status: 400 }
          );
        }
      } else if (alloc.targetType === "purchase_doc") {
        const [doc] = await db
          .select({
            id: purchaseDocs.id,
            currency: purchaseDocs.currency,
            totalAmount: purchaseDocs.totalAmount,
          })
          .from(purchaseDocs)
          .where(and(eq(purchaseDocs.tenantId, tenantId), eq(purchaseDocs.id, alloc.targetId)))
          .limit(1);

        if (!doc) {
          return NextResponse.json(
            { error: `Purchase document not found: ${alloc.targetId}` },
            { status: 404 }
          );
        }

        // Currency validation
        if (doc.currency !== payment.currency) {
          return NextResponse.json(
            { error: `Currency mismatch: payment is ${payment.currency}, document is ${doc.currency}` },
            { status: 400 }
          );
        }

        // Check document remaining
        const docAllocatedTotal = await getDocAllocatedTotalIncludingDraft(
          tenantId,
          "purchase_doc",
          alloc.targetId
        );
        const docTotal = parseFloat(doc.totalAmount);
        const docRemaining = docTotal - docAllocatedTotal;

        if (amount > docRemaining + 0.000001) {
          return NextResponse.json(
            {
              error: `Allocation amount (${amount.toFixed(2)}) exceeds document remaining balance (${docRemaining.toFixed(2)}) for document ${alloc.targetId}`,
            },
            { status: 400 }
          );
        }
      }
    }

    // 7. Check payment allocation limit
    const existingPaymentTotal = await getPaymentAllocatedTotal(tenantId, paymentId);
    const newAllocationsTotal = body.allocations.reduce(
      (sum, alloc) => sum + parseFloat(alloc.amount),
      0
    );
    const paymentAmount = parseFloat(payment.amount);

    if (existingPaymentTotal + newAllocationsTotal > paymentAmount + 0.000001) {
      return NextResponse.json(
        {
          error: `Total allocations (${(existingPaymentTotal + newAllocationsTotal).toFixed(2)}) cannot exceed payment amount (${paymentAmount.toFixed(2)})`,
        },
        { status: 400 }
      );
    }

    // 8. Insert allocations
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

    // Log audit event
    await audit.log("payment", paymentId, "payment_allocation_created", {
      allocationCount: createdAllocations.length,
      totalAllocated: newAllocationsTotal,
      allocationIds: createdAllocations.map((a) => a.id),
    });

    // Return with updated totals
    const updatedPaymentTotal = existingPaymentTotal + newAllocationsTotal;

    return NextResponse.json(
      {
        allocations: createdAllocations,
        summary: {
          paymentAmount,
          paymentAllocatedTotal: updatedPaymentTotal,
          paymentRemaining: paymentAmount - updatedPaymentTotal,
        },
      },
      { status: 201 }
    );
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
