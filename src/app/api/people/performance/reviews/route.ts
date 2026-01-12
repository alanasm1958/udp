/**
 * /api/people/performance/reviews
 *
 * Performance Reviews V2 - List and create guided reviews
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { performanceReviewsV2, employees, people, users } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface CreateReviewRequest {
  employeeId: string;
  periodType?: string;
  periodStart: string;
  periodEnd: string;
  reviewerId?: string;
  visibility?: "visible_to_employee" | "manager_only" | "hr_only";
}

/**
 * GET /api/people/performance/reviews
 * List performance reviews with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const url = new URL(request.url);

    const employeeId = url.searchParams.get("employeeId");
    const status = url.searchParams.get("status");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);

    const conditions = [eq(performanceReviewsV2.tenantId, tenantId)];

    if (employeeId) {
      conditions.push(eq(performanceReviewsV2.employeeId, employeeId));
    }

    if (status) {
      conditions.push(eq(performanceReviewsV2.status, status));
    }

    const reviews = await db
      .select({
        id: performanceReviewsV2.id,
        employeeId: performanceReviewsV2.employeeId,
        personId: performanceReviewsV2.personId,
        reviewerId: performanceReviewsV2.reviewerId,
        periodType: performanceReviewsV2.periodType,
        periodStart: performanceReviewsV2.periodStart,
        periodEnd: performanceReviewsV2.periodEnd,
        status: performanceReviewsV2.status,
        visibility: performanceReviewsV2.visibility,
        aiOutcomeCategory: performanceReviewsV2.aiOutcomeCategory,
        aiOutcomeGeneratedAt: performanceReviewsV2.aiOutcomeGeneratedAt,
        employeeAcknowledgedAt: performanceReviewsV2.employeeAcknowledgedAt,
        followUpDate: performanceReviewsV2.followUpDate,
        createdAt: performanceReviewsV2.createdAt,
        updatedAt: performanceReviewsV2.updatedAt,
      })
      .from(performanceReviewsV2)
      .where(and(...conditions))
      .orderBy(desc(performanceReviewsV2.periodEnd))
      .limit(limit);

    // Enrich with employee names
    const enrichedReviews = await Promise.all(
      reviews.map(async (review) => {
        const [person] = await db
          .select({ fullName: people.fullName })
          .from(people)
          .where(eq(people.id, review.personId));

        let reviewerName = null;
        if (review.reviewerId) {
          const [reviewer] = await db
            .select({ fullName: users.fullName })
            .from(users)
            .where(eq(users.id, review.reviewerId));
          reviewerName = reviewer?.fullName;
        }

        return {
          ...review,
          employeeName: person?.fullName || "Unknown",
          reviewerName,
        };
      })
    );

    return NextResponse.json({ reviews: enrichedReviews });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error fetching performance reviews:", error);
    return NextResponse.json(
      { error: "Failed to fetch performance reviews" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/people/performance/reviews
 * Create a new performance review
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const userIdFromHeader = getUserIdFromHeaders(request);
    const actorIdFromHeader = getActorIdFromHeaders(request);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: CreateReviewRequest = await request.json();

    // Validation
    if (!body.employeeId || !body.periodStart || !body.periodEnd) {
      return NextResponse.json(
        { error: "Employee ID, period start, and period end are required" },
        { status: 400 }
      );
    }

    // Verify employee exists
    const [employee] = await db
      .select({ id: employees.id, personId: employees.personId })
      .from(employees)
      .where(and(eq(employees.id, body.employeeId), eq(employees.tenantId, tenantId)));

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // Check for existing review in this period
    const existingReview = await db
      .select({ id: performanceReviewsV2.id })
      .from(performanceReviewsV2)
      .where(
        and(
          eq(performanceReviewsV2.tenantId, tenantId),
          eq(performanceReviewsV2.employeeId, body.employeeId),
          eq(performanceReviewsV2.periodStart, body.periodStart),
          eq(performanceReviewsV2.periodEnd, body.periodEnd)
        )
      );

    if (existingReview.length > 0) {
      return NextResponse.json(
        { error: "A review already exists for this employee and period" },
        { status: 409 }
      );
    }

    // Create review
    const [newReview] = await db
      .insert(performanceReviewsV2)
      .values({
        tenantId,
        employeeId: body.employeeId,
        personId: employee.personId,
        reviewerId: body.reviewerId || userIdFromHeader,
        periodType: body.periodType || "quarterly",
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        visibility: body.visibility || "visible_to_employee",
        status: "draft",
        createdByActorId: actor.actorId,
        updatedByActorId: actor.actorId,
      })
      .returning();

    await audit.log("performance_review", newReview.id, "performance_review_created", {
      employeeId: body.employeeId,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
    });

    // Get employee name
    const [person] = await db
      .select({ fullName: people.fullName })
      .from(people)
      .where(eq(people.id, employee.personId));

    return NextResponse.json(
      {
        review: {
          ...newReview,
          employeeName: person?.fullName || "Unknown",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error creating performance review:", error);
    return NextResponse.json(
      { error: "Failed to create performance review" },
      { status: 500 }
    );
  }
}
