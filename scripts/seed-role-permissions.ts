/**
 * One-time script to seed:
 * 1. All permission definitions into the permissions table
 * 2. Default permissions for existing tenant roles
 *
 * Run with: npx tsx scripts/seed-role-permissions.ts
 */

import "dotenv/config";
import { db } from "@/db";
import { tenants, roles, permissions, rolePermissions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";

async function seedPermissions() {
  console.log("=== Seeding Permission Definitions ===\n");

  // Check if permissions already exist
  const existing = await db.select({ id: permissions.id }).from(permissions).limit(1);

  if (existing.length > 0) {
    console.log("Permissions already seeded. Checking for new permissions...\n");

    // Get existing permission codes
    const existingPerms = await db.select({ code: permissions.code }).from(permissions);
    const existingCodes = new Set(existingPerms.map((p) => p.code));

    // Find new permissions that need to be added
    const newPerms = ALL_PERMISSIONS.filter((p) => !existingCodes.has(p.code));

    if (newPerms.length > 0) {
      console.log(`Adding ${newPerms.length} new permission(s)...`);
      await db.insert(permissions).values(newPerms);
      console.log("New permissions added.\n");
    } else {
      console.log("All permissions already exist.\n");
    }
  } else {
    // Insert all permissions
    console.log(`Inserting ${ALL_PERMISSIONS.length} permissions...`);
    await db.insert(permissions).values(ALL_PERMISSIONS);
    console.log("Permissions seeded.\n");
  }
}

async function seedRolePermissions() {
  console.log("=== Seeding Role Permissions for Existing Tenants ===\n");

  // Get all permissions for mapping code -> id
  const allPerms = await db.select().from(permissions);
  const permMap = new Map(allPerms.map((p) => [p.code, p.id]));

  // Get all tenants
  const allTenants = await db.select().from(tenants);
  console.log(`Found ${allTenants.length} tenant(s)\n`);

  for (const tenant of allTenants) {
    console.log(`Processing tenant: ${tenant.name} (${tenant.id})`);

    // Get roles for this tenant
    const tenantRoles = await db
      .select()
      .from(roles)
      .where(eq(roles.tenantId, tenant.id));

    console.log(`  Found ${tenantRoles.length} role(s)`);

    for (const role of tenantRoles) {
      // Normalize role name to lowercase for matching
      const normalizedRoleName = role.name.toLowerCase().replace(/\s+/g, "").replace("tenant", "");

      // Skip admin (has implicit access via wildcard)
      if (normalizedRoleName === "admin") {
        console.log(`  - ${role.name}: skipped (admin has implicit access)`);
        continue;
      }

      // Get default permissions for this role type (try exact match first, then normalized)
      const defaultPerms =
        DEFAULT_ROLE_PERMISSIONS[role.name] ||
        DEFAULT_ROLE_PERMISSIONS[normalizedRoleName] ||
        DEFAULT_ROLE_PERMISSIONS[role.name.toLowerCase()] ||
        [];

      if (defaultPerms.length === 0) {
        console.log(`  - ${role.name}: no default permissions defined`);
        continue;
      }

      // Check existing permissions for this role
      const existingRolePerms = await db
        .select({ permissionId: rolePermissions.permissionId })
        .from(rolePermissions)
        .where(
          eq(rolePermissions.roleId, role.id)
        );

      const existingPermIds = new Set(existingRolePerms.map((p) => p.permissionId));

      // Filter to only new permissions
      const newPermIds = defaultPerms
        .map((code) => permMap.get(code))
        .filter((id): id is string => id !== undefined && !existingPermIds.has(id));

      if (newPermIds.length === 0) {
        console.log(`  - ${role.name}: ${defaultPerms.length} permissions (already assigned)`);
        continue;
      }

      // Insert new role permissions
      await db.insert(rolePermissions).values(
        newPermIds.map((permissionId) => ({
          tenantId: tenant.id,
          roleId: role.id,
          permissionId,
        }))
      );

      console.log(`  - ${role.name}: assigned ${newPermIds.length} permission(s)`);
    }

    console.log("");
  }
}

async function main() {
  console.log("\n========================================");
  console.log("  Permission Seeding Script");
  console.log("========================================\n");

  try {
    await seedPermissions();
    await seedRolePermissions();

    console.log("========================================");
    console.log("  Seeding Complete!");
    console.log("========================================\n");
  } catch (error) {
    console.error("Error during seeding:", error);
    process.exit(1);
  }

  process.exit(0);
}

main();
