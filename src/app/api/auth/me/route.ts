/**
 * GET /api/auth/me
 * Returns current user and tenant info from session
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthFromHeaders } from "@/lib/authz";
import { db } from "@/db";
import { users, tenants } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const auth = getAuthFromHeaders(req);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user details
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        isActive: users.isActive,
      })
      .from(users)
      .where(
        and(
          eq(users.tenantId, auth.tenantId),
          eq(users.id, auth.userId)
        )
      )
      .limit(1);

    // Get tenant details
    const [tenant] = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        baseCurrency: tenants.baseCurrency,
      })
      .from(tenants)
      .where(eq(tenants.id, auth.tenantId))
      .limit(1);

    return NextResponse.json({
      user: {
        id: auth.userId,
        actorId: auth.actorId,
        email: user?.email || auth.email,
        fullName: user?.fullName || "",
        roles: auth.roles,
      },
      tenant: {
        id: auth.tenantId,
        name: tenant?.name || "",
        baseCurrency: tenant?.baseCurrency || "USD",
      },
    });
  } catch (error) {
    console.error("GET /api/auth/me error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get user info" },
      { status: 500 }
    );
  }
}
