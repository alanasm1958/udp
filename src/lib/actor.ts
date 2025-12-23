/**
 * Actor resolution and attribution
 * Resolves the actor performing an action based on request context.
 */

import { db } from "@/db";
import { actors, users, userRoles, roles } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export interface ResolvedActor {
  actorId: string;
  type: "user" | "system" | "connector";
  userId: string | null;
}

/**
 * Resolve actor for the current request.
 * Priority:
 * 1. If x-actor-id header provided, verify it belongs to tenant and use it
 * 2. If x-user-id header provided, find or create user actor
 * 3. Otherwise, find or create system actor for the tenant
 */
export async function resolveActor(
  tenantId: string,
  actorIdFromHeader: string | null,
  userIdFromHeader: string | null
): Promise<ResolvedActor> {
  // 1. If actor ID provided directly, verify and use it
  if (actorIdFromHeader) {
    const existingActor = await db
      .select()
      .from(actors)
      .where(and(eq(actors.id, actorIdFromHeader), eq(actors.tenantId, tenantId)))
      .limit(1);

    if (existingActor.length === 0) {
      throw new Error(`Actor ${actorIdFromHeader} not found in tenant ${tenantId}`);
    }

    return {
      actorId: existingActor[0].id,
      type: existingActor[0].type,
      userId: existingActor[0].userId,
    };
  }

  // 2. If user ID provided, find or create user actor
  if (userIdFromHeader) {
    // Verify user exists in tenant
    const existingUser = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userIdFromHeader), eq(users.tenantId, tenantId)))
      .limit(1);

    if (existingUser.length === 0) {
      throw new Error(`User ${userIdFromHeader} not found in tenant ${tenantId}`);
    }

    // Find existing actor for this user
    const existingActor = await db
      .select()
      .from(actors)
      .where(
        and(
          eq(actors.tenantId, tenantId),
          eq(actors.type, "user"),
          eq(actors.userId, userIdFromHeader)
        )
      )
      .limit(1);

    if (existingActor.length > 0) {
      return {
        actorId: existingActor[0].id,
        type: "user",
        userId: userIdFromHeader,
      };
    }

    // Create new actor for this user
    const newActor = await db
      .insert(actors)
      .values({
        tenantId,
        type: "user",
        userId: userIdFromHeader,
      })
      .returning();

    return {
      actorId: newActor[0].id,
      type: "user",
      userId: userIdFromHeader,
    };
  }

  // 3. Fall back to system actor
  return getOrCreateSystemActor(tenantId);
}

/**
 * Get or create the system actor for a tenant.
 */
export async function getOrCreateSystemActor(tenantId: string): Promise<ResolvedActor> {
  const systemName = "udp-system";

  // Find existing system actor
  const existingActor = await db
    .select()
    .from(actors)
    .where(
      and(
        eq(actors.tenantId, tenantId),
        eq(actors.type, "system"),
        eq(actors.systemName, systemName)
      )
    )
    .limit(1);

  if (existingActor.length > 0) {
    return {
      actorId: existingActor[0].id,
      type: "system",
      userId: null,
    };
  }

  // Create system actor
  const newActor = await db
    .insert(actors)
    .values({
      tenantId,
      type: "system",
      systemName,
    })
    .returning();

  return {
    actorId: newActor[0].id,
    type: "system",
    userId: null,
  };
}

/**
 * Check if a user has a specific role within their tenant.
 */
export async function userHasRole(
  tenantId: string,
  userId: string,
  roleName: string
): Promise<boolean> {
  const result = await db
    .select({ roleId: roles.id })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(
      and(
        eq(userRoles.tenantId, tenantId),
        eq(userRoles.userId, userId),
        eq(roles.tenantId, tenantId),
        eq(roles.name, roleName)
      )
    )
    .limit(1);

  return result.length > 0;
}

/**
 * Check if user is a Tenant Admin.
 */
export async function isTenantAdmin(tenantId: string, userId: string): Promise<boolean> {
  return userHasRole(tenantId, userId, "Tenant Admin");
}
