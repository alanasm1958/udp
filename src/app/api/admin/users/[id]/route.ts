/**
 * /api/admin/users/[id]
 *
 * GET: Get a single user
 * PATCH: Update user roles and/or isActive status
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, roles, userRoles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireRole, ROLES, AuthContext } from "@/lib/authz";
import { logAuditEvent } from "@/lib/audit";

interface UpdateUserRequest {
  roles?: string[];
  isActive?: boolean;
}

/**
 * GET /api/admin/users/[id]
 * Get a single user
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

    // Get user
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(
        and(
          eq(users.tenantId, auth.tenantId),
          eq(users.id, userId)
        )
      )
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get user's roles
    const userRoleRows = await db
      .select({ roleName: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        and(
          eq(userRoles.tenantId, auth.tenantId),
          eq(userRoles.userId, userId)
        )
      );

    return NextResponse.json({
      user: {
        ...user,
        roles: userRoleRows.map((r) => r.roleName),
      },
    });
  } catch (error) {
    console.error("GET /api/admin/users/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/users/[id]
 * Update user roles and/or isActive status
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // RBAC: admin only
    const roleCheck = requireRole(req, [ROLES.ADMIN]);
    if (roleCheck instanceof NextResponse) return roleCheck;
    const auth = roleCheck as AuthContext;

    const { id: userId } = await params;
    const body: UpdateUserRequest = await req.json();

    // Get user
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        isActive: users.isActive,
      })
      .from(users)
      .where(
        and(
          eq(users.tenantId, auth.tenantId),
          eq(users.id, userId)
        )
      )
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent deactivating yourself
    if (body.isActive === false && userId === auth.userId) {
      return NextResponse.json(
        { error: "Cannot deactivate your own account" },
        { status: 400 }
      );
    }

    // Update isActive if provided
    if (typeof body.isActive === "boolean") {
      await db
        .update(users)
        .set({ isActive: body.isActive })
        .where(
          and(
            eq(users.tenantId, auth.tenantId),
            eq(users.id, userId)
          )
        );

      // Audit log
      await logAuditEvent({
        tenantId: auth.tenantId,
        actorId: auth.actorId,
        entityType: "user",
        entityId: userId,
        action: body.isActive ? "user_activated" : "user_deactivated",
        metadata: { previousStatus: user.isActive },
      });
    }

    // Update roles if provided
    if (Array.isArray(body.roles)) {
      if (body.roles.length === 0) {
        return NextResponse.json(
          { error: "At least one role is required" },
          { status: 400 }
        );
      }

      // Validate roles exist
      const tenantRoles = await db
        .select({ id: roles.id, name: roles.name })
        .from(roles)
        .where(eq(roles.tenantId, auth.tenantId));

      const roleMap = new Map(tenantRoles.map((r) => [r.name, r.id]));

      for (const roleName of body.roles) {
        if (!roleMap.has(roleName)) {
          return NextResponse.json(
            { error: `Invalid role: ${roleName}` },
            { status: 400 }
          );
        }
      }

      // Prevent removing admin role from yourself
      if (userId === auth.userId && !body.roles.includes(ROLES.ADMIN)) {
        return NextResponse.json(
          { error: "Cannot remove admin role from your own account" },
          { status: 400 }
        );
      }

      // Delete existing role assignments
      await db
        .delete(userRoles)
        .where(
          and(
            eq(userRoles.tenantId, auth.tenantId),
            eq(userRoles.userId, userId)
          )
        );

      // Insert new role assignments
      for (const roleName of body.roles) {
        const roleId = roleMap.get(roleName)!;
        await db.insert(userRoles).values({
          tenantId: auth.tenantId,
          userId,
          roleId,
        });
      }

      // Audit log
      await logAuditEvent({
        tenantId: auth.tenantId,
        actorId: auth.actorId,
        entityType: "user",
        entityId: userId,
        action: "user_roles_changed",
        metadata: { newRoles: body.roles },
      });
    }

    // Get updated user with roles
    const [updatedUser] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(
        and(
          eq(users.tenantId, auth.tenantId),
          eq(users.id, userId)
        )
      )
      .limit(1);

    const updatedRoleRows = await db
      .select({ roleName: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        and(
          eq(userRoles.tenantId, auth.tenantId),
          eq(userRoles.userId, userId)
        )
      );

    return NextResponse.json({
      user: {
        ...updatedUser,
        roles: updatedRoleRows.map((r) => r.roleName),
      },
    });
  } catch (error) {
    console.error("PATCH /api/admin/users/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
