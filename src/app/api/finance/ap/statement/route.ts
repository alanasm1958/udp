/**
 * /api/finance/ap/statement
 *
 * GET: Get AP statement for a party (vendor)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";
import { getAPStatement } from "@/lib/arAp";

/**
 * GET /api/finance/ap/statement
 * Query params: partyId (required), from?, to?
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { searchParams } = new URL(req.url);

    const partyId = searchParams.get("partyId");
    if (!partyId) {
      return NextResponse.json({ error: "partyId is required" }, { status: 400 });
    }

    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    const result = await getAPStatement(tenantId, partyId, { from, to });

    if (!result) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/finance/ap/statement error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
