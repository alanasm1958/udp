/**
 * Authorization helpers
 * RBAC enforcement for API routes
 */

import { NextRequest, NextResponse } from "next/server";

// Role definitions
export const ROLES = {
  ADMIN: "admin",
  FINANCE: "finance",
  INVENTORY: "inventory",
  SALES: "sales",
  PROCUREMENT: "procurement",
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

export interface AuthContext {
  tenantId: string;
  actorId: string;
  userId: string;
  roles: string[];
  email: string;
}

/**
 * Get auth context from request headers (set by middleware)
 */
export function getAuthFromHeaders(req: NextRequest): AuthContext | null {
  const tenantId = req.headers.get("x-tenant-id");
  const actorId = req.headers.get("x-actor-id");
  const userId = req.headers.get("x-user-id");
  const rolesHeader = req.headers.get("x-user-roles");
  const email = req.headers.get("x-user-email");

  if (!tenantId || !actorId || !userId) {
    return null;
  }

  const roles = rolesHeader ? rolesHeader.split(",") : [];

  return {
    tenantId,
    actorId,
    userId,
    roles,
    email: email || "",
  };
}

/**
 * Require authentication - returns 401 if not authenticated
 */
export function requireAuth(req: NextRequest): AuthContext | NextResponse {
  const auth = getAuthFromHeaders(req);

  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  return auth;
}

/**
 * Check if user has any of the required roles
 */
export function hasRole(auth: AuthContext, allowedRoles: string[]): boolean {
  // Admin has access to everything
  if (auth.roles.includes(ROLES.ADMIN)) {
    return true;
  }

  return auth.roles.some((role) => allowedRoles.includes(role));
}

/**
 * Require specific roles - returns 403 if not authorized
 */
export function requireRole(
  req: NextRequest,
  allowedRoles: string[]
): AuthContext | NextResponse {
  const authResult = requireAuth(req);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  if (!hasRole(authResult, allowedRoles)) {
    return NextResponse.json(
      { error: "Forbidden: insufficient permissions" },
      { status: 403 }
    );
  }

  return authResult;
}

/**
 * Create unauthorized response
 */
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * Create forbidden response
 */
export function forbiddenResponse(message = "Forbidden: insufficient permissions"): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}
