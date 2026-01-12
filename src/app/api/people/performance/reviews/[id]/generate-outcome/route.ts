/**
 * /api/people/performance/reviews/[id]/generate-outcome
 *
 * AI outcome generation for performance reviews
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { performanceReviewsV2, people, tasks, hrAuditLog } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createHash } from "crypto";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface ReviewData {
  strengths?: string | null;
  strengthsExamples?: string | null;
  improvements?: string | null;
  improvementsExamples?: string | null;
  fairnessConstraints?: string | null;
  fairnessSupport?: string | null;
  fairnessOutsideControl?: string | null;
  periodType?: string | null;
  periodStart: string;
  periodEnd: string;
  employeeName: string;
}

interface AIOutcome {
  category: "outstanding_contribution" | "strong_performance" | "solid_on_track" | "below_expectations" | "critical_concerns";
  key_reasons: string[];
  suggested_next_step: string;
}

// AI outcome generation logic
// In production, this would call Claude API
async function generateAIOutcome(reviewData: ReviewData): Promise<AIOutcome> {
  const strengths = reviewData.strengths || "";
  const improvements = reviewData.improvements || "";
  const constraints = reviewData.fairnessConstraints || "";

  // Heuristic scoring for demo purposes
  // In production, use Claude API for nuanced analysis
  const strengthsLength = strengths.length;
  const improvementsLength = improvements.length;
  const hasConstraints = constraints.length > 0;

  let category: AIOutcome["category"] = "solid_on_track";
  let reasons: string[] = [];
  let nextStep = "";

  // Scoring logic
  if (strengthsLength > 200 && improvementsLength < 100) {
    category = "outstanding_contribution";
    reasons = [
      "Demonstrates exceptional performance and significant impact",
      "Strengths are well-documented with concrete examples",
      "Minimal areas requiring improvement identified",
    ];
    nextStep = "Consider for recognition, expanded responsibilities, or advancement opportunities";
  } else if (strengthsLength > 100 && improvementsLength < 150) {
    category = "strong_performance";
    reasons = [
      "Consistently exceeds role expectations",
      "Shows initiative and delivers quality work",
      "Minor development areas identified for continued growth",
    ];
    nextStep = "Continue current trajectory, provide stretch assignments and mentoring opportunities";
  } else if (improvementsLength > 200 && !hasConstraints) {
    category = "below_expectations";
    reasons = [
      "Multiple performance gaps identified",
      "Requires additional support and guidance",
      "Clear improvement areas documented for action",
    ];
    nextStep = "Create 30-day performance improvement plan with weekly check-ins";
  } else if (improvementsLength > 300 && !hasConstraints) {
    category = "critical_concerns";
    reasons = [
      "Significant performance issues requiring immediate attention",
      "Multiple areas need urgent improvement",
      "Pattern of performance gaps documented",
    ];
    nextStep = "Initiate formal performance improvement process with HR involvement";
  } else if (hasConstraints) {
    category = "solid_on_track";
    reasons = [
      "Performance acceptable given documented constraints",
      "Context and limitations appropriately considered",
      "Demonstrates effort and commitment despite challenges",
    ];
    nextStep = "Address documented constraints, provide additional support and resources";
  } else {
    category = "solid_on_track";
    reasons = [
      "Meets role expectations consistently",
      "Demonstrates reliable performance and work quality",
      "Growth opportunities identified for development",
    ];
    nextStep = "Continue regular feedback cadence, discuss career development goals";
  }

  return {
    category,
    key_reasons: reasons,
    suggested_next_step: nextStep,
  };
}

function hashReviewInput(review: ReviewData): string {
  const input = [
    review.strengths || "",
    review.strengthsExamples || "",
    review.improvements || "",
    review.improvementsExamples || "",
    review.fairnessConstraints || "",
    review.fairnessSupport || "",
    review.fairnessOutsideControl || "",
  ].join("|");
  return createHash("sha256").update(input).digest("hex");
}

/**
 * POST /api/people/performance/reviews/[id]/generate-outcome
 * Generate AI outcome for a performance review
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

    // Get employee name
    const [person] = await db
      .select({ fullName: people.fullName })
      .from(people)
      .where(eq(people.id, review.personId));

    const employeeName = person?.fullName || "Unknown Employee";

    // Prepare review data
    const reviewData: ReviewData = {
      strengths: review.strengths,
      strengthsExamples: review.strengthsExamples,
      improvements: review.improvements,
      improvementsExamples: review.improvementsExamples,
      fairnessConstraints: review.fairnessConstraints,
      fairnessSupport: review.fairnessSupport,
      fairnessOutsideControl: review.fairnessOutsideControl,
      periodType: review.periodType,
      periodStart: review.periodStart,
      periodEnd: review.periodEnd,
      employeeName,
    };

    // Check if content has changed
    const newHash = hashReviewInput(reviewData);

    if (review.aiOutcomeInputHash === newHash && review.aiOutcomeCategory) {
      return NextResponse.json({
        message: "AI outcome already generated and content unchanged",
        outcome: {
          category: review.aiOutcomeCategory,
          reasons: review.aiOutcomeReasons?.split("\n") || [],
          nextStep: review.aiOutcomeNextStep,
        },
        cached: true,
      });
    }

    // Generate AI outcome
    const outcome = await generateAIOutcome(reviewData);

    // Update review with AI outcome
    await db
      .update(performanceReviewsV2)
      .set({
        aiOutcomeCategory: outcome.category,
        aiOutcomeReasons: outcome.key_reasons.join("\n"),
        aiOutcomeNextStep: outcome.suggested_next_step,
        aiOutcomeGeneratedAt: new Date(),
        aiOutcomeInputHash: newHash,
        updatedAt: new Date(),
        updatedByActorId: actor.actorId,
      })
      .where(eq(performanceReviewsV2.id, reviewId));

    // Create improvement task if needed
    if (outcome.category === "below_expectations" || outcome.category === "critical_concerns") {
      const dueDate = review.followUpDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      await db.insert(tasks).values({
        tenantId,
        title: `Follow up: Performance improvement for ${employeeName}`,
        description: `Review progress on performance improvement plan. Category: ${outcome.category}. Next step: ${outcome.suggested_next_step}`,
        domain: "hr",
        status: "open",
        priority: outcome.category === "critical_concerns" ? "high" : "medium",
        dueAt: new Date(dueDate),
        relatedEntityType: "performance_review",
        relatedEntityId: reviewId,
        createdByActorId: actor.actorId,
      });
    }

    // Log to HR audit
    await db.insert(hrAuditLog).values({
      tenantId,
      actorId: actor.actorId,
      entityType: "performance_review",
      entityId: reviewId,
      action: "ai_outcome_generated",
      aiOutcomeSnapshot: {
        category: outcome.category,
        reasons: outcome.key_reasons,
        nextStep: outcome.suggested_next_step,
        inputHash: newHash,
      },
    });

    await audit.log("performance_review", reviewId, "performance_review_ai_generated", {
      category: outcome.category,
    });

    return NextResponse.json({
      success: true,
      message: "AI outcome generated successfully",
      outcome: {
        category: outcome.category,
        reasons: outcome.key_reasons,
        nextStep: outcome.suggested_next_step,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error generating AI outcome:", error);
    return NextResponse.json(
      { error: "Failed to generate AI outcome" },
      { status: 500 }
    );
  }
}
