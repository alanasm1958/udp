import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const limit = parseInt(searchParams.get("limit") || "100");

    const conditions = [eq(accounts.tenantId, tenantId)];
    if (type) {
      conditions.push(eq(accounts.type, type as any));
    }

    const accountsList = await db
      .select({
        id: accounts.id,
        code: accounts.code,
        name: accounts.name,
        accountType: accounts.type,
        isActive: accounts.isActive,
        parentAccountId: accounts.parentAccountId,
      })
      .from(accounts)
      .where(and(...conditions))
      .orderBy(accounts.code)
      .limit(limit);

    return NextResponse.json({
      accounts: accountsList,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error fetching accounts:", error);
    return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
  }
}
