/**
 * GET /api/admin/roles
 * List all roles in the tenant with their permission counts
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { roles, rolePermissions } from "@/db/schema";
import { requireRole, ROLES, AuthContext } from "@/lib/authz";
import { eq, sql, asc } from "drizzle-orm";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // RBAC: admin only
    const roleCheck = requireRole(req, [ROLES.ADMIN]);
    if (roleCheck instanceof NextResponse) return roleCheck;
    const auth = roleCheck as AuthContext;

    // Get all roles with permission counts
    const tenantRoles = await db
      .select({
        id: roles.id,
        name: roles.name,
        createdAt: roles.createdAt,
        permissionCount: sql<number>`(
          SELECT COUNT(*)::int
          FROM ${rolePermissions}
          WHERE ${rolePermissions.roleId} = ${roles.id}
          AND ${rolePermissions.tenantId} = ${auth.tenantId}
        )`,
      })
      .from(roles)
      .where(eq(roles.tenantId, auth.tenantId))
      .orderBy(asc(roles.name));

    return NextResponse.json({
      roles: tenantRoles,
    });
  } catch (error) {
    console.error("Error fetching roles:", error);
    return NextResponse.json(
      { error: "Failed to fetch roles" },
      { status: 500 }
    );
  }
}
