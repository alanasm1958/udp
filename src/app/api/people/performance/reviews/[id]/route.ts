/**
 * /api/people/performance/reviews/[id]
 *
 * Individual performance review management
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { performanceReviewsV2, people, users, hrAuditLog } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface UpdateReviewRequest {
  strengths?: string;
  strengthsExamples?: string;
  improvements?: string;
  improvementsExamples?: string;
  fairnessConstraints?: string;
  fairnessSupport?: string;
  fairnessOutsideControl?: string;
  goals?: string;
  goalsSupportPlan?: string;
  followUpDate?: string;
  visibility?: "visible_to_employee" | "manager_only" | "hr_only";
  privateNotes?: string;
  status?: "draft" | "completed" | "acknowledged";
}

/**
 * GET /api/people/performance/reviews/[id]
 * Get a performance review with all details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const { id: reviewId } = await params;

    const [review] = await db
      .select()
      .from(performanceReviewsV2)
      .where(
        and(
          eq(performanceReviewsV2.id, reviewId),
          eq(performanceReviewsV2.tenantId, tenantId)
        )
      );

    if (!review) {
      return NextResponse.json({ error: "Performance review not found" }, { status: 404 });
    }

    // Get employee name
    const [person] = await db
      .select({ fullName: people.fullName })
      .from(people)
      .where(eq(people.id, review.personId));

    // Get reviewer name
    let reviewerName = null;
    if (review.reviewerId) {
      const [reviewer] = await db
        .select({ fullName: users.fullName })
        .from(users)
        .where(eq(users.id, review.reviewerId));
      reviewerName = reviewer?.fullName;
    }

    return NextResponse.json({
      review: {
        ...review,
        employeeName: person?.fullName || "Unknown",
        reviewerName,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error fetching performance review:", error);
    return NextResponse.json(
      { error: "Failed to fetch performance review" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/people/performance/reviews/[id]
 * Update a performance review
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const userIdFromHeader = getUserIdFromHeaders(request);
    const actorIdFromHeader = getActorIdFromHeaders(request);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const { id: reviewId } = await params;
    const body: UpdateReviewRequest = await request.json();

    // Check if review exists
    const [existing] = await db
      .select()
      .from(performanceReviewsV2)
      .where(
        and(
          eq(performanceReviewsV2.id, reviewId),
          eq(performanceReviewsV2.tenantId, tenantId)
        )
      );

    if (!existing) {
      return NextResponse.json({ error: "Performance review not found" }, { status: 404 });
    }

    // Don't allow updates to acknowledged reviews
    if (existing.status === "acknowledged" && body.status !== "acknowledged") {
      return NextResponse.json(
        { error: "Cannot modify an acknowledged review" },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedByActorId: actor.actorId,
    };

    if (body.strengths !== undefined) updateData.strengths = body.strengths;
    if (body.strengthsExamples !== undefined) updateData.strengthsExamples = body.strengthsExamples;
    if (body.improvements !== undefined) updateData.improvements = body.improvements;
    if (body.improvementsExamples !== undefined) updateData.improvementsExamples = body.improvementsExamples;
    if (body.fairnessConstraints !== undefined) updateData.fairnessConstraints = body.fairnessConstraints;
    if (body.fairnessSupport !== undefined) updateData.fairnessSupport = body.fairnessSupport;
    if (body.fairnessOutsideControl !== undefined) updateData.fairnessOutsideControl = body.fairnessOutsideControl;
    if (body.goals !== undefined) updateData.goals = body.goals;
    if (body.goalsSupportPlan !== undefined) updateData.goalsSupportPlan = body.goalsSupportPlan;
    if (body.followUpDate !== undefined) updateData.followUpDate = body.followUpDate;
    if (body.visibility !== undefined) updateData.visibility = body.visibility;
    if (body.privateNotes !== undefined) updateData.privateNotes = body.privateNotes;
    if (body.status !== undefined) updateData.status = body.status;

    // Update review
    const [updated] = await db
      .update(performanceReviewsV2)
      .set(updateData)
      .where(eq(performanceReviewsV2.id, reviewId))
      .returning();

    // Log to HR audit
    await db.insert(hrAuditLog).values({
      tenantId,
      actorId: actor.actorId,
      entityType: "performance_review",
      entityId: reviewId,
      action: "updated",
      beforeSnapshot: {
        status: existing.status,
        strengths: existing.strengths,
        improvements: existing.improvements,
      },
      afterSnapshot: {
        status: updated.status,
        strengths: updated.strengths,
        improvements: updated.improvements,
      },
    });

    await audit.log("performance_review", reviewId, "performance_review_updated", {
      fieldsUpdated: Object.keys(body),
    });

    // Get employee name
    const [person] = await db
      .select({ fullName: people.fullName })
      .from(people)
      .where(eq(people.id, updated.personId));

    return NextResponse.json({
      review: {
        ...updated,
        employeeName: person?.fullName || "Unknown",
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error updating performance review:", error);
    return NextResponse.json(
      { error: "Failed to update performance review" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/people/performance/reviews/[id]
 * Delete a draft performance review
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const userIdFromHeader = getUserIdFromHeaders(request);
    const actorIdFromHeader = getActorIdFromHeaders(request);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const { id: reviewId } = await params;

    // Check if review exists and is draft
    const [existing] = await db
      .select()
      .from(performanceReviewsV2)
      .where(
        and(
          eq(performanceReviewsV2.id, reviewId),
          eq(performanceReviewsV2.tenantId, tenantId)
        )
      );

    if (!existing) {
      return NextResponse.json({ error: "Performance review not found" }, { status: 404 });
    }

    if (existing.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft reviews can be deleted" },
        { status: 400 }
      );
    }

    // Delete review
    await db
      .delete(performanceReviewsV2)
      .where(eq(performanceReviewsV2.id, reviewId));

    await audit.log("performance_review", reviewId, "performance_review_deleted", {
      employeeId: existing.employeeId,
      periodStart: existing.periodStart,
      periodEnd: existing.periodEnd,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error deleting performance review:", error);
    return NextResponse.json(
      { error: "Failed to delete performance review" },
      { status: 500 }
    );
  }
}
