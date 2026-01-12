/**
 * /api/people/[id]
 *
 * Get, update, and deactivate a person
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { people, parties, departments, users, serviceProviders, items } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/people/[id]
 * Get person details with linked entities
 */
export async function GET(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await context.params;

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid person ID" }, { status: 400 });
    }

    const [person] = await db
      .select()
      .from(people)
      .where(and(eq(people.tenantId, tenantId), eq(people.id, id)));

    if (!person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    // Fetch linked party name
    let linkedPartyName: string | null = null;
    if (person.linkedPartyId) {
      const [party] = await db
        .select({ name: parties.name })
        .from(parties)
        .where(eq(parties.id, person.linkedPartyId));
      linkedPartyName = party?.name ?? null;
    }

    // Fetch linked user info
    let linkedUserEmail: string | null = null;
    if (person.linkedUserId) {
      const [user] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, person.linkedUserId));
      linkedUserEmail = user?.email ?? null;
    }

    // Fetch department name
    let departmentName: string | null = null;
    if (person.departmentId) {
      const [dept] = await db
        .select({ name: departments.name })
        .from(departments)
        .where(eq(departments.id, person.departmentId));
      departmentName = dept?.name ?? null;
    }

    // Fetch services this person can provide
    const servicesProvidable = await db
      .select({
        itemId: items.id,
        itemName: items.name,
        isPreferred: serviceProviders.isPreferred,
        hourlyRate: serviceProviders.hourlyRate,
        fixedRate: serviceProviders.fixedRate,
      })
      .from(serviceProviders)
      .innerJoin(items, eq(items.id, serviceProviders.itemId))
      .where(
        and(
          eq(serviceProviders.tenantId, tenantId),
          eq(serviceProviders.personId, id),
          eq(serviceProviders.isActive, true)
        )
      );

    return NextResponse.json({
      ...person,
      linkedPartyName,
      linkedUserEmail,
      departmentName,
      servicesProvidable,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/people/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/people/[id]
 * Update a person
 */
export async function PUT(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);
    const { id } = await context.params;

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid person ID" }, { status: 400 });
    }

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const [existing] = await db
      .select({ id: people.id, isQuickAdd: people.isQuickAdd })
      .from(people)
      .where(and(eq(people.tenantId, tenantId), eq(people.id, id)));

    if (!existing) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    const body = await req.json();

    // Build update object
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (body.fullName !== undefined) updateData.fullName = body.fullName;
    if (body.displayName !== undefined) updateData.displayName = body.displayName;
    if (body.types !== undefined) updateData.types = body.types;
    if (body.primaryEmail !== undefined) updateData.primaryEmail = body.primaryEmail;
    if (body.secondaryEmails !== undefined) updateData.secondaryEmails = body.secondaryEmails;
    if (body.primaryPhone !== undefined) updateData.primaryPhone = body.primaryPhone;
    if (body.secondaryPhones !== undefined) updateData.secondaryPhones = body.secondaryPhones;
    if (body.whatsappNumber !== undefined) updateData.whatsappNumber = body.whatsappNumber;
    if (body.preferredChannel !== undefined) updateData.preferredChannel = body.preferredChannel;
    if (body.channelFallbackOrder !== undefined) updateData.channelFallbackOrder = body.channelFallbackOrder;
    if (body.jobTitle !== undefined) updateData.jobTitle = body.jobTitle;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.metadata !== undefined) updateData.metadata = body.metadata;

    // Handle linked party
    if (body.linkedPartyId !== undefined) {
      if (body.linkedPartyId && !isValidUuid(body.linkedPartyId)) {
        return NextResponse.json({ error: "Invalid linkedPartyId format" }, { status: 400 });
      }
      if (body.linkedPartyId) {
        const [party] = await db
          .select({ id: parties.id })
          .from(parties)
          .where(and(eq(parties.tenantId, tenantId), eq(parties.id, body.linkedPartyId)));
        if (!party) {
          return NextResponse.json({ error: "Linked party not found" }, { status: 404 });
        }
      }
      updateData.linkedPartyId = body.linkedPartyId || null;
    }

    // Handle linked user
    if (body.linkedUserId !== undefined) {
      if (body.linkedUserId && !isValidUuid(body.linkedUserId)) {
        return NextResponse.json({ error: "Invalid linkedUserId format" }, { status: 400 });
      }
      if (body.linkedUserId) {
        const [user] = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.tenantId, tenantId), eq(users.id, body.linkedUserId)));
        if (!user) {
          return NextResponse.json({ error: "Linked user not found" }, { status: 404 });
        }
      }
      updateData.linkedUserId = body.linkedUserId || null;
    }

    // Handle department
    if (body.departmentId !== undefined) {
      if (body.departmentId && !isValidUuid(body.departmentId)) {
        return NextResponse.json({ error: "Invalid departmentId format" }, { status: 400 });
      }
      if (body.departmentId) {
        const [dept] = await db
          .select({ id: departments.id })
          .from(departments)
          .where(and(eq(departments.tenantId, tenantId), eq(departments.id, body.departmentId)));
        if (!dept) {
          return NextResponse.json({ error: "Department not found" }, { status: 404 });
        }
      }
      updateData.departmentId = body.departmentId || null;
    }

    // Mark quick-add as completed if profile is being updated
    if (existing.isQuickAdd && Object.keys(updateData).length > 1) {
      updateData.isQuickAdd = false;
      updateData.quickAddCompletedAt = new Date();
    }

    const [updated] = await db
      .update(people)
      .set(updateData)
      .where(and(eq(people.tenantId, tenantId), eq(people.id, id)))
      .returning();

    await audit.log("person", id, "person_updated", { changes: Object.keys(updateData) });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PUT /api/people/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/people/[id]
 * Deactivate a person (soft delete)
 */
export async function DELETE(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);
    const { id } = await context.params;

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid person ID" }, { status: 400 });
    }

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const [existing] = await db
      .select({ id: people.id })
      .from(people)
      .where(and(eq(people.tenantId, tenantId), eq(people.id, id)));

    if (!existing) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    await db
      .update(people)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(people.tenantId, tenantId), eq(people.id, id)));

    await audit.log("person", id, "person_deactivated", {});

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("DELETE /api/people/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
