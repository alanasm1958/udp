// scripts/generate-hr-alerts.ts
// Background job to generate HR alerts and tasks
// Run this via cron daily or as needed

import { db } from "@/db";
import { sql } from "drizzle-orm";

interface Alert {
  tenantId: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  entityType: string;
  entityId: string;
}

interface Task {
  tenantId: string;
  title: string;
  description: string;
  domain: string;
  priority: "low" | "medium" | "high" | "critical";
  dueAt: string;
  assignedTo?: string;
}

async function generateContractEndingAlerts(): Promise<Alert[]> {
  const alerts: Alert[] = [];

  // Critical: Ending in 1 day
  const critical = await db.execute(sql`
    SELECT 
      e.tenant_id,
      e.id as employee_id,
      e.person_id,
      p.first_name || ' ' || p.last_name as person_name,
      e.end_date
    FROM employees e
    JOIN people p ON p.id = e.person_id
    WHERE p.status = 'active'
      AND e.end_date IS NOT NULL
      AND e.end_date >= CURRENT_DATE
      AND e.end_date <= CURRENT_DATE + INTERVAL '1 day'
  `);

  for (const row of critical.rows) {
    alerts.push({
      tenantId: row.tenant_id,
      title: `Contract Ending Tomorrow: ${row.person_name}`,
      message: `${row.person_name}'s contract ends on ${row.end_date}. Immediate action required.`,
      severity: "critical",
      entityType: "employee",
      entityId: row.employee_id,
    });
  }

  // Urgent: Ending in 7 days
  const urgent = await db.execute(sql`
    SELECT 
      e.tenant_id,
      e.id as employee_id,
      e.person_id,
      p.first_name || ' ' || p.last_name as person_name,
      e.end_date
    FROM employees e
    JOIN people p ON p.id = e.person_id
    WHERE p.status = 'active'
      AND e.end_date IS NOT NULL
      AND e.end_date > CURRENT_DATE + INTERVAL '1 day'
      AND e.end_date <= CURRENT_DATE + INTERVAL '7 days'
  `);

  for (const row of urgent.rows) {
    alerts.push({
      tenantId: row.tenant_id,
      title: `Contract Ending Soon: ${row.person_name}`,
      message: `${row.person_name}'s contract ends on ${row.end_date}. Plan renewal or exit.`,
      severity: "warning",
      entityType: "employee",
      entityId: row.employee_id,
    });
  }

  // Info: Ending in 30 days
  const upcoming = await db.execute(sql`
    SELECT 
      e.tenant_id,
      e.id as employee_id,
      e.person_id,
      p.first_name || ' ' || p.last_name as person_name,
      e.end_date
    FROM employees e
    JOIN people p ON p.id = e.person_id
    WHERE p.status = 'active'
      AND e.end_date IS NOT NULL
      AND e.end_date > CURRENT_DATE + INTERVAL '7 days'
      AND e.end_date <= CURRENT_DATE + INTERVAL '30 days'
  `);

  for (const row of upcoming.rows) {
    alerts.push({
      tenantId: row.tenant_id,
      title: `Upcoming Contract End: ${row.person_name}`,
      message: `${row.person_name}'s contract ends on ${row.end_date}.`,
      severity: "info",
      entityType: "employee",
      entityId: row.employee_id,
    });
  }

  return alerts;
}

async function generateMissingPayrollAlerts(): Promise<Alert[]> {
  const alerts: Alert[] = [];

  // Check for missing payroll for current month
  const missingPayroll = await db.execute(sql`
    SELECT DISTINCT t.id as tenant_id, t.name as tenant_name
    FROM tenants t
    WHERE NOT EXISTS (
      SELECT 1 FROM payroll_runs_v2 pr
      WHERE pr.tenant_id = t.id
        AND pr.period_start >= DATE_TRUNC('month', CURRENT_DATE)
        AND pr.period_end <= DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    )
    AND EXISTS (
      SELECT 1 FROM employees e
      JOIN people p ON p.id = e.person_id
      WHERE e.tenant_id = t.id
        AND p.status = 'active'
    )
  `);

  for (const row of missingPayroll.rows) {
    const isEndOfMonth = new Date().getDate() > 25;
    alerts.push({
      tenantId: row.tenant_id,
      title: "Missing Payroll Run",
      message: `No payroll run created for current month. ${isEndOfMonth ? 'Month end approaching!' : ''}`,
      severity: isEndOfMonth ? "warning" : "info",
      entityType: "tenant",
      entityId: row.tenant_id,
    });
  }

  return alerts;
}

