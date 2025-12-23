/**
 * Tenant boundary enforcement
 * All API routes must use these helpers to extract and validate tenant context.
 */

import { NextRequest } from "next/server";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class TenantError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = "TenantError";
  }
}

/**
 * Extract and validate tenant ID from request headers.
 * NEVER trust tenant ID from request body.
 */
export function requireTenantIdFromHeaders(req: NextRequest): string {
  const tenantId = req.headers.get("x-tenant-id");

  if (!tenantId) {
    throw new TenantError("Missing required header: x-tenant-id", 400);
  }

  if (!UUID_REGEX.test(tenantId)) {
    throw new TenantError("Invalid x-tenant-id format: must be a valid UUID", 400);
  }

  return tenantId.toLowerCase();
}

/**
 * Validate that a string is a valid UUID format.
 */
export function isValidUUID(value: string | null | undefined): value is string {
  if (!value) return false;
  return UUID_REGEX.test(value);
}

/**
 * Extract optional user ID from headers.
 */
export function getUserIdFromHeaders(req: NextRequest): string | null {
  const userId = req.headers.get("x-user-id");
  if (!userId) return null;
  if (!UUID_REGEX.test(userId)) {
    throw new TenantError("Invalid x-user-id format: must be a valid UUID", 400);
  }
  return userId.toLowerCase();
}

/**
 * Extract optional actor ID from headers.
 */
export function getActorIdFromHeaders(req: NextRequest): string | null {
  const actorId = req.headers.get("x-actor-id");
  if (!actorId) return null;
  if (!UUID_REGEX.test(actorId)) {
    throw new TenantError("Invalid x-actor-id format: must be a valid UUID", 400);
  }
  return actorId.toLowerCase();
}
