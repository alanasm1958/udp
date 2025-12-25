/**
 * /api/sales/docs/[id]
 *
 * GET: Get a single sales document with payment status
 * PATCH: Update an existing sales document
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { salesDocs, parties } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";
import { getDocAllocatedTotal, computePaymentStatus } from "@/lib/arAp";

/**
 * GET /api/sales/docs/[id]
 * Get a single sales document with payment status
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await params;

    const [doc] = await db
      .select({
        id: salesDocs.id,
        docType: salesDocs.docType,
        docNumber: salesDocs.docNumber,
        partyId: salesDocs.partyId,
        partyName: parties.name,
        docDate: salesDocs.docDate,
        dueDate: salesDocs.dueDate,
        currency: salesDocs.currency,
        subtotal: salesDocs.subtotal,
        discountAmount: salesDocs.discountAmount,
        taxAmount: salesDocs.taxAmount,
        totalAmount: salesDocs.totalAmount,
        status: salesDocs.status,
        notes: salesDocs.notes,
        metadata: salesDocs.metadata,
        createdAt: salesDocs.createdAt,
        updatedAt: salesDocs.updatedAt,
      })
      .from(salesDocs)
      .leftJoin(parties, eq(salesDocs.partyId, parties.id))
      .where(and(eq(salesDocs.tenantId, tenantId), eq(salesDocs.id, id)))
      .limit(1);

    if (!doc) {
      return NextResponse.json({ error: "Sales document not found" }, { status: 404 });
    }

    // Calculate payment status for posted invoices
    let allocatedAmount = 0;
    let remainingAmount = parseFloat(doc.totalAmount);
    let paymentStatus: "unpaid" | "partial" | "paid" | null = null;

    if (doc.docType === "invoice" && doc.status === "posted") {
      allocatedAmount = await getDocAllocatedTotal(tenantId, "sales_doc", id);
      remainingAmount = parseFloat(doc.totalAmount) - allocatedAmount;
      paymentStatus = computePaymentStatus(parseFloat(doc.totalAmount), remainingAmount);
    }

    return NextResponse.json({
      ...doc,
      allocatedAmount,
      remainingAmount,
      paymentStatus,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/sales/docs/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

interface UpdateSalesDocRequest {
  docDate?: string;
  dueDate?: string;
  currency?: string;
  subtotal?: string;
  discountAmount?: string;
  taxAmount?: string;
  totalAmount?: string;
  status?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

/**
 * PATCH /api/sales/docs/[id]
 * Update an existing sales document
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

    const { id } = await params;
    const body: UpdateSalesDocRequest = await req.json();

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (body.docDate !== undefined) updates.docDate = body.docDate;
    if (body.dueDate !== undefined) updates.dueDate = body.dueDate;
    if (body.currency !== undefined) updates.currency = body.currency;
    if (body.subtotal !== undefined) updates.subtotal = body.subtotal;
    if (body.discountAmount !== undefined) updates.discountAmount = body.discountAmount;
    if (body.taxAmount !== undefined) updates.taxAmount = body.taxAmount;
    if (body.totalAmount !== undefined) updates.totalAmount = body.totalAmount;
    if (body.status !== undefined) updates.status = body.status;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.metadata !== undefined) updates.metadata = body.metadata;

    const [updated] = await db
      .update(salesDocs)
      .set(updates)
      .where(and(eq(salesDocs.tenantId, tenantId), eq(salesDocs.id, id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Sales document not found" }, { status: 404 });
    }

    await audit.log("sales_doc", updated.id, "sales_doc_updated", {
      changes: Object.keys(updates).filter((k) => k !== "updatedAt"),
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/sales/docs/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
