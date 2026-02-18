/**
 * /api/cron/ai-sales-scan
 *
 * Cron job endpoint for daily AI sales scan
 * Runs at 8 AM local time to analyze sales data and generate tasks
 *
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/ai-sales-scan",
 *     "schedule": "0 8 * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  tenants,
  aiSalesTasks,
  aiSalesScanLogs,
  parties,
  leads,
  salesDocs,
  customerHealthScores,
} from "@/db/schema";
import { eq, and, lt, or, isNull, sql, desc } from "drizzle-orm";

// Verify this is a legitimate cron request
const CRON_SECRET = process.env.CRON_SECRET;

interface AITaskSuggestion {
  taskType: string;
  priority: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  aiRationale: string;
  entityType: "customer" | "lead" | "quote" | "invoice";
  entityId: string;
  entityName: string;
  suggestedActions: Array<{
    action: string;
    type: "call" | "email" | "meeting" | "quote" | "reminder" | "other";
  }>;
  potentialValue?: number;
  riskLevel?: "low" | "medium" | "high" | "critical";
  dueDate?: string;
  confidence: number;
}

/**
 * GET /api/cron/ai-sales-scan
 * Run scheduled AI sales scan for all tenants
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // Require explicit secret in production and verify bearer token.
    if (process.env.NODE_ENV === "production" && !CRON_SECRET) {
      return NextResponse.json(
        { error: "Cron secret is not configured" },
        { status: 500 }
      );
    }

    if (CRON_SECRET) {
      const authHeader = req.headers.get("authorization");
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Get all active tenants
    const activeTenants = await db
      .select({ id: tenants.id, name: tenants.name })
      .from(tenants)
      .where(eq(tenants.status, "active"))
      .limit(100);

    const results: Array<{
      tenantId: string;
      tenantName: string;
      success: boolean;
      tasksCreated: number;
      tasksUpdated: number;
      error?: string;
    }> = [];

    for (const tenant of activeTenants) {
      try {
        const scanResult = await runScanForTenant(tenant.id);
        results.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          success: true,
          ...scanResult,
        });
      } catch (error) {
        results.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          success: false,
          tasksCreated: 0,
          tasksUpdated: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const totalCreated = results.reduce((sum, r) => sum + r.tasksCreated, 0);
    const totalUpdated = results.reduce((sum, r) => sum + r.tasksUpdated, 0);
    const successCount = results.filter((r) => r.success).length;

    console.log(`AI Sales Scan completed: ${successCount}/${activeTenants.length} tenants, ${totalCreated} tasks created, ${totalUpdated} tasks updated`);

    return NextResponse.json({
      success: true,
      tenantsProcessed: activeTenants.length,
      tenantsSuccessful: successCount,
      totalTasksCreated: totalCreated,
      totalTasksUpdated: totalUpdated,
      results,
    });
  } catch (error) {
    console.error("GET /api/cron/ai-sales-scan error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Run AI sales scan for a single tenant
 */
