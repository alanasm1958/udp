/**
 * AI Provider Abstraction Layer
 *
 * Supports multiple providers via env vars:
 * - AI_PROVIDER: mock | openai | anthropic
 * - AI_MODEL: provider-specific model name
 * - OPENAI_API_KEY, ANTHROPIC_API_KEY
 */

export interface AIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCalls?: AIToolCall[];
  toolResults?: AIToolResult[];
}

export interface AIToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AIToolResult {
  toolCallId: string;
  result: unknown;
}

export interface AIToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AICompletionRequest {
  messages: AIMessage[];
  tools?: AIToolDefinition[];
  maxTokens?: number;
  temperature?: number;
}

export interface AICompletionResponse {
  content: string;
  toolCalls?: AIToolCall[];
  finishReason: "stop" | "tool_calls" | "length" | "error";
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface AIStreamChunk {
  type: "text" | "tool_call" | "done" | "error";
  content?: string;
  toolCall?: AIToolCall;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface AIProvider {
  name: string;
  complete(request: AICompletionRequest): Promise<AICompletionResponse>;
  stream?(request: AICompletionRequest): AsyncGenerator<AIStreamChunk>;
}

/**
 * Mock Provider - for development without API keys
 */
class MockProvider implements AIProvider {
  name = "mock";

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const lastMessage = request.messages[request.messages.length - 1];
    const userText = lastMessage?.content?.toLowerCase() || "";

    // Check if tools are available and user is asking for data
    if (request.tools && request.tools.length > 0) {
      // Check for trial balance request
      if (userText.includes("trial balance") || userText.includes("balance")) {
        const trialBalanceTool = request.tools.find(t => t.name === "reports_trialBalance");
        if (trialBalanceTool) {
          return {
            content: "",
            toolCalls: [{
              id: `call_${Date.now()}`,
              name: "reports_trialBalance",
              arguments: { asOf: new Date().toISOString().split("T")[0] }
            }],
            finishReason: "tool_calls",
            usage: { promptTokens: 100, completionTokens: 50 }
          };
        }
      }

      // Check for inventory request
      if (userText.includes("inventory") || userText.includes("stock")) {
        const inventoryTool = request.tools.find(t => t.name === "inventory_balances");
        if (inventoryTool) {
          return {
            content: "",
            toolCalls: [{
              id: `call_${Date.now()}`,
              name: "inventory_balances",
              arguments: {}
            }],
            finishReason: "tool_calls",
            usage: { promptTokens: 100, completionTokens: 50 }
          };
        }
      }

      // Check for AR request
      if (userText.includes("ar") || userText.includes("receivable") || userText.includes("open ar")) {
        const arTool = request.tools.find(t => t.name === "finance_openAR");
        if (arTool) {
          return {
            content: "",
            toolCalls: [{
              id: `call_${Date.now()}`,
              name: "finance_openAR",
              arguments: { limit: 50 }
            }],
            finishReason: "tool_calls",
            usage: { promptTokens: 100, completionTokens: 50 }
          };
        }
      }
    }

    // Check for tool results in messages - summarize them
    const toolResultMsg = request.messages.find(m => m.role === "tool" || m.toolResults);
    if (toolResultMsg) {
      return {
        content: "Based on the data I retrieved, here's a summary of your business information. The tool successfully returned the requested data which you can see in the response details.",
        finishReason: "stop",
        usage: { promptTokens: 150, completionTokens: 80 }
      };
    }

    // Default response
    return {
      content: "I'm your Business Copilot. I can help you with:\n\n- **Reports**: Trial balance, general ledger, cashbook\n- **Inventory**: Stock levels, balances by warehouse\n- **Finance**: Open AR/AP, payment status\n- **Sales & Procurement**: Document lookup, order status\n\nWhat would you like to know about your business operations?",
      finishReason: "stop",
      usage: { promptTokens: 50, completionTokens: 100 }
    };
  }

  async *stream(request: AICompletionRequest): AsyncGenerator<AIStreamChunk> {
    // For mock, just return the complete response as chunks
    const response = await this.complete(request);

    if (response.toolCalls && response.toolCalls.length > 0) {
      for (const toolCall of response.toolCalls) {
        yield { type: "tool_call", toolCall };
      }
    } else if (response.content) {
      // Simulate streaming by yielding words
      const words = response.content.split(" ");
      for (const word of words) {
        yield { type: "text", content: word + " " };
        await new Promise(r => setTimeout(r, 20)); // Simulate latency
      }
    }

    yield { type: "done", usage: response.usage };
  }
}

/**
 * OpenAI Provider
 */
class OpenAIProvider implements AIProvider {
  name = "openai";
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || "";
    this.model = process.env.AI_MODEL || "gpt-4o-mini";
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const messages = request.messages.map(m => ({
      role: m.role as "system" | "user" | "assistant",
      content: m.content,
      ...(m.toolCalls && { tool_calls: m.toolCalls.map(tc => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) }
      })) }),
      ...(m.toolResults && m.toolResults.length > 0 && {
        tool_call_id: m.toolResults[0].toolCallId,
        content: JSON.stringify(m.toolResults[0].result)
      }),
    }));

    const tools = request.tools?.map(t => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }));

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        tools: tools && tools.length > 0 ? tools : undefined,
        max_tokens: request.maxTokens || 1000,
        temperature: request.temperature ?? 0.7
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    const choice = data.choices[0];
    const message = choice.message;

    return {
      content: message.content || "",
      toolCalls: message.tool_calls?.map((tc: { id: string; function: { name: string; arguments: string } }) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments)
      })),
      finishReason: choice.finish_reason === "tool_calls" ? "tool_calls" : "stop",
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0
      }
    };
  }

  async *stream(request: AICompletionRequest): AsyncGenerator<AIStreamChunk> {
    if (!this.apiKey) {
      yield { type: "error", error: "OPENAI_API_KEY not configured" };
      return;
    }

    const messages = request.messages.map(m => ({
      role: m.role as "system" | "user" | "assistant",
      content: m.content,
    }));

    const tools = request.tools?.map(t => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }));

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        tools: tools && tools.length > 0 ? tools : undefined,
        max_tokens: request.maxTokens || 1000,
        temperature: request.temperature ?? 0.7,
        stream: true
      })
    });

    if (!response.ok) {
      yield { type: "error", error: `OpenAI API error: ${response.status}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: "error", error: "No response body" };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            yield { type: "done" };
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              yield { type: "text", content: delta.content };
            }
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (tc.function?.name) {
                  yield {
                    type: "tool_call",
                    toolCall: {
                      id: tc.id || `call_${Date.now()}`,
                      name: tc.function.name,
                      arguments: tc.function.arguments ? JSON.parse(tc.function.arguments) : {}
                    }
                  };
                }
              }
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }

    yield { type: "done" };
  }
}

/**
 * Anthropic Provider
 */
class AnthropicProvider implements AIProvider {
  name = "anthropic";
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || "";
    this.model = process.env.AI_MODEL || "claude-3-haiku-20240307";
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.apiKey) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    // Extract system message
    const systemMessage = request.messages.find(m => m.role === "system");
    const otherMessages = request.messages.filter(m => m.role !== "system");

    const messages = otherMessages.map(m => ({
      role: m.role === "tool" ? "user" : m.role,
      content: m.role === "tool" && m.toolResults
        ? JSON.stringify({ tool_result: m.toolResults })
        : m.content
    }));

    const tools = request.tools?.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters
    }));

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: request.maxTokens || 1000,
        system: systemMessage?.content,
        messages,
        tools: tools && tools.length > 0 ? tools : undefined
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = await response.json();

    let content = "";
    const toolCalls: AIToolCall[] = [];

    for (const block of data.content || []) {
      if (block.type === "text") {
        content += block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input
        });
      }
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: data.stop_reason === "tool_use" ? "tool_calls" : "stop",
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0
      }
    };
  }

  async *stream(request: AICompletionRequest): AsyncGenerator<AIStreamChunk> {
    // For simplicity, use non-streaming for Anthropic and yield result
    try {
      const response = await this.complete(request);

      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const toolCall of response.toolCalls) {
          yield { type: "tool_call", toolCall };
        }
      } else if (response.content) {
        yield { type: "text", content: response.content };
      }

      yield { type: "done", usage: response.usage };
    } catch (error) {
      yield { type: "error", error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
}

/**
 * Get the configured AI provider
 */
export function getAIProvider(): AIProvider {
  const providerName = process.env.AI_PROVIDER || "mock";

  switch (providerName.toLowerCase()) {
    case "openai":
      return new OpenAIProvider();
    case "anthropic":
      return new AnthropicProvider();
    case "mock":
    default:
      return new MockProvider();
  }
}

/**
 * Check if AI is available
 */
export function isAIAvailable(): boolean {
  const provider = process.env.AI_PROVIDER || "mock";

  if (provider === "mock") return true;
  if (provider === "openai" && process.env.OPENAI_API_KEY) return true;
  if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) return true;

  return false;
}
