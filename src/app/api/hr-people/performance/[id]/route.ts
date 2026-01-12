/**
 * /api/hr-people/performance/[id]
 *
 * Individual performance review operations (GET, PATCH, DELETE)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { hrPerformanceReviews } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";

/**
 * GET /api/hr-people/performance/[id]
 * Get a single performance review
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await params;

    const [review] = await db
      .select({
        id: hrPerformanceReviews.id,
        personId: hrPerformanceReviews.personId,
        personName: hrPerformanceReviews.personName,
        reviewerId: hrPerformanceReviews.reviewerId,
        reviewerName: hrPerformanceReviews.reviewerName,
        reviewPeriodStart: hrPerformanceReviews.reviewPeriodStart,
        reviewPeriodEnd: hrPerformanceReviews.reviewPeriodEnd,
        reviewDate: hrPerformanceReviews.reviewDate,
        strengths: hrPerformanceReviews.strengths,
        areasForImprovement: hrPerformanceReviews.areasForImprovement,
        goalsSet: hrPerformanceReviews.goalsSet,
        overallRating: hrPerformanceReviews.overallRating,
        reviewerComments: hrPerformanceReviews.reviewerComments,
        employeeComments: hrPerformanceReviews.employeeComments,
        privateNotes: hrPerformanceReviews.privateNotes,
        status: hrPerformanceReviews.status,
        reviewerAccepted: hrPerformanceReviews.reviewerAccepted,
        reviewerAcceptedAt: hrPerformanceReviews.reviewerAcceptedAt,
        employeeAccepted: hrPerformanceReviews.employeeAccepted,
        employeeAcceptedAt: hrPerformanceReviews.employeeAcceptedAt,
        createdAt: hrPerformanceReviews.createdAt,
        updatedAt: hrPerformanceReviews.updatedAt,
        isLocked: sql<boolean>`(${hrPerformanceReviews.reviewerAccepted} AND ${hrPerformanceReviews.employeeAccepted})`,
      })
      .from(hrPerformanceReviews)
      .where(and(eq(hrPerformanceReviews.id, id), eq(hrPerformanceReviews.tenantId, tenantId)));

    if (!review) {
      return NextResponse.json({ error: "Performance review not found" }, { status: 404 });
    }

    return NextResponse.json({ review });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/hr-people/performance/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/hr-people/performance/[id]
 * Update a performance review (only if not locked)
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
    const { id } = await params;

    // Check if review exists and is not locked
    const [existing] = await db
      .select()
      .from(hrPerformanceReviews)
      .where(and(eq(hrPerformanceReviews.id, id), eq(hrPerformanceReviews.tenantId, tenantId)));

    if (!existing) {
      return NextResponse.json({ error: "Performance review not found" }, { status: 404 });
    }

    // Check if locked (both accepted)
    if (existing.reviewerAccepted && existing.employeeAccepted) {
      return NextResponse.json(
        { error: "Cannot edit a locked review (both parties have accepted)" },
        { status: 400 }
      );
    }

    const body = await req.json();

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedBy: actor.actorId,
    };

    const fieldMappings: Record<string, string> = {
      strengths: "strengths",
      areas_for_improvement: "areasForImprovement",
      goals_set: "goalsSet",
      overall_rating: "overallRating",
      reviewer_comments: "reviewerComments",
      employee_comments: "employeeComments",
      private_notes: "privateNotes",
      status: "status",
    };

    for (const [bodyField, schemaField] of Object.entries(fieldMappings)) {
      if (bodyField in body) {
        updateData[schemaField] = body[bodyField];
      }
    }

    const [updated] = await db
      .update(hrPerformanceReviews)
      .set(updateData)
      .where(eq(hrPerformanceReviews.id, id))
      .returning();

    return NextResponse.json({
      review: {
        ...updated,
        isLocked: updated.reviewerAccepted && updated.employeeAccepted,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/hr-people/performance/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/hr-people/performance/[id]
 * Delete a performance review (only if not locked)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await params;

    const [existing] = await db
      .select()
      .from(hrPerformanceReviews)
      .where(and(eq(hrPerformanceReviews.id, id), eq(hrPerformanceReviews.tenantId, tenantId)));

    if (!existing) {
      return NextResponse.json({ error: "Performance review not found" }, { status: 404 });
    }

    // Check if locked
    if (existing.reviewerAccepted && existing.employeeAccepted) {
      return NextResponse.json(
        { error: "Cannot delete a locked review" },
        { status: 400 }
      );
    }

    await db.delete(hrPerformanceReviews).where(eq(hrPerformanceReviews.id, id));

    return NextResponse.json({ success: true, message: "Performance review deleted" });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("DELETE /api/hr-people/performance/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
