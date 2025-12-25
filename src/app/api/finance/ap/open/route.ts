/**
 * /api/finance/ap/open
 *
 * GET: List open AP (purchase invoices with remaining balance > 0)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";
import { listOpenAP } from "@/lib/arAp";

/**
 * GET /api/finance/ap/open
 * Query params: partyId?, limit?, offset?
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { searchParams } = new URL(req.url);

    const partyId = searchParams.get("partyId") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const result = await listOpenAP(tenantId, { partyId, limit, offset });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/finance/ap/open error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
