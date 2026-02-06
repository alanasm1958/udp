/**
 * GET /api/auth/accessible-pages
 * Returns list of pages the current user has access to
 * Used for navigation filtering
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthFromHeaders } from "@/lib/authz";
import { getUserAccessiblePages } from "@/lib/rbac-access";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const auth = getAuthFromHeaders(req);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessiblePages = await getUserAccessiblePages(auth.tenantId, auth.userId);

    // Create a set of accessible routes for quick lookup
    const accessibleRoutes = accessiblePages.map((p) => p.route);

    return NextResponse.json({
      pages: accessiblePages,
      routes: accessibleRoutes,
      isAdmin: accessiblePages.length > 0 && accessiblePages.every((p) => p.hasAccess),
    });
  } catch (error) {
    console.error("GET /api/auth/accessible-pages error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get accessible pages" },
      { status: 500 }
    );
  }
}
