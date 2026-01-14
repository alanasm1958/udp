/**
 * GET /api/admin/permissions
 * List all available system permissions grouped by module
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { permissions } from "@/db/schema";
import { requireRole, ROLES, AuthContext } from "@/lib/authz";
import { asc } from "drizzle-orm";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // RBAC: admin only
    const roleCheck = requireRole(req, [ROLES.ADMIN]);
    if (roleCheck instanceof NextResponse) return roleCheck;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _auth = roleCheck as AuthContext;

    // Get all permissions ordered by module and action
    const allPermissions = await db
      .select({
        id: permissions.id,
        code: permissions.code,
        module: permissions.module,
        action: permissions.action,
        description: permissions.description,
      })
      .from(permissions)
      .orderBy(asc(permissions.module), asc(permissions.action));

    // Group by module for easier UI rendering
    const grouped = allPermissions.reduce(
      (acc, p) => {
        if (!acc[p.module]) acc[p.module] = [];
        acc[p.module].push(p);
        return acc;
      },
      {} as Record<string, typeof allPermissions>
    );

    return NextResponse.json({
      permissions: grouped,
      total: allPermissions.length,
    });
  } catch (error) {
    console.error("Error fetching permissions:", error);
    return NextResponse.json(
      { error: "Failed to fetch permissions" },
      { status: 500 }
    );
  }
}
