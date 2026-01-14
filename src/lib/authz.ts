/**
 * Authorization helpers
 * RBAC enforcement for API routes with granular permissions
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { roles, rolePermissions, permissions } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

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

// ============================================================================
// GRANULAR PERMISSIONS
// ============================================================================

/**
 * Permission cache to avoid repeated database queries
 * Key: "tenantId:role1,role2" -> { permissions: string[], expiry: number }
 */
const permissionCache = new Map<string, { permissions: string[]; expiry: number }>();
const CACHE_TTL = 60000; // 1 minute

/**
 * Get all permissions for a user's roles in a tenant
 * Admin role returns ["*"] wildcard for implicit access to everything
 */
export async function getUserPermissions(
  tenantId: string,
  userRoleNames: string[]
): Promise<string[]> {
  // Admin has all permissions implicitly
  if (userRoleNames.includes(ROLES.ADMIN)) {
    return ["*"]; // Wildcard for admin
  }

  if (userRoleNames.length === 0) {
    return [];
  }

  // Check cache first
  const cacheKey = `${tenantId}:${userRoleNames.sort().join(",")}`;
  const cached = permissionCache.get(cacheKey);

  if (cached && cached.expiry > Date.now()) {
    return cached.permissions;
  }

  // Get role IDs for the user's roles in this tenant
  const roleRows = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.tenantId, tenantId), inArray(roles.name, userRoleNames)));

  const roleIds = roleRows.map((r) => r.id);

  if (roleIds.length === 0) {
    return [];
  }

  // Get all permissions assigned to these roles
  const permissionRows = await db
    .select({ code: permissions.code })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(
      and(eq(rolePermissions.tenantId, tenantId), inArray(rolePermissions.roleId, roleIds))
    );

  const userPermissions = [...new Set(permissionRows.map((p) => p.code))];

  // Cache the result
  permissionCache.set(cacheKey, {
    permissions: userPermissions,
    expiry: Date.now() + CACHE_TTL,
  });

  return userPermissions;
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(userPermissions: string[], requiredPermission: string): boolean {
  // Admin wildcard grants all permissions
  if (userPermissions.includes("*")) {
    return true;
  }

  return userPermissions.includes(requiredPermission);
}

/**
 * Check if user has ANY of the required permissions
 */
export function hasAnyPermission(
  userPermissions: string[],
  requiredPermissions: string[]
): boolean {
  // Admin wildcard grants all permissions
  if (userPermissions.includes("*")) {
    return true;
  }

  return requiredPermissions.some((p) => userPermissions.includes(p));
}

/**
 * Check if user has ALL of the required permissions
 */
export function hasAllPermissions(
  userPermissions: string[],
  requiredPermissions: string[]
): boolean {
  // Admin wildcard grants all permissions
  if (userPermissions.includes("*")) {
    return true;
  }

  return requiredPermissions.every((p) => userPermissions.includes(p));
}

/**
 * Extended auth context with cached permissions
 */
export interface AuthContextWithPermissions extends AuthContext {
  permissions: string[];
}

/**
 * Require specific permission(s) - returns 403 if not authorized
 * Accepts a single permission string or an array (any of which grants access)
 */
export async function requirePermission(
  req: NextRequest,
  requiredPermissions: string | string[]
): Promise<AuthContextWithPermissions | NextResponse> {
  const authResult = requireAuth(req);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const auth = authResult as AuthContext;
  const permissionsToCheck = Array.isArray(requiredPermissions)
    ? requiredPermissions
    : [requiredPermissions];

  // Get user's permissions
  const userPermissions = await getUserPermissions(auth.tenantId, auth.roles);

  if (!hasAnyPermission(userPermissions, permissionsToCheck)) {
    return NextResponse.json(
      {
        error: "Forbidden: insufficient permissions",
        required: permissionsToCheck,
      },
      { status: 403 }
    );
  }

  return {
    ...auth,
    permissions: userPermissions,
  };
}

/**
 * Clear permission cache for a tenant (call after role permission updates)
 * If no tenantId provided, clears entire cache
 */
export function clearPermissionCache(tenantId?: string): void {
  if (tenantId) {
    // Clear entries for specific tenant
    for (const key of permissionCache.keys()) {
      if (key.startsWith(`${tenantId}:`)) {
        permissionCache.delete(key);
      }
    }
  } else {
    permissionCache.clear();
  }
}
