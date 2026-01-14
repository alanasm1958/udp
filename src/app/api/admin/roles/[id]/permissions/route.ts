/**
 * GET /api/admin/roles/[id]/permissions
 * Get all permissions assigned to a specific role
 *
 * PATCH /api/admin/roles/[id]/permissions
 * Update permissions for a role (full replacement)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { roles, rolePermissions, permissions } from "@/db/schema";
import { requireRole, ROLES, AuthContext, clearPermissionCache } from "@/lib/authz";
import { logAuditEvent } from "@/lib/audit";
import { eq, and, inArray } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET - Get permissions assigned to a role
 */
export async function GET(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    // RBAC: admin only
    const roleCheck = requireRole(req, [ROLES.ADMIN]);
    if (roleCheck instanceof NextResponse) return roleCheck;
    const auth = roleCheck as AuthContext;

    const { id: roleId } = await params;

    // Verify role belongs to tenant
    const [role] = await db
      .select({
        id: roles.id,
        name: roles.name,
        createdAt: roles.createdAt,
      })
      .from(roles)
      .where(and(eq(roles.tenantId, auth.tenantId), eq(roles.id, roleId)))
      .limit(1);

    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Get assigned permissions
    const assigned = await db
      .select({
        id: permissions.id,
        code: permissions.code,
        module: permissions.module,
        action: permissions.action,
        description: permissions.description,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        and(eq(rolePermissions.tenantId, auth.tenantId), eq(rolePermissions.roleId, roleId))
      );

    return NextResponse.json({
      role,
      permissions: assigned,
      permissionIds: assigned.map((p) => p.id),
    });
  } catch (error) {
    console.error("Error fetching role permissions:", error);
    return NextResponse.json(
      { error: "Failed to fetch role permissions" },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update role permissions (full replacement)
 */
export async function PATCH(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    // RBAC: admin only
    const roleCheck = requireRole(req, [ROLES.ADMIN]);
    if (roleCheck instanceof NextResponse) return roleCheck;
    const auth = roleCheck as AuthContext;

    const { id: roleId } = await params;
    const body = await req.json();
    const { permissionIds } = body as { permissionIds: string[] };

    if (!Array.isArray(permissionIds)) {
      return NextResponse.json(
        { error: "permissionIds must be an array" },
        { status: 400 }
      );
    }

    // Verify role belongs to tenant
    const [role] = await db
      .select({
        id: roles.id,
        name: roles.name,
      })
      .from(roles)
      .where(and(eq(roles.tenantId, auth.tenantId), eq(roles.id, roleId)))
      .limit(1);

    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Prevent modifying admin role permissions (admin has implicit access to all)
    if (role.name === "admin") {
      return NextResponse.json(
        { error: "Cannot modify admin role permissions. Admin has implicit access to all permissions." },
        { status: 400 }
      );
    }

    // Validate all permission IDs exist
    if (permissionIds.length > 0) {
      const validPermissions = await db
        .select({ id: permissions.id })
        .from(permissions)
        .where(inArray(permissions.id, permissionIds));

      if (validPermissions.length !== permissionIds.length) {
        const validIds = new Set(validPermissions.map((p) => p.id));
        const invalidIds = permissionIds.filter((id) => !validIds.has(id));
        return NextResponse.json(
          { error: "Invalid permission IDs", invalidIds },
          { status: 400 }
        );
      }
    }

    // Delete existing role permissions for this tenant
    await db.delete(rolePermissions).where(
      and(eq(rolePermissions.tenantId, auth.tenantId), eq(rolePermissions.roleId, roleId))
    );

    // Insert new permissions
    if (permissionIds.length > 0) {
      await db.insert(rolePermissions).values(
        permissionIds.map((permissionId) => ({
          tenantId: auth.tenantId,
          roleId,
          permissionId,
          createdByActorId: auth.actorId,
        }))
      );
    }

    // Clear permission cache for this tenant
    clearPermissionCache(auth.tenantId);

    // Audit log
    await logAuditEvent({
      tenantId: auth.tenantId,
      actorId: auth.actorId,
      entityType: "role",
      entityId: roleId,
      action: "role_permissions_updated",
      metadata: {
        roleName: role.name,
        permissionCount: permissionIds.length,
      },
    });

    return NextResponse.json({
      success: true,
      permissionCount: permissionIds.length,
    });
  } catch (error) {
    console.error("Error updating role permissions:", error);
    return NextResponse.json(
      { error: "Failed to update role permissions" },
      { status: 500 }
    );
  }
}
