/**
 * POST /api/auth/login
 * Authenticate user with email + password, issue session cookie
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, actors, roles, userRoles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyPassword } from "@/lib/password";
import { createSessionToken, setSessionCookie } from "@/lib/auth";

interface LoginRequest {
  email: string;
  password: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: LoginRequest = await req.json();

    if (!body.email || !body.password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const email = body.email.toLowerCase().trim();

    // Find user by email (users table is tenant-scoped, but email should be unique globally for login)
    const [user] = await db
      .select({
        id: users.id,
        tenantId: users.tenantId,
        email: users.email,
        fullName: users.fullName,
        passwordHash: users.passwordHash,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Account is deactivated" },
        { status: 401 }
      );
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        { error: "Password not set for this account" },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await verifyPassword(body.password, user.passwordHash);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Get or create actor for this user
    let [actor] = await db
      .select({ id: actors.id })
      .from(actors)
      .where(
        and(
          eq(actors.tenantId, user.tenantId),
          eq(actors.userId, user.id),
          eq(actors.type, "user")
        )
      )
      .limit(1);

    if (!actor) {
      // Create actor
      const [newActor] = await db
        .insert(actors)
        .values({
          tenantId: user.tenantId,
          type: "user",
          userId: user.id,
        })
        .returning({ id: actors.id });
      actor = newActor;
    }

    // Get user roles
    const userRoleRows = await db
      .select({
        roleName: roles.name,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        and(
          eq(userRoles.tenantId, user.tenantId),
          eq(userRoles.userId, user.id)
        )
      );

    const roleNames = userRoleRows.map((r) => r.roleName);

    // Create session token
    const token = await createSessionToken({
      userId: user.id,
      actorId: actor.id,
      tenantId: user.tenantId,
      roles: roleNames,
      email: user.email,
    });

    // Set session cookie
    await setSessionCookie(token);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        tenantId: user.tenantId,
        roles: roleNames,
      },
    });
  } catch (error) {
    console.error("POST /api/auth/login error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Login failed" },
      { status: 500 }
    );
  }
}