async function runScanForTenant(tenantId: string): Promise<{
  tasksCreated: number;
  tasksUpdated: number;
}> {
  const scanId = crypto.randomUUID();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Create scan log
  await db.insert(aiSalesScanLogs).values({
    tenantId,
    scanId,
    triggerType: "scheduled",
    status: "running",
    entitiesScanned: { customers: 0, leads: 0, quotes: 0, invoices: 0 },
  });

  try {
    // Get leads needing follow-up
    const leadsNeedingAttention = await db
      .select({
        id: leads.id,
        contactName: leads.contactName,
        company: leads.company,
        status: leads.status,
        estimatedValue: leads.estimatedValue,
        lastActivityDate: leads.lastActivityDate,
      })
      .from(leads)
      .where(
        and(
          eq(leads.tenantId, tenantId),
          or(
            eq(leads.status, "new"),
            eq(leads.status, "contacted"),
            eq(leads.status, "qualified")
          ),
          or(
            isNull(leads.lastActivityDate),
            lt(leads.lastActivityDate, sevenDaysAgo)
          )
        )
      )
      .orderBy(desc(leads.estimatedValue))
      .limit(10);

    // Get quotes needing follow-up
    const quotesNeedingAttention = await db
      .select({
        id: salesDocs.id,
        docNumber: salesDocs.docNumber,
        totalAmount: salesDocs.totalAmount,
        sentAt: salesDocs.sentAt,
        partyId: salesDocs.partyId,
        partyName: parties.name,
      })
      .from(salesDocs)
      .leftJoin(parties, eq(salesDocs.partyId, parties.id))
      .where(
        and(
          eq(salesDocs.tenantId, tenantId),
          eq(salesDocs.docType, "quote"),
          eq(salesDocs.status, "sent"),
          lt(salesDocs.sentAt, sevenDaysAgo)
        )
      )
      .orderBy(desc(salesDocs.totalAmount))
      .limit(10);

    // Get overdue invoices
    const overdueInvoices = await db
      .select({
        id: salesDocs.id,
        docNumber: salesDocs.docNumber,
        totalAmount: salesDocs.totalAmount,
        dueDate: salesDocs.dueDate,
        partyId: salesDocs.partyId,
        partyName: parties.name,
        reminderCount: salesDocs.reminderCount,
      })
      .from(salesDocs)
      .leftJoin(parties, eq(salesDocs.partyId, parties.id))
      .where(
        and(
          eq(salesDocs.tenantId, tenantId),
          eq(salesDocs.docType, "invoice"),
          eq(salesDocs.status, "sent"),
          lt(salesDocs.dueDate, now.toISOString().split("T")[0])
        )
      )
      .orderBy(desc(salesDocs.totalAmount))
      .limit(10);

    // Get at-risk customers
    const atRiskCustomers = await db
      .select({
        customerId: customerHealthScores.customerId,
        customerName: parties.name,
        overallScore: customerHealthScores.overallScore,
        trend: customerHealthScores.trend,
        riskLevel: customerHealthScores.riskLevelValue,
        riskFactors: customerHealthScores.riskFactors,
        daysSinceLastOrder: customerHealthScores.daysSinceLastOrder,
        totalRevenue: customerHealthScores.totalRevenue,
      })
      .from(customerHealthScores)
      .leftJoin(parties, eq(customerHealthScores.customerId, parties.id))
      .where(
        and(
          eq(customerHealthScores.tenantId, tenantId),
          or(
            eq(customerHealthScores.riskLevelValue, "high"),
            eq(customerHealthScores.riskLevelValue, "critical"),
            eq(customerHealthScores.trend, "declining")
          )
        )
      )
      .orderBy(customerHealthScores.overallScore)
      .limit(10);

    // Get dormant customers
    const dormantCustomers = await db
      .select({
        customerId: customerHealthScores.customerId,
        customerName: parties.name,
        totalOrders: customerHealthScores.totalOrders,
        totalRevenue: customerHealthScores.totalRevenue,
        daysSinceLastOrder: customerHealthScores.daysSinceLastOrder,
        averageOrderValue: customerHealthScores.averageOrderValue,
      })
      .from(customerHealthScores)
      .leftJoin(parties, eq(customerHealthScores.customerId, parties.id))
      .where(
        and(
          eq(customerHealthScores.tenantId, tenantId),
          sql`${customerHealthScores.totalOrders} > 0`,
          sql`${customerHealthScores.daysSinceLastOrder} > 90`
        )
      )
      .orderBy(desc(customerHealthScores.totalRevenue))
      .limit(5);

    // Generate tasks using rule-based logic (simplified for cron)
    const tasks = generateRuleBasedTasks(
      leadsNeedingAttention,
      quotesNeedingAttention,
      overdueInvoices,
      atRiskCustomers,
      dormantCustomers
    );

    let tasksCreated = 0;
    let tasksUpdated = 0;

    // Create or update tasks
    for (const task of tasks) {
      let customerId: string | null = null;
      let leadId: string | null = null;
      let salesDocId: string | null = null;

      if (task.entityType === "customer") {
        customerId = task.entityId;
      } else if (task.entityType === "lead") {
        leadId = task.entityId;
      } else if (task.entityType === "quote" || task.entityType === "invoice") {
        salesDocId = task.entityId;
      }

      // Check for existing task
      const [existingTask] = await db
        .select({ id: aiSalesTasks.id })
        .from(aiSalesTasks)
        .where(
          and(
            eq(aiSalesTasks.tenantId, tenantId),
            eq(aiSalesTasks.taskType, task.taskType as "follow_up_lead" | "follow_up_quote" | "follow_up_customer" | "payment_reminder" | "at_risk_customer" | "hot_lead" | "quote_expiring" | "reactivate_customer" | "upsell_opportunity" | "churn_prevention"),
            customerId ? eq(aiSalesTasks.customerId, customerId) : isNull(aiSalesTasks.customerId),
            leadId ? eq(aiSalesTasks.leadId, leadId) : isNull(aiSalesTasks.leadId),
            salesDocId ? eq(aiSalesTasks.salesDocId, salesDocId) : isNull(aiSalesTasks.salesDocId),
            or(eq(aiSalesTasks.status, "pending"), eq(aiSalesTasks.status, "snoozed"))
          )
        );

      if (existingTask) {
        await db
          .update(aiSalesTasks)
          .set({
            priority: task.priority,
            description: task.description,
            aiRationale: task.aiRationale,
            scanScore: task.confidence,
            lastScanId: scanId,
            updatedAt: now,
          })
          .where(eq(aiSalesTasks.id, existingTask.id));
        tasksUpdated++;
      } else {
        await db.insert(aiSalesTasks).values({
          tenantId,
          taskType: task.taskType as "follow_up_lead" | "follow_up_quote" | "follow_up_customer" | "payment_reminder" | "at_risk_customer" | "hot_lead" | "quote_expiring" | "reactivate_customer" | "upsell_opportunity" | "churn_prevention",
          priority: task.priority,
          status: "pending",
          title: task.title,
          description: task.description,
          aiRationale: task.aiRationale,
          customerId,
          leadId,
          salesDocId,
          suggestedActions: task.suggestedActions,
          potentialValue: task.potentialValue?.toString(),
          riskLevel: task.riskLevel,
          scanScore: task.confidence,
          lastScanId: scanId,
        });
        tasksCreated++;
      }
    }

    // Update scan log
    await db
      .update(aiSalesScanLogs)
      .set({
        status: "completed",
        tasksCreated,
        tasksUpdated,
        entitiesScanned: {
          customers: atRiskCustomers.length + dormantCustomers.length,
          leads: leadsNeedingAttention.length,
          quotes: quotesNeedingAttention.length,
          invoices: overdueInvoices.length,
        },
        completedAt: now,
      })
      .where(eq(aiSalesScanLogs.scanId, scanId));

    return { tasksCreated, tasksUpdated };
  } catch (error) {
    // Update scan log with error
    await db
      .update(aiSalesScanLogs)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        completedAt: new Date(),
      })
      .where(eq(aiSalesScanLogs.scanId, scanId));
    throw error;
  }
}

