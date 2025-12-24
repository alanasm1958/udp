/**
 * /api/procurement/docs/[id]/lines
 *
 * GET: List lines for a purchase document
 * POST: Add a line to a purchase document
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { purchaseDocs, purchaseDocLines } from "@/db/schema";
import { eq, and, max } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface CreatePurchaseDocLineRequest {
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
 * GET /api/procurement/docs/[id]/lines
 * List lines for a purchase document
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id: purchaseDocId } = await params;

    // Verify document exists
    const [doc] = await db
      .select({ id: purchaseDocs.id })
      .from(purchaseDocs)
      .where(and(eq(purchaseDocs.tenantId, tenantId), eq(purchaseDocs.id, purchaseDocId)))
      .limit(1);

    if (!doc) {
      return NextResponse.json({ error: "Purchase document not found" }, { status: 404 });
    }

    const lines = await db
      .select({
        id: purchaseDocLines.id,
        lineNo: purchaseDocLines.lineNo,
        productId: purchaseDocLines.productId,
        description: purchaseDocLines.description,
        quantity: purchaseDocLines.quantity,
        uomId: purchaseDocLines.uomId,
        unitPrice: purchaseDocLines.unitPrice,
        discountPercent: purchaseDocLines.discountPercent,
        discountAmount: purchaseDocLines.discountAmount,
        taxCategoryId: purchaseDocLines.taxCategoryId,
        taxAmount: purchaseDocLines.taxAmount,
        lineTotal: purchaseDocLines.lineTotal,
        metadata: purchaseDocLines.metadata,
        createdAt: purchaseDocLines.createdAt,
      })
      .from(purchaseDocLines)
      .where(and(eq(purchaseDocLines.tenantId, tenantId), eq(purchaseDocLines.purchaseDocId, purchaseDocId)));

    return NextResponse.json({ items: lines });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/procurement/docs/[id]/lines error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/procurement/docs/[id]/lines
 * Add a line to a purchase document
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

    const { id: purchaseDocId } = await params;
    const body: CreatePurchaseDocLineRequest = await req.json();

    if (!body.description) {
      return NextResponse.json({ error: "description is required" }, { status: 400 });
    }

    // Verify document exists
    const [doc] = await db
      .select({ id: purchaseDocs.id })
      .from(purchaseDocs)
      .where(and(eq(purchaseDocs.tenantId, tenantId), eq(purchaseDocs.id, purchaseDocId)))
      .limit(1);

    if (!doc) {
      return NextResponse.json({ error: "Purchase document not found" }, { status: 404 });
    }

    // Get the next line_no
    const [maxLineResult] = await db
      .select({ maxLine: max(purchaseDocLines.lineNo) })
      .from(purchaseDocLines)
      .where(and(eq(purchaseDocLines.tenantId, tenantId), eq(purchaseDocLines.purchaseDocId, purchaseDocId)));

    const nextLineNo = (maxLineResult?.maxLine ?? 0) + 1;

    const [line] = await db
      .insert(purchaseDocLines)
      .values({
        tenantId,
        purchaseDocId,
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

    await audit.log("purchase_doc_line", line.id, "purchase_doc_line_created", {
      purchaseDocId,
      lineNo: nextLineNo,
      description: body.description,
    });

    return NextResponse.json(line, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/procurement/docs/[id]/lines error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
