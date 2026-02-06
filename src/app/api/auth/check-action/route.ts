/**
 * GET /api/auth/check-action
 * Check if current user has access to a specific action
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthFromHeaders } from "@/lib/authz";
import { checkActionAccess } from "@/lib/rbac-access";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const auth = getAuthFromHeaders(req);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const pageCode = searchParams.get("pageCode");
    const actionCode = searchParams.get("actionCode");

    if (!pageCode || !actionCode) {
      return NextResponse.json(
        { error: "pageCode and actionCode are required" },
        { status: 400 }
      );
    }

    const result = await checkActionAccess(
      auth.tenantId,
      auth.userId,
      pageCode,
      actionCode
    );

    return NextResponse.json({
      hasAccess: result.hasAccess,
      action: result.action,
      reason: result.reason,
    });
  } catch (error) {
    console.error("GET /api/auth/check-action error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check action access" },
      { status: 500 }
    );
  }
}