/**
 * Generate rule-based tasks
 */
function generateRuleBasedTasks(
  leadsData: Array<{
    id: string;
    contactName: string;
    company: string | null;
    status: string | null;
    estimatedValue: string | null;
    lastActivityDate: Date | null;
  }>,
  quotes: Array<{
    id: string;
    docNumber: string;
    totalAmount: string | null;
    sentAt: Date | null;
    partyId: string | null;
    partyName: string | null;
  }>,
  invoices: Array<{
    id: string;
    docNumber: string;
    totalAmount: string | null;
    dueDate: string | null;
    partyId: string | null;
    partyName: string | null;
    reminderCount: number | null;
  }>,
  atRiskCustomers: Array<{
    customerId: string;
    customerName: string | null;
    overallScore: number | null;
    trend: string | null;
    riskLevel: string | null;
    riskFactors: unknown;
    daysSinceLastOrder: number | null;
    totalRevenue: string | null;
  }>,
  dormantCustomers: Array<{
    customerId: string;
    customerName: string | null;
    totalOrders: number | null;
    totalRevenue: string | null;
    daysSinceLastOrder: number | null;
    averageOrderValue: string | null;
  }>
): AITaskSuggestion[] {
  const tasks: AITaskSuggestion[] = [];
  const now = new Date();

  // Lead follow-ups
  for (const lead of leadsData) {
    const daysSinceActivity = lead.lastActivityDate
      ? Math.floor((now.getTime() - new Date(lead.lastActivityDate).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    const estimatedValue = parseFloat(lead.estimatedValue || "0");
    const priority = estimatedValue > 50000 || daysSinceActivity > 14 ? "high" : "medium";

    tasks.push({
      taskType: daysSinceActivity > 14 ? "hot_lead" : "follow_up_lead",
      priority: priority as "low" | "medium" | "high" | "critical",
      title: `Follow up with ${lead.contactName || lead.company || "Lead"}`,
      description: `Lead hasn't been contacted in ${daysSinceActivity} days.`,
      aiRationale: estimatedValue > 0 ? `Estimated value of $${estimatedValue.toLocaleString()}` : "Regular follow-up needed",
      entityType: "lead",
      entityId: lead.id,
      entityName: lead.contactName || lead.company || "Unknown",
      suggestedActions: [
        { action: "Call to check status", type: "call" },
        { action: "Send follow-up email", type: "email" },
      ],
      potentialValue: estimatedValue || undefined,
      confidence: 75,
    });
  }

  // Quote follow-ups
  for (const quote of quotes) {
    const amount = parseFloat(quote.totalAmount || "0");

    tasks.push({
      taskType: "follow_up_quote",
      priority: amount > 10000 ? "high" : "medium",
      title: `Follow up on quote ${quote.docNumber}`,
      description: `Quote for ${quote.partyName} worth $${amount.toLocaleString()} pending response.`,
      aiRationale: "Quote pending for 7+ days",
      entityType: "quote",
      entityId: quote.id,
      entityName: quote.docNumber,
      suggestedActions: [
        { action: "Call to discuss", type: "call" },
        { action: "Send reminder", type: "email" },
      ],
      potentialValue: amount || undefined,
      confidence: 80,
    });
  }

  // Payment reminders
  for (const invoice of invoices) {
    const amount = parseFloat(invoice.totalAmount || "0");
    const daysOverdue = invoice.dueDate
      ? Math.floor((now.getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    tasks.push({
      taskType: "payment_reminder",
      priority: daysOverdue > 30 || amount > 5000 ? "critical" : "high",
      title: `Payment reminder for ${invoice.partyName}`,
      description: `Invoice ${invoice.docNumber} for $${amount.toLocaleString()} is ${daysOverdue} days overdue.`,
      aiRationale: `${daysOverdue} days past due`,
      entityType: "invoice",
      entityId: invoice.id,
      entityName: invoice.docNumber,
      suggestedActions: [
        { action: "Send reminder", type: "reminder" },
        { action: "Call accounts", type: "call" },
      ],
      potentialValue: amount,
      riskLevel: daysOverdue > 60 ? "high" : "medium",
      confidence: 90,
    });
  }

  // At-risk customers
  for (const customer of atRiskCustomers) {
    const revenue = parseFloat(customer.totalRevenue || "0");

    tasks.push({
      taskType: "at_risk_customer",
      priority: customer.riskLevel === "critical" ? "critical" : "high",
      title: `At-risk: ${customer.customerName} needs attention`,
      description: `Health score: ${customer.overallScore}/100. Last order: ${customer.daysSinceLastOrder} days ago.`,
      aiRationale: `${customer.riskLevel} risk with ${customer.trend} trend`,
      entityType: "customer",
      entityId: customer.customerId,
      entityName: customer.customerName || "Unknown",
      suggestedActions: [
        { action: "Schedule check-in", type: "call" },
        { action: "Offer promotion", type: "email" },
      ],
      potentialValue: revenue,
      riskLevel: customer.riskLevel as "low" | "medium" | "high" | "critical" || "medium",
      confidence: 85,
    });
  }

  // Dormant customers
  for (const customer of dormantCustomers) {
    const revenue = parseFloat(customer.totalRevenue || "0");

    tasks.push({
      taskType: "reactivate_customer",
      priority: revenue > 20000 ? "medium" : "low",
      title: `Reactivate ${customer.customerName}`,
      description: `Former customer with ${customer.totalOrders} orders. Inactive ${customer.daysSinceLastOrder} days.`,
      aiRationale: `$${revenue.toLocaleString()} lifetime value`,
      entityType: "customer",
      entityId: customer.customerId,
      entityName: customer.customerName || "Unknown",
      suggestedActions: [
        { action: "Win-back email", type: "email" },
        { action: "Check-in call", type: "call" },
      ],
      potentialValue: parseFloat(customer.averageOrderValue || "0"),
      confidence: 60,
    });
  }

  return tasks;
}
