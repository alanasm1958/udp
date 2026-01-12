/**
 * /api/ai/conversations/[id]/messages
 *
 * AI conversation messages
 * GET: List messages in a conversation
 * POST: Send a message and get AI response (with SSE streaming)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { aiConversations, aiMessages, aiToolRuns, aiUsageDaily } from "@/db/schema";
import { eq, and, asc, sql } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { canUseAI } from "@/lib/entitlements";
import { getAIProvider } from "@/lib/ai/provider";
import { SYSTEM_PROMPT, containsDisallowedContent, generateRefusalResponse } from "@/lib/ai/policy";
import { TOOL_DEFINITIONS, executeTool } from "@/lib/ai/tools";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/ai/conversations/[id]/messages
 * List messages in a conversation
 */
export async function GET(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userId = getUserIdFromHeaders(req);
    const { id: conversationId } = await context.params;

    if (!userId) {
      return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
    }

    // Verify conversation ownership
    const [conversation] = await db
      .select()
      .from(aiConversations)
      .where(
        and(
          eq(aiConversations.id, conversationId),
          eq(aiConversations.tenantId, tenantId),
          eq(aiConversations.userId, userId)
        )
      );

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const messages = await db
      .select({
        id: aiMessages.id,
        role: aiMessages.role,
        content: aiMessages.content,
        safeSummary: aiMessages.safeSummary,
        createdAt: aiMessages.createdAt,
      })
      .from(aiMessages)
      .where(
        and(
          eq(aiMessages.conversationId, conversationId),
          eq(aiMessages.tenantId, tenantId)
        )
      )
      .orderBy(asc(aiMessages.createdAt));

    return NextResponse.json({ items: messages });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/ai/conversations/[id]/messages error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/conversations/[id]/messages
 * Send a message and get AI response with SSE streaming
 */
export async function POST(
  req: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userId = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);
    const { id: conversationId } = await context.params;

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

    const actor = await resolveActor(tenantId, actorIdFromHeader, userId);

    // Verify conversation ownership
    const [conversation] = await db
      .select()
      .from(aiConversations)
      .where(
        and(
          eq(aiConversations.id, conversationId),
          eq(aiConversations.tenantId, tenantId),
          eq(aiConversations.userId, userId)
        )
      );

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const body = await req.json();
    const userMessage = body.message?.trim();

    if (!userMessage) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Check for disallowed content
    const contentCheck = containsDisallowedContent(userMessage);
    if (contentCheck.blocked) {
      const refusalResponse = generateRefusalResponse(contentCheck.reason);

      // Store user message
      await db.insert(aiMessages).values({
        tenantId,
        conversationId,
        role: "user",
        content: { text: userMessage },
        createdByActorId: actor.actorId,
      });

      // Store refusal response
      const [assistantMsg] = await db.insert(aiMessages).values({
        tenantId,
        conversationId,
        role: "assistant",
        content: { text: refusalResponse },
        safeSummary: "Politely declined off-topic request",
        createdByActorId: actor.actorId,
      }).returning();

      // Update conversation timestamp
      await db
        .update(aiConversations)
        .set({ lastMessageAt: new Date(), updatedAt: new Date() })
        .where(eq(aiConversations.id, conversationId));

      return NextResponse.json({
        message: assistantMsg,
        blocked: true,
        reason: contentCheck.reason,
      });
    }

    // Store user message
    await db.insert(aiMessages).values({
      tenantId,
      conversationId,
      role: "user",
      content: { text: userMessage },
      createdByActorId: actor.actorId,
    });

    // Get conversation history
    const history = await db
      .select({
        role: aiMessages.role,
        content: aiMessages.content,
      })
      .from(aiMessages)
      .where(
        and(
          eq(aiMessages.conversationId, conversationId),
          eq(aiMessages.tenantId, tenantId)
        )
      )
      .orderBy(asc(aiMessages.createdAt));

    // Build messages for AI
    const aiMessages_list = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      ...history.map((m) => ({
        role: m.role as "user" | "assistant" | "tool" | "system",
        content: typeof m.content === "object" && m.content !== null && "text" in m.content
          ? (m.content as { text: string }).text
          : JSON.stringify(m.content),
      })),
    ];

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const provider = getAIProvider();
          let fullContent = "";
          let totalPromptTokens = 0;
          let totalCompletionTokens = 0;

          // Tool calling loop
          let maxIterations = 5;
          const currentMessages = [...aiMessages_list];

          while (maxIterations > 0) {
            maxIterations--;

            const response = await provider.complete({
              messages: currentMessages,
              tools: TOOL_DEFINITIONS,
              maxTokens: 1000,
              temperature: 0.7,
            });

            totalPromptTokens += response.usage?.promptTokens || 0;
            totalCompletionTokens += response.usage?.completionTokens || 0;

            if (response.toolCalls && response.toolCalls.length > 0) {
              // Execute tool calls
              for (const toolCall of response.toolCalls) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: "tool_call", tool: toolCall.name })}\n\n`)
                );

                const startTime = Date.now();
                const result = await executeTool(toolCall.name, toolCall.arguments, { tenantId, userId: userId!, actorId: actor.actorId });
                const duration = Date.now() - startTime;

                // Store tool run
                const [assistantToolMsg] = await db.insert(aiMessages).values({
                  tenantId,
                  conversationId,
                  role: "assistant",
                  content: { toolCalls: [toolCall] },
                  createdByActorId: actor.actorId,
                }).returning();

                await db.insert(aiToolRuns).values({
                  tenantId,
                  conversationId,
                  messageId: assistantToolMsg.id,
                  toolName: toolCall.name,
                  toolInput: toolCall.arguments,
                  toolOutput: result,
                  status: result.error ? "error" : "ok",
                  durationMs: duration,
                });

                // Add tool result to messages
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

                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: "tool_result", tool: toolCall.name, success: !result.error })}\n\n`)
                );
              }

              // Continue loop to get final response
              continue;
            }

            // No more tool calls - we have the final response
            fullContent = response.content;

            // Stream the content word by word
            const words = fullContent.split(" ");
            for (const word of words) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "text", content: word + " " })}\n\n`)
              );
            }

            break;
          }

          // Store assistant response
          const [assistantMsg] = await db.insert(aiMessages).values({
            tenantId,
            conversationId,
            role: "assistant",
            content: { text: fullContent },
            safeSummary: fullContent.substring(0, 100),
            createdByActorId: actor.actorId,
          }).returning();

          // Update conversation timestamp and title
          const updates: Record<string, unknown> = {
            lastMessageAt: new Date(),
            updatedAt: new Date(),
          };

          if (!conversation.title && userMessage.length > 0) {
            updates.title = userMessage.substring(0, 50) + (userMessage.length > 50 ? "..." : "");
          }

          await db
            .update(aiConversations)
            .set(updates)
            .where(eq(aiConversations.id, conversationId));

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

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done", messageId: assistantMsg.id })}\n\n`)
          );
          controller.close();
        } catch (error) {
          console.error("AI stream error:", error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: "AI processing failed" })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/ai/conversations/[id]/messages error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
