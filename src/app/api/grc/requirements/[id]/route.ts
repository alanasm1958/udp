/**
 * /api/grc/requirements/[id]
 *
 * GET: Get single requirement with tasks and alerts
 * PATCH: Update requirement
 * DELETE: Soft delete (set isActive = false)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";
import { db } from "@/db";
import { grcRequirements, grcTasks, grcAlerts } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/grc/requirements/:id
 * Get single requirement with related tasks and alerts
 */
export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await params;

    // Get requirement
    const [requirement] = await db
      .select()
      .from(grcRequirements)
      .where(
        and(
          eq(grcRequirements.id, id),
          eq(grcRequirements.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!requirement) {
      return NextResponse.json({ error: "Requirement not found" }, { status: 404 });
    }

    // Get related tasks
    const tasks = await db
      .select()
      .from(grcTasks)
      .where(eq(grcTasks.requirementId, id))
      .orderBy(desc(grcTasks.createdAt));

    // Get related alerts
    const alerts = await db
      .select()
      .from(grcAlerts)
      .where(eq(grcAlerts.requirementId, id))
      .orderBy(desc(grcAlerts.createdAt));

    return NextResponse.json({
      requirement: {
        ...requirement,
        closureCriteria: requirement.closureCriteria as object,
        evidenceDocuments: (requirement.evidenceDocuments as unknown[]) || [],
        evidenceData: requirement.evidenceData as object | null,
        evidenceUpdatedAt: requirement.evidenceUpdatedAt?.toISOString() || null,
        satisfiedAt: requirement.satisfiedAt?.toISOString() || null,
        expiresAt: requirement.expiresAt?.toISOString() || null,
        createdAt: requirement.createdAt.toISOString(),
        updatedAt: requirement.updatedAt.toISOString(),
      },
      tasks: tasks.map((t) => ({
        ...t,
        completedAt: t.completedAt?.toISOString() || null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      alerts: alerts.map((a) => ({
        ...a,
        resolvedAt: a.resolvedAt?.toISOString() || null,
        expiresAt: a.expiresAt?.toISOString() || null,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/grc/requirements/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/grc/requirements/:id
 * Update requirement fields
 */
export async function PATCH(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await params;
    const body = await req.json();

    // Verify requirement exists
    const [existing] = await db
      .select({ id: grcRequirements.id })
      .from(grcRequirements)
      .where(
        and(
          eq(grcRequirements.id, id),
          eq(grcRequirements.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Requirement not found" }, { status: 404 });
    }

    // Allowed update fields
    const updateFields: Record<string, unknown> = {};

    if (body.title !== undefined) updateFields.title = body.title;
    if (body.description !== undefined) updateFields.description = body.description;
    if (body.riskLevel !== undefined) updateFields.riskLevel = body.riskLevel;
    if (body.priority !== undefined) updateFields.priority = body.priority;
    if (body.status !== undefined) updateFields.status = body.status;
    if (body.closureCriteria !== undefined) updateFields.closureCriteria = body.closureCriteria;
    if (body.isActive !== undefined) updateFields.isActive = body.isActive;
    if (body.nextActionDue !== undefined) updateFields.nextActionDue = body.nextActionDue;
    if (body.expiresAt !== undefined) updateFields.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

    updateFields.updatedAt = new Date();

    // If status changed to satisfied, set satisfiedAt
    if (body.status === "satisfied") {
      updateFields.satisfiedAt = new Date();
    }

    const [updated] = await db
      .update(grcRequirements)
      .set(updateFields)
      .where(eq(grcRequirements.id, id))
      .returning();

    return NextResponse.json({ requirement: updated });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/grc/requirements/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/grc/requirements/:id
 * Soft delete - sets isActive = false
 */
export async function DELETE(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await params;

    // Verify requirement exists
    const [existing] = await db
      .select({ id: grcRequirements.id })
      .from(grcRequirements)
      .where(
        and(
          eq(grcRequirements.id, id),
          eq(grcRequirements.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Requirement not found" }, { status: 404 });
    }

    // Soft delete
    await db
      .update(grcRequirements)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(grcRequirements.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("DELETE /api/grc/requirements/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
