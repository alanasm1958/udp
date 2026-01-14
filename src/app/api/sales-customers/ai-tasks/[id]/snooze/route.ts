/**
 * /api/sales-customers/ai-tasks/[id]/snooze
 *
 * Snooze an AI sales task
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { aiSalesTasks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  TenantError,
} from "@/lib/tenant";

interface SnoozeRequest {
  hours?: number; // Default 24 hours
}

/**
 * POST /api/sales-customers/ai-tasks/[id]/snooze
 * Snooze a task for a specified duration
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

    const body: SnoozeRequest = await req.json().catch(() => ({}));
    const hours = body.hours || 24;

    // Calculate snooze until time
    const snoozedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);

    // Update task
    const [updatedTask] = await db
      .update(aiSalesTasks)
      .set({
        status: "snoozed",
        snoozedUntil,
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

    return NextResponse.json({
      success: true,
      taskId: updatedTask.id,
      snoozedUntil: snoozedUntil.toISOString(),
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/sales-customers/ai-tasks/[id]/snooze error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
