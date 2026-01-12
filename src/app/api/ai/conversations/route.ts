/**
 * /api/ai/conversations
 *
 * AI conversation management
 * GET: List user's conversations
 * POST: Create a new conversation
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { aiConversations } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { canUseAI } from "@/lib/entitlements";

/**
 * GET /api/ai/conversations
 * List user's conversations
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userId = getUserIdFromHeaders(req);

    if (!userId) {
      return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
    }

    // Check AI entitlement
    const canUse = await canUseAI(tenantId);
    if (!canUse) {
      return NextResponse.json(
        { error: "AI Copilot is not available on your plan" },
        { status: 403 }
      );
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "active";
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "20", 10) || 20, 1), 100);

    const conversations = await db
      .select({
        id: aiConversations.id,
        title: aiConversations.title,
        status: aiConversations.status,
        lastMessageAt: aiConversations.lastMessageAt,
        createdAt: aiConversations.createdAt,
      })
      .from(aiConversations)
      .where(
        and(
          eq(aiConversations.tenantId, tenantId),
          eq(aiConversations.userId, userId),
          eq(aiConversations.status, status as "active" | "archived")
        )
      )
      .orderBy(desc(aiConversations.lastMessageAt))
      .limit(limit);

    return NextResponse.json({ items: conversations });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/ai/conversations error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/conversations
 * Create a new conversation
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userId = getUserIdFromHeaders(req);

    if (!userId) {
      return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
    }

    // Check AI entitlement
    const canUse = await canUseAI(tenantId);
    if (!canUse) {
      return NextResponse.json(
        { error: "AI Copilot is not available on your plan" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const title = body.title || null;

    const [conversation] = await db
      .insert(aiConversations)
      .values({
        tenantId,
        userId,
        title,
      })
      .returning();

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/ai/conversations error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
