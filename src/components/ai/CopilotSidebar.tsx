"use client";

import * as React from "react";
import { GlassButton, Spinner, GlassBadge } from "@/components/ui/glass";
import { QUICK_PROMPTS } from "@/lib/ai/policy";

interface Message {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  title: string | null;
  lastMessageAt: string;
}

interface CopilotSidebarProps {
  open: boolean;
  onClose: () => void;
}

// Helper to generate unique IDs
let idCounter = 0;
function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function CopilotSidebar({ open, onClose }: CopilotSidebarProps) {
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const [streamingContent, setStreamingContent] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Define fetchConversations before useEffect that uses it
  const fetchConversations = React.useCallback(async () => {
    try {
      const res = await fetch("/api/ai/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.items || []);
      }
    } catch {
      console.error("Failed to fetch conversations");
    }
  }, []);

  // Fetch conversations on mount
  React.useEffect(() => {
    if (open) {
      fetchConversations();
      // Focus input when opening
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, fetchConversations]);

  // Scroll to bottom when messages change
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  const fetchMessages = async (conversationId: string) => {
    try {
      const res = await fetch(`/api/ai/conversations/${conversationId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(
          (data.items || []).map((m: { id: string; role: string; content: unknown; createdAt: string }) => ({
            id: m.id,
            role: m.role as "user" | "assistant" | "tool",
            content:
              typeof m.content === "object" && m.content !== null && "text" in m.content
                ? (m.content as { text: string }).text
                : JSON.stringify(m.content),
            createdAt: m.createdAt,
          }))
        );
      }
    } catch {
      console.error("Failed to fetch messages");
    }
  };

  const createNewConversation = async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/ai/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const conversation = await res.json();
        setActiveConversationId(conversation.id);
        setMessages([]);
        await fetchConversations();
        return conversation.id;
      }
    } catch {
      console.error("Failed to create conversation");
    }
    return null;
  };

  const sendMessage = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || streaming) return;

    setError(null);
    setInput("");

    let conversationId = activeConversationId;
    if (!conversationId) {
      conversationId = await createNewConversation();
      if (!conversationId) {
        setError("Failed to start conversation");
        return;
      }
    }

    // Optimistically add user message
    const userMessage: Message = {
      id: generateId("temp"),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setStreaming(true);
    setStreamingContent("");

    try {
      const res = await fetch(`/api/ai/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to send message");
        setStreaming(false);
        return;
      }

      // Check if this is a blocked response (not streaming)
      const contentType = res.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const data = await res.json();
        if (data.blocked) {
          setMessages((prev) => [
            ...prev,
            {
              id: data.message?.id || generateId("msg"),
              role: "assistant",
              content: data.message?.content?.text || "I can't help with that.",
              createdAt: new Date().toISOString(),
            },
          ]);
          setStreaming(false);
          return;
        }
      }

      // Process SSE stream
      const reader = res.body?.getReader();
      if (!reader) {
        setError("No response stream");
        setStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      const contentParts: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "text") {
                contentParts.push(data.content);
                setStreamingContent(contentParts.join(""));
              } else if (data.type === "tool_call") {
                setStreamingContent(`Calling ${data.tool}...`);
              } else if (data.type === "tool_result") {
                setStreamingContent(`${data.tool} completed`);
              } else if (data.type === "done") {
                const finalContent = contentParts.join("");
                setMessages((prev) => [
                  ...prev,
                  {
                    id: data.messageId || generateId("msg"),
                    role: "assistant",
                    content: finalContent,
                    createdAt: new Date().toISOString(),
                  },
                ]);
                setStreamingContent("");
              } else if (data.type === "error") {
                setError(data.error);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }

      setStreaming(false);
      await fetchConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      setStreaming(false);
    }
  };

  const selectConversation = async (conv: Conversation) => {
    setActiveConversationId(conv.id);
    await fetchMessages(conv.id);
  };

  const startNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    setError(null);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sidebar Panel */}
      <div
        className="
          relative h-full w-full max-w-md
          bg-zinc-900/95 backdrop-blur-xl
          border-l border-white/10
          shadow-2xl
          animate-slide-left
          flex flex-col
        "
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Business Copilot</h2>
              <p className="text-xs text-white/50">Ask anything about your operations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={startNewChat}
              className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              title="New chat"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !activeConversationId && (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-white mb-1">Start a conversation</h3>
              <p className="text-xs text-white/50 mb-4">Ask about your business operations</p>

              {/* Quick prompts */}
              <div className="flex flex-wrap gap-2 justify-center">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt.label}
                    onClick={() => sendMessage(prompt.prompt)}
                    className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/15 text-white/70 hover:text-white rounded-lg transition-colors"
                  >
                    {prompt.label}
                  </button>
                ))}
              </div>

              {/* Recent conversations */}
              {conversations.length > 0 && (
                <div className="mt-6 text-left">
                  <p className="text-xs text-white/40 uppercase tracking-wider mb-2 px-1">Recent</p>
                  <div className="space-y-1">
                    {conversations.slice(0, 5).map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => selectConversation(conv)}
                        className="w-full px-3 py-2 text-left text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors truncate"
                      >
                        {conv.title || "New conversation"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Chat messages */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`
                  max-w-[85%] px-4 py-2.5 rounded-2xl text-sm
                  ${msg.role === "user"
                    ? "bg-blue-500/80 text-white rounded-br-md"
                    : "bg-white/10 text-white/90 rounded-bl-md"
                  }
                `}
              >
                {msg.role === "tool" ? (
                  <div className="flex items-center gap-2">
                    <GlassBadge variant="info">{msg.toolName || "Tool"}</GlassBadge>
                    <span className="text-white/60 text-xs">Result loaded</span>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                )}
              </div>
            </div>
          ))}

          {/* Streaming indicator */}
          {streaming && (
            <div className="flex justify-start">
              <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-bl-md bg-white/10 text-white/90 text-sm">
                {streamingContent || (
                  <div className="flex items-center gap-2">
                    <Spinner size="sm" />
                    <span className="text-white/60">Thinking...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="p-4 border-t border-white/10">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your business..."
              disabled={streaming}
              className="
                flex-1 px-4 py-2.5
                bg-white/8 backdrop-blur-md
                border border-white/15 rounded-xl
                text-sm text-white placeholder:text-white/40
                focus:outline-none focus:bg-white/12 focus:border-white/25
                disabled:opacity-50
              "
            />
            <GlassButton
              type="submit"
              variant="primary"
              disabled={!input.trim() || streaming}
            >
              {streaming ? (
                <Spinner size="sm" />
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              )}
            </GlassButton>
          </form>
          <p className="text-xs text-white/30 mt-2 text-center">
            AI responses may contain errors. Verify important data.
          </p>
        </div>
      </div>
    </div>
  );
}
