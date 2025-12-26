/**
 * POST /api/auth/logout
 * Clear session cookie
 */

import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function POST(): Promise<NextResponse> {
  try {
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
