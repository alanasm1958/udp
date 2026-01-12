/**
 * /api/master/categories
 *
 * GET: List all categories for the tenant
 * POST: Create a new category
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError, getUserIdFromHeaders, isValidUUID } from "@/lib/tenant";
import { db } from "@/db";
import { categories, actors } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit";

type CategoryDomain = "product" | "party" | "service" | "generic";

/**
 * GET /api/master/categories?domain=product
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { searchParams } = new URL(req.url);
    const domain = searchParams.get("domain") as CategoryDomain | null;

    const conditions = [eq(categories.tenantId, tenantId)];

    if (domain && ["product", "party", "service", "generic"].includes(domain)) {
      conditions.push(eq(categories.domain, domain));
    }

    const items = await db
      .select()
      .from(categories)
      .where(and(...conditions))
      .orderBy(asc(categories.name));

    // Build hierarchical structure
    const rootCategories = items.filter((c) => !c.parentCategoryId);
    const childMap = new Map<string, typeof items>();

    items.forEach((c) => {
      if (c.parentCategoryId) {
        const children = childMap.get(c.parentCategoryId) || [];
        children.push(c);
        childMap.set(c.parentCategoryId, children);
      }
    });

    function buildTree(cat: typeof items[0]): object {
      return {
        id: cat.id,
        name: cat.name,
        code: cat.code,
        description: cat.description,
        domain: cat.domain,
        parentCategoryId: cat.parentCategoryId,
        isActive: cat.isActive,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
        children: (childMap.get(cat.id) || []).map(buildTree),
      };
    }

    return NextResponse.json({
      items: items.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        description: c.description,
        domain: c.domain,
        parentCategoryId: c.parentCategoryId,
        isActive: c.isActive,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      tree: rootCategories.map(buildTree),
      total: items.length,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/master/categories error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/master/categories
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userId = getUserIdFromHeaders(req);

    if (!userId || !isValidUUID(userId)) {
      return NextResponse.json({ error: "Missing or invalid x-user-id header" }, { status: 400 });
    }

    const body = await req.json();
    const { name, code, description, domain, parentCategoryId } = body;

    if (!name) {
      return NextResponse.json({ error: "Missing required field: name" }, { status: 400 });
    }

    if (!domain || !["product", "party", "service", "generic"].includes(domain)) {
      return NextResponse.json({ error: "Invalid domain. Must be: product, party, service, or generic" }, { status: 400 });
    }

    // Validate parent category exists if provided
    if (parentCategoryId) {
      if (!isValidUUID(parentCategoryId)) {
        return NextResponse.json({ error: "Invalid parentCategoryId" }, { status: 400 });
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
      if (parent[0].domain !== domain) {
        return NextResponse.json({ error: "Parent category must be in the same domain" }, { status: 400 });
      }
    }

    // Get or create actor for user
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

    const result = await db
      .insert(categories)
      .values({
        tenantId,
        name,
        code: code || null,
        description: description || null,
        domain,
        parentCategoryId: parentCategoryId || null,
        createdByActorId: actorId,
      })
      .returning();

    // Audit log
    await logAuditEvent({
      tenantId,
      actorId,
      entityType: "category",
      entityId: result[0].id,
      action: "category_created",
      metadata: { name, code, domain, parentCategoryId },
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
    console.error("POST /api/master/categories error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
