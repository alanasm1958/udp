/**
 * /api/ai/omni
 *
 * Stateless one-shot AI endpoint for Omni Window (Cmd+K)
 * POST: Send a query and get AI response
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { aiUsageDaily } from "@/db/schema";
import { sql } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { canUseAI } from "@/lib/entitlements";
import { getAIProvider } from "@/lib/ai/provider";
import {
  SYSTEM_PROMPT,
  containsDisallowedContent,
  generateRefusalResponse,
  detectNavigationIntent,
} from "@/lib/ai/policy";
import { TOOL_DEFINITIONS, executeTool } from "@/lib/ai/tools";

/**
 * POST /api/ai/omni
 * Stateless one-shot query for Omni Window
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userId = getUserIdFromHeaders(req);

    if (!userId) {
      return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
    }

    const actorIdFromHeader = getActorIdFromHeaders(req);
    const actor = await resolveActor(tenantId, actorIdFromHeader, userId);

    // Check AI entitlement
    const canUse = await canUseAI(tenantId);
    if (!canUse) {
      return NextResponse.json(
        { error: "AI Copilot is not available on your plan" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const query = body.query?.trim();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // Check for navigation intent first (fast path)
    const navIntent = detectNavigationIntent(query);
    if (navIntent) {
      return NextResponse.json({
        type: "navigation",
        route: navIntent.route,
        description: navIntent.description,
        message: `Navigating to ${navIntent.description}`,
      });
    }

    // Check for disallowed content
    const contentCheck = containsDisallowedContent(query);
    if (contentCheck.blocked) {
      return NextResponse.json({
        type: "refusal",
        message: generateRefusalResponse(contentCheck.reason),
        reason: contentCheck.reason,
      });
    }

    const provider = getAIProvider();
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    // Build messages
    const messages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      { role: "user" as const, content: query },
    ];

    // Tool calling loop
    let maxIterations = 3;
    const currentMessages = [...messages];
    const toolResults: Array<{ tool: string; result: unknown }> = [];

    while (maxIterations > 0) {
      maxIterations--;

      const response = await provider.complete({
        messages: currentMessages,
        tools: TOOL_DEFINITIONS,
        maxTokens: 500,
        temperature: 0.5,
      });

      totalPromptTokens += response.usage?.promptTokens || 0;
      totalCompletionTokens += response.usage?.completionTokens || 0;

      if (response.toolCalls && response.toolCalls.length > 0) {
        // Execute tool calls
        for (const toolCall of response.toolCalls) {
          const result = await executeTool(toolCall.name, toolCall.arguments, { tenantId, userId, actorId: actor.actorId });
          toolResults.push({ tool: toolCall.name, result });

          // Add to messages for next iteration
          currentMessages.push({
            role: "assistant",
            content: "",
            toolCalls: [toolCall],
          } as unknown as typeof currentMessages[0]);

          currentMessages.push({
            role: "tool",
            content: JSON.stringify(result),
            toolResults: [{ toolCallId: toolCall.id, result }],
          } as unknown as typeof currentMessages[0]);
        }
        continue;
      }

      // No more tool calls - we have the final response
      // Update usage tracking
      const today = new Date().toISOString().split("T")[0];
      await db
        .insert(aiUsageDaily)
        .values({
          tenantId,
          date: today,
          requests: 1,
          tokensIn: totalPromptTokens,
          tokensOut: totalCompletionTokens,
        })
        .onConflictDoUpdate({
          target: [aiUsageDaily.tenantId, aiUsageDaily.date],
          set: {
            requests: sql`${aiUsageDaily.requests} + 1`,
            tokensIn: sql`${aiUsageDaily.tokensIn} + ${totalPromptTokens}`,
            tokensOut: sql`${aiUsageDaily.tokensOut} + ${totalCompletionTokens}`,
            updatedAt: new Date(),
          },
        });

      return NextResponse.json({
        type: "answer",
        message: response.content,
        toolResults: toolResults.length > 0 ? toolResults : undefined,
        usage: {
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
        },
      });
    }

    // Max iterations reached without final answer
    return NextResponse.json({
      type: "error",
      message: "Unable to complete request - too many tool calls",
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/ai/omni error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
