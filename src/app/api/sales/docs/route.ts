/**
 * /api/sales/docs
 *
 * Sales document endpoints (quotes, orders, invoices, etc.)
 * GET: List sales documents with filters
 * POST: Create a new sales document
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { salesDocs } from "@/db/schema";
import { eq, and, ilike, or } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";
import { requireRole, ROLES } from "@/lib/authz";

interface CreateSalesDocRequest {
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
 * GET /api/sales/docs
 * List sales documents with optional filters
 * Query params: type, status, partyId, q, limit
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const roleCheck = requireRole(req, [ROLES.SALES, ROLES.FINANCE]);
    if (roleCheck instanceof NextResponse) return roleCheck;

    const tenantId = requireTenantIdFromHeaders(req);
    const url = new URL(req.url);

    const typeFilter = url.searchParams.get("type");
    const statusFilter = url.searchParams.get("status");
    const partyIdFilter = url.searchParams.get("partyId");
    const searchQuery = url.searchParams.get("q");
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 200);

    const conditions = [eq(salesDocs.tenantId, tenantId)];

    if (typeFilter) {
      conditions.push(eq(salesDocs.docType, typeFilter));
    }

    if (statusFilter) {
      conditions.push(eq(salesDocs.status, statusFilter));
    }

    if (partyIdFilter) {
      conditions.push(eq(salesDocs.partyId, partyIdFilter));
    }

    if (searchQuery) {
      const searchPattern = `%${searchQuery}%`;
      conditions.push(
        or(ilike(salesDocs.docNumber, searchPattern), ilike(salesDocs.notes, searchPattern))!
      );
    }

    const docs = await db
      .select({
        id: salesDocs.id,
        docType: salesDocs.docType,
        docNumber: salesDocs.docNumber,
        partyId: salesDocs.partyId,
        docDate: salesDocs.docDate,
        dueDate: salesDocs.dueDate,
        currency: salesDocs.currency,
        subtotal: salesDocs.subtotal,
        discountAmount: salesDocs.discountAmount,
        taxAmount: salesDocs.taxAmount,
        totalAmount: salesDocs.totalAmount,
        status: salesDocs.status,
        createdAt: salesDocs.createdAt,
      })
      .from(salesDocs)
      .where(and(...conditions))
      .limit(limit);

    return NextResponse.json({ items: docs });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/sales/docs error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sales/docs
 * Create a new sales document
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const roleCheck = requireRole(req, [ROLES.SALES, ROLES.FINANCE]);
    if (roleCheck instanceof NextResponse) return roleCheck;

    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: CreateSalesDocRequest = await req.json();

    if (!body.docType || !body.docNumber || !body.partyId || !body.docDate) {
      return NextResponse.json(
        { error: "docType, docNumber, partyId, and docDate are required" },
        { status: 400 }
      );
    }

    const [doc] = await db
      .insert(salesDocs)
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

    await audit.log("sales_doc", doc.id, "sales_doc_created", {
      docType: body.docType,
      docNumber: body.docNumber,
      partyId: body.partyId,
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/sales/docs error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
