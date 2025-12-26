/**
 * /api/admin/users
 *
 * GET: List all users in the tenant
 * POST: Create a new user
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, actors, roles, userRoles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireRole, ROLES, AuthContext } from "@/lib/authz";
import { hashPassword } from "@/lib/password";
import { logAuditEvent } from "@/lib/audit";

interface CreateUserRequest {
  email: string;
  fullName: string;
  password: string;
  roles: string[];
}

/**
 * GET /api/admin/users
 * List all users in the tenant
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // RBAC: admin only
    const roleCheck = requireRole(req, [ROLES.ADMIN]);
    if (roleCheck instanceof NextResponse) return roleCheck;
    const auth = roleCheck as AuthContext;

    // Get all users in tenant
    const tenantUsers = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.tenantId, auth.tenantId));

    // Get roles for each user
    const usersWithRoles = await Promise.all(
      tenantUsers.map(async (user) => {
        const userRoleRows = await db
          .select({ roleName: roles.name })
          .from(userRoles)
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .where(
            and(
              eq(userRoles.tenantId, auth.tenantId),
              eq(userRoles.userId, user.id)
            )
          );

        return {
          ...user,
          roles: userRoleRows.map((r) => r.roleName),
        };
      })
    );

    return NextResponse.json({ users: usersWithRoles });
  } catch (error) {
    console.error("GET /api/admin/users error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/users
 * Create a new user
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // RBAC: admin only
    const roleCheck = requireRole(req, [ROLES.ADMIN]);
    if (roleCheck instanceof NextResponse) return roleCheck;
    const auth = roleCheck as AuthContext;

    const body: CreateUserRequest = await req.json();

    // Validate input
    if (!body.email || !body.fullName || !body.password) {
      return NextResponse.json(
        { error: "email, fullName, and password are required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.roles) || body.roles.length === 0) {
      return NextResponse.json(
        { error: "At least one role is required" },
        { status: 400 }
      );
    }

    const email = body.email.toLowerCase().trim();

    // Check if user already exists in this tenant
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.tenantId, auth.tenantId),
          eq(users.email, email)
        )
      )
      .limit(1);

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
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

    // Hash password
    const passwordHash = await hashPassword(body.password);

    // Create user
    const [user] = await db
      .insert(users)
      .values({
        tenantId: auth.tenantId,
        email,
        fullName: body.fullName,
        passwordHash,
        isActive: true,
      })
      .returning({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    // Create actor for user
    const [actor] = await db
      .insert(actors)
      .values({
        tenantId: auth.tenantId,
        type: "user",
        userId: user.id,
      })
      .returning({ id: actors.id });

    // Assign roles
    for (const roleName of body.roles) {
      const roleId = roleMap.get(roleName)!;
      await db.insert(userRoles).values({
        tenantId: auth.tenantId,
        userId: user.id,
        roleId,
      });
    }

    // Audit log
    await logAuditEvent({
      tenantId: auth.tenantId,
      actorId: auth.actorId,
      entityType: "user",
      entityId: user.id,
      action: "user_created",
      metadata: { email, roles: body.roles },
    });

    return NextResponse.json(
      {
        user: {
          ...user,
          actorId: actor.id,
          roles: body.roles,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/admin/users error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
