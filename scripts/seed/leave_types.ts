/**
 * Seed default leave types
 *
 * Run: npx tsx scripts/seed/leave_types.ts
 *
 * Creates standard leave types for each tenant:
 * - Vacation
 * - Sick Leave
 * - Personal Time
 * - Bereavement
 * - Jury Duty
 * - Maternity/Paternity Leave
 * - Unpaid Leave
 */

import "dotenv/config";
import { db } from "@/db";
import { leaveTypes, tenants } from "@/db/schema";
import { eq, and } from "drizzle-orm";

interface LeaveTypeDef {
  code: string;
  name: string;
  description: string;
  accrualType: "manual" | "monthly" | "annual" | "per_period";
  defaultAnnualAllowance: string | null;
  maxCarryoverDays: string | null;
  requiresApproval: boolean;
  isPaid: boolean;
}

const defaultLeaveTypes: LeaveTypeDef[] = [
  {
    code: "VACATION",
    name: "Vacation",
    description: "Annual paid vacation leave",
    accrualType: "annual",
    defaultAnnualAllowance: "15.00",
    maxCarryoverDays: "5.00",
    requiresApproval: true,
    isPaid: true,
  },
  {
    code: "SICK",
    name: "Sick Leave",
    description: "Paid sick leave for illness or medical appointments",
    accrualType: "annual",
    defaultAnnualAllowance: "10.00",
    maxCarryoverDays: null,
    requiresApproval: true,
    isPaid: true,
  },
  {
    code: "PERSONAL",
    name: "Personal Time",
    description: "Personal time off for non-vacation, non-sick needs",
    accrualType: "annual",
    defaultAnnualAllowance: "3.00",
    maxCarryoverDays: null,
    requiresApproval: true,
    isPaid: true,
  },
  {
    code: "BEREAVEMENT",
    name: "Bereavement Leave",
    description: "Time off for death of a family member",
    accrualType: "manual",
    defaultAnnualAllowance: null,
    maxCarryoverDays: null,
    requiresApproval: true,
    isPaid: true,
  },
  {
    code: "JURY",
    name: "Jury Duty",
    description: "Time off for jury duty service",
    accrualType: "manual",
    defaultAnnualAllowance: null,
    maxCarryoverDays: null,
    requiresApproval: true,
    isPaid: true,
  },
  {
    code: "MATERNITY",
    name: "Maternity Leave",
    description: "Paid maternity leave for new mothers",
    accrualType: "manual",
    defaultAnnualAllowance: null,
    maxCarryoverDays: null,
    requiresApproval: true,
    isPaid: true,
  },
  {
    code: "PATERNITY",
    name: "Paternity Leave",
    description: "Paid paternity leave for new fathers",
    accrualType: "manual",
    defaultAnnualAllowance: null,
    maxCarryoverDays: null,
    requiresApproval: true,
    isPaid: true,
  },
  {
    code: "UNPAID",
    name: "Unpaid Leave",
    description: "Unpaid time off (leave of absence)",
    accrualType: "manual",
    defaultAnnualAllowance: null,
    maxCarryoverDays: null,
    requiresApproval: true,
    isPaid: false,
  },
  {
    code: "WFH",
    name: "Work From Home",
    description: "Remote work day (informational, not a leave type)",
    accrualType: "manual",
    defaultAnnualAllowance: null,
    maxCarryoverDays: null,
    requiresApproval: false,
    isPaid: true,
  },
];

async function seedLeaveTypes() {
  console.log("Seeding leave types...\n");

  // Get all tenants
  const allTenants = await db.select({ id: tenants.id, name: tenants.name }).from(tenants);

  if (allTenants.length === 0) {
    console.log("No tenants found. Please bootstrap the database first.");
    return;
  }

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const tenant of allTenants) {
    console.log(`Processing tenant: ${tenant.name} (${tenant.id})`);

    for (const lt of defaultLeaveTypes) {
      // Check if already exists
      const existing = await db
        .select({ id: leaveTypes.id })
        .from(leaveTypes)
        .where(and(eq(leaveTypes.tenantId, tenant.id), eq(leaveTypes.code, lt.code)))
        .limit(1);

      if (existing.length > 0) {
        console.log(`  - ${lt.code}: already exists, skipping`);
        totalSkipped++;
        continue;
      }

      // Insert
      await db.insert(leaveTypes).values({
        tenantId: tenant.id,
        code: lt.code,
        name: lt.name,
        description: lt.description,
        accrualType: lt.accrualType,
        defaultAnnualAllowance: lt.defaultAnnualAllowance,
        maxCarryoverDays: lt.maxCarryoverDays,
        requiresApproval: lt.requiresApproval,
        isPaid: lt.isPaid,
        isActive: true,
      });

      console.log(`  + ${lt.code}: created`);
      totalCreated++;
    }

    console.log("");
  }

  console.log("=".repeat(50));
  console.log(`Summary:`);
  console.log(`  Created: ${totalCreated}`);
  console.log(`  Skipped: ${totalSkipped}`);
  console.log(`  Tenants processed: ${allTenants.length}`);
}

seedLeaveTypes()
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error seeding leave types:", err);
    process.exit(1);
  });
