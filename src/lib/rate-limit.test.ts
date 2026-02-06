import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  const config = { maxRequests: 3, windowMs: 60_000 };

  beforeEach(() => {
    // Use unique keys per test to avoid shared state
  });

  it("allows first request for a new key", () => {
    const key = `test-${Math.random()}`;
    expect(checkRateLimit(key, config)).toBe(true);
  });

  it("allows requests up to the limit", () => {
    const key = `test-${Math.random()}`;
    expect(checkRateLimit(key, config)).toBe(true);
    expect(checkRateLimit(key, config)).toBe(true);
    expect(checkRateLimit(key, config)).toBe(true);
  });

  it("blocks requests beyond the limit", () => {
    const key = `test-${Math.random()}`;
    // Use all tokens
    checkRateLimit(key, config);
    checkRateLimit(key, config);
    checkRateLimit(key, config);
    // 4th request should be blocked
    expect(checkRateLimit(key, config)).toBe(false);
  });

  it("uses separate buckets for different keys", () => {
    const key1 = `test-a-${Math.random()}`;
    const key2 = `test-b-${Math.random()}`;

    // Exhaust key1
    checkRateLimit(key1, config);
    checkRateLimit(key1, config);
    checkRateLimit(key1, config);
    expect(checkRateLimit(key1, config)).toBe(false);

    // key2 should still be allowed
    expect(checkRateLimit(key2, config)).toBe(true);
  });

  it("respects different configs per call", () => {
    const key = `test-${Math.random()}`;
    const strictConfig = { maxRequests: 1, windowMs: 60_000 };

    expect(checkRateLimit(key, strictConfig)).toBe(true);
    expect(checkRateLimit(key, strictConfig)).toBe(false);
  });
});
