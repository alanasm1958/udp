/**
 * /api/sales-customers/leads
 *
 * Lead management endpoints
 * GET: List leads with filters
 * POST: Create a new lead
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getActorIdFromHeaders,
  getUserIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface CreateLeadRequest {
  contactName: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  estimatedValue?: number | null;
  probability?: number | null;
  expectedCloseDate?: string | null;
  notes?: string | null;
  partyId?: string | null;
}

/**
 * GET /api/sales-customers/leads
 * List leads with optional filters
 * Query params: status, partyId, limit
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const url = new URL(req.url);

    const statusFilter = url.searchParams.get("status");
    const partyIdFilter = url.searchParams.get("partyId");
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "100", 10) || 100, 1), 500);

    const conditions = [eq(leads.tenantId, tenantId)];

    if (statusFilter) {
      // Support comma-separated statuses
      const statuses = statusFilter.split(",").map((s) => s.trim());
      if (statuses.length === 1) {
        conditions.push(eq(leads.status, statuses[0] as typeof leads.status.enumValues[number]));
      } else {
        conditions.push(inArray(leads.status, statuses as typeof leads.status.enumValues[number][]));
      }
    }

    if (partyIdFilter) {
      conditions.push(eq(leads.partyId, partyIdFilter));
    }

    const items = await db
      .select({
        id: leads.id,
        contactName: leads.contactName,
        company: leads.company,
        email: leads.email,
        phone: leads.phone,
        status: leads.status,
        source: leads.source,
        estimatedValue: leads.estimatedValue,
        probability: leads.probability,
        expectedCloseDate: leads.expectedCloseDate,
        notes: leads.notes,
        partyId: leads.partyId,
        assignedToUserId: leads.assignedToUserId,
        convertedToSalesDocId: leads.convertedToSalesDocId,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
      })
      .from(leads)
      .where(and(...conditions))
      .orderBy(desc(leads.createdAt))
      .limit(limit);

    return NextResponse.json({ items, total: items.length });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/sales-customers/leads error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/sales-customers/leads
 * Create a new lead
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const auditCtx = createAuditContext(tenantId, actor.actorId);
    const body: CreateLeadRequest = await req.json();

    if (!body.contactName?.trim()) {
      return NextResponse.json({ error: "Contact name is required" }, { status: 400 });
    }

    const [created] = await db
      .insert(leads)
      .values({
        tenantId,
        contactName: body.contactName.trim(),
        company: body.company?.trim() || null,
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        source: body.source?.trim() || null,
        estimatedValue: body.estimatedValue?.toString() || null,
        probability: body.probability || 10,
        expectedCloseDate: body.expectedCloseDate || null,
        notes: body.notes?.trim() || null,
        partyId: body.partyId || null,
        status: "new",
        createdByActorId: auditCtx.actorId,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/sales-customers/leads error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
