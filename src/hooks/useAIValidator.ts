"use client";

import * as React from "react";

/* =============================================================================
   TYPES
   ============================================================================= */

export interface AIHint {
  id: string;
  type: string; // 'price_watch' | 'volume_optimization' | 'vendor_reliability' | 'reorder_prompt' | etc.
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  suggestion?: string;
  actionLabel?: string;
  actionValue?: unknown;
  metadata?: Record<string, unknown>;
}

export interface AIHintWithDismissed extends AIHint {
  dismissed: boolean;
}

export interface UseAIValidatorOptions {
  /** Domain for the validation (operations, sales, finance, etc.) */
  domain: string;
  /** Debounce delay in ms (default 600ms) */
  debounceMs?: number;
  /** Whether validation is enabled (default true) */
  enabled?: boolean;
  /** API endpoint to call (default: /api/{domain}/ai/validate) */
  endpoint?: string;
}

export interface UseAIValidatorResult {
  /** Active hints (not dismissed) */
  hints: AIHintWithDismissed[];
  /** All hints including dismissed */
  allHints: AIHintWithDismissed[];
  /** Whether validation is in progress */
  loading: boolean;
  /** Last error if any */
  error: string | null;
  /** Dismiss a specific hint */
  dismissHint: (hintId: string) => void;
  /** Dismiss all hints */
  dismissAll: () => void;
  /** Manually trigger a refresh */
  refresh: () => Promise<void>;
}

/* =============================================================================
   UTILITIES
   ============================================================================= */

/**
 * Generate a hash for the context object to use as cache key
 */
function hashContext(context: Record<string, unknown>): string {
  return JSON.stringify(context);
}

/**
 * Get dismissed hints from sessionStorage
 */
function getDismissedHints(domain: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const stored = sessionStorage.getItem(`ai-hints-dismissed-${domain}`);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

/**
 * Save dismissed hints to sessionStorage
 */
function saveDismissedHints(domain: string, dismissed: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      `ai-hints-dismissed-${domain}`,
      JSON.stringify([...dismissed])
    );
  } catch {
    // Silently fail
  }
}

/* =============================================================================
   HOOK
   ============================================================================= */

/**
 * useAIValidator - Generic hook for AI-powered form validation hints
 *
 * This hook observes form context, calls an AI validation endpoint,
 * and returns dismissible hints. Designed to be non-blocking.
 *
 * @example
 * ```tsx
 * const { hints, loading, dismissHint } = useAIValidator(
 *   { vendorId, lines: [{ itemId, quantity, unitCost }] },
 *   { domain: 'operations', debounceMs: 600 }
 * );
 * ```
 */
export function useAIValidator(
  context: Record<string, unknown>,
  options: UseAIValidatorOptions
): UseAIValidatorResult {
  const {
    domain,
    debounceMs = 600,
    enabled = true,
    endpoint,
  } = options;

  const [allHints, setAllHints] = React.useState<AIHintWithDismissed[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = React.useState<Set<string>>(() =>
    getDismissedHints(domain)
  );

  // Cache to avoid redundant API calls
  const cacheRef = React.useRef<Map<string, AIHint[]>>(new Map());
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Compute the API endpoint
  const apiEndpoint = endpoint || `/api/${domain}/ai/validate`;

  // Fetch hints from API
  const fetchHints = React.useCallback(
    async (ctx: Record<string, unknown>): Promise<AIHint[]> => {
      const cacheKey = hashContext(ctx);

      // Check cache
      if (cacheRef.current.has(cacheKey)) {
        return cacheRef.current.get(cacheKey)!;
      }

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      try {
        const res = await fetch(apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ctx),
          signal: abortControllerRef.current.signal,
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`Validation failed: ${res.status}`);
        }

        const data = await res.json();
        const hints: AIHint[] = data.hints || [];

        // Cache the result
        cacheRef.current.set(cacheKey, hints);

        // Limit cache size
        if (cacheRef.current.size > 50) {
          const firstKey = cacheRef.current.keys().next().value;
          if (firstKey) cacheRef.current.delete(firstKey);
        }

        return hints;
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          return [];
        }
        throw err;
      }
    },
    [apiEndpoint]
  );

  // Stable context hash to avoid infinite loops from object reference changes
  const contextHash = React.useMemo(() => hashContext(context), [context]);

  // Debounced validation effect
  React.useEffect(() => {
    if (!enabled) {
      // Only clear if there are hints to clear (avoid infinite loop)
      setAllHints((prev) => (prev.length > 0 ? [] : prev));
      return;
    }

    // Check if context has meaningful data to validate
    const hasData = Object.values(context).some((v) => {
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === "object" && v !== null) return Object.keys(v).length > 0;
      return v !== undefined && v !== null && v !== "";
    });

    if (!hasData) {
      // Only clear if there are hints to clear (avoid infinite loop)
      setAllHints((prev) => (prev.length > 0 ? [] : prev));
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const hints = await fetchHints(context);
        setAllHints(
          hints.map((h) => ({
            ...h,
            dismissed: dismissedIds.has(h.id),
          }))
        );
      } catch (err) {
        // Graceful degradation - show empty hints on error
        setError(err instanceof Error ? err.message : "Validation failed");
        setAllHints((prev) => (prev.length > 0 ? [] : prev));
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextHash, enabled, debounceMs, fetchHints, dismissedIds]);

  // Dismiss a specific hint
  const dismissHint = React.useCallback(
    (hintId: string) => {
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.add(hintId);
        saveDismissedHints(domain, next);
        return next;
      });
      setAllHints((prev) =>
        prev.map((h) => (h.id === hintId ? { ...h, dismissed: true } : h))
      );
    },
    [domain]
  );

  // Dismiss all hints
  const dismissAll = React.useCallback(() => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      allHints.forEach((h) => next.add(h.id));
      saveDismissedHints(domain, next);
      return next;
    });
    setAllHints((prev) => prev.map((h) => ({ ...h, dismissed: true })));
  }, [domain, allHints]);

  // Manual refresh (clears cache for current context)
  const refresh = React.useCallback(async () => {
    const cacheKey = hashContext(context);
    cacheRef.current.delete(cacheKey);

    setLoading(true);
    setError(null);

    try {
      const hints = await fetchHints(context);
      setAllHints(
        hints.map((h) => ({
          ...h,
          dismissed: dismissedIds.has(h.id),
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed");
    } finally {
      setLoading(false);
    }
  }, [context, fetchHints, dismissedIds]);

  // Filter out dismissed hints for the active hints list
  const hints = React.useMemo(
    () => allHints.filter((h) => !h.dismissed),
    [allHints]
  );

  return {
    hints,
    allHints,
    loading,
    error,
    dismissHint,
    dismissAll,
    refresh,
  };
}

export default useAIValidator;
