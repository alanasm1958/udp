/**
 * /api/master/parties
 *
 * CRUD endpoints for party master data.
 * Parties represent customers, vendors, employees, banks, etc.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { parties, partyProfiles, partyIdentifiers } from "@/db/schema";
import { eq, and, ilike, or, sql } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

// Request types
interface PartyProfileInput {
  profileType: string;
  data: Record<string, unknown>;
}

interface PartyIdentifierInput {
  identifierType: string;
  identifierValue: string;
  issuingAuthority?: string;
  validFrom?: string;
  validTo?: string;
}

interface CreatePartyRequest {
  type: "customer" | "vendor" | "employee" | "bank" | "government" | "other";
  code: string;
  name: string;
  defaultCurrency?: string;
  notes?: string;
  profiles?: PartyProfileInput[];
  identifiers?: PartyIdentifierInput[];
}

interface UpdatePartyRequest {
  id: string;
  name?: string;
  isActive?: boolean;
  defaultCurrency?: string;
  notes?: string;
}

// Response types
interface PartyResponse {
  id: string;
  type: string;
  code: string;
  name: string;
  isActive: boolean;
  defaultCurrency: string | null;
  notes: string | null;
  createdAt: Date;
  profiles?: Array<{
    id: string;
    profileType: string;
    data: unknown;
  }>;
  identifiers?: Array<{
    id: string;
    identifierType: string;
    identifierValue: string;
    issuingAuthority: string | null;
    validFrom: string | null;
    validTo: string | null;
  }>;
}

/**
 * GET /api/master/parties
 * List parties for the tenant with optional filters
 * Query params: type, q (search name/code), limit (default 50, max 200)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const url = new URL(req.url);

    // Parse query params
    const typeFilter = url.searchParams.get("type");
    const searchQuery = url.searchParams.get("q");
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 200);

    // Build conditions
    const conditions = [eq(parties.tenantId, tenantId)];

    if (typeFilter) {
      conditions.push(eq(parties.type, typeFilter as typeof parties.type.enumValues[number]));
    }

    if (searchQuery) {
      const searchPattern = `%${searchQuery}%`;
      conditions.push(
        or(
          ilike(parties.name, searchPattern),
          ilike(parties.code, searchPattern)
        )!
      );
    }

    const partyList = await db
      .select({
        id: parties.id,
        partyType: parties.type,
        displayName: parties.name,
        code: parties.code,
        status: sql<string>`CASE WHEN ${parties.isActive} THEN 'active' ELSE 'inactive' END`,
        createdAt: parties.createdAt,
      })
      .from(parties)
      .where(and(...conditions))
      .limit(limit);

    return NextResponse.json({ items: partyList });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/master/parties error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/master/parties
 * Create a new party with optional profiles and identifiers
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: CreatePartyRequest = await req.json();

    // Validate required fields
    if (!body.type || !body.code || !body.name) {
      return NextResponse.json(
        { error: "type, code, and name are required" },
        { status: 400 }
      );
    }

    // Create party
    const [party] = await db
      .insert(parties)
      .values({
        tenantId,
        type: body.type,
        code: body.code,
        name: body.name,
        defaultCurrency: body.defaultCurrency ?? null,
        notes: body.notes ?? null,
        createdByActorId: actor.actorId,
      })
      .returning();

    await audit.log("party", party.id, "party_created", {
      type: body.type,
      code: body.code,
      name: body.name,
    });

    // Create profiles if provided
    const createdProfiles: Array<{ id: string; profileType: string; data: unknown }> = [];
    if (body.profiles && body.profiles.length > 0) {
      for (const profile of body.profiles) {
        const [created] = await db
          .insert(partyProfiles)
          .values({
            tenantId,
            partyId: party.id,
            profileType: profile.profileType,
            data: profile.data,
            createdByActorId: actor.actorId,
          })
          .returning();

        createdProfiles.push({
          id: created.id,
          profileType: created.profileType,
          data: created.data,
        });

        await audit.log("party_profile", created.id, "party_profile_created", {
          partyId: party.id,
          profileType: profile.profileType,
        });
      }
    }

    // Create identifiers if provided
    const createdIdentifiers: Array<{
      id: string;
      identifierType: string;
      identifierValue: string;
      issuingAuthority: string | null;
      validFrom: string | null;
      validTo: string | null;
    }> = [];
    if (body.identifiers && body.identifiers.length > 0) {
      for (const identifier of body.identifiers) {
        const [created] = await db
          .insert(partyIdentifiers)
          .values({
            tenantId,
            partyId: party.id,
            identifierType: identifier.identifierType,
            identifierValue: identifier.identifierValue,
            issuingAuthority: identifier.issuingAuthority ?? null,
            validFrom: identifier.validFrom ?? null,
            validTo: identifier.validTo ?? null,
            createdByActorId: actor.actorId,
          })
          .returning();

        createdIdentifiers.push({
          id: created.id,
          identifierType: created.identifierType,
          identifierValue: created.identifierValue,
          issuingAuthority: created.issuingAuthority,
          validFrom: created.validFrom,
          validTo: created.validTo,
        });

        await audit.log("party_identifier", created.id, "party_identifier_created", {
          partyId: party.id,
          identifierType: identifier.identifierType,
        });
      }
    }

    const response: PartyResponse = {
      id: party.id,
      type: party.type,
      code: party.code,
      name: party.name,
      isActive: party.isActive,
      defaultCurrency: party.defaultCurrency,
      notes: party.notes,
      createdAt: party.createdAt,
      profiles: createdProfiles,
      identifiers: createdIdentifiers,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/master/parties error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/master/parties
 * Update an existing party
 */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: UpdatePartyRequest = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Build update object
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (body.name !== undefined) updates.name = body.name;
    if (body.isActive !== undefined) updates.isActive = body.isActive;
    if (body.defaultCurrency !== undefined) updates.defaultCurrency = body.defaultCurrency;
    if (body.notes !== undefined) updates.notes = body.notes;

    const [updated] = await db
      .update(parties)
      .set(updates)
      .where(and(eq(parties.tenantId, tenantId), eq(parties.id, body.id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    await audit.log("party", updated.id, "party_updated", {
      changes: Object.keys(updates).filter((k) => k !== "updatedAt"),
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/master/parties error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
