/**
 * POST /api/auth/logout
 * Clear session cookie
 */

import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { clearSessionCookie, getSessionTokenFromRequest } from "@/lib/auth";
import { revokeSession } from "@/lib/sessions";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Revoke server-side session if token is present
    const token = getSessionTokenFromRequest(req);
    if (token) {
      await revokeSession(token);
    }

    await clearSessionCookie();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/auth/logout error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Logout failed" },
      { status: 500 }
    );
  }
}
