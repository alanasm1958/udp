/**
 * /api/sales-customers/customers
 *
 * Proxy API for customer CRUD within the sales-customers domain.
 * Wraps the master parties API with type=customer filter.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { parties, partyProfiles } from "@/db/schema";
import { eq, and, ilike, or, sql, desc } from "drizzle-orm";
import {
    requireTenantIdFromHeaders,
    getUserIdFromHeaders,
    getActorIdFromHeaders,
    TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface CreateCustomerRequest {
    name: string;
    code?: string;
    email?: string;
    phone?: string;
    notes?: string;
}

/**
 * GET /api/sales-customers/customers
 * List customers (parties with type=customer)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
    try {
        const tenantId = requireTenantIdFromHeaders(req);
        const url = new URL(req.url);

        const searchQuery = url.searchParams.get("q");
        const limitParam = url.searchParams.get("limit");
        const limit = Math.min(Math.max(parseInt(limitParam || "100", 10) || 100, 1), 200);

        // Build conditions - always filter by type=customer
        const conditions = [
            eq(parties.tenantId, tenantId),
            eq(parties.type, "customer"),
        ];

        if (searchQuery) {
            const searchPattern = `%${searchQuery}%`;
            conditions.push(
                or(
                    ilike(parties.name, searchPattern),
                    ilike(parties.code, searchPattern)
                )!
            );
        }

        // Get customers with their contact profile
        const customers = await db
            .select({
                id: parties.id,
                name: parties.name,
                code: parties.code,
                type: parties.type,
                isActive: parties.isActive,
                defaultCurrency: parties.defaultCurrency,
                notes: parties.notes,
                createdAt: parties.createdAt,
            })
            .from(parties)
            .where(and(...conditions))
            .orderBy(desc(parties.createdAt))
            .limit(limit);

        // Fetch contact profiles for customers
        const customerIds = customers.map((c) => c.id);
        const profiles = customerIds.length > 0
            ? await db
                .select()
                .from(partyProfiles)
                .where(
                    and(
                        eq(partyProfiles.tenantId, tenantId),
                        eq(partyProfiles.profileType, "contact"),
                        sql`${partyProfiles.partyId} = ANY(${customerIds}::uuid[])`
                    )
                )
            : [];

        // Build profile map
        const profileMap = new Map<string, { email?: string; phone?: string }>();
        for (const profile of profiles) {
            const data = profile.data as { email?: string; phone?: string };
            profileMap.set(profile.partyId, { email: data.email, phone: data.phone });
        }

        // Enrich customers with contact data
        const items = customers.map((c) => {
            const contact = profileMap.get(c.id);
            return {
                ...c,
                email: contact?.email || null,
                phone: contact?.phone || null,
            };
        });

        return NextResponse.json({ items, total: items.length });
    } catch (error) {
        if (error instanceof TenantError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }
        console.error("GET /api/sales-customers/customers error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/sales-customers/customers
 * Create a new customer
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        const tenantId = requireTenantIdFromHeaders(req);
        const userIdFromHeader = getUserIdFromHeaders(req);
        const actorIdFromHeader = getActorIdFromHeaders(req);

        const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
        const audit = createAuditContext(tenantId, actor.actorId);

        const body: CreateCustomerRequest = await req.json();

        // Validate required fields
        if (!body.name) {
            return NextResponse.json({ error: "name is required" }, { status: 400 });
        }

        // Generate code if not provided: CUST-XXXX
        const code = body.code || `CUST-${Date.now().toString(36).toUpperCase()}`;

        // Create customer party
        const [customer] = await db
            .insert(parties)
            .values({
                tenantId,
                type: "customer",
                code,
                name: body.name,
                notes: body.notes ?? null,
                createdByActorId: actor.actorId,
            })
            .returning();

        await audit.log("party", customer.id, "party_created", {
            code,
            name: body.name,
        });

        // Create contact profile if email or phone provided
        if (body.email || body.phone) {
            await db
                .insert(partyProfiles)
                .values({
                    tenantId,
                    partyId: customer.id,
                    profileType: "contact",
                    data: {
                        email: body.email || null,
                        phone: body.phone || null,
                    },
                    createdByActorId: actor.actorId,
                });
        }

        return NextResponse.json({
            id: customer.id,
            name: customer.name,
            code: customer.code,
            type: customer.type,
            isActive: customer.isActive,
            email: body.email || null,
            phone: body.phone || null,
            notes: customer.notes,
            createdAt: customer.createdAt,
        }, { status: 201 });
    } catch (error) {
        if (error instanceof TenantError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }
        console.error("POST /api/sales-customers/customers error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
