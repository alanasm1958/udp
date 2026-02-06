/**
 * In-memory rate limiter using sliding window.
 * Suitable for single-instance deployments.
 * For multi-instance, replace with Redis/Upstash.
 */

import { NextResponse } from "next/server";

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(windowMs: number): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, entry] of store) {
    if (now - entry.lastRefill > windowMs * 2) {
      store.delete(key);
    }
  }
}

/**
 * Check rate limit for a given key using token bucket algorithm.
 * Returns true if the request is allowed, false if rate limited.
 */
export function checkRateLimit(key: string, config: RateLimitConfig): boolean {
  const now = Date.now();
  cleanup(config.windowMs);

  const entry = store.get(key);

  if (!entry) {
    store.set(key, { tokens: config.maxRequests - 1, lastRefill: now });
    return true;
  }

  // Refill tokens based on elapsed time
  const elapsed = now - entry.lastRefill;
  const refillRate = config.maxRequests / config.windowMs;
  const newTokens = Math.min(
    config.maxRequests,
    entry.tokens + elapsed * refillRate
  );

  if (newTokens < 1) {
    return false;
  }

  store.set(key, { tokens: newTokens - 1, lastRefill: now });
  return true;
}

/**
 * Rate limit response helper.
 */
export function rateLimitedResponse(): NextResponse {
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: { "Retry-After": "60" },
    }
  );
}

// ============================================================================
// Pre-configured rate limiters for common use cases
// ============================================================================

/** Auth endpoints: 10 attempts per minute per IP */
export const AUTH_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60 * 1000,
};

/** Financial mutations: 30 per minute per tenant */
export const FINANCE_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 30,
  windowMs: 60 * 1000,
};

/** General API: 100 per minute per user */
export const API_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60 * 1000,
};

/**
 * Extract client IP from request for rate limiting.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
