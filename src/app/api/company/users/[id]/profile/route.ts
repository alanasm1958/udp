/**
 * /api/company/users/[id]/profile
 *
 * GET: Get user org profile
 * PATCH: Update user org profile (department, job title, manager, etc.)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError, getUserIdFromHeaders, isValidUUID } from "@/lib/tenant";
import { db } from "@/db";
import { userProfiles, users, departments, actors } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/company/users/[id]/profile
 */
export async function GET(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id: targetUserId } = await context.params;

    if (!isValidUUID(targetUserId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    // Verify user exists in tenant
    const user = await db
      .select({ id: users.id, name: users.fullName, email: users.email })
      .from(users)
      .where(and(eq(users.id, targetUserId), eq(users.tenantId, tenantId)))
      .limit(1);

    if (user.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get or return empty profile
    const profile = await db
      .select()
      .from(userProfiles)
      .where(and(eq(userProfiles.userId, targetUserId), eq(userProfiles.tenantId, tenantId)))
      .limit(1);

    if (profile.length === 0) {
      return NextResponse.json({
        profile: {
          userId: targetUserId,
          userName: user[0].name,
          userEmail: user[0].email,
          departmentId: null,
          departmentName: null,
          jobTitle: null,
          managerUserId: null,
          managerName: null,
          location: null,
          phone: null,
          isOrgChartVisible: true,
        },
      });
    }

    // Get department name if assigned
    let departmentName = null;
    if (profile[0].departmentId) {
      const dept = await db
        .select({ name: departments.name })
        .from(departments)
        .where(eq(departments.id, profile[0].departmentId))
        .limit(1);
      departmentName = dept[0]?.name || null;
    }

    // Get manager name if assigned
    let managerName = null;
    if (profile[0].managerUserId) {
      const manager = await db
        .select({ name: users.fullName, email: users.email })
        .from(users)
        .where(eq(users.id, profile[0].managerUserId))
        .limit(1);
      managerName = manager[0]?.name || manager[0]?.email || null;
    }

    return NextResponse.json({
      profile: {
        id: profile[0].id,
        userId: targetUserId,
        userName: user[0].name,
        userEmail: user[0].email,
        departmentId: profile[0].departmentId,
        departmentName,
        jobTitle: profile[0].jobTitle,
        managerUserId: profile[0].managerUserId,
        managerName,
        location: profile[0].location,
        phone: profile[0].phone,
        isOrgChartVisible: profile[0].isOrgChartVisible,
        updatedAt: profile[0].updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/company/users/[id]/profile error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/company/users/[id]/profile
 */
export async function PATCH(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const currentUserId = getUserIdFromHeaders(req);
    const { id: targetUserId } = await context.params;

    if (!currentUserId || !isValidUUID(currentUserId)) {
      return NextResponse.json({ error: "Missing or invalid x-user-id header" }, { status: 400 });
    }

    if (!isValidUUID(targetUserId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    // Verify target user exists in tenant
    const user = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, targetUserId), eq(users.tenantId, tenantId)))
      .limit(1);

    if (user.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const { departmentId, jobTitle, managerUserId, location, phone, isOrgChartVisible } = body;

    // Validate department if provided
    if (departmentId !== undefined && departmentId !== null) {
      if (!isValidUUID(departmentId)) {
        return NextResponse.json({ error: "Invalid departmentId" }, { status: 400 });
      }

      const dept = await db
        .select({ id: departments.id })
        .from(departments)
        .where(and(eq(departments.id, departmentId), eq(departments.tenantId, tenantId)))
        .limit(1);

      if (dept.length === 0) {
        return NextResponse.json({ error: "Department not found" }, { status: 404 });
      }
    }

    // Validate manager if provided
    if (managerUserId !== undefined && managerUserId !== null) {
      if (!isValidUUID(managerUserId)) {
        return NextResponse.json({ error: "Invalid managerUserId" }, { status: 400 });
      }

      // Prevent self-reporting
      if (managerUserId === targetUserId) {
        return NextResponse.json({ error: "User cannot be their own manager" }, { status: 400 });
      }

      const manager = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, managerUserId), eq(users.tenantId, tenantId)))
        .limit(1);

      if (manager.length === 0) {
        return NextResponse.json({ error: "Manager not found" }, { status: 404 });
      }
    }

    // Get or create actor
    let actor = await db
      .select()
      .from(actors)
      .where(and(eq(actors.tenantId, tenantId), eq(actors.userId, currentUserId)))
      .limit(1);

    let actorId: string;
    if (actor.length === 0) {
      const newActor = await db
        .insert(actors)
        .values({ tenantId, type: "user", userId: currentUserId })
        .returning({ id: actors.id });
      actorId = newActor[0].id;
    } else {
      actorId = actor[0].id;
    }

    // Check if profile exists
    const existing = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(and(eq(userProfiles.userId, targetUserId), eq(userProfiles.tenantId, tenantId)))
      .limit(1);

    // Build update/insert values
    const values: Record<string, unknown> = {
      updatedAt: sql`now()`,
    };

    if (departmentId !== undefined) values.departmentId = departmentId;
    if (jobTitle !== undefined) values.jobTitle = jobTitle;
    if (managerUserId !== undefined) values.managerUserId = managerUserId;
    if (location !== undefined) values.location = location;
    if (phone !== undefined) values.phone = phone;
    if (isOrgChartVisible !== undefined) values.isOrgChartVisible = isOrgChartVisible;

    let result;
    if (existing.length === 0) {
      // Insert new profile
      result = await db
        .insert(userProfiles)
        .values({
          tenantId,
          userId: targetUserId,
          ...values,
        })
        .returning();
    } else {
      // Update existing profile
      result = await db
        .update(userProfiles)
        .set(values)
        .where(and(eq(userProfiles.userId, targetUserId), eq(userProfiles.tenantId, tenantId)))
        .returning();
    }

    // Audit log
    await logAuditEvent({
      tenantId,
      actorId,
      entityType: "user_profile",
      entityId: result[0].id,
      action: "user_org_profile_updated",
      metadata: { targetUserId, changes: Object.keys(body) },
    });

    return NextResponse.json({
      success: true,
      profile: {
        id: result[0].id,
        userId: targetUserId,
        departmentId: result[0].departmentId,
        jobTitle: result[0].jobTitle,
        managerUserId: result[0].managerUserId,
        location: result[0].location,
        phone: result[0].phone,
        isOrgChartVisible: result[0].isOrgChartVisible,
        updatedAt: result[0].updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/company/users/[id]/profile error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
