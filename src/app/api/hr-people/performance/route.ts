/**
 * /api/hr-people/performance
 *
 * CRUD endpoints for performance reviews
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { hrPerformanceReviews, hrPersons, users } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";

/**
 * GET /api/hr-people/performance
 * List all performance reviews
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const url = new URL(req.url);

    const statusFilter = url.searchParams.get("status");
    const personIdFilter = url.searchParams.get("person_id");
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 200);

    let whereClause = eq(hrPerformanceReviews.tenantId, tenantId);

    if (statusFilter) {
      whereClause = and(whereClause, eq(hrPerformanceReviews.status, statusFilter))!;
    }

    if (personIdFilter) {
      whereClause = and(whereClause, eq(hrPerformanceReviews.personId, personIdFilter))!;
    }

    const reviews = await db
      .select({
        id: hrPerformanceReviews.id,
        personId: hrPerformanceReviews.personId,
        personName: hrPerformanceReviews.personName,
        reviewerId: hrPerformanceReviews.reviewerId,
        reviewerName: hrPerformanceReviews.reviewerName,
        reviewPeriodStart: hrPerformanceReviews.reviewPeriodStart,
        reviewPeriodEnd: hrPerformanceReviews.reviewPeriodEnd,
        reviewDate: hrPerformanceReviews.reviewDate,
        overallRating: hrPerformanceReviews.overallRating,
        status: hrPerformanceReviews.status,
        reviewerAccepted: hrPerformanceReviews.reviewerAccepted,
        employeeAccepted: hrPerformanceReviews.employeeAccepted,
        createdAt: hrPerformanceReviews.createdAt,
        // Computed is_locked
        isLocked: sql<boolean>`(${hrPerformanceReviews.reviewerAccepted} AND ${hrPerformanceReviews.employeeAccepted})`,
      })
      .from(hrPerformanceReviews)
      .where(whereClause)
      .orderBy(desc(hrPerformanceReviews.reviewPeriodEnd))
      .limit(limit);

    return NextResponse.json({ reviews });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/hr-people/performance error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/hr-people/performance
 * Create a new performance review
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);

    const body = await req.json();

    // Validate required fields
    if (!body.person_id) {
      return NextResponse.json({ error: "Person ID is required" }, { status: 400 });
    }
    if (!body.review_period_start || !body.review_period_end) {
      return NextResponse.json(
        { error: "Review period start and end are required" },
        { status: 400 }
      );
    }

    // Get person name
    const [person] = await db
      .select({ fullName: hrPersons.fullName })
      .from(hrPersons)
      .where(and(eq(hrPersons.id, body.person_id), eq(hrPersons.tenantId, tenantId)));

    if (!person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    // Get reviewer name if provided
    let reviewerName = null;
    if (body.reviewer_id) {
      const [reviewer] = await db
        .select({ fullName: users.fullName })
        .from(users)
        .where(eq(users.id, body.reviewer_id));
      reviewerName = reviewer?.fullName || null;
    }

    const [review] = await db
      .insert(hrPerformanceReviews)
      .values({
        tenantId,
        personId: body.person_id,
        personName: person.fullName,
        reviewerId: body.reviewer_id || null,
        reviewerName,
        reviewPeriodStart: body.review_period_start,
        reviewPeriodEnd: body.review_period_end,
        reviewDate: body.review_date || new Date().toISOString().split("T")[0],
        strengths: body.strengths || null,
        areasForImprovement: body.areas_for_improvement || null,
        goalsSet: body.goals_set || null,
        overallRating: body.overall_rating || null,
        reviewerComments: body.reviewer_comments || null,
        employeeComments: body.employee_comments || null,
        privateNotes: body.private_notes || null,
        status: "draft",
        createdBy: actor.actorId,
        updatedBy: actor.actorId,
      })
      .returning();

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/hr-people/performance error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
