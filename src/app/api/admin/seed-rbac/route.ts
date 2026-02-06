/**
 * POST /api/admin/seed-rbac
 * Seeds the pages and page_actions tables with all defined pages and actions
 * Also sets up the platform owner tenant if not already set
 *
 * Admin only endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { pages, pageActions, tenants, users, roles, userRoles, actors } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { requireRole, ROLES } from "@/lib/authz";
import { pagesSeed, actionsSeed } from "@/lib/seeds/rbac-pages-actions";
import { hashPassword } from "@/lib/password";

export async function POST(req: NextRequest) {
  // Require admin role
  const authResult = requireRole(req, [ROLES.ADMIN]);
  if (authResult instanceof NextResponse) return authResult;
  const auth = authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const { setPlatformOwner, platformOwnerEmail } = body;

    // Start transaction
    const result = await db.transaction(async (tx) => {
      let pagesCreated = 0;
      let pagesSkipped = 0;
      let actionsCreated = 0;
      let actionsSkipped = 0;
      let platformOwnerSet = false;

      // 1. Seed pages
      for (const pageSeed of pagesSeed) {
        const existing = await tx
          .select({ id: pages.id })
          .from(pages)
          .where(eq(pages.code, pageSeed.code))
          .limit(1);

        if (existing.length === 0) {
          await tx.insert(pages).values({
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

      // 2. Get page ID map for actions
      const allPages = await tx.select({ id: pages.id, code: pages.code }).from(pages);
      const pageIdMap = new Map(allPages.map((p) => [p.code, p.id]));

      // 3. Seed actions
      for (const actionSeed of actionsSeed) {
        const pageId = pageIdMap.get(actionSeed.pageCode);
        if (!pageId) {
          console.warn(`Page not found for action: ${actionSeed.pageCode}/${actionSeed.code}`);
          continue;
        }

        const existing = await tx
          .select({ id: pageActions.id })
          .from(pageActions)
          .where(
            and(eq(pageActions.pageId, pageId), eq(pageActions.code, actionSeed.code))
          )
          .limit(1);

        if (existing.length === 0) {
          await tx.insert(pageActions).values({
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

      // 4. Set platform owner if requested
      if (setPlatformOwner) {
        // First, ensure no other tenant is platform owner
        await tx
          .update(tenants)
          .set({ isPlatformOwner: false })
          .where(eq(tenants.isPlatformOwner, true));

        // Set current tenant as platform owner
        await tx
          .update(tenants)
          .set({ isPlatformOwner: true })
          .where(eq(tenants.id, auth.tenantId));

        platformOwnerSet = true;
      }

      return {
        pagesCreated,
        pagesSkipped,
        actionsCreated,
        actionsSkipped,
        platformOwnerSet,
        totalPages: pagesCreated + pagesSkipped,
        totalActions: actionsCreated + actionsSkipped,
      };
    });

    return NextResponse.json({
      success: true,
      ...result,
      message: `Seeded ${result.pagesCreated} pages and ${result.actionsCreated} actions. ${result.platformOwnerSet ? "Platform owner set." : ""}`,
    });
  } catch (error) {
    console.error("Error seeding RBAC:", error);
    return NextResponse.json(
      { error: "Failed to seed RBAC data" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/seed-rbac
 * Returns current seed status
 */
export async function GET(req: NextRequest) {
  // Require admin role
  const authResult = requireRole(req, [ROLES.ADMIN]);
  if (authResult instanceof NextResponse) return authResult;
  const auth = authResult;

  try {
    // Count pages and actions
    const [pagesCount] = await db
      .select({ count: count() })
      .from(pages);

    const [actionsCount] = await db
      .select({ count: count() })
      .from(pageActions);

    // Check if current tenant is platform owner
    const [tenant] = await db
      .select({ isPlatformOwner: tenants.isPlatformOwner })
      .from(tenants)
      .where(eq(tenants.id, auth.tenantId))
      .limit(1);

    return NextResponse.json({
      pagesInDb: pagesCount?.count || 0,
      actionsInDb: actionsCount?.count || 0,
      pagesInSeed: pagesSeed.length,
      actionsInSeed: actionsSeed.length,
      isPlatformOwner: tenant?.isPlatformOwner || false,
      needsSeeding: (pagesCount?.count || 0) < pagesSeed.length,
    });
  } catch (error) {
    console.error("Error checking RBAC status:", error);
    return NextResponse.json(
      { error: "Failed to check RBAC status" },
      { status: 500 }
    );
  }
}
