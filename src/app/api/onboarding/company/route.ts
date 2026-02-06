/**
 * /api/onboarding/company
 *
 * PUT: Save company profile during onboarding
 */

import { NextRequest, NextResponse } from "next/server";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { db } from "@/db";
import { tenants, tenantLegalProfiles } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { createAuditContext } from "@/lib/audit";

interface CompanyProfileInput {
  companyName: string;
  industry?: string;
  address?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  taxId?: string;
  phone?: string;
  email?: string;
  website?: string;
}

/**
 * PUT /api/onboarding/company
 * Creates or updates the company legal profile
 */
export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);
    const body: CompanyProfileInput = await req.json();

    if (!body.companyName) {
      return NextResponse.json({ error: "companyName is required" }, { status: 400 });
    }

    // Update tenant name and industry
    await db
      .update(tenants)
      .set({
        name: body.companyName,
        // @ts-expect-error - industry may not be in type yet
        industry: body.industry || null,
        updatedAt: sql`now()`,
      })
      .where(eq(tenants.id, tenantId));

    // Check if legal profile exists
    const [existingProfile] = await db
      .select({ id: tenantLegalProfiles.id })
      .from(tenantLegalProfiles)
      .where(eq(tenantLegalProfiles.tenantId, tenantId))
      .limit(1);

    let profile;

    if (existingProfile) {
      // Update existing profile
      [profile] = await db
        .update(tenantLegalProfiles)
        .set({
          legalName: body.companyName,
          address: body.address || null,
          city: body.city || null,
          region: body.region || null,
          postalCode: body.postalCode || null,
          country: body.country || "US",
          taxId: body.taxId || null,
          phone: body.phone || null,
          email: body.email || null,
          website: body.website || null,
          updatedAt: sql`now()`,
        })
        .where(eq(tenantLegalProfiles.id, existingProfile.id))
        .returning();
    } else {
      // Create new profile
      [profile] = await db
        .insert(tenantLegalProfiles)
        .values({
          tenantId,
          legalName: body.companyName,
          address: body.address || null,
          city: body.city || null,
          region: body.region || null,
          postalCode: body.postalCode || null,
          country: body.country || "US",
          taxId: body.taxId || null,
          phone: body.phone || null,
          email: body.email || null,
          website: body.website || null,
        })
        .returning();
    }

    await audit.log(
      "tenant_legal_profile",
      profile.id,
      "onboarding_company_saved",
      {
        companyName: body.companyName,
        industry: body.industry,
        isUpdate: !!existingProfile,
      }
    );

    return NextResponse.json({
      success: true,
      profile: {
        id: profile.id,
        companyName: profile.legalName,
        country: profile.country,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PUT /api/onboarding/company error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
