import { describe, it, expect } from "vitest";
import { parsePagination, paginatedResponse } from "./pagination";

describe("parsePagination", () => {
  it("returns default values when no params provided", () => {
    const params = new URLSearchParams();
    const result = parsePagination(params);
    expect(result).toEqual({ limit: 50, offset: 0 });
  });

  it("parses valid limit and offset", () => {
    const params = new URLSearchParams({ limit: "20", offset: "10" });
    const result = parsePagination(params);
    expect(result).toEqual({ limit: 20, offset: 10 });
  });

  it("caps limit at 100", () => {
    const params = new URLSearchParams({ limit: "500" });
    const result = parsePagination(params);
    expect(result.limit).toBe(100);
  });

  it("falls back to default when limit is 0 (falsy)", () => {
    const params = new URLSearchParams({ limit: "0" });
    const result = parsePagination(params);
    expect(result.limit).toBe(50); // 0 is falsy, falls back to default 50
  });

  it("enforces minimum offset of 0", () => {
    const params = new URLSearchParams({ offset: "-5" });
    const result = parsePagination(params);
    expect(result.offset).toBe(0);
  });

  it("handles non-numeric values gracefully", () => {
    const params = new URLSearchParams({ limit: "abc", offset: "xyz" });
    const result = parsePagination(params);
    expect(result).toEqual({ limit: 50, offset: 0 });
  });
});

describe("paginatedResponse", () => {
  it("builds response with correct hasMore when more items exist", () => {
    const items = [1, 2, 3];
    const result = paginatedResponse(items, 10, { limit: 3, offset: 0 });
    expect(result).toEqual({
      items: [1, 2, 3],
      total: 10,
      limit: 3,
      offset: 0,
      hasMore: true,
    });
  });

  it("sets hasMore to false when on last page", () => {
    const items = [8, 9, 10];
    const result = paginatedResponse(items, 10, { limit: 5, offset: 7 });
    expect(result.hasMore).toBe(false);
  });

  it("sets hasMore to false when all items fit on one page", () => {
    const items = [1, 2];
    const result = paginatedResponse(items, 2, { limit: 50, offset: 0 });
    expect(result.hasMore).toBe(false);
  });

  it("handles empty items", () => {
    const result = paginatedResponse([], 0, { limit: 50, offset: 0 });
    expect(result).toEqual({
      items: [],
      total: 0,
      limit: 50,
      offset: 0,
      hasMore: false,
    });
  });
});
