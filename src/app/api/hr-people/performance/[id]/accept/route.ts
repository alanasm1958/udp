/**
 * /api/hr-people/performance/[id]/accept
 *
 * Accept performance review (reviewer or employee)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { hrPerformanceReviews } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";

interface AcceptRequest {
  role: "reviewer" | "employee";
}

/**
 * POST /api/hr-people/performance/[id]/accept
 * Accept performance review as reviewer or employee
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const { id } = await params;

    const [existing] = await db
      .select()
      .from(hrPerformanceReviews)
      .where(and(eq(hrPerformanceReviews.id, id), eq(hrPerformanceReviews.tenantId, tenantId)));

    if (!existing) {
      return NextResponse.json({ error: "Performance review not found" }, { status: 404 });
    }

    const body: AcceptRequest = await req.json();

    if (!body.role || !["reviewer", "employee"].includes(body.role)) {
      return NextResponse.json(
        { error: "Role must be 'reviewer' or 'employee'" },
        { status: 400 }
      );
    }

    const now = new Date();
    const updateData: Record<string, unknown> = {
      updatedAt: now,
      updatedBy: actor.actorId,
    };

    if (body.role === "reviewer") {
      if (existing.reviewerAccepted) {
        return NextResponse.json(
          { error: "Reviewer has already accepted this review" },
          { status: 400 }
        );
      }
      updateData.reviewerAccepted = true;
      updateData.reviewerAcceptedAt = now;
    } else {
      if (existing.employeeAccepted) {
        return NextResponse.json(
          { error: "Employee has already accepted this review" },
          { status: 400 }
        );
      }
      updateData.employeeAccepted = true;
      updateData.employeeAcceptedAt = now;
    }

    const [updated] = await db
      .update(hrPerformanceReviews)
      .set(updateData)
      .where(eq(hrPerformanceReviews.id, id))
      .returning();

    const isLocked = updated.reviewerAccepted && updated.employeeAccepted;

    return NextResponse.json({
      success: true,
      message: `${body.role === "reviewer" ? "Reviewer" : "Employee"} acceptance recorded`,
      review: {
        id: updated.id,
        reviewerAccepted: updated.reviewerAccepted,
        reviewerAcceptedAt: updated.reviewerAcceptedAt,
        employeeAccepted: updated.employeeAccepted,
        employeeAcceptedAt: updated.employeeAcceptedAt,
        isLocked,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/hr-people/performance/[id]/accept error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
