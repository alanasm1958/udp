/**
 * RBAC Access Control Library
 *
 * Provides functions for checking user page and action access.
 * Works alongside the existing role-based permission system.
 */

import { db } from "@/db";
import { pages, pageActions, userPageAccess, userActionAccess, users, roles, userRoles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getUserPermissions, hasAnyPermission } from "@/lib/authz";

/**
 * Page access result with full page details
 */
export interface PageAccessResult {
  pageId: string;
  pageCode: string;
  pageName: string;
  route: string;
  module: string;
  hasAccess: boolean;
  isAlwaysAccessible: boolean;
}

/**
 * Action access result with full action details
 */
export interface ActionAccessResult {
  actionId: string;
  actionCode: string;
  actionName: string;
  pageCode: string;
  hasAccess: boolean;
  actionType: string;
  requiresPermission: string | null;
}

/**
 * Check if a user has access to a specific page by route
 */
export async function checkPageAccessByRoute(
  tenantId: string,
  userId: string,
  route: string
): Promise<{ hasAccess: boolean; page: PageAccessResult | null; reason: string }> {
  // Find the page by route
  const [page] = await db
    .select({
      id: pages.id,
      code: pages.code,
      name: pages.name,
      route: pages.route,
      module: pages.module,
      isAlwaysAccessible: pages.isAlwaysAccessible,
    })
    .from(pages)
    .where(eq(pages.route, route))
    .limit(1);

  // If page is not in our RBAC system, allow access (backwards compatibility)
  if (!page) {
    return { hasAccess: true, page: null, reason: "Page not in RBAC system" };
  }

  // Always accessible pages bypass RBAC
  if (page.isAlwaysAccessible) {
    return {
      hasAccess: true,
      page: {
        pageId: page.id,
        pageCode: page.code,
        pageName: page.name,
        route: page.route,
        module: page.module || "other",
        hasAccess: true,
        isAlwaysAccessible: true,
      },
      reason: "Page is always accessible",
    };
  }

  // Check if user is admin - admins have full access
  const isAdmin = await checkIfUserIsAdmin(tenantId, userId);
  if (isAdmin) {
    return {
      hasAccess: true,
      page: {
        pageId: page.id,
        pageCode: page.code,
        pageName: page.name,
        route: page.route,
        module: page.module || "other",
        hasAccess: true,
        isAlwaysAccessible: false,
      },
      reason: "User is admin",
    };
  }

  // Check user's specific page access
  const [access] = await db
    .select({ hasAccess: userPageAccess.hasAccess })
    .from(userPageAccess)
    .where(
      and(
        eq(userPageAccess.tenantId, tenantId),
        eq(userPageAccess.userId, userId),
        eq(userPageAccess.pageId, page.id)
      )
    )
    .limit(1);

  // If explicit page access record exists, use it
  if (access !== undefined) {
    return {
      hasAccess: access.hasAccess,
      page: {
        pageId: page.id,
        pageCode: page.code,
        pageName: page.name,
        route: page.route,
        module: page.module || "other",
        hasAccess: access.hasAccess,
        isAlwaysAccessible: false,
      },
      reason: access.hasAccess ? "User has explicit page access" : "User denied explicit page access",
    };
  }

  // Fallback: bridge to role-based permissions
  // If no explicit page access record exists, check if the user's roles
  // grant them view permission for this page's module
  const moduleName = page.module || "other";
  const userRoleNames = await getUserRoleNames(tenantId, userId);
  const userPermissions = await getUserPermissions(tenantId, userRoleNames);
  const hasModuleView = hasAnyPermission(userPermissions, [`${moduleName}:view`]);

  return {
    hasAccess: hasModuleView,
    page: {
      pageId: page.id,
      pageCode: page.code,
      pageName: page.name,
      route: page.route,
      module: moduleName,
      hasAccess: hasModuleView,
      isAlwaysAccessible: false,
    },
    reason: hasModuleView
      ? "User has module view permission via role"
      : "User does not have page or module access",
  };
}

/**
 * Check if a user has access to a specific page by code
 */
