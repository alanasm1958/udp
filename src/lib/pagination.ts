/**
 * Pagination helper for consistent API responses.
 * All list endpoints should use this for uniform pagination metadata.
 */

import { SQL, sql } from "drizzle-orm";
import { PgSelect } from "drizzle-orm/pg-core";
import { db } from "@/db";

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Parse pagination params from URL search params with defaults and bounds.
 */
export function parsePagination(searchParams: URLSearchParams): PaginationParams {
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") || "50", 10) || 50, 1),
    100
  );
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);
  return { limit, offset };
}

/**
 * Build a paginated response object from items and a total count.
 */
export function paginatedResponse<T>(
  items: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  return {
    items,
    total,
    limit: params.limit,
    offset: params.offset,
    hasMore: params.offset + items.length < total,
  };
}

/**
 * Execute a count query using the same conditions as the main query.
 * Pass the table and where conditions.
 */
export async function countRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any,
  whereCondition?: SQL
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = db.select({ count: sql<number>`count(*)::int` }).from(table);
  if (whereCondition) {
    query = query.where(whereCondition);
  }
  const [result] = await query;
  return (result as { count: number }).count;
}
