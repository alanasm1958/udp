/**
 * /api/admin/users/[id]/access
 *
 * GET: Get user's page and action access settings
 * PUT: Update user's page and action access settings
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, pages, pageActions, userPageAccess, userActionAccess } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireRole, ROLES, AuthContext } from "@/lib/authz";
import { logAuditEvent } from "@/lib/audit";

interface PageAccessItem {
  pageId: string;
  hasAccess: boolean;
}

interface ActionAccessItem {
  actionId: string;
  hasAccess: boolean;
}

interface UpdateAccessRequest {
  pageAccess?: PageAccessItem[];
  actionAccess?: ActionAccessItem[];
}

/**
 * GET /api/admin/users/[id]/access
 * Get user's page and action access settings
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // RBAC: admin only
    const roleCheck = requireRole(req, [ROLES.ADMIN]);
    if (roleCheck instanceof NextResponse) return roleCheck;
    const auth = roleCheck as AuthContext;

    const { id: userId } = await params;

    // Verify user exists in tenant
    const [user] = await db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(and(eq(users.tenantId, auth.tenantId), eq(users.id, userId)))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get all pages grouped by module
    const allPages = await db
      .select({
        id: pages.id,
        code: pages.code,
        name: pages.name,
        route: pages.route,
        module: pages.module,
        description: pages.description,
        icon: pages.icon,
        isAlwaysAccessible: pages.isAlwaysAccessible,
        displayOrder: pages.displayOrder,
        parentPageCode: pages.parentPageCode,
      })
      .from(pages)
      .orderBy(pages.module, pages.displayOrder);

    // Get all actions
    const allActions = await db
      .select({
        id: pageActions.id,
        pageId: pageActions.pageId,
        code: pageActions.code,
        name: pageActions.name,
        description: pageActions.description,
        actionType: pageActions.actionType,
        requiresPermission: pageActions.requiresPermission,
        displayOrder: pageActions.displayOrder,
      })
      .from(pageActions)
      .orderBy(pageActions.displayOrder);

    // Get user's current page access settings
    const userPages = await db
      .select({
        pageId: userPageAccess.pageId,
        hasAccess: userPageAccess.hasAccess,
      })
      .from(userPageAccess)
      .where(
        and(
          eq(userPageAccess.tenantId, auth.tenantId),
          eq(userPageAccess.userId, userId)
        )
      );

    // Get user's current action access settings
    const userActions = await db
      .select({
        actionId: userActionAccess.actionId,
        hasAccess: userActionAccess.hasAccess,
      })
      .from(userActionAccess)
      .where(
        and(
          eq(userActionAccess.tenantId, auth.tenantId),
          eq(userActionAccess.userId, userId)
        )
      );

    // Create maps for quick lookup
    const pageAccessMap = new Map(userPages.map((p) => [p.pageId, p.hasAccess]));
    const actionAccessMap = new Map(userActions.map((a) => [a.actionId, a.hasAccess]));

    // Group pages by module with access status
    const pagesByModule: Record<string, Array<{
      id: string;
      code: string;
      name: string;
      route: string;
      module: string;
      description: string | null;
      icon: string | null;
      isAlwaysAccessible: boolean;
      displayOrder: number;
      parentPageCode: string | null;
      hasAccess: boolean;
      actions: Array<{
        id: string;
        code: string;
        name: string;
        description: string | null;
        actionType: string;
        requiresPermission: string | null;
        displayOrder: number;
        hasAccess: boolean;
      }>;
    }>> = {};

    // Build page structure with actions
    for (const page of allPages) {
      const moduleName = page.module || "other";
      if (!pagesByModule[moduleName]) {
        pagesByModule[moduleName] = [];
      }

      // Get actions for this page
      const pageActionsList = allActions
        .filter((a) => a.pageId === page.id)
        .map((action) => ({
          ...action,
          hasAccess: actionAccessMap.get(action.id) ?? false, // Default: no access
        }));

      pagesByModule[moduleName].push({
        ...page,
        hasAccess: page.isAlwaysAccessible || (pageAccessMap.get(page.id) ?? false), // Default: no access (except always accessible)
        actions: pageActionsList,
      });
    }

    return NextResponse.json({
      user: { id: user.id, fullName: user.fullName },
      pagesByModule,
      summary: {
        totalPages: allPages.length,
        accessiblePages: allPages.filter(
          (p) => p.isAlwaysAccessible || pageAccessMap.get(p.id)
        ).length,
        totalActions: allActions.length,
        accessibleActions: allActions.filter((a) => actionAccessMap.get(a.id)).length,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/users/[id]/access error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/users/[id]/access
 * Update user's page and action access settings
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // RBAC: admin only
    const roleCheck = requireRole(req, [ROLES.ADMIN]);
    if (roleCheck instanceof NextResponse) return roleCheck;
    const auth = roleCheck as AuthContext;

    const { id: userId } = await params;
    const body: UpdateAccessRequest = await req.json();

    // Verify user exists in tenant
    const [user] = await db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(and(eq(users.tenantId, auth.tenantId), eq(users.id, userId)))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const changes: { pagesUpdated: number; actionsUpdated: number } = {
      pagesUpdated: 0,
      actionsUpdated: 0,
    };

    // Update page access
    if (Array.isArray(body.pageAccess)) {
      for (const { pageId, hasAccess } of body.pageAccess) {
        // Check if record exists
        const [existing] = await db
          .select({ id: userPageAccess.id })
          .from(userPageAccess)
          .where(
            and(
              eq(userPageAccess.tenantId, auth.tenantId),
              eq(userPageAccess.userId, userId),
              eq(userPageAccess.pageId, pageId)
            )
          )
          .limit(1);

        if (existing) {
          // Update existing
          await db
            .update(userPageAccess)
            .set({ hasAccess, updatedAt: new Date() })
            .where(eq(userPageAccess.id, existing.id));
        } else {
          // Insert new
          await db.insert(userPageAccess).values({
            tenantId: auth.tenantId,
            userId,
            pageId,
            hasAccess,
            grantedByActorId: auth.actorId,
          });
        }
        changes.pagesUpdated++;
      }
    }

    // Update action access
    if (Array.isArray(body.actionAccess)) {
      for (const { actionId, hasAccess } of body.actionAccess) {
        // Check if record exists
        const [existing] = await db
          .select({ id: userActionAccess.id })
          .from(userActionAccess)
          .where(
            and(
              eq(userActionAccess.tenantId, auth.tenantId),
              eq(userActionAccess.userId, userId),
              eq(userActionAccess.actionId, actionId)
            )
          )
          .limit(1);

        if (existing) {
          // Update existing
          await db
            .update(userActionAccess)
            .set({ hasAccess, updatedAt: new Date() })
            .where(eq(userActionAccess.id, existing.id));
        } else {
          // Insert new
          await db.insert(userActionAccess).values({
            tenantId: auth.tenantId,
            userId,
            actionId,
            hasAccess,
            grantedByActorId: auth.actorId,
          });
        }
        changes.actionsUpdated++;
      }
    }

    // Audit log
    await logAuditEvent({
      tenantId: auth.tenantId,
      actorId: auth.actorId,
      entityType: "user",
      entityId: userId,
      action: "user_access_updated",
      metadata: {
        pagesUpdated: changes.pagesUpdated,
        actionsUpdated: changes.actionsUpdated,
      },
    });

    return NextResponse.json({
      success: true,
      ...changes,
      message: `Updated ${changes.pagesUpdated} page(s) and ${changes.actionsUpdated} action(s)`,
    });
  } catch (error) {
    console.error("PUT /api/admin/users/[id]/access error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
