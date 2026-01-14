/**
 * /api/sales-customers/ai-tasks/[id]/dismiss
 *
 * Dismiss an AI sales task
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { aiSalesTasks, actors } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  TenantError,
} from "@/lib/tenant";

interface DismissRequest {
  reason?: string;
}

/**
 * POST /api/sales-customers/ai-tasks/[id]/dismiss
 * Dismiss a task
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userId = getUserIdFromHeaders(req);
    const { id } = await params;

    if (!userId) {
      return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
    }

    const body: DismissRequest = await req.json().catch(() => ({}));

    // Get actor ID for the user
    const [actor] = await db
      .select({ id: actors.id })
      .from(actors)
      .where(and(eq(actors.tenantId, tenantId), eq(actors.userId, userId)));

    // Update task
    const [updatedTask] = await db
      .update(aiSalesTasks)
      .set({
        status: "dismissed",
        completedAt: new Date(),
        completedByActorId: actor?.id,
        completionNote: body.reason || "Task dismissed by user",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(aiSalesTasks.id, id),
          eq(aiSalesTasks.tenantId, tenantId)
        )
      )
      .returning({ id: aiSalesTasks.id });

    if (!updatedTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, taskId: updatedTask.id });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/sales-customers/ai-tasks/[id]/dismiss error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
