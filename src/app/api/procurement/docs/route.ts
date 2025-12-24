/**
 * /api/procurement/docs
 *
 * Purchase document endpoints (RFQs, orders, invoices, etc.)
 * GET: List purchase documents with filters
 * POST: Create a new purchase document
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { purchaseDocs } from "@/db/schema";
import { eq, and, ilike, or } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface CreatePurchaseDocRequest {
  docType: string;
  docNumber: string;
  partyId: string;
  docDate: string;
  dueDate?: string;
  currency?: string;
  subtotal?: string;
  discountAmount?: string;
  taxAmount?: string;
  totalAmount?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

/**
 * GET /api/procurement/docs
 * List purchase documents with optional filters
 * Query params: type, status, partyId, q, limit
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const url = new URL(req.url);

    const typeFilter = url.searchParams.get("type");
    const statusFilter = url.searchParams.get("status");
    const partyIdFilter = url.searchParams.get("partyId");
    const searchQuery = url.searchParams.get("q");
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 200);

    const conditions = [eq(purchaseDocs.tenantId, tenantId)];

    if (typeFilter) {
      conditions.push(eq(purchaseDocs.docType, typeFilter));
    }

    if (statusFilter) {
      conditions.push(eq(purchaseDocs.status, statusFilter));
    }

    if (partyIdFilter) {
      conditions.push(eq(purchaseDocs.partyId, partyIdFilter));
    }

    if (searchQuery) {
      const searchPattern = `%${searchQuery}%`;
      conditions.push(
        or(ilike(purchaseDocs.docNumber, searchPattern), ilike(purchaseDocs.notes, searchPattern))!
      );
    }

    const docs = await db
      .select({
        id: purchaseDocs.id,
        docType: purchaseDocs.docType,
        docNumber: purchaseDocs.docNumber,
        partyId: purchaseDocs.partyId,
        docDate: purchaseDocs.docDate,
        dueDate: purchaseDocs.dueDate,
        currency: purchaseDocs.currency,
        subtotal: purchaseDocs.subtotal,
        discountAmount: purchaseDocs.discountAmount,
        taxAmount: purchaseDocs.taxAmount,
        totalAmount: purchaseDocs.totalAmount,
        status: purchaseDocs.status,
        createdAt: purchaseDocs.createdAt,
      })
      .from(purchaseDocs)
      .where(and(...conditions))
      .limit(limit);

    return NextResponse.json({ items: docs });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/procurement/docs error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/procurement/docs
 * Create a new purchase document
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: CreatePurchaseDocRequest = await req.json();

    if (!body.docType || !body.docNumber || !body.partyId || !body.docDate) {
      return NextResponse.json(
        { error: "docType, docNumber, partyId, and docDate are required" },
        { status: 400 }
      );
    }

    const [doc] = await db
      .insert(purchaseDocs)
      .values({
        tenantId,
        docType: body.docType,
        docNumber: body.docNumber,
        partyId: body.partyId,
        docDate: body.docDate,
        dueDate: body.dueDate ?? null,
        currency: body.currency ?? "USD",
        subtotal: body.subtotal ?? "0",
        discountAmount: body.discountAmount ?? "0",
        taxAmount: body.taxAmount ?? "0",
        totalAmount: body.totalAmount ?? "0",
        notes: body.notes ?? null,
        metadata: body.metadata ?? null,
        createdByActorId: actor.actorId,
      })
      .returning();

    await audit.log("purchase_doc", doc.id, "purchase_doc_created", {
      docType: body.docType,
      docNumber: body.docNumber,
      partyId: body.partyId,
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/procurement/docs error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
