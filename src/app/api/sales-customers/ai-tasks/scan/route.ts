/**
 * /api/sales-customers/ai-tasks/scan
 *
 * AI Sales Scan endpoint
 * POST: Run AI analysis on sales data to generate tasks
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  aiSalesTasks,
  aiSalesScanLogs,
  parties,
  leads,
  salesDocs,
  customerHealthScores,
} from "@/db/schema";
import { eq, and, desc, lt, or, isNull, sql } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { canUseAI } from "@/lib/entitlements";
import { getAIProvider } from "@/lib/ai/provider";

interface ScanRequest {
  triggerType?: "scheduled" | "manual" | "webhook";
}

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

const SCAN_SYSTEM_PROMPT = `You are a sales intelligence AI assistant. Your role is to analyze sales data and identify opportunities for follow-up actions that will help increase revenue and prevent customer churn.

Analyze the provided sales data and identify tasks that need attention. For each identified issue, provide a task recommendation.

TASK TYPES YOU CAN RECOMMEND:
- follow_up_lead: Lead hasn't been contacted in X days
- follow_up_quote: Quote sent but no response
- follow_up_customer: Customer hasn't ordered in X days
- payment_reminder: Invoice overdue
- at_risk_customer: Customer health score declining
- hot_lead: High-value lead needs immediate attention
- quote_expiring: Quote about to expire
- reactivate_customer: Dormant customer with past orders
- upsell_opportunity: Customer might benefit from additional products
- churn_prevention: Customer showing signs of leaving

PRIORITY LEVELS:
- critical: Immediate action required (overdue payments, expiring quotes, high-value at-risk customers)
- high: Action needed within 24-48 hours (hot leads, declining health scores)
- medium: Action needed within a week (follow-ups, reactivation)
- low: Action can be scheduled (upsell opportunities, general follow-ups)

For each task, provide:
1. A clear, actionable title
2. Specific description of the issue
3. Your rationale for why this needs attention
4. 1-3 suggested actions (call, email, meeting, quote, reminder)
5. Estimated potential value if applicable
6. A confidence score (0-100) for how certain you are this task is important

Your response MUST be valid JSON array of task objects matching this structure:
[
  {
    "taskType": "follow_up_lead",
    "priority": "high",
    "title": "Follow up with ABC Corp - Hot Lead",
    "description": "Lead ABC Corp expressed interest 7 days ago but hasn't been contacted since.",
    "aiRationale": "High budget ($50K) and clear timeline suggests strong buying intent. Delay risks losing to competitor.",
    "entityType": "lead",
    "entityId": "uuid-here",
    "entityName": "ABC Corp",
    "suggestedActions": [
      {"action": "Call to discuss requirements", "type": "call"},
      {"action": "Send personalized email with case studies", "type": "email"}
    ],
    "potentialValue": 50000,
    "riskLevel": "high",
    "dueDate": "2024-01-20",
    "confidence": 85
  }
]

Only return tasks that are genuinely actionable. Don't create tasks for healthy, active relationships.`;

/**
 * POST /api/sales-customers/ai-tasks/scan
 * Run AI analysis on sales data to generate tasks
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userId = getUserIdFromHeaders(req);

    if (!userId) {
      return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
    }

    const body: ScanRequest = await req.json().catch(() => ({}));
    const triggerType = body.triggerType || "manual";

    // Create scan log
    const scanId = crypto.randomUUID();
    await db.insert(aiSalesScanLogs).values({
      tenantId,
      scanId,
      triggerType,
      status: "running",
      entitiesScanned: { customers: 0, leads: 0, quotes: 0, invoices: 0 },
    });

    try {
      // Gather sales data for analysis
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Get leads that need follow-up (no activity in 7+ days)
      const leadsNeedingAttention = await db
        .select({
          id: leads.id,
          contactName: leads.contactName,
          company: leads.company,
          status: leads.status,
          estimatedValue: leads.estimatedValue,
          lastActivityDate: leads.lastActivityDate,
          createdAt: leads.createdAt,
          source: leads.source,
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
        .limit(20);

      // Get quotes that need follow-up (sent but not accepted, older than 3 days)
      const quotesNeedingAttention = await db
        .select({
          id: salesDocs.id,
          docNumber: salesDocs.docNumber,
          totalAmount: salesDocs.totalAmount,
          status: salesDocs.status,
          docDate: salesDocs.docDate,
          dueDate: salesDocs.dueDate,
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
        .limit(20);

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
        .limit(20);

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
        .limit(20);

      // Get dormant customers (no orders in 90+ days but had previous orders)
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
        .limit(10);

      // Build context for AI
      const salesContext = `
## SALES DATA SNAPSHOT
Generated: ${now.toISOString()}

### LEADS NEEDING FOLLOW-UP (${leadsNeedingAttention.length} leads)
${leadsNeedingAttention.length > 0
  ? leadsNeedingAttention.map(l =>
      `- ID: ${l.id}, Name: ${l.contactName}, Company: ${l.company || "N/A"}, Status: ${l.status}, Est. Value: ${l.estimatedValue || "Unknown"}, Last Activity: ${l.lastActivityDate ? new Date(l.lastActivityDate).toLocaleDateString() : "Never"}, Source: ${l.source || "Unknown"}`
    ).join("\n")
  : "No leads needing immediate follow-up"}

### QUOTES AWAITING RESPONSE (${quotesNeedingAttention.length} quotes)
${quotesNeedingAttention.length > 0
  ? quotesNeedingAttention.map(q =>
      `- ID: ${q.id}, Doc#: ${q.docNumber}, Customer: ${q.partyName || "Unknown"}, Amount: $${q.totalAmount || 0}, Sent: ${q.sentAt ? new Date(q.sentAt).toLocaleDateString() : "Unknown"}, Due: ${q.dueDate || "No due date"}`
    ).join("\n")
  : "No quotes pending response"}

### OVERDUE INVOICES (${overdueInvoices.length} invoices)
${overdueInvoices.length > 0
  ? overdueInvoices.map(i =>
      `- ID: ${i.id}, Doc#: ${i.docNumber}, Customer: ${i.partyName || "Unknown"}, Amount: $${i.totalAmount || 0}, Due: ${i.dueDate}, Reminders Sent: ${i.reminderCount || 0}`
    ).join("\n")
  : "No overdue invoices"}

### AT-RISK CUSTOMERS (${atRiskCustomers.length} customers)
${atRiskCustomers.length > 0
  ? atRiskCustomers.map(c =>
      `- ID: ${c.customerId}, Name: ${c.customerName || "Unknown"}, Health Score: ${c.overallScore}/100, Risk Level: ${c.riskLevel}, Trend: ${c.trend}, Days Since Last Order: ${c.daysSinceLastOrder || "Unknown"}, Total Revenue: $${c.totalRevenue || 0}, Risk Factors: ${(c.riskFactors as string[] || []).join(", ") || "None specified"}`
    ).join("\n")
  : "No at-risk customers identified"}

### DORMANT CUSTOMERS TO REACTIVATE (${dormantCustomers.length} customers)
${dormantCustomers.length > 0
  ? dormantCustomers.map(c =>
      `- ID: ${c.customerId}, Name: ${c.customerName || "Unknown"}, Total Orders: ${c.totalOrders}, Total Revenue: $${c.totalRevenue || 0}, Days Inactive: ${c.daysSinceLastOrder}, Avg Order: $${c.averageOrderValue || 0}`
    ).join("\n")
  : "No dormant customers to reactivate"}

Please analyze this data and generate actionable tasks. Focus on the highest-impact opportunities first.
`;

      let aiTasks: AITaskSuggestion[] = [];

      // Check if AI is available
      const canUse = await canUseAI(tenantId);

      if (canUse) {
        // Use AI to generate tasks
        const provider = getAIProvider();
        const response = await provider.complete({
          messages: [
            { role: "system", content: SCAN_SYSTEM_PROMPT },
            { role: "user", content: salesContext },
          ],
          maxTokens: 4000,
          temperature: 0.5,
        });

        // Parse AI response
        try {
          const jsonMatch = response.content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            aiTasks = JSON.parse(jsonMatch[0]);
          }
        } catch {
          console.error("Failed to parse AI response, using rule-based tasks");
        }
      }

      // If AI didn't return tasks or isn't available, use rule-based approach
      if (aiTasks.length === 0) {
        aiTasks = generateRuleBasedTasks(
          leadsNeedingAttention,
          quotesNeedingAttention,
          overdueInvoices,
          atRiskCustomers,
          dormantCustomers
        );
      }

      // Create or update tasks in database
      let tasksCreated = 0;
      let tasksUpdated = 0;
      const tasksClosed = 0;

      for (const task of aiTasks) {
        // Determine entity IDs
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
          .select({ id: aiSalesTasks.id, priority: aiSalesTasks.priority })
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
          // Update existing task if priority changed
          await db
            .update(aiSalesTasks)
            .set({
              priority: task.priority,
              description: task.description,
              aiRationale: task.aiRationale,
              suggestedActions: task.suggestedActions,
              potentialValue: task.potentialValue?.toString(),
              scanScore: task.confidence,
              lastScanId: scanId,
              updatedAt: now,
            })
            .where(eq(aiSalesTasks.id, existingTask.id));
          tasksUpdated++;
        } else {
          // Create new task
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
            dueDate: task.dueDate,
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
          tasksClosed,
          entitiesScanned: {
            customers: atRiskCustomers.length + dormantCustomers.length,
            leads: leadsNeedingAttention.length,
            quotes: quotesNeedingAttention.length,
            invoices: overdueInvoices.length,
          },
          completedAt: now,
        })
        .where(eq(aiSalesScanLogs.scanId, scanId));

      return NextResponse.json({
        success: true,
        scanId,
        tasksCreated,
        tasksUpdated,
        tasksClosed,
        totalTasksGenerated: aiTasks.length,
      });
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
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/sales-customers/ai-tasks/scan error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Generate rule-based tasks when AI is not available
 */
