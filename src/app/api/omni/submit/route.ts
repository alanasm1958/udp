/**
 * POST /api/omni/submit
 *
 * Submit a transaction set for review (draft -> review).
 * This is a prerequisite for posting.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { submitForReview } from "@/lib/posting";

interface SubmitRequestBody {
  transactionSetId: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Extract tenant context from headers
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    // 2. Resolve actor
    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);

    // 3. Parse request body
    const body: SubmitRequestBody = await req.json();

    if (!body.transactionSetId) {
      return NextResponse.json(
        { error: "transactionSetId is required" },
        { status: 400 }
      );
    }

    // 4. Submit for review
    const result = await submitForReview(tenantId, actor.actorId, body.transactionSetId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      transactionSetId: body.transactionSetId,
      status: "review",
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Submit error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
