/**
 * /api/people/performance-reviews
 *
 * List and query performance reviews.
 * Individual reviews are created through performance cycles.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { performanceReviews, performanceCycles, employees, people } from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  TenantError,
} from "@/lib/tenant";

type ReviewStatus = "not_started" | "in_progress" | "submitted" | "approved" | "cancelled";

/**
 * GET /api/people/performance-reviews
 * List performance reviews with optional filters
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const url = new URL(req.url);

    const cycleId = url.searchParams.get("cycleId");
    const employeeId = url.searchParams.get("employeeId");
    const reviewerId = url.searchParams.get("reviewerId");
    const statusFilter = url.searchParams.get("status");
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 200);

    const conditions = [eq(performanceReviews.tenantId, tenantId)];

    if (cycleId) {
      conditions.push(eq(performanceReviews.cycleId, cycleId));
    }

    if (employeeId) {
      conditions.push(eq(performanceReviews.employeeId, employeeId));
    }

    if (reviewerId) {
      conditions.push(eq(performanceReviews.reviewerEmployeeId, reviewerId));
    }

    if (statusFilter) {
      conditions.push(eq(performanceReviews.status, statusFilter as ReviewStatus));
    }

    const reviews = await db
      .select({
        id: performanceReviews.id,
        cycleId: performanceReviews.cycleId,
        employeeId: performanceReviews.employeeId,
        reviewerEmployeeId: performanceReviews.reviewerEmployeeId,
        status: performanceReviews.status,
        overallRating: performanceReviews.overallRating,
        completedAt: performanceReviews.completedAt,
        approvedAt: performanceReviews.approvedAt,
        createdAt: performanceReviews.createdAt,
        updatedAt: performanceReviews.updatedAt,
        // Cycle info
        cycleName: performanceCycles.name,
        cyclePeriodStart: performanceCycles.periodStart,
        cyclePeriodEnd: performanceCycles.periodEnd,
        cycleDueDate: performanceCycles.dueDate,
        // Employee info
        employeeName: people.fullName,
      })
      .from(performanceReviews)
      .innerJoin(performanceCycles, eq(performanceCycles.id, performanceReviews.cycleId))
      .innerJoin(employees, eq(employees.id, performanceReviews.employeeId))
      .innerJoin(people, eq(people.id, employees.personId))
      .where(and(...conditions))
      .orderBy(desc(performanceReviews.createdAt))
      .limit(limit);

    // Get reviewer names in a separate query
    const reviewerIds = [...new Set(reviews.filter(r => r.reviewerEmployeeId).map(r => r.reviewerEmployeeId!))];
    const reviewerMap = new Map<string, string>();

    if (reviewerIds.length > 0) {
      const reviewers = await db
        .select({
          employeeId: employees.id,
          fullName: people.fullName,
        })
        .from(employees)
        .innerJoin(people, eq(people.id, employees.personId))
        .where(sql`${employees.id} IN (${sql.join(reviewerIds.map(id => sql`${id}`), sql`, `)})`);

      reviewers.forEach(r => reviewerMap.set(r.employeeId, r.fullName));
    }

    const enrichedReviews = reviews.map(r => ({
      ...r,
      reviewerName: r.reviewerEmployeeId ? reviewerMap.get(r.reviewerEmployeeId) : null,
    }));

    return NextResponse.json({ items: enrichedReviews });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/people/performance-reviews error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
