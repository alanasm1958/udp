/**
 * Tenant Users Management API
 * Platform owner only - manage users within any tenant
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tenants, users, roles, userRoles, actors } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requirePlatformOwner } from "@/lib/authz";
import { hashPassword } from "@/lib/password";
import { logAuditEvent, AuditAction } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tenant-management/[id]/users
 * List all users in a tenant
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const authResult = await requirePlatformOwner(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id: tenantId } = await params;

  try {
    // Verify tenant exists
    const [tenant] = await db
      .select({ id: tenants.id, name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

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
      .where(eq(users.tenantId, tenantId))
      .orderBy(desc(users.createdAt));

    // Get roles for each user
    const userIds = tenantUsers.map((u) => u.id);
    const userRolesData =
      userIds.length > 0
        ? await db
            .select({
              userId: userRoles.userId,
              roleId: userRoles.roleId,
              roleName: roles.name,
            })
            .from(userRoles)
            .innerJoin(roles, eq(userRoles.roleId, roles.id))
            .where(eq(userRoles.tenantId, tenantId))
        : [];

    // Map roles to users
    const userRolesMap = new Map<string, string[]>();
    userRolesData.forEach((ur) => {
      const existing = userRolesMap.get(ur.userId) || [];
      existing.push(ur.roleName);
      userRolesMap.set(ur.userId, existing);
    });

    const usersWithRoles = tenantUsers.map((user) => ({
      ...user,
      roles: userRolesMap.get(user.id) || [],
    }));

    return NextResponse.json({
      tenant: { id: tenant.id, name: tenant.name },
      users: usersWithRoles,
    });
  } catch (error) {
    console.error("Error listing tenant users:", error);
    return NextResponse.json(
      { error: "Failed to list users" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tenant-management/[id]/users
 * Create a new user in a tenant
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const authResult = await requirePlatformOwner(req);
  if (authResult instanceof NextResponse) return authResult;
  const auth = authResult;

  const { id: tenantId } = await params;

  try {
    const body = await req.json();
    const { email, fullName, password, roleNames = [] } = body;

    // Validate required fields
    if (!email || !fullName || !password) {
      return NextResponse.json(
        { error: "Missing required fields: email, fullName, password" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Verify tenant exists and is active
    const [tenant] = await db
      .select({ id: tenants.id, status: tenants.status })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (tenant.status !== "active") {
      return NextResponse.json(
        { error: "Cannot create users in inactive tenant" },
        { status: 400 }
      );
    }

    // Check if email already exists in tenant
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

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: "Email already exists in this tenant" },
        { status: 409 }
      );
    }

    // Create user in transaction
    const result = await db.transaction(async (tx) => {
      // 1. Create user
      const passwordHash = await hashPassword(password);
      const [newUser] = await tx
        .insert(users)
        .values({
          tenantId,
          email: email.toLowerCase(),
          fullName,
          passwordHash,
          isActive: true,
        })
        .returning();

      // 2. Create actor
      await tx.insert(actors).values({
        tenantId,
        type: "user",
        userId: newUser.id,
      });

      // 3. Assign roles if specified
      if (roleNames.length > 0) {
        const tenantRoles = await tx
          .select({ id: roles.id, name: roles.name })
          .from(roles)
          .where(eq(roles.tenantId, tenantId));

        const roleMap = new Map(tenantRoles.map((r) => [r.name, r.id]));
        const validRoleIds = roleNames
          .filter((name: string) => roleMap.has(name))
          .map((name: string) => roleMap.get(name)!);

        if (validRoleIds.length > 0) {
          await tx.insert(userRoles).values(
            validRoleIds.map((roleId: string) => ({
              tenantId,
              userId: newUser.id,
              roleId,
            }))
          );
        }
      }

      return newUser;
    });

    // Audit log
    await logAuditEvent({
      tenantId: auth.tenantId,
      actorId: auth.actorId,
      action: "user_created" as AuditAction,
      entityType: "user",
      entityId: result.id,
      metadata: {
        targetTenantId: tenantId,
        email: email.toLowerCase(),
        roles: roleNames,
        byPlatformOwner: true,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: result.id,
        email: result.email,
        fullName: result.fullName,
        isActive: result.isActive,
        roles: roleNames,
      },
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}
