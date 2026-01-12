/**
 * Lead Promotion Service
 *
 * Checks if a customer qualifies for lead promotion based on:
 * - >=3 orders (posted invoices)
 * - OR >=$5,000 lifetime spend
 *
 * Creates a single promotion task per customer (idempotent).
 */

import { db } from "@/db";
import { salesDocs, tasks, parties } from "@/db/schema";
import { eq, and, sql, count } from "drizzle-orm";

const ORDER_COUNT_THRESHOLD = 3;
const SPEND_THRESHOLD = 5000;
const TASK_TITLE_PREFIX = "Lead Promotion:";

interface CustomerStats {
    orderCount: number;
    totalSpend: number;
}

/**
 * Get customer order statistics
 */
export async function getCustomerStats(
    tenantId: string,
    partyId: string
): Promise<CustomerStats> {
    const result = await db
        .select({
            orderCount: count(salesDocs.id),
            totalSpend: sql<string>`COALESCE(SUM(${salesDocs.totalAmount}::numeric), 0)`,
        })
        .from(salesDocs)
        .where(
            and(
                eq(salesDocs.tenantId, tenantId),
                eq(salesDocs.partyId, partyId),
                eq(salesDocs.docType, "invoice"),
                eq(salesDocs.status, "posted")
            )
        );

    return {
        orderCount: result[0]?.orderCount || 0,
        totalSpend: parseFloat(result[0]?.totalSpend || "0"),
    };
}

/**
 * Check if a lead promotion task already exists for this customer
 */
export async function hasExistingPromotionTask(
    tenantId: string,
    partyId: string
): Promise<boolean> {
    const existing = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(
            and(
                eq(tasks.tenantId, tenantId),
                eq(tasks.relatedEntityType, "party"),
                eq(tasks.relatedEntityId, partyId),
                sql`${tasks.title} LIKE ${TASK_TITLE_PREFIX + "%"}`
            )
        )
        .limit(1);

    return existing.length > 0;
}

/**
 * Create a lead promotion task for a customer
 */
export async function createPromotionTask(
    tenantId: string,
    partyId: string,
    actorId: string,
    stats: CustomerStats
): Promise<string | null> {
    // Get customer name for task title
    const [customer] = await db
        .select({ name: parties.name, code: parties.code })
        .from(parties)
        .where(and(eq(parties.tenantId, tenantId), eq(parties.id, partyId)))
        .limit(1);

    if (!customer) return null;

    const qualifyReason =
        stats.orderCount >= ORDER_COUNT_THRESHOLD && stats.totalSpend >= SPEND_THRESHOLD
            ? `${stats.orderCount} orders and $${stats.totalSpend.toLocaleString()} lifetime spend`
            : stats.orderCount >= ORDER_COUNT_THRESHOLD
            ? `${stats.orderCount} orders`
            : `$${stats.totalSpend.toLocaleString()} lifetime spend`;

    const [task] = await db
        .insert(tasks)
        .values({
            tenantId,
            title: `${TASK_TITLE_PREFIX} ${customer.name}`,
            description: `Customer "${customer.name}" (${customer.code}) has reached ${qualifyReason}. Consider promoting to a prioritized customer segment or creating a dedicated lead for follow-up.`,
            status: "open",
            priority: "normal",
            relatedEntityType: "party",
            relatedEntityId: partyId,
            createdByActorId: actorId,
        })
        .returning();

    return task?.id || null;
}

/**
 * Main function: Check customer and create promotion task if qualified
 * Returns true if a new task was created
 */
export async function checkAndCreatePromotionTask(
    tenantId: string,
    partyId: string,
    actorId: string
): Promise<{ created: boolean; taskId?: string; reason?: string }> {
    // Skip if Walk-in customer
    const [party] = await db
        .select({ code: parties.code })
        .from(parties)
        .where(and(eq(parties.tenantId, tenantId), eq(parties.id, partyId)))
        .limit(1);

    if (!party || party.code === "WALKIN") {
        return { created: false, reason: "walkin_customer" };
    }

    // Check if task already exists
    const hasTask = await hasExistingPromotionTask(tenantId, partyId);
    if (hasTask) {
        return { created: false, reason: "task_exists" };
    }

    // Get customer stats
    const stats = await getCustomerStats(tenantId, partyId);

    // Check thresholds
    const qualifies = stats.orderCount >= ORDER_COUNT_THRESHOLD || stats.totalSpend >= SPEND_THRESHOLD;
    if (!qualifies) {
        return { created: false, reason: "threshold_not_met" };
    }

    // Create task
    const taskId = await createPromotionTask(tenantId, partyId, actorId, stats);
    if (taskId) {
        return { created: true, taskId };
    }

    return { created: false, reason: "creation_failed" };
}