export async function checkPageAccessByCode(
  tenantId: string,
  userId: string,
  pageCode: string
): Promise<{ hasAccess: boolean; page: PageAccessResult | null; reason: string }> {
  // Find the page by code
  const [page] = await db
    .select({
      id: pages.id,
      code: pages.code,
      name: pages.name,
      route: pages.route,
      module: pages.module,
      isAlwaysAccessible: pages.isAlwaysAccessible,
    })
    .from(pages)
    .where(eq(pages.code, pageCode))
    .limit(1);

  if (!page) {
    return { hasAccess: false, page: null, reason: "Page not found" };
  }

  // Always accessible pages bypass RBAC
  if (page.isAlwaysAccessible) {
    return {
      hasAccess: true,
      page: {
        pageId: page.id,
        pageCode: page.code,
        pageName: page.name,
        route: page.route,
        module: page.module || "other",
        hasAccess: true,
        isAlwaysAccessible: true,
      },
      reason: "Page is always accessible",
    };
  }

  // Check if user is admin
  const isAdmin = await checkIfUserIsAdmin(tenantId, userId);
  if (isAdmin) {
    return {
      hasAccess: true,
      page: {
        pageId: page.id,
        pageCode: page.code,
        pageName: page.name,
        route: page.route,
        module: page.module || "other",
        hasAccess: true,
        isAlwaysAccessible: false,
      },
      reason: "User is admin",
    };
  }

  // Check user's specific page access
  const [access] = await db
    .select({ hasAccess: userPageAccess.hasAccess })
    .from(userPageAccess)
    .where(
      and(
        eq(userPageAccess.tenantId, tenantId),
        eq(userPageAccess.userId, userId),
        eq(userPageAccess.pageId, page.id)
      )
    )
    .limit(1);

  const hasAccess = access?.hasAccess ?? false;

  return {
    hasAccess,
    page: {
      pageId: page.id,
      pageCode: page.code,
      pageName: page.name,
      route: page.route,
      module: page.module || "other",
      hasAccess,
      isAlwaysAccessible: false,
    },
    reason: hasAccess ? "User has explicit page access" : "User does not have page access",
  };
}

/**
 * Check if a user has access to a specific action
 */
export async function checkActionAccess(
  tenantId: string,
  userId: string,
  pageCode: string,
  actionCode: string
): Promise<{ hasAccess: boolean; action: ActionAccessResult | null; reason: string }> {
  // Find the page first
  const [page] = await db
    .select({ id: pages.id, code: pages.code })
    .from(pages)
    .where(eq(pages.code, pageCode))
    .limit(1);

  if (!page) {
    return { hasAccess: false, action: null, reason: "Page not found" };
  }

  // Find the action
  const [action] = await db
    .select({
      id: pageActions.id,
      code: pageActions.code,
      name: pageActions.name,
      actionType: pageActions.actionType,
      requiresPermission: pageActions.requiresPermission,
    })
    .from(pageActions)
    .where(
      and(
        eq(pageActions.pageId, page.id),
        eq(pageActions.code, actionCode)
      )
    )
    .limit(1);

  if (!action) {
    return { hasAccess: false, action: null, reason: "Action not found" };
  }

  // Check if user is admin - admins have full access
  const isAdmin = await checkIfUserIsAdmin(tenantId, userId);
  if (isAdmin) {
    return {
      hasAccess: true,
      action: {
        actionId: action.id,
        actionCode: action.code,
        actionName: action.name,
        pageCode: page.code,
        hasAccess: true,
        actionType: action.actionType,
        requiresPermission: action.requiresPermission,
      },
      reason: "User is admin",
    };
  }

  // Check user's specific action access
  const [access] = await db
    .select({ hasAccess: userActionAccess.hasAccess })
    .from(userActionAccess)
    .where(
      and(
        eq(userActionAccess.tenantId, tenantId),
        eq(userActionAccess.userId, userId),
        eq(userActionAccess.actionId, action.id)
      )
    )
    .limit(1);

  const hasAccess = access?.hasAccess ?? false;

  return {
    hasAccess,
    action: {
      actionId: action.id,
      actionCode: action.code,
      actionName: action.name,
      pageCode: page.code,
      hasAccess,
      actionType: action.actionType,
      requiresPermission: action.requiresPermission,
    },
    reason: hasAccess ? "User has explicit action access" : "User does not have action access",
  };
}

/**
 * Get all accessible pages for a user
 */
export async function getUserAccessiblePages(
  tenantId: string,
  userId: string
): Promise<PageAccessResult[]> {
  // Check if user is admin
  const isAdmin = await checkIfUserIsAdmin(tenantId, userId);

  // Get all pages
  const allPages = await db
    .select({
      id: pages.id,
      code: pages.code,
      name: pages.name,
      route: pages.route,
      module: pages.module,
      isAlwaysAccessible: pages.isAlwaysAccessible,
    })
    .from(pages)
    .orderBy(pages.module, pages.displayOrder);

  // If admin, return all pages as accessible
  if (isAdmin) {
    return allPages.map((page) => ({
      pageId: page.id,
      pageCode: page.code,
      pageName: page.name,
      route: page.route,
      module: page.module || "other",
      hasAccess: true,
      isAlwaysAccessible: page.isAlwaysAccessible,
    }));
  }

  // Get user's page access records
  const userAccess = await db
    .select({
      pageId: userPageAccess.pageId,
      hasAccess: userPageAccess.hasAccess,
    })
    .from(userPageAccess)
    .where(
      and(
        eq(userPageAccess.tenantId, tenantId),
        eq(userPageAccess.userId, userId)
      )
    );

  const accessMap = new Map(userAccess.map((a) => [a.pageId, a.hasAccess]));

  // Return pages with access status
  return allPages
    .map((page) => ({
      pageId: page.id,
      pageCode: page.code,
      pageName: page.name,
      route: page.route,
      module: page.module || "other",
      hasAccess: page.isAlwaysAccessible || (accessMap.get(page.id) ?? false),
      isAlwaysAccessible: page.isAlwaysAccessible,
    }))
    .filter((page) => page.hasAccess);
}

