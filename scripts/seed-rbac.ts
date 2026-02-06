/**
 * RBAC Seed Script
 *
 * This script:
 * 1. Seeds the pages and page_actions tables with all defined pages and actions
 * 2. Sets up the platform owner tenant
 *
 * Usage:
 *   npx tsx scripts/seed-rbac.ts [--set-platform-owner] [--email=user@example.com]
 *
 * Options:
 *   --set-platform-owner   Set the tenant of the specified user as platform owner
 *   --email=<email>        Email of the user whose tenant should be platform owner (default: alan@example.com)
 */

import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "@/db";
import { pages, pageActions, tenants, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { pagesSeed, actionsSeed } from "@/lib/seeds/rbac-pages-actions";

async function seedRbac() {
  const args = process.argv.slice(2);
  const setPlatformOwner = args.includes("--set-platform-owner");
  const emailArg = args.find(a => a.startsWith("--email="));
  const email = emailArg ? emailArg.split("=")[1] : "alan@example.com";

  console.log("=".repeat(60));
  console.log("RBAC Seed Script");
  console.log("=".repeat(60));

  let pagesCreated = 0;
  let pagesSkipped = 0;
  let actionsCreated = 0;
  let actionsSkipped = 0;

  // 1. Seed pages
  console.log("\n📄 Seeding pages...");
  for (const pageSeed of pagesSeed) {
    const existing = await db
      .select({ id: pages.id })
      .from(pages)
      .where(eq(pages.code, pageSeed.code))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(pages).values({
        code: pageSeed.code,
        name: pageSeed.name,
        route: pageSeed.route,
        module: pageSeed.module,
        description: pageSeed.description,
        icon: pageSeed.icon,
        isAlwaysAccessible: pageSeed.isAlwaysAccessible ?? false,
        displayOrder: pageSeed.displayOrder,
        parentPageCode: pageSeed.parentPageCode,
      });
      pagesCreated++;
    } else {
      pagesSkipped++;
    }
  }
  console.log(`   ✅ Pages: ${pagesCreated} created, ${pagesSkipped} already existed`);

  // 2. Get page ID map for actions
  const allPages = await db.select({ id: pages.id, code: pages.code }).from(pages);
  const pageIdMap = new Map(allPages.map((p) => [p.code, p.id]));

  // 3. Seed actions
  console.log("\n🎬 Seeding actions...");
  for (const actionSeed of actionsSeed) {
    const pageId = pageIdMap.get(actionSeed.pageCode);
    if (!pageId) {
      console.warn(`   ⚠️  Page not found for action: ${actionSeed.pageCode}/${actionSeed.code}`);
      continue;
    }

    const existing = await db
      .select({ id: pageActions.id })
      .from(pageActions)
      .where(
        and(eq(pageActions.pageId, pageId), eq(pageActions.code, actionSeed.code))
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(pageActions).values({
        pageId,
        code: actionSeed.code,
        name: actionSeed.name,
        description: actionSeed.description,
        actionType: actionSeed.actionType,
        requiresPermission: actionSeed.requiresPermission,
        displayOrder: actionSeed.displayOrder,
      });
      actionsCreated++;
    } else {
      actionsSkipped++;
    }
  }
  console.log(`   ✅ Actions: ${actionsCreated} created, ${actionsSkipped} already existed`);

  // 4. Set platform owner if requested
  if (setPlatformOwner) {
    console.log(`\n👑 Setting platform owner for user: ${email}...`);

    // Find the user
    const [user] = await db
      .select({ id: users.id, tenantId: users.tenantId, fullName: users.fullName })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      console.error(`   ❌ User not found: ${email}`);
      console.log("\n   Available users:");
      const allUsers = await db
        .select({ email: users.email, fullName: users.fullName })
        .from(users)
        .limit(10);
      allUsers.forEach(u => console.log(`      - ${u.email} (${u.fullName})`));
    } else {
      // Remove platform owner from any existing tenant
      await db
        .update(tenants)
        .set({ isPlatformOwner: false })
        .where(eq(tenants.isPlatformOwner, true));

      // Set this user's tenant as platform owner
      await db
        .update(tenants)
        .set({ isPlatformOwner: true })
        .where(eq(tenants.id, user.tenantId));

      // Get tenant name for confirmation
      const [tenant] = await db
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, user.tenantId))
        .limit(1);

      console.log(`   ✅ Platform owner set:`);
      console.log(`      User: ${user.fullName} (${email})`);
      console.log(`      Tenant: ${tenant?.name || user.tenantId}`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("Summary:");
  console.log(`   Total pages in seed: ${pagesSeed.length}`);
  console.log(`   Total actions in seed: ${actionsSeed.length}`);
  console.log(`   Pages created: ${pagesCreated}`);
  console.log(`   Actions created: ${actionsCreated}`);
  if (setPlatformOwner) {
    console.log(`   Platform owner: Set for ${email}`);
  }
  console.log("=".repeat(60));
  console.log("\n✅ RBAC seeding complete!\n");
}

// Run
seedRbac()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
