/**
 * /api/master/categories/[id]
 *
 * PATCH: Update a category
 * DELETE: Delete a category
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError, getUserIdFromHeaders, isValidUUID } from "@/lib/tenant";
import { db } from "@/db";
import { categories, actors } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/master/categories/[id]
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
      return NextResponse.json({ error: "Invalid category ID" }, { status: 400 });
    }

    // Check category exists
    const existing = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.tenantId, tenantId)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const body = await req.json();
    const { name, code, description, parentCategoryId, isActive } = body;

    // Validate parent category if provided
    if (parentCategoryId !== undefined && parentCategoryId !== null) {
      if (!isValidUUID(parentCategoryId)) {
        return NextResponse.json({ error: "Invalid parentCategoryId" }, { status: 400 });
      }

      // Prevent circular reference
      if (parentCategoryId === id) {
        return NextResponse.json({ error: "Category cannot be its own parent" }, { status: 400 });
      }

      const parent = await db
        .select({ id: categories.id, domain: categories.domain })
        .from(categories)
        .where(and(eq(categories.id, parentCategoryId), eq(categories.tenantId, tenantId)))
        .limit(1);

      if (parent.length === 0) {
        return NextResponse.json({ error: "Parent category not found" }, { status: 404 });
      }

      // Parent must be in the same domain
      if (parent[0].domain !== existing[0].domain) {
        return NextResponse.json({ error: "Parent category must be in the same domain" }, { status: 400 });
      }
    }

    // Get actor
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
    if (parentCategoryId !== undefined) {
      updates.parentCategoryId = parentCategoryId;
      changes.parentCategoryId = parentCategoryId;
    }
    if (isActive !== undefined) {
      updates.isActive = isActive;
      changes.isActive = isActive;
    }

    const result = await db
      .update(categories)
      .set(updates)
      .where(and(eq(categories.id, id), eq(categories.tenantId, tenantId)))
      .returning();

    // Audit log
    await logAuditEvent({
      tenantId,
      actorId,
      entityType: "category",
      entityId: id,
      action: "category_updated",
      metadata: { changes },
    });

    return NextResponse.json({
      success: true,
      category: {
        id: result[0].id,
        name: result[0].name,
        code: result[0].code,
        description: result[0].description,
        domain: result[0].domain,
        parentCategoryId: result[0].parentCategoryId,
        isActive: result[0].isActive,
        createdAt: result[0].createdAt,
        updatedAt: result[0].updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/master/categories/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/master/categories/[id]
 */
export async function DELETE(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await context.params;

    if (!isValidUUID(id)) {
      return NextResponse.json({ error: "Invalid category ID" }, { status: 400 });
    }

    // Check category exists
    const existing = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.tenantId, tenantId)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Check if category has child categories
    const children = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.parentCategoryId, id), eq(categories.tenantId, tenantId)))
      .limit(1);

    if (children.length > 0) {
      return NextResponse.json({ error: "Cannot delete category with child categories" }, { status: 400 });
    }

    // Delete the category
    await db
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.tenantId, tenantId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("DELETE /api/master/categories/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
