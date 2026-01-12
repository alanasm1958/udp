/**
 * /api/sales-customers/salespersons/[id]
 *
 * Individual salesperson operations
 * GET: Get a single salesperson
 * PUT: Update a salesperson (including link/unlink user)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { salespersons, users, tasks } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getActorIdFromHeaders,
  getUserIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface UpdateSalespersonRequest {
  name?: string;
  email?: string | null;
  phone?: string | null;
  linkedUserId?: string | null;
  isActive?: boolean;
}

/**
 * GET /api/sales-customers/salespersons/[id]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await params;

    const [salesperson] = await db
      .select({
        id: salespersons.id,
        name: salespersons.name,
        email: salespersons.email,
        phone: salespersons.phone,
        linkedUserId: salespersons.linkedUserId,
        isActive: salespersons.isActive,
        createdAt: salespersons.createdAt,
        updatedAt: salespersons.updatedAt,
      })
      .from(salespersons)
      .where(and(eq(salespersons.tenantId, tenantId), eq(salespersons.id, id)))
      .limit(1);

    if (!salesperson) {
      return NextResponse.json({ error: "Salesperson not found" }, { status: 404 });
    }

    // Get linked user info if present
    let linkedUserName: string | null = null;
    if (salesperson.linkedUserId) {
      const [user] = await db
        .select({ email: users.email, fullName: users.fullName })
        .from(users)
        .where(eq(users.id, salesperson.linkedUserId))
        .limit(1);
      if (user) {
        linkedUserName = user.fullName || user.email;
      }
    }

    return NextResponse.json({
      ...salesperson,
      linkedUserName,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/sales-customers/salespersons/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/sales-customers/salespersons/[id]
 * Update a salesperson's details or link/unlink user
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const auditCtx = createAuditContext(tenantId, actor.actorId);
    const { id } = await params;
    const body: UpdateSalespersonRequest = await req.json();

    // Check salesperson exists
    const [existing] = await db
      .select()
      .from(salespersons)
      .where(and(eq(salespersons.tenantId, tenantId), eq(salespersons.id, id)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Salesperson not found" }, { status: 404 });
    }

    // Prepare update values
    const updateValues: Record<string, unknown> = {
      updatedAt: sql`now()`,
    };

    if (body.name !== undefined) {
      updateValues.name = body.name.trim();
    }
    if (body.email !== undefined) {
      updateValues.email = body.email?.trim() || null;
    }
    if (body.phone !== undefined) {
      updateValues.phone = body.phone?.trim() || null;
    }
    if (body.linkedUserId !== undefined) {
      updateValues.linkedUserId = body.linkedUserId || null;
    }
    if (body.isActive !== undefined) {
      updateValues.isActive = body.isActive;
    }

    // Check if we're linking a user - resolve any pending AI match tasks
    if (body.linkedUserId && body.linkedUserId !== existing.linkedUserId) {
      // Resolve matching AI tasks for this salesperson
      await db
        .update(tasks)
        .set({
          status: "completed",
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(tasks.tenantId, tenantId),
            eq(tasks.relatedEntityType, "salesperson"),
            eq(tasks.relatedEntityId, id),
            sql`${tasks.title} LIKE 'AI Match:%'`,
            eq(tasks.status, "open")
          )
        );
    }

    const [updated] = await db
      .update(salespersons)
      .set(updateValues)
      .where(and(eq(salespersons.tenantId, tenantId), eq(salespersons.id, id)))
      .returning();

    await auditCtx.log("salesperson", id, "salesperson_updated", {
      changes: Object.keys(updateValues).filter((k) => k !== "updatedAt"),
      linkedUserId: body.linkedUserId,
    });

    // Get linked user name if linked
    let linkedUserName: string | null = null;
    if (updated.linkedUserId) {
      const [user] = await db
        .select({ email: users.email, fullName: users.fullName })
        .from(users)
        .where(eq(users.id, updated.linkedUserId))
        .limit(1);
      if (user) {
        linkedUserName = user.fullName || user.email;
      }
    }

    return NextResponse.json({
      ...updated,
      linkedUserName,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PUT /api/sales-customers/salespersons/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
