/**
 * /api/company/departments
 *
 * GET: List all departments for the tenant
 * POST: Create a new department
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError, getUserIdFromHeaders, isValidUUID } from "@/lib/tenant";
import { db } from "@/db";
import { departments, actors } from "@/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit";

/**
 * GET /api/company/departments
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);

    const items = await db
      .select()
      .from(departments)
      .where(eq(departments.tenantId, tenantId))
      .orderBy(asc(departments.name));

    // Build hierarchical structure
    const rootDepartments = items.filter((d) => !d.parentDepartmentId);
    const childMap = new Map<string, typeof items>();

    items.forEach((d) => {
      if (d.parentDepartmentId) {
        const children = childMap.get(d.parentDepartmentId) || [];
        children.push(d);
        childMap.set(d.parentDepartmentId, children);
      }
    });

    function buildTree(dept: typeof items[0]): object {
      return {
        id: dept.id,
        name: dept.name,
        code: dept.code,
        description: dept.description,
        parentDepartmentId: dept.parentDepartmentId,
        isActive: dept.isActive,
        createdAt: dept.createdAt,
        updatedAt: dept.updatedAt,
        children: (childMap.get(dept.id) || []).map(buildTree),
      };
    }

    return NextResponse.json({
      items: items.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        description: d.description,
        parentDepartmentId: d.parentDepartmentId,
        isActive: d.isActive,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
      tree: rootDepartments.map(buildTree),
      total: items.length,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/company/departments error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/company/departments
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userId = getUserIdFromHeaders(req);

    if (!userId || !isValidUUID(userId)) {
      return NextResponse.json({ error: "Missing or invalid x-user-id header" }, { status: 400 });
    }

    const body = await req.json();
    const { name, code, description, parentDepartmentId } = body;

    if (!name) {
      return NextResponse.json({ error: "Missing required field: name" }, { status: 400 });
    }

    // Validate parent department exists if provided
    if (parentDepartmentId) {
      if (!isValidUUID(parentDepartmentId)) {
        return NextResponse.json({ error: "Invalid parentDepartmentId" }, { status: 400 });
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

    // Get or create actor for user
    let actor = await db
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

    const result = await db
      .insert(departments)
      .values({
        tenantId,
        name,
        code: code || null,
        description: description || null,
        parentDepartmentId: parentDepartmentId || null,
        createdByActorId: actorId,
      })
      .returning();

    // Audit log
    await logAuditEvent({
      tenantId,
      actorId,
      entityType: "department",
      entityId: result[0].id,
      action: "department_created",
      metadata: { name, code, parentDepartmentId },
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
    console.error("POST /api/company/departments error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
