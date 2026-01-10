/**
 * /api/people/performance-cycles/[id]
 *
 * View, update, and manage individual performance cycles.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { performanceCycles, performanceReviews, employees, people } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

type CycleFrequency = "quarterly" | "semi_annual" | "annual" | "custom";
type CycleStatus = "planned" | "active" | "completed" | "cancelled";

interface UpdateCycleRequest {
  name?: string;
  frequency?: CycleFrequency;
  periodStart?: string;
  periodEnd?: string;
  dueDate?: string;
  assignedToRole?: "hr" | "manager" | "owner" | null;
  status?: CycleStatus;
  notes?: string;
}

function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * GET /api/people/performance-cycles/[id]
 * Get a single performance cycle with details
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await params;

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid cycle ID" }, { status: 400 });
    }

    const [cycle] = await db
      .select({
        id: performanceCycles.id,
        name: performanceCycles.name,
        frequency: performanceCycles.frequency,
        periodStart: performanceCycles.periodStart,
        periodEnd: performanceCycles.periodEnd,
        dueDate: performanceCycles.dueDate,
        assignedToRole: performanceCycles.assignedToRole,
        status: performanceCycles.status,
        notes: performanceCycles.notes,
        createdAt: performanceCycles.createdAt,
        updatedAt: performanceCycles.updatedAt,
      })
      .from(performanceCycles)
      .where(and(eq(performanceCycles.tenantId, tenantId), eq(performanceCycles.id, id)));

    if (!cycle) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }

    // Get review statistics
    const stats = await db
      .select({
        status: performanceReviews.status,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(performanceReviews)
      .where(eq(performanceReviews.cycleId, id))
      .groupBy(performanceReviews.status);

    const reviewStats = {
      total: 0,
      notStarted: 0,
      inProgress: 0,
      submitted: 0,
      approved: 0,
      cancelled: 0,
    };

    for (const stat of stats) {
      reviewStats.total += stat.count;
      switch (stat.status) {
        case "not_started":
          reviewStats.notStarted = stat.count;
          break;
        case "in_progress":
          reviewStats.inProgress = stat.count;
          break;
        case "submitted":
          reviewStats.submitted = stat.count;
          break;
        case "approved":
          reviewStats.approved = stat.count;
          break;
        case "cancelled":
          reviewStats.cancelled = stat.count;
          break;
      }
    }

    // Get reviews with employee info
    const reviews = await db
      .select({
        id: performanceReviews.id,
        employeeId: performanceReviews.employeeId,
        reviewerEmployeeId: performanceReviews.reviewerEmployeeId,
        status: performanceReviews.status,
        overallRating: performanceReviews.overallRating,
        completedAt: performanceReviews.completedAt,
        approvedAt: performanceReviews.approvedAt,
        employeeName: people.fullName,
      })
      .from(performanceReviews)
      .innerJoin(employees, eq(employees.id, performanceReviews.employeeId))
      .innerJoin(people, eq(people.id, employees.personId))
      .where(eq(performanceReviews.cycleId, id))
      .orderBy(people.fullName);

    return NextResponse.json({
      ...cycle,
      reviewStats,
      reviews,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/people/performance-cycles/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/people/performance-cycles/[id]
 * Update a performance cycle
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);
    const { id } = await params;

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid cycle ID" }, { status: 400 });
    }

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: UpdateCycleRequest = await req.json();

    // Get existing cycle
    const [existing] = await db
      .select()
      .from(performanceCycles)
      .where(and(eq(performanceCycles.tenantId, tenantId), eq(performanceCycles.id, id)));

    if (!existing) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }

    // Validate status transitions
    if (body.status) {
      const validTransitions: Record<CycleStatus, CycleStatus[]> = {
        planned: ["active", "cancelled"],
        active: ["completed", "cancelled"],
        completed: [], // No transitions from completed
        cancelled: ["planned"], // Can reactivate a cancelled cycle
      };

      if (!validTransitions[existing.status as CycleStatus].includes(body.status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${existing.status} to ${body.status}` },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updates: Partial<typeof performanceCycles.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.name !== undefined) updates.name = body.name;
    if (body.frequency !== undefined) updates.frequency = body.frequency;
    if (body.periodStart !== undefined) updates.periodStart = body.periodStart;
    if (body.periodEnd !== undefined) updates.periodEnd = body.periodEnd;
    if (body.dueDate !== undefined) updates.dueDate = body.dueDate;
    if (body.assignedToRole !== undefined) updates.assignedToRole = body.assignedToRole;
    if (body.status !== undefined) updates.status = body.status;
    if (body.notes !== undefined) updates.notes = body.notes;

    const [updated] = await db
      .update(performanceCycles)
      .set(updates)
      .where(and(eq(performanceCycles.tenantId, tenantId), eq(performanceCycles.id, id)))
      .returning();

    await audit.log("performance_cycle", id, "performance_cycle_updated", {
      changes: body,
      previousStatus: existing.status,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/people/performance-cycles/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/people/performance-cycles/[id]
 * Delete a performance cycle (only if planned with no reviews)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);
    const { id } = await params;

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid cycle ID" }, { status: 400 });
    }

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    // Get existing cycle
    const [existing] = await db
      .select()
      .from(performanceCycles)
      .where(and(eq(performanceCycles.tenantId, tenantId), eq(performanceCycles.id, id)));

    if (!existing) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }

    // Only allow deletion of planned cycles
    if (existing.status !== "planned") {
      return NextResponse.json(
        { error: "Only planned cycles can be deleted. Use status=cancelled instead." },
        { status: 400 }
      );
    }

    // Check for any reviews (even not_started)
    const [reviewCount] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(performanceReviews)
      .where(eq(performanceReviews.cycleId, id));

    if (reviewCount.count > 0) {
      return NextResponse.json(
        { error: "Cannot delete cycle with reviews. Cancel the cycle instead." },
        { status: 400 }
      );
    }

    // Delete cycle
    await db
      .delete(performanceCycles)
      .where(and(eq(performanceCycles.tenantId, tenantId), eq(performanceCycles.id, id)));

    await audit.log("performance_cycle", id, "performance_cycle_deleted", {
      name: existing.name,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("DELETE /api/people/performance-cycles/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
