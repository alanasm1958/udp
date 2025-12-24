/**
 * /api/sales/docs/[id]
 *
 * PATCH: Update an existing sales document
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { salesDocs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

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
