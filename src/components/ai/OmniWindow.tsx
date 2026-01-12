"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/glass";
import { QUICK_PROMPTS, NAVIGATION_INTENTS } from "@/lib/ai/policy";

interface OmniResult {
  type: "navigation" | "answer" | "refusal" | "error";
  message: string;
  route?: string;
  description?: string;
  toolResults?: Array<{ tool: string; result: unknown }>;
}

interface OmniWindowProps {
  open: boolean;
  onClose: () => void;
  onOpenCopilot: () => void;
}

export function OmniWindow({ open, onClose, onOpenCopilot }: OmniWindowProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<OmniResult | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Focus input when opening
  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResult(null);
    }
  }, [open]);

  // Handle escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery || loading) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/ai/omni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmedQuery }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({
          type: "error",
          message: data.error || "Something went wrong",
        });
        return;
      }

      setResult(data as OmniResult);

      // Auto-navigate if it's a navigation result
      if (data.type === "navigation" && data.route) {
        setTimeout(() => {
          router.push(data.route);
          onClose();
        }, 500);
      }
    } catch (err) {
      setResult({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to process query",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (prompt: string) => {
    setQuery(prompt);
    // Auto-submit after setting query
    setTimeout(() => {
      inputRef.current?.form?.requestSubmit();
    }, 50);
  };

  const handleNavigate = (route: string) => {
    router.push(route);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="
          relative w-full max-w-xl
          bg-zinc-900/95 backdrop-blur-xl
          border border-white/15
          rounded-2xl shadow-2xl
          animate-scale-up
          overflow-hidden
        "
      >
        {/* Search input */}
        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
            {loading ? (
              <Spinner size="sm" />
            ) : (
              <svg className="w-5 h-5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything or navigate..."
              disabled={loading}
              className="
                flex-1 bg-transparent
                text-white text-base
                placeholder:text-white/40
                focus:outline-none
                disabled:opacity-50
              "
            />
            <div className="flex items-center gap-2">
              <kbd className="hidden sm:inline-flex px-2 py-1 text-xs text-white/40 bg-white/10 rounded-md">
                esc
              </kbd>
            </div>
          </div>
        </form>

        {/* Results area */}
        <div className="max-h-[50vh] overflow-y-auto">
          {/* Show result if available */}
          {result && (
            <div className="p-4">
              {result.type === "navigation" && (
                <div className="flex items-center gap-3 p-3 bg-blue-500/20 border border-blue-500/30 rounded-xl">
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">Navigating to {result.description}</p>
                    <p className="text-xs text-white/50">{result.route}</p>
                  </div>
                  <Spinner size="sm" />
                </div>
              )}

              {result.type === "answer" && (
                <div className="space-y-3">
                  <div className="p-3 bg-white/10 rounded-xl">
                    <p className="text-sm text-white whitespace-pre-wrap">{result.message}</p>
                  </div>
                  {result.toolResults && result.toolResults.length > 0 && (
                    <div className="text-xs text-white/40">
                      Used: {result.toolResults.map((t) => t.tool).join(", ")}
                    </div>
                  )}
                  <button
                    onClick={onOpenCopilot}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Continue in Copilot for more details →
                  </button>
                </div>
              )}

              {result.type === "refusal" && (
                <div className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-xl">
                  <p className="text-sm text-amber-400">{result.message}</p>
                </div>
              )}

              {result.type === "error" && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl">
                  <p className="text-sm text-red-400">{result.message}</p>
                </div>
              )}
            </div>
          )}

          {/* Show suggestions when no query or result */}
          {!result && !loading && (
            <div className="p-4 space-y-4">
              {/* Quick prompts */}
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider mb-2 px-1">Quick Actions</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt.label}
                      onClick={() => handleQuickAction(prompt.prompt)}
                      className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/15 text-white/70 hover:text-white rounded-lg transition-colors"
                    >
                      {prompt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Navigation shortcuts */}
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider mb-2 px-1">Navigate</p>
                <div className="grid grid-cols-2 gap-1">
                  {NAVIGATION_INTENTS.slice(0, 8).map((nav) => (
                    <button
                      key={nav.route}
                      onClick={() => handleNavigate(nav.route)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-left"
                    >
                      <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                      {nav.description}
                    </button>
                  ))}
                </div>
              </div>

              {/* Open full copilot */}
              <div className="pt-2 border-t border-white/10">
                <button
                  onClick={() => {
                    onClose();
                    onOpenCopilot();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    Open Copilot Sidebar
                  </div>
                  <kbd className="px-2 py-1 text-xs text-white/40 bg-white/10 rounded-md">
                    ⌘ + /
                  </kbd>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
