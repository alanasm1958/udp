/**
 * /api/people/performance-reviews/[id]
 *
 * View and update individual performance reviews.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  performanceReviews,
  performanceReviewRatings,
  performanceCycles,
  performanceGoals,
  employees,
  people,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

type ReviewStatus = "not_started" | "in_progress" | "submitted" | "approved" | "cancelled";

interface UpdateReviewRequest {
  status?: ReviewStatus;
  overallRating?: number | null;
  strengths?: string | null;
  areasForImprovement?: string | null;
  goalsForNextPeriod?: string | null;
  managerComments?: string | null;
  employeeComments?: string | null;
  ratings?: Array<{
    category: string;
    categoryLabel: string;
    rating: number;
    weight?: number;
    comments?: string;
  }>;
}

function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * GET /api/people/performance-reviews/[id]
 * Get a single performance review with details
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await params;

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid review ID" }, { status: 400 });
    }

    // Get review with cycle and employee info
    const [review] = await db
      .select({
        id: performanceReviews.id,
        cycleId: performanceReviews.cycleId,
        employeeId: performanceReviews.employeeId,
        reviewerEmployeeId: performanceReviews.reviewerEmployeeId,
        status: performanceReviews.status,
        overallRating: performanceReviews.overallRating,
        strengths: performanceReviews.strengths,
        areasForImprovement: performanceReviews.areasForImprovement,
        goalsForNextPeriod: performanceReviews.goalsForNextPeriod,
        managerComments: performanceReviews.managerComments,
        employeeComments: performanceReviews.employeeComments,
        completedAt: performanceReviews.completedAt,
        approvedAt: performanceReviews.approvedAt,
        createdAt: performanceReviews.createdAt,
        updatedAt: performanceReviews.updatedAt,
        // Cycle info
        cycleName: performanceCycles.name,
        cycleFrequency: performanceCycles.frequency,
        cyclePeriodStart: performanceCycles.periodStart,
        cyclePeriodEnd: performanceCycles.periodEnd,
        cycleDueDate: performanceCycles.dueDate,
        cycleStatus: performanceCycles.status,
        // Employee info
        employeeName: people.fullName,
        employeeJobTitle: people.jobTitle,
      })
      .from(performanceReviews)
      .innerJoin(performanceCycles, eq(performanceCycles.id, performanceReviews.cycleId))
      .innerJoin(employees, eq(employees.id, performanceReviews.employeeId))
      .innerJoin(people, eq(people.id, employees.personId))
      .where(and(eq(performanceReviews.tenantId, tenantId), eq(performanceReviews.id, id)));

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Get reviewer info
    let reviewerName = null;
    if (review.reviewerEmployeeId) {
      const [reviewer] = await db
        .select({ fullName: people.fullName })
        .from(employees)
        .innerJoin(people, eq(people.id, employees.personId))
        .where(eq(employees.id, review.reviewerEmployeeId));
      reviewerName = reviewer?.fullName;
    }

    // Get ratings
    const ratings = await db
      .select({
        id: performanceReviewRatings.id,
        category: performanceReviewRatings.category,
        categoryLabel: performanceReviewRatings.categoryLabel,
        rating: performanceReviewRatings.rating,
        weight: performanceReviewRatings.weight,
        comments: performanceReviewRatings.comments,
      })
      .from(performanceReviewRatings)
      .where(eq(performanceReviewRatings.reviewId, id));

    // Get employee goals for this cycle
    const goals = await db
      .select({
        id: performanceGoals.id,
        title: performanceGoals.title,
        description: performanceGoals.description,
        targetDate: performanceGoals.targetDate,
        status: performanceGoals.status,
        progressPercent: performanceGoals.progressPercent,
        completedAt: performanceGoals.completedAt,
      })
      .from(performanceGoals)
      .where(
        and(
          eq(performanceGoals.tenantId, tenantId),
          eq(performanceGoals.employeeId, review.employeeId),
          eq(performanceGoals.cycleId, review.cycleId)
        )
      );

    return NextResponse.json({
      ...review,
      reviewerName,
      ratings,
      goals,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/people/performance-reviews/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/people/performance-reviews/[id]
 * Update a performance review
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
      return NextResponse.json({ error: "Invalid review ID" }, { status: 400 });
    }

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: UpdateReviewRequest = await req.json();

    // Get existing review
    const [existing] = await db
      .select()
      .from(performanceReviews)
      .where(and(eq(performanceReviews.tenantId, tenantId), eq(performanceReviews.id, id)));

    if (!existing) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Validate status transitions
    if (body.status) {
      const validTransitions: Record<ReviewStatus, ReviewStatus[]> = {
        not_started: ["in_progress", "cancelled"],
        in_progress: ["submitted", "cancelled"],
        submitted: ["approved", "in_progress", "cancelled"], // Can reopen for corrections
        approved: [], // Final state
        cancelled: ["not_started"], // Can reactivate
      };

      if (!validTransitions[existing.status as ReviewStatus].includes(body.status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${existing.status} to ${body.status}` },
          { status: 400 }
        );
      }
    }

    // Validate rating
    if (body.overallRating !== undefined && body.overallRating !== null) {
      if (body.overallRating < 1 || body.overallRating > 5) {
        return NextResponse.json(
          { error: "Overall rating must be between 1 and 5" },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updates: Partial<typeof performanceReviews.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.status !== undefined) {
      updates.status = body.status;

      // Set timestamps for status changes
      if (body.status === "submitted" && existing.status !== "submitted") {
        updates.completedAt = new Date();
      }
      if (body.status === "approved" && existing.status !== "approved") {
        updates.approvedAt = new Date();
        updates.approvedByActorId = actor.actorId;
      }
    }

    if (body.overallRating !== undefined) updates.overallRating = body.overallRating;
    if (body.strengths !== undefined) updates.strengths = body.strengths;
    if (body.areasForImprovement !== undefined) updates.areasForImprovement = body.areasForImprovement;
    if (body.goalsForNextPeriod !== undefined) updates.goalsForNextPeriod = body.goalsForNextPeriod;
    if (body.managerComments !== undefined) updates.managerComments = body.managerComments;
    if (body.employeeComments !== undefined) updates.employeeComments = body.employeeComments;

    const [updated] = await db
      .update(performanceReviews)
      .set(updates)
      .where(and(eq(performanceReviews.tenantId, tenantId), eq(performanceReviews.id, id)))
      .returning();

    // Handle ratings if provided
    if (body.ratings && body.ratings.length > 0) {
      // Delete existing ratings
      await db
        .delete(performanceReviewRatings)
        .where(eq(performanceReviewRatings.reviewId, id));

      // Insert new ratings
      await db.insert(performanceReviewRatings).values(
        body.ratings.map(r => ({
          tenantId,
          reviewId: id,
          category: r.category,
          categoryLabel: r.categoryLabel,
          rating: r.rating,
          weight: r.weight?.toString() ?? "1.0",
          comments: r.comments ?? null,
        }))
      );
    }

    await audit.log("performance_review", id, "performance_review_updated", {
      changes: body,
      previousStatus: existing.status,
      newStatus: updates.status || existing.status,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/people/performance-reviews/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
