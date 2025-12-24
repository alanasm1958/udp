/**
 * /api/strategy/budgets/[id]
 *
 * PATCH: Update an existing budget (name, status, notes, period dates)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { budgets } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface UpdateBudgetRequest {
  name?: string;
  status?: string;
  notes?: string;
  periodStart?: string;
  periodEnd?: string;
}

/**
 * PATCH /api/strategy/budgets/[id]
 * Update an existing budget
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const { id } = await params;
    const body: UpdateBudgetRequest = await req.json();

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (body.name !== undefined) updates.name = body.name;
    if (body.status !== undefined) updates.status = body.status;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.periodStart !== undefined) updates.periodStart = body.periodStart;
    if (body.periodEnd !== undefined) updates.periodEnd = body.periodEnd;

    const [updated] = await db
      .update(budgets)
      .set(updates)
      .where(and(eq(budgets.tenantId, tenantId), eq(budgets.id, id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Budget not found" }, { status: 404 });
    }

    await audit.log("budget", updated.id, "budget_updated", {
      changes: Object.keys(updates).filter((k) => k !== "updatedAt"),
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/strategy/budgets/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
