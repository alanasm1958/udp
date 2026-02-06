/**
 * /api/finance/periods/[id]
 *
 * GET: Get a single accounting period
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { db } from "@/db";
import { accountingPeriods } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * GET /api/finance/periods/[id]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const authResult = requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { tenantId } = authResult;

  try {
    const { id } = await params;

    const [period] = await db
      .select()
      .from(accountingPeriods)
      .where(
        and(
          eq(accountingPeriods.id, id),
          eq(accountingPeriods.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!period) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }

    return NextResponse.json({ period });
  } catch (error) {
    console.error("GET /api/finance/periods/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
