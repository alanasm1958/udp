/**
 * /api/sales-customers/salespersons
 *
 * Salesperson management endpoints
 * GET: List salespersons
 * POST: Create a new salesperson
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { salespersons, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getActorIdFromHeaders,
  getUserIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";
import { checkAndCreateMatchTasks } from "@/lib/sales-customers/salesperson-match";

interface CreateSalespersonRequest {
  name: string;
  email?: string | null;
  phone?: string | null;
  linkedUserId?: string | null;
}

/**
 * GET /api/sales-customers/salespersons
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);

    const items = await db
      .select({
        id: salespersons.id,
        name: salespersons.name,
        email: salespersons.email,
        phone: salespersons.phone,
        linkedUserId: salespersons.linkedUserId,
        isActive: salespersons.isActive,
        createdAt: salespersons.createdAt,
      })
      .from(salespersons)
      .where(eq(salespersons.tenantId, tenantId))
      .orderBy(desc(salespersons.createdAt));

    // Fetch linked user names
    const linkedUserIds = items.filter((s) => s.linkedUserId).map((s) => s.linkedUserId!);
    let userMap: Record<string, string> = {};

    if (linkedUserIds.length > 0) {
      const linkedUsers = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(eq(users.tenantId, tenantId));

      userMap = linkedUsers.reduce((acc, u) => {
        acc[u.id] = u.email;
        return acc;
      }, {} as Record<string, string>);
    }

    const enrichedItems = items.map((s) => ({
      ...s,
      linkedUserName: s.linkedUserId ? userMap[s.linkedUserId] : null,
    }));

    return NextResponse.json({ items: enrichedItems, total: items.length });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/sales-customers/salespersons error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/sales-customers/salespersons
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const auditCtx = createAuditContext(tenantId, actor.actorId);
    const body: CreateSalespersonRequest = await req.json();

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const [created] = await db
      .insert(salespersons)
      .values({
        tenantId,
        name: body.name.trim(),
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        linkedUserId: body.linkedUserId || null,
        isActive: true,
        createdByActorId: auditCtx.actorId,
      })
      .returning();

    // Check for AI match suggestions (async, non-blocking)
    if (!body.linkedUserId) {
      checkAndCreateMatchTasks(tenantId, auditCtx.actorId, {
        id: created.id,
        name: created.name,
        email: created.email,
        phone: created.phone,
        linkedUserId: null,
      }).catch((err) => {
        console.error("Salesperson match check failed:", err);
      });
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/sales-customers/salespersons error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
