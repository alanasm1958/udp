/**
 * Session management for token revocation.
 *
 * When a session token is created, a record is stored in the sessions table.
 * Token validity can be revoked by setting revoked_at.
 * This supports user deactivation and role-change invalidation.
 */

import { db } from "@/db";
import { sessions } from "@/db/schema";
import { eq, and, isNull, gt } from "drizzle-orm";

/**
 * Create a hash of the token for storage (not the full token).
 * Uses a simple hash for lookup - the JWT signature provides actual security.
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Record a new session when a token is issued.
 */
export async function createSession(params: {
  tenantId: string;
  userId: string;
  token: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
}): Promise<string> {
  const tokenHash = await hashToken(params.token);

  const [session] = await db
    .insert(sessions)
    .values({
      tenantId: params.tenantId,
      userId: params.userId,
      tokenHash,
      expiresAt: params.expiresAt,
      userAgent: params.userAgent ?? null,
      ipAddress: params.ipAddress ?? null,
    })
    .returning({ id: sessions.id });

  return session.id;
}

/**
 * Check if a session token is still valid (not revoked, not expired).
 */
export async function isSessionValid(token: string): Promise<boolean> {
  const tokenHash = await hashToken(token);

  const [session] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date())
      )
    )
    .limit(1);

  return !!session;
}

/**
 * Revoke a specific session by token.
 */
export async function revokeSession(token: string): Promise<void> {
  const tokenHash = await hashToken(token);

  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.tokenHash, tokenHash));
}

/**
 * Revoke all sessions for a user (e.g., when user is deactivated or password changed).
 */
export async function revokeAllUserSessions(userId: string): Promise<number> {
  const result = await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt)
      )
    )
    .returning({ id: sessions.id });

  return result.length;
}

/**
 * Revoke all sessions for a tenant (e.g., when tenant is suspended).
 */
export async function revokeAllTenantSessions(tenantId: string): Promise<number> {
  const result = await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(sessions.tenantId, tenantId),
        isNull(sessions.revokedAt)
      )
    )
    .returning({ id: sessions.id });

  return result.length;
}
