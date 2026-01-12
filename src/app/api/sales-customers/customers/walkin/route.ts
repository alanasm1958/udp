/**
 * /api/sales-customers/customers/walkin
 *
 * Idempotent endpoint to ensure a Walk-in (General) customer exists per tenant.
 * Used for POS/walk-in sales where no specific customer is selected.
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

const WALKIN_CODE = "WALKIN";
const WALKIN_NAME = "Walk-in (General)";

/**
 * GET /api/sales-customers/customers/walkin
 * Get the Walk-in customer, creating if not exists (idempotent)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
    try {
        const tenantId = requireTenantIdFromHeaders(req);
        const userIdFromHeader = getUserIdFromHeaders(req);
        const actorIdFromHeader = getActorIdFromHeaders(req);

        // Check if Walk-in customer already exists
        const existing = await db
            .select({
                id: parties.id,
                name: parties.name,
                code: parties.code,
                type: parties.type,
                isActive: parties.isActive,
                notes: parties.notes,
            })
            .from(parties)
            .where(
                and(
                    eq(parties.tenantId, tenantId),
                    eq(parties.code, WALKIN_CODE),
                    eq(parties.type, "customer")
                )
            )
            .limit(1);

        if (existing.length > 0) {
            return NextResponse.json({
                ...existing[0],
                email: null,
                phone: null,
                isWalkin: true,
            });
        }

        // Create Walk-in customer if not exists
        const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
        const audit = createAuditContext(tenantId, actor.actorId);

        const [customer] = await db
            .insert(parties)
            .values({
                tenantId,
                type: "customer",
                code: WALKIN_CODE,
                name: WALKIN_NAME,
                notes: "Default walk-in customer for point-of-sale transactions",
                createdByActorId: actor.actorId,
            })
            .onConflictDoNothing()
            .returning();

        // Handle race condition - if conflict occurred, fetch existing
        if (!customer) {
            const [refetched] = await db
                .select({
                    id: parties.id,
                    name: parties.name,
                    code: parties.code,
                    type: parties.type,
                    isActive: parties.isActive,
                    notes: parties.notes,
                })
                .from(parties)
                .where(
                    and(
                        eq(parties.tenantId, tenantId),
                        eq(parties.code, WALKIN_CODE),
                        eq(parties.type, "customer")
                    )
                )
                .limit(1);

            return NextResponse.json({
                ...refetched,
                email: null,
                phone: null,
                isWalkin: true,
            });
        }

        await audit.log("party", customer.id, "party_created", {
            code: WALKIN_CODE,
            name: WALKIN_NAME,
            isWalkin: true,
        });

        return NextResponse.json({
            id: customer.id,
            name: customer.name,
            code: customer.code,
            type: customer.type,
            isActive: customer.isActive,
            notes: customer.notes,
            email: null,
            phone: null,
            isWalkin: true,
        }, { status: 201 });
    } catch (error) {
        if (error instanceof TenantError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }
        console.error("GET /api/sales-customers/customers/walkin error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/sales-customers/customers/walkin
 * Same as GET - idempotent ensure
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    return GET(req);
}
