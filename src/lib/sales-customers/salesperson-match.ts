/**
 * Salesperson-User Match Detection Service
 *
 * AI-powered detection of potential matches between salespersons and platform users
 * based on email, phone, or name similarity.
 *
 * Creates confirmation tasks for manual review - never auto-links.
 */

import { db } from "@/db";
import { users, salespersons, tasks } from "@/db/schema";
import { eq, and, or, ilike, sql } from "drizzle-orm";

const TASK_TITLE_PREFIX = "AI Match:";

interface MatchResult {
  userId: string;
  userEmail: string;
  userName?: string;
  matchType: "email" | "name";
  confidence: "high" | "medium";
}

/**
 * Find potential user matches for a salesperson
 */
export async function findUserMatches(
  tenantId: string,
  salesperson: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    linkedUserId: string | null;
  }
): Promise<MatchResult[]> {
  // Skip if already linked
  if (salesperson.linkedUserId) {
    return [];
  }

  const matches: MatchResult[] = [];

  // Get all users in tenant (users table doesn't have phone column)
  const tenantUsers = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
    })
    .from(users)
    .where(eq(users.tenantId, tenantId));

  // Check for already-linked users (exclude from matches)
  const linkedUserIds = new Set(
    (
      await db
        .select({ linkedUserId: salespersons.linkedUserId })
        .from(salespersons)
        .where(
          and(
            eq(salespersons.tenantId, tenantId),
            sql`${salespersons.linkedUserId} IS NOT NULL`
          )
        )
    ).map((s) => s.linkedUserId)
  );

  for (const user of tenantUsers) {
    // Skip already-linked users
    if (linkedUserIds.has(user.id)) {
      continue;
    }

    // Email match (high confidence)
    if (salesperson.email && user.email) {
      const spEmail = salesperson.email.toLowerCase().trim();
      const uEmail = user.email.toLowerCase().trim();
      if (spEmail === uEmail) {
        matches.push({
          userId: user.id,
          userEmail: user.email,
          userName: user.fullName || undefined,
          matchType: "email",
          confidence: "high",
        });
        continue; // Don't add duplicate matches for same user
      }
    }

    // Name match (medium confidence - fuzzy)
    if (user.fullName) {
      const nameSimilarity = calculateNameSimilarity(salesperson.name, user.fullName);
      if (nameSimilarity >= 0.8) {
        matches.push({
          userId: user.id,
          userEmail: user.email,
          userName: user.fullName,
          matchType: "name",
          confidence: "medium",
        });
      }
    }
  }

  return matches;
}

/**
 * Calculate name similarity (simple Jaccard-like similarity)
 */
function calculateNameSimilarity(name1: string, name2: string): number {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 1);

  const words1 = new Set(normalize(name1));
  const words2 = new Set(normalize(name2));

  if (words1.size === 0 || words2.size === 0) {
    return 0;
  }

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Check if a match task already exists for this salesperson-user pair
 */
export async function hasExistingMatchTask(
  tenantId: string,
  salespersonId: string,
  userId: string
): Promise<boolean> {
  const existing = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        eq(tasks.tenantId, tenantId),
        eq(tasks.relatedEntityType, "salesperson"),
        eq(tasks.relatedEntityId, salespersonId),
        sql`${tasks.title} LIKE ${TASK_TITLE_PREFIX + "%"}`,
        sql`${tasks.description} LIKE ${"%" + userId + "%"}`
      )
    )
    .limit(1);

  return existing.length > 0;
}

/**
 * Create an AI match suggestion task
 */
export async function createMatchTask(
  tenantId: string,
  actorId: string,
  salesperson: { id: string; name: string },
  match: MatchResult
): Promise<string | null> {
  // Check if task already exists
  const exists = await hasExistingMatchTask(tenantId, salesperson.id, match.userId);
  if (exists) {
    return null;
  }

  const matchDescription =
    match.matchType === "email"
      ? "matching email address"
      : "similar name";

  const [task] = await db
    .insert(tasks)
    .values({
      tenantId,
      title: `${TASK_TITLE_PREFIX} ${salesperson.name}`,
      description: `Salesperson "${salesperson.name}" may be the same person as platform user "${match.userName || match.userEmail}" (${matchDescription}, ${match.confidence} confidence). User ID: ${match.userId}. Review and link if appropriate.`,
      status: "open",
      priority: match.confidence === "high" ? "high" : "normal",
      relatedEntityType: "salesperson",
      relatedEntityId: salesperson.id,
      createdByActorId: actorId,
    })
    .returning();

  return task?.id || null;
}

/**
 * Main function: Check salesperson and create match tasks if potential matches found
 */
export async function checkAndCreateMatchTasks(
  tenantId: string,
  actorId: string,
  salesperson: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    linkedUserId: string | null;
  }
): Promise<{ created: number; matches: MatchResult[] }> {
  // Skip if already linked
  if (salesperson.linkedUserId) {
    return { created: 0, matches: [] };
  }

  const matches = await findUserMatches(tenantId, salesperson);

  let created = 0;
  for (const match of matches) {
    const taskId = await createMatchTask(tenantId, actorId, salesperson, match);
    if (taskId) {
      created++;
    }
  }

  return { created, matches };
}

/**
 * Resolve (complete) all match tasks for a salesperson when manually linked
 * This is called from the salesperson update endpoint
 */
export async function resolveMatchTasks(
  tenantId: string,
  salespersonId: string
): Promise<number> {
  const result = await db
    .update(tasks)
    .set({
      status: "completed",
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(tasks.tenantId, tenantId),
        eq(tasks.relatedEntityType, "salesperson"),
        eq(tasks.relatedEntityId, salespersonId),
        sql`${tasks.title} LIKE ${TASK_TITLE_PREFIX + "%"}`,
        eq(tasks.status, "open")
      )
    )
    .returning({ id: tasks.id });

  return result.length;
}
