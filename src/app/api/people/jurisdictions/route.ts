/**
 * /api/people/jurisdictions
 *
 * List jurisdictions (global reference data, not tenant-scoped)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { jurisdictions } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  TenantError,
} from "@/lib/tenant";

/**
 * GET /api/people/jurisdictions
 * List jurisdictions with optional filtering
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // Still require tenant auth but jurisdictions are global
    requireTenantIdFromHeaders(req);
    const url = new URL(req.url);

    const countryCode = url.searchParams.get("countryCode");
    const type = url.searchParams.get("type");
    const activeOnly = url.searchParams.get("activeOnly") !== "false";
    const topLevelOnly = url.searchParams.get("topLevelOnly") === "true";

    const conditions = [];

    if (activeOnly) {
      conditions.push(eq(jurisdictions.isActive, true));
    }

    if (countryCode) {
      conditions.push(eq(jurisdictions.countryCode, countryCode));
    }

    if (type) {
      conditions.push(eq(jurisdictions.jurisdictionType, type as "country" | "state" | "province" | "territory" | "local"));
    }

    if (topLevelOnly) {
      conditions.push(isNull(jurisdictions.parentJurisdictionId));
    }

    const items = await db
      .select({
        id: jurisdictions.id,
        code: jurisdictions.code,
        name: jurisdictions.name,
        countryCode: jurisdictions.countryCode,
        subdivisionCode: jurisdictions.subdivisionCode,
        jurisdictionType: jurisdictions.jurisdictionType,
        parentJurisdictionId: jurisdictions.parentJurisdictionId,
        currencyCode: jurisdictions.currencyCode,
        timezone: jurisdictions.timezone,
        isActive: jurisdictions.isActive,
      })
      .from(jurisdictions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(jurisdictions.name);

    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/people/jurisdictions error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
