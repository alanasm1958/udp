/**
 * Individual User Management API
 * Platform owner only - manage individual users in any tenant
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tenants, users, roles, userRoles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requirePlatformOwner } from "@/lib/authz";
import { hashPassword } from "@/lib/password";
import { logAuditEvent, AuditAction } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string; userId: string }>;
}

/**
 * GET /api/tenant-management/[id]/users/[userId]
 * Get user details
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const authResult = await requirePlatformOwner(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id: tenantId, userId } = await params;

  try {
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
      .where(and(eq(users.tenantId, tenantId), eq(users.id, userId)))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get user roles
    const userRolesData = await db
      .select({ roleName: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(and(eq(userRoles.tenantId, tenantId), eq(userRoles.userId, userId)));

    return NextResponse.json({
      user: {
        ...user,
        roles: userRolesData.map((r) => r.roleName),
      },
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tenant-management/[id]/users/[userId]
 * Update user details, status, roles
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const authResult = await requirePlatformOwner(req);
  if (authResult instanceof NextResponse) return authResult;
  const auth = authResult;

  const { id: tenantId, userId } = await params;

  try {
    const body = await req.json();
    const { fullName, email, password, isActive, roleNames } = body;

    // Get current user
    const [currentUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.id, userId)))
      .limit(1);

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    const auditChanges: Record<string, { from: unknown; to: unknown }> = {};

    // Handle field updates
    if (fullName && fullName !== currentUser.fullName) {
      updates.fullName = fullName;
      auditChanges.fullName = { from: currentUser.fullName, to: fullName };
    }

    if (email && email.toLowerCase() !== currentUser.email) {
      // Check if new email already exists
      const existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.tenantId, tenantId),
            eq(users.email, email.toLowerCase())
          )
        )
        .limit(1);

      if (existingUser.length > 0 && existingUser[0].id !== userId) {
        return NextResponse.json(
          { error: "Email already exists in this tenant" },
          { status: 409 }
        );
      }

      updates.email = email.toLowerCase();
      auditChanges.email = { from: currentUser.email, to: email.toLowerCase() };
    }

    if (password) {
      if (password.length < 8) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters" },
          { status: 400 }
        );
      }
      updates.passwordHash = await hashPassword(password);
      auditChanges.password = { from: "[redacted]", to: "[changed]" };
    }

    if (typeof isActive === "boolean" && isActive !== currentUser.isActive) {
      updates.isActive = isActive;
      auditChanges.isActive = { from: currentUser.isActive, to: isActive };
    }

    // Update user fields
    if (Object.keys(updates).length > 0) {
      await db
        .update(users)
        .set(updates)
        .where(eq(users.id, userId));
    }

    // Handle role updates
    if (Array.isArray(roleNames)) {
      // Get current roles
      const currentRoles = await db
        .select({ roleName: roles.name })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(
          and(eq(userRoles.tenantId, tenantId), eq(userRoles.userId, userId))
        );

      const currentRoleNames = currentRoles.map((r) => r.roleName);

      // Only update if roles changed
      if (
        JSON.stringify(currentRoleNames.sort()) !==
        JSON.stringify([...roleNames].sort())
      ) {
        // Delete all current role assignments
        await db
          .delete(userRoles)
          .where(
            and(eq(userRoles.tenantId, tenantId), eq(userRoles.userId, userId))
          );

        // Get role IDs for new roles
        if (roleNames.length > 0) {
          const tenantRoles = await db
            .select({ id: roles.id, name: roles.name })
            .from(roles)
            .where(eq(roles.tenantId, tenantId));

          const roleMap = new Map(tenantRoles.map((r) => [r.name, r.id]));
          const validRoleIds = roleNames
            .filter((name: string) => roleMap.has(name))
            .map((name: string) => roleMap.get(name)!);

          if (validRoleIds.length > 0) {
            await db.insert(userRoles).values(
              validRoleIds.map((roleId: string) => ({
                tenantId,
                userId,
                roleId,
              }))
            );
          }
        }

        auditChanges.roles = { from: currentRoleNames, to: roleNames };
      }
    }

    // Audit log
    if (Object.keys(auditChanges).length > 0) {
      await logAuditEvent({
        tenantId: auth.tenantId,
        actorId: auth.actorId,
        action: "user_updated" as AuditAction,
        entityType: "user",
        entityId: userId,
        metadata: {
          targetTenantId: tenantId,
          changes: auditChanges,
          byPlatformOwner: true,
        },
      });
    }

    // Fetch updated user
    const [updatedUser] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const updatedRoles = await db
      .select({ roleName: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(and(eq(userRoles.tenantId, tenantId), eq(userRoles.userId, userId)));

    return NextResponse.json({
      success: true,
      user: {
        ...updatedUser,
        roles: updatedRoles.map((r) => r.roleName),
      },
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tenant-management/[id]/users/[userId]
 * Delete (deactivate) a user
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const authResult = await requirePlatformOwner(req);
  if (authResult instanceof NextResponse) return authResult;
  const auth = authResult;

  const { id: tenantId, userId } = await params;

  try {
    // Get user
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.id, userId)))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Soft delete - deactivate the user
    await db
      .update(users)
      .set({ isActive: false })
      .where(eq(users.id, userId));

    // Audit log
    await logAuditEvent({
      tenantId: auth.tenantId,
      actorId: auth.actorId,
      action: "user_deleted" as AuditAction,
      entityType: "user",
      entityId: userId,
      metadata: {
        targetTenantId: tenantId,
        email: user.email,
        byPlatformOwner: true,
        softDelete: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "User deactivated successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
