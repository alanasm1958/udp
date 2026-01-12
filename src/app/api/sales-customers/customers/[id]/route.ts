/**
 * /api/sales-customers/customers/[id]
 *
 * Single customer CRUD operations.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { parties, partyProfiles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
    requireTenantIdFromHeaders,
    getUserIdFromHeaders,
    getActorIdFromHeaders,
    TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface UpdateCustomerRequest {
    name?: string;
    email?: string;
    phone?: string;
    notes?: string;
    isActive?: boolean;
}

/**
 * GET /api/sales-customers/customers/[id]
 * Get a single customer
 */
export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
    try {
        const tenantId = requireTenantIdFromHeaders(req);
        const { id } = await context.params;

        const [customer] = await db
            .select()
            .from(parties)
            .where(
                and(
                    eq(parties.tenantId, tenantId),
                    eq(parties.id, id),
                    eq(parties.type, "customer")
                )
            );

        if (!customer) {
            return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }

        // Fetch contact profile
        const [profile] = await db
            .select()
            .from(partyProfiles)
            .where(
                and(
                    eq(partyProfiles.tenantId, tenantId),
                    eq(partyProfiles.partyId, id),
                    eq(partyProfiles.profileType, "contact")
                )
            );

        const contact = profile?.data as { email?: string; phone?: string } | undefined;

        return NextResponse.json({
            id: customer.id,
            name: customer.name,
            code: customer.code,
            type: customer.type,
            isActive: customer.isActive,
            email: contact?.email || null,
            phone: contact?.phone || null,
            notes: customer.notes,
            createdAt: customer.createdAt,
        });
    } catch (error) {
        if (error instanceof TenantError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }
        console.error("GET /api/sales-customers/customers/[id] error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/sales-customers/customers/[id]
 * Update a customer
 */
export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
    try {
        const tenantId = requireTenantIdFromHeaders(req);
        const userIdFromHeader = getUserIdFromHeaders(req);
        const actorIdFromHeader = getActorIdFromHeaders(req);
        const { id } = await context.params;

        const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
        const audit = createAuditContext(tenantId, actor.actorId);

        const body: UpdateCustomerRequest = await req.json();

        // Build party updates
        const partyUpdates: Record<string, unknown> = {
            updatedAt: new Date(),
        };
        if (body.name !== undefined) partyUpdates.name = body.name;
        if (body.isActive !== undefined) partyUpdates.isActive = body.isActive;
        if (body.notes !== undefined) partyUpdates.notes = body.notes;

        // Update party
        const [updated] = await db
            .update(parties)
            .set(partyUpdates)
            .where(
                and(
                    eq(parties.tenantId, tenantId),
                    eq(parties.id, id),
                    eq(parties.type, "customer")
                )
            )
            .returning();

        if (!updated) {
            return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }

        // Update or create contact profile if email/phone changed
        if (body.email !== undefined || body.phone !== undefined) {
            const [existingProfile] = await db
                .select()
                .from(partyProfiles)
                .where(
                    and(
                        eq(partyProfiles.tenantId, tenantId),
                        eq(partyProfiles.partyId, id),
                        eq(partyProfiles.profileType, "contact")
                    )
                );

            const currentData = existingProfile?.data as { email?: string; phone?: string } || {};
            const newData = {
                email: body.email !== undefined ? body.email : currentData.email,
                phone: body.phone !== undefined ? body.phone : currentData.phone,
            };

            if (existingProfile) {
                await db
                    .update(partyProfiles)
                    .set({ data: newData, updatedAt: new Date() })
                    .where(eq(partyProfiles.id, existingProfile.id));
            } else {
                await db
                    .insert(partyProfiles)
                    .values({
                        tenantId,
                        partyId: id,
                        profileType: "contact",
                        data: newData,
                        createdByActorId: actor.actorId,
                    });
            }
        }

        await audit.log("party", id, "party_updated", {
            changes: Object.keys(partyUpdates).filter((k) => k !== "updatedAt"),
        });

        // Fetch updated contact
        const [profile] = await db
            .select()
            .from(partyProfiles)
            .where(
                and(
                    eq(partyProfiles.tenantId, tenantId),
                    eq(partyProfiles.partyId, id),
                    eq(partyProfiles.profileType, "contact")
                )
            );

        const contact = profile?.data as { email?: string; phone?: string } | undefined;

        return NextResponse.json({
            id: updated.id,
            name: updated.name,
            code: updated.code,
            type: updated.type,
            isActive: updated.isActive,
            email: contact?.email || null,
            phone: contact?.phone || null,
            notes: updated.notes,
            createdAt: updated.createdAt,
        });
    } catch (error) {
        if (error instanceof TenantError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }
        console.error("PUT /api/sales-customers/customers/[id] error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