async function generateDocumentExpiryAlerts(): Promise<Alert[]> {
  const alerts: Alert[] = [];

  // Documents expiring within 30 days
  const expiringDocs = await db.execute(sql`
    SELECT 
      d.tenant_id,
      d.id as document_id,
      d.filename,
      d.category,
      d.expiry_date,
      dl.entity_type,
      dl.entity_id
    FROM hr_documents d
    LEFT JOIN hr_document_links dl ON dl.document_id = d.id
    WHERE d.expiry_date IS NOT NULL
      AND d.expiry_date >= CURRENT_DATE
      AND d.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
      AND d.verification_status != 'expired'
  `);

  for (const row of expiringDocs.rows) {
    const daysUntilExpiry = Math.ceil(
      (new Date(row.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    
    alerts.push({
      tenantId: row.tenant_id,
      title: `Document Expiring: ${row.filename}`,
      message: `${row.category} document expires in ${daysUntilExpiry} days.`,
      severity: daysUntilExpiry <= 7 ? "warning" : "info",
      entityType: "document",
      entityId: row.document_id,
    });
  }

  // Mark expired documents
  await db.execute(sql`
    UPDATE hr_documents
    SET verification_status = 'expired'
    WHERE expiry_date < CURRENT_DATE
      AND verification_status != 'expired'
  `);

  return alerts;
}

async function autoInactivateExpiredContracts(): Promise<void> {
  // Auto-inactivate people whose contracts have ended
  await db.execute(sql`
    UPDATE people
    SET status = 'inactive'
    WHERE id IN (
      SELECT p.id
      FROM people p
      JOIN employees e ON e.person_id = p.id
      WHERE p.status = 'active'
        AND e.end_date IS NOT NULL
        AND e.end_date < CURRENT_DATE
    )
  `);

  // Log audit events
  await db.execute(sql`
    INSERT INTO hr_audit_log (
      id, tenant_id, actor_id, actor_name, entity_type, entity_id,
      action, notes
    )
    SELECT 
      'audit_' || gen_random_uuid()::text,
      e.tenant_id,
      null,
      'System',
      'employee',
      e.id,
      'auto_inactivated',
      'Contract ended on ' || e.end_date::text
    FROM employees e
    JOIN people p ON p.id = e.person_id
    WHERE p.status = 'inactive'
      AND e.end_date < CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM hr_audit_log
        WHERE entity_id = e.id
          AND action = 'auto_inactivated'
          AND occurred_at >= CURRENT_DATE
      )
  `);
}

async function saveAlertsAndTasks(
  alerts: Alert[],
  tasks: Task[]
): Promise<void> {
  // Delete old alerts
  await db.execute(sql`
    DELETE FROM alerts
    WHERE source = 'system'
      AND created_at < CURRENT_DATE - INTERVAL '7 days'
  `);

  // Insert new alerts (avoiding duplicates)
  for (const alert of alerts) {
    await db.execute(sql`
      INSERT INTO alerts (
        id, tenant_id, title, message, severity,
        source, status, entity_type, entity_id
      )
      SELECT 
        'alert_' || gen_random_uuid()::text,
        ${alert.tenantId},
        ${alert.title},
        ${alert.message},
        ${alert.severity},
        'system',
        'active',
        ${alert.entityType},
        ${alert.entityId}
      WHERE NOT EXISTS (
        SELECT 1 FROM alerts
        WHERE tenant_id = ${alert.tenantId}
          AND entity_type = ${alert.entityType}
          AND entity_id = ${alert.entityId}
          AND status = 'active'
          AND created_at >= CURRENT_DATE
      )
    `);
  }

  // Insert new tasks (avoiding duplicates)
  for (const task of tasks) {
    await db.execute(sql`
      INSERT INTO tasks (
        id, tenant_id, title, description, domain,
        status, priority, due_at, assigned_to_user_id, created_by
      )
      SELECT 
        'task_' || gen_random_uuid()::text,
        ${task.tenantId},
        ${task.title},
        ${task.description},
        ${task.domain},
        'open',
        ${task.priority},
        ${task.dueAt}::date,
        ${task.assignedTo || null},
        null
      WHERE NOT EXISTS (
        SELECT 1 FROM tasks
        WHERE tenant_id = ${task.tenantId}
          AND title = ${task.title}
          AND status = 'open'
          AND created_at >= CURRENT_DATE - INTERVAL '7 days'
      )
    `);
  }
}

async function main() {
  console.log("Starting HR alerts generation...");

  try {
    // Generate all alerts
    const contractAlerts = await generateContractEndingAlerts();
    const payrollAlerts = await generateMissingPayrollAlerts();
    const documentAlerts = await generateDocumentExpiryAlerts();

    const allAlerts = [
      ...contractAlerts,
      ...payrollAlerts,
      ...documentAlerts,
    ];

    // Auto-inactivate expired contracts
    await autoInactivateExpiredContracts();

    // Save to database
    await saveAlertsAndTasks(allAlerts, []);

    console.log(`Generated ${allAlerts.length} alerts`);
    console.log(`  - Contract endings: ${contractAlerts.length}`);
    console.log(`  - Missing payroll: ${payrollAlerts.length}`);
    console.log(`  - Document expiry: ${documentAlerts.length}`);
    console.log("HR alerts generation complete");
  } catch (error) {
    console.error("Error generating HR alerts:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { main as generateHRAlerts };
