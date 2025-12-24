/**
 * /api/sales/docs/[id]/lines
 *
 * GET: List lines for a sales document
 * POST: Add a line to a sales document
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { salesDocs, salesDocLines } from "@/db/schema";
import { eq, and, max } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface CreateSalesDocLineRequest {
  productId?: string;
  description: string;
  quantity?: string;
  uomId?: string;
  unitPrice?: string;
  discountPercent?: string;
  discountAmount?: string;
  taxCategoryId?: string;
  taxAmount?: string;
  lineTotal?: string;
  metadata?: Record<string, unknown>;
}

/**
 * GET /api/sales/docs/[id]/lines
 * List lines for a sales document
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id: salesDocId } = await params;

    // Verify document exists
    const [doc] = await db
      .select({ id: salesDocs.id })
      .from(salesDocs)
      .where(and(eq(salesDocs.tenantId, tenantId), eq(salesDocs.id, salesDocId)))
      .limit(1);

    if (!doc) {
      return NextResponse.json({ error: "Sales document not found" }, { status: 404 });
    }

    const lines = await db
      .select({
        id: salesDocLines.id,
        lineNo: salesDocLines.lineNo,
        productId: salesDocLines.productId,
        description: salesDocLines.description,
        quantity: salesDocLines.quantity,
        uomId: salesDocLines.uomId,
        unitPrice: salesDocLines.unitPrice,
        discountPercent: salesDocLines.discountPercent,
        discountAmount: salesDocLines.discountAmount,
        taxCategoryId: salesDocLines.taxCategoryId,
        taxAmount: salesDocLines.taxAmount,
        lineTotal: salesDocLines.lineTotal,
        metadata: salesDocLines.metadata,
        createdAt: salesDocLines.createdAt,
      })
      .from(salesDocLines)
      .where(and(eq(salesDocLines.tenantId, tenantId), eq(salesDocLines.salesDocId, salesDocId)));

    return NextResponse.json({ items: lines });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/sales/docs/[id]/lines error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sales/docs/[id]/lines
 * Add a line to a sales document
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

    const { id: salesDocId } = await params;
    const body: CreateSalesDocLineRequest = await req.json();

    if (!body.description) {
      return NextResponse.json({ error: "description is required" }, { status: 400 });
    }

    // Verify document exists
    const [doc] = await db
      .select({ id: salesDocs.id })
      .from(salesDocs)
      .where(and(eq(salesDocs.tenantId, tenantId), eq(salesDocs.id, salesDocId)))
      .limit(1);

    if (!doc) {
      return NextResponse.json({ error: "Sales document not found" }, { status: 404 });
    }

    // Get the next line_no
    const [maxLineResult] = await db
      .select({ maxLine: max(salesDocLines.lineNo) })
      .from(salesDocLines)
      .where(and(eq(salesDocLines.tenantId, tenantId), eq(salesDocLines.salesDocId, salesDocId)));

    const nextLineNo = (maxLineResult?.maxLine ?? 0) + 1;

    const [line] = await db
      .insert(salesDocLines)
      .values({
        tenantId,
        salesDocId,
        lineNo: nextLineNo,
        productId: body.productId ?? null,
        description: body.description,
        quantity: body.quantity ?? "1",
        uomId: body.uomId ?? null,
        unitPrice: body.unitPrice ?? "0",
        discountPercent: body.discountPercent ?? "0",
        discountAmount: body.discountAmount ?? "0",
        taxCategoryId: body.taxCategoryId ?? null,
        taxAmount: body.taxAmount ?? "0",
        lineTotal: body.lineTotal ?? "0",
        metadata: body.metadata ?? null,
        createdByActorId: actor.actorId,
      })
      .returning();

    await audit.log("sales_doc_line", line.id, "sales_doc_line_created", {
      salesDocId,
      lineNo: nextLineNo,
      description: body.description,
    });

    return NextResponse.json(line, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/sales/docs/[id]/lines error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
