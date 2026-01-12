/**
 * /api/grc/profile
 *
 * GET: Get current business profile
 * POST: Create or update business profile
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";
import { db } from "@/db";
import { businessProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/grc/profile
 * Returns the business profile for the current tenant
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);

    const [profile] = await db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.tenantId, tenantId))
      .limit(1);

    if (!profile) {
      return NextResponse.json({ profile: null });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/grc/profile error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/grc/profile
 * Create or update business profile
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const body = await req.json();

    const {
      legalName,
      tradeName,
      legalStructure,
      incorporationDate,
      jurisdiction,
      taxId,
      primaryIndustry,
      naicsCodes,
      businessDescription,
      annualRevenue,
      employeeCount,
      headquartersAddress,
      operatingLocations,
      businessActivities,
      licensesHeld,
      regulatedActivities,
    } = body;

    if (!legalName) {
      return NextResponse.json(
        { error: "legalName is required" },
        { status: 400 }
      );
    }

    // Check if profile exists
    const [existing] = await db
      .select({ id: businessProfiles.id })
      .from(businessProfiles)
      .where(eq(businessProfiles.tenantId, tenantId))
      .limit(1);

    let profile;

    if (existing) {
      // Update existing profile
      [profile] = await db
        .update(businessProfiles)
        .set({
          legalName,
          tradeName: tradeName || null,
          legalStructure: legalStructure || null,
          incorporationDate: incorporationDate || null,
          jurisdiction: jurisdiction || null,
          taxId: taxId || null,
          primaryIndustry: primaryIndustry || null,
          naicsCodes: naicsCodes || [],
          businessDescription: businessDescription || null,
          annualRevenue: annualRevenue?.toString() || null,
          employeeCount: employeeCount || null,
          headquartersAddress: headquartersAddress || null,
          operatingLocations: operatingLocations || [],
          businessActivities: businessActivities || [],
          licensesHeld: licensesHeld || [],
          regulatedActivities: regulatedActivities || [],
          updatedAt: new Date(),
        })
        .where(eq(businessProfiles.id, existing.id))
        .returning();
    } else {
      // Create new profile
      [profile] = await db
        .insert(businessProfiles)
        .values({
          tenantId,
          legalName,
          tradeName: tradeName || null,
          legalStructure: legalStructure || null,
          incorporationDate: incorporationDate || null,
          jurisdiction: jurisdiction || null,
          taxId: taxId || null,
          primaryIndustry: primaryIndustry || null,
          naicsCodes: naicsCodes || [],
          businessDescription: businessDescription || null,
          annualRevenue: annualRevenue?.toString() || null,
          employeeCount: employeeCount || null,
          headquartersAddress: headquartersAddress || null,
          operatingLocations: operatingLocations || [],
          businessActivities: businessActivities || [],
          licensesHeld: licensesHeld || [],
          regulatedActivities: regulatedActivities || [],
        })
        .returning();
    }

    return NextResponse.json({ profile }, { status: existing ? 200 : 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/grc/profile error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
