// /api/people/performance/reviews/[id]/generate-outcome/route.ts
// AI outcome generation for performance reviews

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { createHash } from "crypto";

// Simulated AI call - in production, use Anthropic Claude API
async function generateAIOutcome(reviewData: any) {
  const prompt = `
You are an HR advisor analyzing a performance review. Based on the following information, categorize the performance and provide guidance.

Review Period: ${reviewData.period_type} (${reviewData.period_start} to ${reviewData.period_end})
Employee: ${reviewData.employee_name}

STRENGTHS:
${reviewData.strengths || "Not specified"}

Examples: ${reviewData.strengths_examples || "None provided"}

AREAS FOR IMPROVEMENT:
${reviewData.improvements || "Not specified"}

Examples: ${reviewData.improvements_examples || "None provided"}

FAIRNESS CONTEXT:
- Constraints: ${reviewData.fairness_constraints || "None"}
- Support provided: ${reviewData.fairness_support || "None"}
- External factors: ${reviewData.fairness_outside_control || "None"}

Respond with JSON only:
{
  "category": "outstanding_contribution" | "strong_performance" | "solid_on_track" | "below_expectations" | "critical_concerns",
  "key_reasons": ["reason 1", "reason 2", "reason 3"],
  "suggested_next_step": "Clear action recommendation"
}

Guidelines:
- Be fair and fact-based
- Consider external constraints mentioned
- Outstanding contribution: Exceptional results, significant impact beyond role
- Strong performance: Exceeds expectations consistently
- Solid on track: Meets expectations, reliable performance
- Below expectations: Some concerns, needs support
- Critical concerns: Serious performance issues requiring immediate action
`;

  // In production, call Claude API here
  // For now, return mock response
  
  // Simple heuristic for demo
  const hasStrongStrengths = reviewData.strengths && reviewData.strengths.length > 100;
  const hasMinorImprovements = reviewData.improvements && reviewData.improvements.length < 200;
  const hasMajorImprovements = reviewData.improvements && reviewData.improvements.length >= 200;
  const hasConstraints = reviewData.fairness_constraints && reviewData.fairness_constraints.length > 0;

  let category = "solid_on_track";
  let reasons = [];
  let nextStep = "";

  if (hasStrongStrengths && hasMinorImprovements) {
    category = "strong_performance";
    reasons = [
      "Consistently delivers quality work",
      "Demonstrates initiative and ownership",
      "Minor improvements identified but overall strong"
    ];
    nextStep = "Continue current trajectory, consider stretch assignments";
  } else if (hasMajorImprovements && !hasConstraints) {
    category = "below_expectations";
    reasons = [
      "Performance gaps identified",
      "Needs additional support and guidance",
      "Clear improvement areas documented"
    ];
    nextStep = "Create 30-day improvement plan with weekly check-ins";
  } else if (hasConstraints) {
    category = "solid_on_track";
    reasons = [
      "Performance acceptable given constraints",
      "Context and limitations acknowledged",
      "Demonstrates effort despite challenges"
    ];
    nextStep = "Address constraints, provide additional support";
  } else {
    category = "solid_on_track";
    reasons = [
      "Meets role expectations",
      "Reliable performance",
      "Areas for growth identified"
    ];
    nextStep = "Continue regular feedback and support";
  }

  return {
    category,
    key_reasons: reasons,
    suggested_next_step: nextStep,
  };
}

function hashReviewInput(review: any): string {
  const input = `${review.strengths}|${review.strengths_examples}|${review.improvements}|${review.improvements_examples}|${review.fairness_constraints}|${review.fairness_support}|${review.fairness_outside_control}`;
  return createHash("sha256").update(input).digest("hex");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const headersList = await headers();
    const tenantId = headersList.get("x-tenant-id");
    const userId = headersList.get("x-user-id");

    if (!tenantId || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: reviewId } = await params;

    // Fetch review
    const reviewResult = await db.execute(sql`
      SELECT 
        pr.*,
        p.first_name || ' ' || p.last_name as employee_name
      FROM performance_reviews_v2 pr
      JOIN people p ON p.id = pr.person_id
      WHERE pr.id = ${reviewId}
        AND pr.tenant_id = ${tenantId}
    `);

    if (reviewResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Performance review not found" },
        { status: 404 }
      );
    }

    const review = reviewResult.rows[0];

    // Check if content has changed
    const newHash = hashReviewInput(review);
    
    if (review.ai_outcome_input_hash === newHash && review.ai_outcome_category) {
      return NextResponse.json({
        message: "AI outcome already generated and content unchanged",
        outcome: {
          category: review.ai_outcome_category,
          reasons: review.ai_outcome_reasons,
          next_step: review.ai_outcome_next_step,
        },
      });
    }

    // Generate AI outcome
    const outcome = await generateAIOutcome(review);

    // Update review with AI outcome
    await db.execute(sql`
      UPDATE performance_reviews_v2
      SET 
        ai_outcome_category = ${outcome.category},
        ai_outcome_reasons = ${outcome.key_reasons.join("\n")},
        ai_outcome_next_step = ${outcome.suggested_next_step},
        ai_outcome_generated_at = NOW(),
        ai_outcome_input_hash = ${newHash},
        updated_at = NOW(),
        updated_by = ${userId}
      WHERE id = ${reviewId}
    `);

    // Create improvement task if needed
    if (outcome.category === "below_expectations" || outcome.category === "critical_concerns") {
      const dueDate = review.follow_up_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      await db.execute(sql`
        INSERT INTO tasks (
          id, tenant_id, title, description, domain, status,
          priority, due_at, assigned_to_user_id, created_by
        )
        VALUES (
          'task_' || gen_random_uuid()::text,
          ${tenantId},
          'Follow up: Performance improvement for ' || ${review.employee_name},
          'Review progress on performance improvement plan. Category: ' || ${outcome.category},
          'hr',
          'open',
          CASE WHEN ${outcome.category} = 'critical_concerns' THEN 'high' ELSE 'medium' END,
          ${dueDate}::date,
          COALESCE(${review.reviewer_id}, ${userId}),
          ${userId}
        )
      `);
    }

    // Log audit event
    await db.execute(sql`
      INSERT INTO hr_audit_log (
        id, tenant_id, actor_id, actor_name, entity_type, entity_id,
        action, ai_outcome_snapshot
      )
      VALUES (
        'audit_' || gen_random_uuid()::text,
        ${tenantId},
        ${userId},
        (SELECT full_name FROM users WHERE id = ${userId}),
        'performance_review',
        ${reviewId},
        'ai_outcome_generated',
        ${JSON.stringify(outcome)}::jsonb
      )
    `);

    return NextResponse.json({
      success: true,
      message: "AI outcome generated successfully",
      outcome: {
        category: outcome.category,
        reasons: outcome.key_reasons,
        next_step: outcome.suggested_next_step,
      },
    });
  } catch (error) {
    console.error("Error generating AI outcome:", error);
    return NextResponse.json(
      { error: "Failed to generate AI outcome" },
      { status: 500 }
    );
  }
}
