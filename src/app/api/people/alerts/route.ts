/**
 * /api/people/alerts
 *
 * HR-specific alerts and tasks endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { alerts, tasks } from "@/db/schema";
import { eq, and, desc, sql, or } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  TenantError,
} from "@/lib/tenant";

/**
 * GET /api/people/alerts
 * List HR alerts and tasks with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const url = new URL(request.url);

    const status = url.searchParams.get("status"); // active, acknowledged, resolved
    const severity = url.searchParams.get("severity"); // info, warning, critical
    const includeTasksBool = url.searchParams.get("includeTasks") !== "false";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);

    // Get HR alerts
    const alertConditions = [
      eq(alerts.tenantId, tenantId),
      eq(alerts.domain, "hr"),
    ];

    if (status) {
      alertConditions.push(eq(alerts.status, status));
    } else {
      alertConditions.push(or(eq(alerts.status, "active"), eq(alerts.status, "acknowledged"))!);
    }

    if (severity) {
      alertConditions.push(eq(alerts.severity, severity));
    }

    const hrAlerts = await db
      .select({
        id: alerts.id,
        type: alerts.type,
        severity: alerts.severity,
        message: alerts.message,
        status: alerts.status,
        source: alerts.source,
        relatedEntityType: alerts.relatedEntityType,
        relatedEntityId: alerts.relatedEntityId,
        createdAt: alerts.createdAt,
      })
      .from(alerts)
      .where(and(...alertConditions))
      .orderBy(desc(alerts.createdAt))
      .limit(limit);

    // Get HR tasks if requested
    let hrTasks: Array<{
      id: string;
      title: string;
      description: string | null;
      status: string;
      priority: string;
      dueAt: Date | null;
      relatedEntityType: string | null;
      relatedEntityId: string | null;
      createdAt: Date;
    }> = [];

    if (includeTasksBool) {
      const taskConditions = [
        eq(tasks.tenantId, tenantId),
        eq(tasks.domain, "hr"),
      ];

      if (status === "active" || !status) {
        taskConditions.push(eq(tasks.status, "open"));
      }

      hrTasks = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          description: tasks.description,
          status: tasks.status,
          priority: tasks.priority,
          dueAt: tasks.dueAt,
          relatedEntityType: tasks.relatedEntityType,
          relatedEntityId: tasks.relatedEntityId,
          createdAt: tasks.createdAt,
        })
        .from(tasks)
        .where(and(...taskConditions))
        .orderBy(desc(tasks.createdAt))
        .limit(limit);
    }

    // Count by severity/priority
    const alertCountsResult = await db.execute(sql`
      SELECT
        severity,
        COUNT(*) as count
      FROM alerts
      WHERE tenant_id = ${tenantId}
        AND domain = 'hr'
        AND status IN ('active', 'acknowledged')
      GROUP BY severity
    `);

    const taskCountsResult = await db.execute(sql`
      SELECT
        priority,
        COUNT(*) as count
      FROM tasks
      WHERE tenant_id = ${tenantId}
        AND domain = 'hr'
        AND status = 'open'
      GROUP BY priority
    `);

    const alertCounts = Object.fromEntries(
      alertCountsResult.rows.map((r) => [r.severity, parseInt(String(r.count))])
    );
    const taskCounts = Object.fromEntries(
      taskCountsResult.rows.map((r) => [r.priority, parseInt(String(r.count))])
    );

    return NextResponse.json({
      alerts: hrAlerts,
      tasks: hrTasks,
      summary: {
        totalAlerts: hrAlerts.length,
        totalTasks: hrTasks.length,
        alertCounts,
        taskCounts,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error fetching HR alerts:", error);
    return NextResponse.json(
      { error: "Failed to fetch HR alerts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/people/alerts
 * Trigger alert generation (can be called manually or via cron)
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);

    const generatedAlerts: Array<{
      title: string;
      message: string;
      severity: string;
      entityType: string;
      entityId: string;
    }> = [];

    // 1. Contract ending alerts
    const contractsEnding = await db.execute(sql`
      SELECT
        e.id as employee_id,
        p.full_name as person_name,
        e.termination_date,
        EXTRACT(DAY FROM e.termination_date - CURRENT_DATE) as days_until
      FROM employees e
      JOIN people p ON p.id = e.person_id
      WHERE e.tenant_id = ${tenantId}
        AND p.is_active = true
        AND e.termination_date IS NOT NULL
        AND e.termination_date >= CURRENT_DATE
        AND e.termination_date <= CURRENT_DATE + INTERVAL '30 days'
        AND NOT EXISTS (
          SELECT 1 FROM alerts a
          WHERE a.tenant_id = ${tenantId}
            AND a.related_entity_type = 'employee'
            AND a.related_entity_id = e.id
            AND a.type = 'contract_ending'
            AND a.status = 'active'
            AND a.created_at >= CURRENT_DATE - INTERVAL '7 days'
        )
    `);

    for (const row of contractsEnding.rows) {
      const daysUntil = parseInt(String(row.days_until));
      const severity = daysUntil <= 1 ? "critical" : daysUntil <= 7 ? "warning" : "info";

      await db.insert(alerts).values({
        tenantId,
        domain: "hr",
        type: "contract_ending",
        severity,
        message: `${row.person_name}'s contract ends on ${row.termination_date}. ${daysUntil <= 1 ? 'Immediate action required.' : daysUntil <= 7 ? 'Action needed soon.' : 'Plan ahead.'}`,
        status: "active",
        source: "system",
        relatedEntityType: "employee",
        relatedEntityId: String(row.employee_id),
      });

      generatedAlerts.push({
        title: "Contract Ending",
        message: `${row.person_name} - ${daysUntil} days`,
        severity,
        entityType: "employee",
        entityId: String(row.employee_id),
      });
    }

    // 2. Document expiry alerts
    const expiringDocs = await db.execute(sql`
      SELECT
        d.id as document_id,
        d.filename,
        d.category,
        d.expiry_date,
        EXTRACT(DAY FROM d.expiry_date - CURRENT_DATE) as days_until
      FROM documents d
      WHERE d.tenant_id = ${tenantId}
        AND d.expiry_date IS NOT NULL
        AND d.expiry_date >= CURRENT_DATE
        AND d.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
        AND NOT EXISTS (
          SELECT 1 FROM alerts a
          WHERE a.tenant_id = ${tenantId}
            AND a.related_entity_type = 'document'
            AND a.related_entity_id = d.id
            AND a.type = 'document_expiring'
            AND a.status = 'active'
            AND a.created_at >= CURRENT_DATE - INTERVAL '7 days'
        )
    `);

    for (const row of expiringDocs.rows) {
      const daysUntil = parseInt(String(row.days_until));
      const severity = daysUntil <= 7 ? "warning" : "info";

      await db.insert(alerts).values({
        tenantId,
        domain: "hr",
        type: "document_expiring",
        severity,
        message: `Document "${row.filename}" (${row.category || 'Other'}) expires in ${daysUntil} days.`,
        status: "active",
        source: "system",
        relatedEntityType: "document",
        relatedEntityId: String(row.document_id),
      });

      generatedAlerts.push({
        title: "Document Expiring",
        message: `${row.filename} - ${daysUntil} days`,
        severity,
        entityType: "document",
        entityId: String(row.document_id),
      });
    }

    // 3. Missing payroll alert
    const currentMonth = new Date();
    const isEndOfMonth = currentMonth.getDate() > 20;

    const hasPayrollRun = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM payroll_runs_v2
      WHERE tenant_id = ${tenantId}
        AND period_start >= DATE_TRUNC('month', CURRENT_DATE)
        AND period_end <= DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    `);

    const hasEmployees = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM employees e
      JOIN people p ON p.id = e.person_id
      WHERE e.tenant_id = ${tenantId}
        AND p.is_active = true
        AND e.employment_status = 'active'
    `);

    if (
      parseInt(String(hasPayrollRun.rows[0]?.count)) === 0 &&
      parseInt(String(hasEmployees.rows[0]?.count)) > 0
    ) {
      // Check if we already have this alert
      const existingAlert = await db.execute(sql`
        SELECT 1 FROM alerts
        WHERE tenant_id = ${tenantId}
          AND type = 'missing_payroll'
          AND status = 'active'
          AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
      `);

      if (existingAlert.rows.length === 0) {
        await db.insert(alerts).values({
          tenantId,
          domain: "hr",
          type: "missing_payroll",
          severity: isEndOfMonth ? "warning" : "info",
          message: `No payroll run created for current month.${isEndOfMonth ? ' Month end approaching!' : ''}`,
          status: "active",
          source: "system",
          relatedEntityType: "tenant",
          relatedEntityId: tenantId,
        });

        generatedAlerts.push({
          title: "Missing Payroll",
          message: "No payroll run for current month",
          severity: isEndOfMonth ? "warning" : "info",
          entityType: "tenant",
          entityId: tenantId,
        });
      }
    }

    // 4. Pending leave requests alert
    const pendingLeave = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM leave_requests
      WHERE tenant_id = ${tenantId}
        AND status = 'pending'
    `);

    const pendingCount = parseInt(String(pendingLeave.rows[0]?.count || 0));
    if (pendingCount > 0) {
      const existingAlert = await db.execute(sql`
        SELECT 1 FROM alerts
        WHERE tenant_id = ${tenantId}
          AND type = 'pending_leave_requests'
          AND status = 'active'
          AND created_at >= CURRENT_DATE
      `);

      if (existingAlert.rows.length === 0) {
        await db.insert(alerts).values({
          tenantId,
          domain: "hr",
          type: "pending_leave_requests",
          severity: pendingCount > 5 ? "warning" : "info",
          message: `${pendingCount} leave request${pendingCount > 1 ? 's' : ''} pending approval.`,
          status: "active",
          source: "system",
          relatedEntityType: "leave_request",
          relatedEntityId: tenantId,
        });

        generatedAlerts.push({
          title: "Pending Leave Requests",
          message: `${pendingCount} pending`,
          severity: pendingCount > 5 ? "warning" : "info",
          entityType: "leave_request",
          entityId: tenantId,
        });
      }
    }

    return NextResponse.json({
      success: true,
      generated: generatedAlerts.length,
      alerts: generatedAlerts,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error generating HR alerts:", error);
    return NextResponse.json(
      { error: "Failed to generate HR alerts" },
      { status: 500 }
    );
  }
}