/**
 * Get all accessible actions for a user on a specific page
 */
export async function getUserAccessibleActions(
  tenantId: string,
  userId: string,
  pageCode: string
): Promise<ActionAccessResult[]> {
  // Find the page
  const [page] = await db
    .select({ id: pages.id, code: pages.code })
    .from(pages)
    .where(eq(pages.code, pageCode))
    .limit(1);

  if (!page) {
    return [];
  }

  // Check if user is admin
  const isAdmin = await checkIfUserIsAdmin(tenantId, userId);

  // Get all actions for the page
  const allActions = await db
    .select({
      id: pageActions.id,
      code: pageActions.code,
      name: pageActions.name,
      actionType: pageActions.actionType,
      requiresPermission: pageActions.requiresPermission,
    })
    .from(pageActions)
    .where(eq(pageActions.pageId, page.id))
    .orderBy(pageActions.displayOrder);

  // If admin, return all actions as accessible
  if (isAdmin) {
    return allActions.map((action) => ({
      actionId: action.id,
      actionCode: action.code,
      actionName: action.name,
      pageCode: page.code,
      hasAccess: true,
      actionType: action.actionType,
      requiresPermission: action.requiresPermission,
    }));
  }

  // Get user's action access records
  const userAccess = await db
    .select({
      actionId: userActionAccess.actionId,
      hasAccess: userActionAccess.hasAccess,
    })
    .from(userActionAccess)
    .where(
      and(
        eq(userActionAccess.tenantId, tenantId),
        eq(userActionAccess.userId, userId)
      )
    );

  const accessMap = new Map(userAccess.map((a) => [a.actionId, a.hasAccess]));

  // Return actions with access status
  return allActions
    .map((action) => ({
      actionId: action.id,
      actionCode: action.code,
      actionName: action.name,
      pageCode: page.code,
      hasAccess: accessMap.get(action.id) ?? false,
      actionType: action.actionType,
      requiresPermission: action.requiresPermission,
    }))
    .filter((action) => action.hasAccess);
}

/**
 * Get role names for a user in a tenant.
 * Used to bridge page RBAC with role-based permissions.
 */
async function getUserRoleNames(tenantId: string, userId: string): Promise<string[]> {
  const userRoleRows = await db
    .select({ name: roles.name })
    .from(roles)
    .innerJoin(userRoles, eq(userRoles.roleId, roles.id))
    .where(
      and(
        eq(roles.tenantId, tenantId),
        eq(userRoles.userId, userId)
      )
    );

  return userRoleRows.map((r) => r.name);
}

/**
 * Check if a user has admin role
 */
async function checkIfUserIsAdmin(tenantId: string, userId: string): Promise<boolean> {
  const adminRole = await db
    .select({ id: roles.id })
    .from(roles)
    .innerJoin(userRoles, eq(userRoles.roleId, roles.id))
    .where(
      and(
        eq(roles.tenantId, tenantId),
        eq(roles.name, "admin"),
        eq(userRoles.userId, userId)
      )
    )
    .limit(1);

  return adminRole.length > 0;
}

/**
 * Batch check multiple pages for a user (more efficient for navigation filtering)
 */
export async function batchCheckPageAccess(
  tenantId: string,
  userId: string,
  routes: string[]
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();

  // Check if user is admin
  const isAdmin = await checkIfUserIsAdmin(tenantId, userId);

  // Get all pages matching the routes
  const matchingPages = await db
    .select({
      id: pages.id,
      route: pages.route,
      isAlwaysAccessible: pages.isAlwaysAccessible,
    })
    .from(pages);

  // Create a map of route to page
  const routeToPage = new Map(matchingPages.map((p) => [p.route, p]));

  // If admin, all routes are accessible
  if (isAdmin) {
    routes.forEach((route) => result.set(route, true));
    return result;
  }

  // Get user's page access
  const userAccess = await db
    .select({
      pageId: userPageAccess.pageId,
      hasAccess: userPageAccess.hasAccess,
    })
    .from(userPageAccess)
    .where(
      and(
        eq(userPageAccess.tenantId, tenantId),
        eq(userPageAccess.userId, userId)
      )
    );

  const accessMap = new Map(userAccess.map((a) => [a.pageId, a.hasAccess]));

  // Check each route
  routes.forEach((route) => {
    const page = routeToPage.get(route);
    if (!page) {
      // Route not in RBAC system - allow (backwards compatibility)
      result.set(route, true);
    } else if (page.isAlwaysAccessible) {
      result.set(route, true);
    } else {
      result.set(route, accessMap.get(page.id) ?? false);
    }
  });

  return result;
}
