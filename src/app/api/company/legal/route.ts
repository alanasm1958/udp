/**
 * /api/company/legal
 *
 * GET: Get tenant legal profile
 * PATCH: Update tenant legal profile
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError, getUserIdFromHeaders, isValidUUID } from "@/lib/tenant";
import { db } from "@/db";
import { tenantLegalProfiles, actors } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit";

/**
 * GET /api/company/legal
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);

    const profile = await db
      .select()
      .from(tenantLegalProfiles)
      .where(eq(tenantLegalProfiles.tenantId, tenantId))
      .limit(1);

    if (profile.length === 0) {
      // Return empty profile - not an error
      return NextResponse.json({
        profile: {
          legalName: null,
          registrationNumber: null,
          taxId: null,
          address: null,
          city: null,
          region: null,
          country: null,
          postalCode: null,
          phone: null,
          email: null,
          website: null,
          notes: null,
        },
      });
    }

    return NextResponse.json({
      profile: {
        id: profile[0].id,
        legalName: profile[0].legalName,
        registrationNumber: profile[0].registrationNumber,
        taxId: profile[0].taxId,
        address: profile[0].address,
        city: profile[0].city,
        region: profile[0].region,
        country: profile[0].country,
        postalCode: profile[0].postalCode,
        phone: profile[0].phone,
        email: profile[0].email,
        website: profile[0].website,
        notes: profile[0].notes,
        updatedAt: profile[0].updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/company/legal error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/company/legal
 */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userId = getUserIdFromHeaders(req);

    if (!userId || !isValidUUID(userId)) {
      return NextResponse.json({ error: "Missing or invalid x-user-id header" }, { status: 400 });
    }

    const body = await req.json();
    const {
      legalName,
      registrationNumber,
      taxId,
      address,
      city,
      region,
      country,
      postalCode,
      phone,
      email,
      website,
      notes,
    } = body;

    // Get or create actor for user
    let actor = await db
      .select()
      .from(actors)
      .where(and(eq(actors.tenantId, tenantId), eq(actors.userId, userId)))
      .limit(1);

    let actorId: string;
    if (actor.length === 0) {
      const newActor = await db
        .insert(actors)
        .values({ tenantId, type: "user", userId })
        .returning({ id: actors.id });
      actorId = newActor[0].id;
    } else {
      actorId = actor[0].id;
    }

    // Check if profile exists
    const existing = await db
      .select({ id: tenantLegalProfiles.id })
      .from(tenantLegalProfiles)
      .where(eq(tenantLegalProfiles.tenantId, tenantId))
      .limit(1);

    // Build update/insert values
    const values = {
      legalName: legalName ?? null,
      registrationNumber: registrationNumber ?? null,
      taxId: taxId ?? null,
      address: address ?? null,
      city: city ?? null,
      region: region ?? null,
      country: country ?? null,
      postalCode: postalCode ?? null,
      phone: phone ?? null,
      email: email ?? null,
      website: website ?? null,
      notes: notes ?? null,
      updatedByActorId: actorId,
      updatedAt: sql`now()`,
    };

    let result;
    if (existing.length === 0) {
      // Insert new profile
      result = await db
        .insert(tenantLegalProfiles)
        .values({
          tenantId,
          ...values,
        })
        .returning();
    } else {
      // Update existing profile
      result = await db
        .update(tenantLegalProfiles)
        .set(values)
        .where(eq(tenantLegalProfiles.tenantId, tenantId))
        .returning();
    }

    // Audit log
    await logAuditEvent({
      tenantId,
      actorId,
      entityType: "tenant_legal_profile",
      entityId: result[0].id,
      action: "company_legal_profile_updated",
      metadata: { fields: Object.keys(body) },
    });

    return NextResponse.json({
      success: true,
      profile: {
        id: result[0].id,
        legalName: result[0].legalName,
        registrationNumber: result[0].registrationNumber,
        taxId: result[0].taxId,
        address: result[0].address,
        city: result[0].city,
        region: result[0].region,
        country: result[0].country,
        postalCode: result[0].postalCode,
        phone: result[0].phone,
        email: result[0].email,
        website: result[0].website,
        notes: result[0].notes,
        updatedAt: result[0].updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/company/legal error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
