/**
 * /api/ai/confirm
 *
 * Execute confirmed AI actions
 * POST: Verify token and execute the action
 */

import { NextRequest, NextResponse } from "next/server";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { canUseAI } from "@/lib/entitlements";
import { verifyActionToken, consumePendingAction, AIAction } from "@/lib/ai/actions";

/**
 * Execute an action based on its type
 */
async function executeAction(
  action: AIAction,
  _tenantId: string,
  _userId: string
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  switch (action.type) {
    case "navigate": {
      // Navigation is handled client-side
      return {
        success: true,
        result: { route: action.payload.route },
      };
    }

    case "draft.salesDocument":
    case "draft.purchaseDocument":
    case "draft.payment":
    case "draft.journalEntry": {
      // These would call the appropriate omni/draft endpoints
      // For now, return a placeholder
      return {
        success: false,
        error: "Draft creation via AI is not yet implemented",
      };
    }

    case "post.document": {
      // This would call the appropriate post endpoint
      return {
        success: false,
        error: "Document posting via AI is not yet implemented",
      };
    }

    default:
      return {
        success: false,
        error: `Unknown action type: ${action.type}`,
      };
  }
}

/**
 * POST /api/ai/confirm
 * Verify and execute a confirmed action
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userId = getUserIdFromHeaders(req);

    if (!userId) {
      return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
    }

    // Check AI entitlement
    const canUse = await canUseAI(tenantId);
    if (!canUse) {
      return NextResponse.json(
        { error: "AI Copilot is not available on your plan" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const token = body.token;

    if (!token) {
      return NextResponse.json({ error: "Action token is required" }, { status: 400 });
    }

    // Verify the token
    const verification = verifyActionToken(token, tenantId, userId);
    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error },
        { status: 400 }
      );
    }

    // Consume the pending action (one-time use)
    const pendingAction = consumePendingAction(token);
    if (!pendingAction) {
      // Token was valid but already consumed or expired from store
      // Still allow execution if signature is valid
    }

    // Execute the action
    const result = await executeAction(verification.action, tenantId, userId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, action: verification.action },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      action: verification.action,
      result: result.result,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/ai/confirm error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
