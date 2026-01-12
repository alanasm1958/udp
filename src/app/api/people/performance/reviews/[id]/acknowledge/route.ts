/**
 * /api/people/performance/reviews/[id]/acknowledge
 *
 * Employee acknowledgment of performance review
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { performanceReviewsV2, people, hrAuditLog } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface AcknowledgeRequest {
  employeeComments?: string;
}

/**
 * POST /api/people/performance/reviews/[id]/acknowledge
 * Employee acknowledges their performance review
 */
export async function POST(
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
    const body: AcknowledgeRequest = await request.json().catch(() => ({}));

    // Fetch review
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

    // Check if already acknowledged
    if (review.status === "acknowledged") {
      return NextResponse.json(
        { error: "Review has already been acknowledged" },
        { status: 400 }
      );
    }

    // Check if review is completed (has required fields)
    if (review.status === "draft") {
      // Allow acknowledgment of draft reviews if they have content
      if (!review.strengths && !review.improvements) {
        return NextResponse.json(
          { error: "Review must have content before acknowledgment" },
          { status: 400 }
        );
      }
    }

    // Check visibility allows employee access
    if (review.visibility === "hr_only" || review.visibility === "manager_only") {
      return NextResponse.json(
        { error: "This review is not visible to the employee" },
        { status: 403 }
      );
    }

    // Update review with acknowledgment
    const [updated] = await db
      .update(performanceReviewsV2)
      .set({
        status: "acknowledged",
        employeeAcknowledgedAt: new Date(),
        updatedAt: new Date(),
        updatedByActorId: actor.actorId,
      })
      .where(eq(performanceReviewsV2.id, reviewId))
      .returning();

    // Get employee name
    const [person] = await db
      .select({ fullName: people.fullName })
      .from(people)
      .where(eq(people.id, review.personId));

    const employeeName = person?.fullName || "Unknown";

    // Log to HR audit
    await db.insert(hrAuditLog).values({
      tenantId,
      actorId: actor.actorId,
      entityType: "performance_review",
      entityId: reviewId,
      action: "acknowledged",
      beforeSnapshot: {
        status: review.status,
        employeeAcknowledgedAt: review.employeeAcknowledgedAt,
      },
      afterSnapshot: {
        status: "acknowledged",
        employeeAcknowledgedAt: updated.employeeAcknowledgedAt,
        employeeComments: body.employeeComments,
      },
    });

    await audit.log("performance_review", reviewId, "performance_review_acknowledged", {
      employeeName,
      acknowledgedAt: updated.employeeAcknowledgedAt,
    });

    return NextResponse.json({
      success: true,
      message: "Review acknowledged successfully",
      review: {
        ...updated,
        employeeName,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error acknowledging performance review:", error);
    return NextResponse.json(
      { error: "Failed to acknowledge performance review" },
      { status: 500 }
    );
  }
}