function generateRuleBasedTasks(
  leadsData: Array<{
    id: string;
    contactName: string;
    company: string | null;
    status: string | null;
    estimatedValue: string | null;
    lastActivityDate: Date | null;
    createdAt: Date;
    source: string | null;
  }>,
  quotes: Array<{
    id: string;
    docNumber: string;
    totalAmount: string | null;
    status: string | null;
    docDate: string | null;
    dueDate: string | null;
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
  for (const lead of leadsData.slice(0, 5)) {
    const daysSinceActivity = lead.lastActivityDate
      ? Math.floor((now.getTime() - new Date(lead.lastActivityDate).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    const estimatedValue = parseFloat(lead.estimatedValue || "0");
    const priority = estimatedValue > 50000 || daysSinceActivity > 14 ? "high" : "medium";

    tasks.push({
      taskType: daysSinceActivity > 14 ? "hot_lead" : "follow_up_lead",
      priority: priority as "low" | "medium" | "high" | "critical",
      title: `Follow up with ${lead.contactName || lead.company || "Lead"}`,
      description: `Lead hasn't been contacted in ${daysSinceActivity} days. Status: ${lead.status || "Unknown"}.`,
      aiRationale: estimatedValue > 0
        ? `Estimated value of $${estimatedValue.toLocaleString()} indicates strong potential.`
        : "Regular follow-up needed to maintain engagement.",
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
  for (const quote of quotes.slice(0, 5)) {
    const amount = parseFloat(quote.totalAmount || "0");
    const priority = amount > 10000 ? "high" : "medium";

    tasks.push({
      taskType: "follow_up_quote",
      priority: priority as "low" | "medium" | "high" | "critical",
      title: `Follow up on quote ${quote.docNumber}`,
      description: `Quote for ${quote.partyName || "customer"} worth $${amount.toLocaleString()} is pending response.`,
      aiRationale: "Quote has been pending for more than 7 days without response.",
      entityType: "quote",
      entityId: quote.id,
      entityName: quote.docNumber,
      suggestedActions: [
        { action: "Call to discuss quote", type: "call" },
        { action: "Send reminder email", type: "email" },
      ],
      potentialValue: amount || undefined,
      confidence: 80,
    });
  }

  // Payment reminders
  for (const invoice of invoices.slice(0, 5)) {
    const amount = parseFloat(invoice.totalAmount || "0");
    const daysOverdue = invoice.dueDate
      ? Math.floor((now.getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const priority = daysOverdue > 30 || amount > 5000 ? "critical" : "high";

    tasks.push({
      taskType: "payment_reminder",
      priority: priority as "low" | "medium" | "high" | "critical",
      title: `Payment reminder for ${invoice.partyName || "customer"}`,
      description: `Invoice ${invoice.docNumber} for $${amount.toLocaleString()} is ${daysOverdue} days overdue.`,
      aiRationale: `Invoice is ${daysOverdue} days past due date. ${(invoice.reminderCount || 0) > 0 ? `${invoice.reminderCount} reminders already sent.` : "No reminders sent yet."}`,
      entityType: "invoice",
      entityId: invoice.id,
      entityName: invoice.docNumber,
      suggestedActions: [
        { action: "Send payment reminder", type: "reminder" },
        { action: "Call accounts payable", type: "call" },
      ],
      potentialValue: amount,
      riskLevel: daysOverdue > 60 ? "high" : "medium",
      confidence: 90,
    });
  }

  // At-risk customers
  for (const customer of atRiskCustomers.slice(0, 3)) {
    const revenue = parseFloat(customer.totalRevenue || "0");
    const priority = customer.riskLevel === "critical" || revenue > 50000 ? "critical" : "high";

    tasks.push({
      taskType: "at_risk_customer",
      priority: priority as "low" | "medium" | "high" | "critical",
      title: `At-risk: ${customer.customerName || "Customer"} needs attention`,
      description: `Health score: ${customer.overallScore}/100 (${customer.trend}). Last order: ${customer.daysSinceLastOrder} days ago.`,
      aiRationale: `Customer has ${customer.riskLevel} risk level with ${(customer.riskFactors as string[] || []).join(", ") || "multiple factors"} contributing to churn risk.`,
      entityType: "customer",
      entityId: customer.customerId,
      entityName: customer.customerName || "Unknown",
      suggestedActions: [
        { action: "Schedule check-in call", type: "call" },
        { action: "Review account history", type: "other" },
        { action: "Offer loyalty discount", type: "email" },
      ],
      potentialValue: revenue,
      riskLevel: customer.riskLevel as "low" | "medium" | "high" | "critical" || "medium",
      confidence: 85,
    });
  }

  // Dormant customer reactivation
  for (const customer of dormantCustomers.slice(0, 3)) {
    const revenue = parseFloat(customer.totalRevenue || "0");
    const avgOrder = parseFloat(customer.averageOrderValue || "0");

    tasks.push({
      taskType: "reactivate_customer",
      priority: revenue > 20000 ? "medium" : "low",
      title: `Reactivate ${customer.customerName || "customer"}`,
      description: `Former customer with ${customer.totalOrders} orders totaling $${revenue.toLocaleString()}. Inactive for ${customer.daysSinceLastOrder} days.`,
      aiRationale: `Customer had average order value of $${avgOrder.toLocaleString()} and represents reactivation opportunity.`,
      entityType: "customer",
      entityId: customer.customerId,
      entityName: customer.customerName || "Unknown",
      suggestedActions: [
        { action: "Send win-back campaign", type: "email" },
        { action: "Call to check in", type: "call" },
      ],
      potentialValue: avgOrder,
      confidence: 60,
    });
  }

  return tasks;
}
