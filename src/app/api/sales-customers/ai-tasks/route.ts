/**
 * /api/sales-customers/ai-tasks
 *
 * AI Sales Tasks endpoint
 * GET: List AI-generated sales tasks
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { aiSalesTasks, aiSalesScanLogs, parties, leads, salesDocs } from "@/db/schema";
import { eq, and, desc, or, isNull, sql } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  TenantError,
} from "@/lib/tenant";

/**
 * GET /api/sales-customers/ai-tasks
 * List AI-generated sales tasks
 * Query params: status, limit, offset
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const url = new URL(req.url);

    const status = url.searchParams.get("status") || "pending";
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    // Build conditions
    const conditions = [eq(aiSalesTasks.tenantId, tenantId)];

    if (status && status !== "all") {
      if (status === "pending") {
        // Include snoozed tasks that are past their snooze time
        conditions.push(
          or(
            eq(aiSalesTasks.status, "pending"),
            and(
              eq(aiSalesTasks.status, "snoozed"),
              or(
                isNull(aiSalesTasks.snoozedUntil),
                sql`${aiSalesTasks.snoozedUntil} <= now()`
              )
            )
          )!
        );
      } else {
        conditions.push(eq(aiSalesTasks.status, status as "pending" | "in_progress" | "completed" | "dismissed" | "snoozed"));
      }
    }

    // Get tasks with related entity names
    const tasks = await db
      .select({
        id: aiSalesTasks.id,
        taskType: aiSalesTasks.taskType,
        priority: aiSalesTasks.priority,
        status: aiSalesTasks.status,
        title: aiSalesTasks.title,
        description: aiSalesTasks.description,
        aiRationale: aiSalesTasks.aiRationale,
        customerId: aiSalesTasks.customerId,
        leadId: aiSalesTasks.leadId,
        salesDocId: aiSalesTasks.salesDocId,
        suggestedActions: aiSalesTasks.suggestedActions,
        potentialValue: aiSalesTasks.potentialValue,
        riskLevel: aiSalesTasks.riskLevel,
        dueDate: aiSalesTasks.dueDate,
        snoozedUntil: aiSalesTasks.snoozedUntil,
        scanScore: aiSalesTasks.scanScore,
        createdAt: aiSalesTasks.createdAt,
        updatedAt: aiSalesTasks.updatedAt,
        // Related entity names
        customerName: parties.name,
        leadName: leads.contactName,
        salesDocNumber: salesDocs.docNumber,
      })
      .from(aiSalesTasks)
      .leftJoin(parties, eq(aiSalesTasks.customerId, parties.id))
      .leftJoin(leads, eq(aiSalesTasks.leadId, leads.id))
      .leftJoin(salesDocs, eq(aiSalesTasks.salesDocId, salesDocs.id))
      .where(and(...conditions))
      .orderBy(
        desc(aiSalesTasks.priority),
        desc(aiSalesTasks.createdAt)
      )
      .limit(limit)
      .offset(offset);

    // Get last scan info
    const [lastScan] = await db
      .select({
        scanId: aiSalesScanLogs.scanId,
        status: aiSalesScanLogs.status,
        completedAt: aiSalesScanLogs.completedAt,
        tasksCreated: aiSalesScanLogs.tasksCreated,
        tasksUpdated: aiSalesScanLogs.tasksUpdated,
      })
      .from(aiSalesScanLogs)
      .where(eq(aiSalesScanLogs.tenantId, tenantId))
      .orderBy(desc(aiSalesScanLogs.startedAt))
      .limit(1);

    return NextResponse.json({
      tasks,
      total: tasks.length,
      lastScan: lastScan || null,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/sales-customers/ai-tasks error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
