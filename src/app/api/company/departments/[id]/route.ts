/**
 * /api/company/departments/[id]
 *
 * PATCH: Update a department
 * DELETE: Delete a department
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError, getUserIdFromHeaders, isValidUUID } from "@/lib/tenant";
import { db } from "@/db";
import { departments, actors, userProfiles } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/company/departments/[id]
 */
export async function PATCH(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userId = getUserIdFromHeaders(req);
    const { id } = await context.params;

    if (!userId || !isValidUUID(userId)) {
      return NextResponse.json({ error: "Missing or invalid x-user-id header" }, { status: 400 });
    }

    if (!isValidUUID(id)) {
      return NextResponse.json({ error: "Invalid department ID" }, { status: 400 });
    }

    // Check department exists
    const existing = await db
      .select()
      .from(departments)
      .where(and(eq(departments.id, id), eq(departments.tenantId, tenantId)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    const body = await req.json();
    const { name, code, description, parentDepartmentId, isActive } = body;

    // Validate parent department if provided
    if (parentDepartmentId !== undefined && parentDepartmentId !== null) {
      if (!isValidUUID(parentDepartmentId)) {
        return NextResponse.json({ error: "Invalid parentDepartmentId" }, { status: 400 });
      }

      // Prevent circular reference
      if (parentDepartmentId === id) {
        return NextResponse.json({ error: "Department cannot be its own parent" }, { status: 400 });
      }

      const parent = await db
        .select({ id: departments.id })
        .from(departments)
        .where(and(eq(departments.id, parentDepartmentId), eq(departments.tenantId, tenantId)))
        .limit(1);

      if (parent.length === 0) {
        return NextResponse.json({ error: "Parent department not found" }, { status: 404 });
      }
    }

    // Get actor
    const actor = await db
      .select()
      .from(actors)
      .where(and(eq(actors.tenantId, tenantId), eq(actors.userId, userId)))
      .limit(1);

    let actorId: string;
    if (actor.length === 0) {
      const newActor = await db
        .insert(actors)
        .values({ tenantId, type: "user", userId })
        .returning({ id: actors.id });
      actorId = newActor[0].id;
    } else {
      actorId = actor[0].id;
    }

    // Build update object
    const updates: Record<string, unknown> = { updatedAt: sql`now()` };
    const changes: Record<string, unknown> = {};

    if (name !== undefined) {
      updates.name = name;
      changes.name = name;
    }
    if (code !== undefined) {
      updates.code = code;
      changes.code = code;
    }
    if (description !== undefined) {
      updates.description = description;
      changes.description = description;
    }
    if (parentDepartmentId !== undefined) {
      updates.parentDepartmentId = parentDepartmentId;
      changes.parentDepartmentId = parentDepartmentId;
    }
    if (isActive !== undefined) {
      updates.isActive = isActive;
      changes.isActive = isActive;
    }

    const result = await db
      .update(departments)
      .set(updates)
      .where(and(eq(departments.id, id), eq(departments.tenantId, tenantId)))
      .returning();

    // Audit log
    await logAuditEvent({
      tenantId,
      actorId,
      entityType: "department",
      entityId: id,
      action: "department_updated",
      metadata: { changes },
    });

    return NextResponse.json({
      success: true,
      department: {
        id: result[0].id,
        name: result[0].name,
        code: result[0].code,
        description: result[0].description,
        parentDepartmentId: result[0].parentDepartmentId,
        isActive: result[0].isActive,
        createdAt: result[0].createdAt,
        updatedAt: result[0].updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/company/departments/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/company/departments/[id]
 */
export async function DELETE(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await context.params;

    if (!isValidUUID(id)) {
      return NextResponse.json({ error: "Invalid department ID" }, { status: 400 });
    }

    // Check department exists
    const existing = await db
      .select()
      .from(departments)
      .where(and(eq(departments.id, id), eq(departments.tenantId, tenantId)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    // Check if department has child departments
    const children = await db
      .select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.parentDepartmentId, id), eq(departments.tenantId, tenantId)))
      .limit(1);

    if (children.length > 0) {
      return NextResponse.json({ error: "Cannot delete department with child departments" }, { status: 400 });
    }

    // Check if department has assigned users
    const assignedUsers = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(and(eq(userProfiles.departmentId, id), eq(userProfiles.tenantId, tenantId)))
      .limit(1);

    if (assignedUsers.length > 0) {
      return NextResponse.json({ error: "Cannot delete department with assigned users" }, { status: 400 });
    }

    // Delete the department
    await db
      .delete(departments)
      .where(and(eq(departments.id, id), eq(departments.tenantId, tenantId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("DELETE /api/company/departments/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
