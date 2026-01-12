/**
 * /api/sales-customers/leads/[id]
 *
 * Single lead endpoints
 * GET: Get lead by ID
 * PUT: Update lead
 * DELETE: Delete lead
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  TenantError,
} from "@/lib/tenant";

interface UpdateLeadRequest {
  contactName?: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: "new" | "contacted" | "qualified" | "disqualified" | "won" | "lost";
  source?: string | null;
  estimatedValue?: number | null;
  probability?: number | null;
  expectedCloseDate?: string | null;
  notes?: string | null;
  partyId?: string | null;
  assignedToUserId?: string | null;
}

/**
 * GET /api/sales-customers/leads/[id]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await params;

    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json(lead);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/sales-customers/leads/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/sales-customers/leads/[id]
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await params;
    const body: UpdateLeadRequest = await req.json();

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.contactName !== undefined) updateData.contactName = body.contactName.trim();
    if (body.company !== undefined) updateData.company = body.company?.trim() || null;
    if (body.email !== undefined) updateData.email = body.email?.trim() || null;
    if (body.phone !== undefined) updateData.phone = body.phone?.trim() || null;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.source !== undefined) updateData.source = body.source?.trim() || null;
    if (body.estimatedValue !== undefined) updateData.estimatedValue = body.estimatedValue?.toString() || null;
    if (body.probability !== undefined) updateData.probability = body.probability;
    if (body.expectedCloseDate !== undefined) updateData.expectedCloseDate = body.expectedCloseDate || null;
    if (body.notes !== undefined) updateData.notes = body.notes?.trim() || null;
    if (body.partyId !== undefined) updateData.partyId = body.partyId || null;
    if (body.assignedToUserId !== undefined) updateData.assignedToUserId = body.assignedToUserId || null;

    const [updated] = await db
      .update(leads)
      .set(updateData)
      .where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PUT /api/sales-customers/leads/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/sales-customers/leads/[id]
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await params;

    const [deleted] = await db
      .delete(leads)
      .where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("DELETE /api/sales-customers/leads/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
