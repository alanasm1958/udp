/**
 * /api/master/warehouses
 *
 * CRUD endpoints for warehouse master data.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { warehouses } from "@/db/schema";
import { eq, and, ilike, or } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface CreateWarehouseRequest {
  code: string;
  name: string;
  address?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * GET /api/master/warehouses
 * List warehouses with optional filters
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const url = new URL(req.url);

    const searchQuery = url.searchParams.get("q");
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 200);

    const conditions = [eq(warehouses.tenantId, tenantId)];

    if (searchQuery) {
      const searchPattern = `%${searchQuery}%`;
      conditions.push(
        or(
          ilike(warehouses.name, searchPattern),
          ilike(warehouses.code, searchPattern)
        )!
      );
    }

    const warehouseList = await db
      .select({
        id: warehouses.id,
        code: warehouses.code,
        name: warehouses.name,
        status: warehouses.status,
        createdAt: warehouses.createdAt,
      })
      .from(warehouses)
      .where(and(...conditions))
      .limit(limit);

    return NextResponse.json({ items: warehouseList });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/master/warehouses error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/master/warehouses
 * Create a new warehouse
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: CreateWarehouseRequest = await req.json();

    // Validate required fields
    if (!body.code || !body.name) {
      return NextResponse.json(
        { error: "code and name are required" },
        { status: 400 }
      );
    }

    // Check code uniqueness
    const [existingCode] = await db
      .select({ id: warehouses.id })
      .from(warehouses)
      .where(and(eq(warehouses.tenantId, tenantId), eq(warehouses.code, body.code)));

    if (existingCode) {
      return NextResponse.json(
        { error: `Warehouse code '${body.code}' already exists` },
        { status: 409 }
      );
    }

    // Create warehouse
    const [warehouse] = await db
      .insert(warehouses)
      .values({
        tenantId,
        code: body.code,
        name: body.name,
        address: body.address ?? {},
        metadata: body.metadata ?? {},
        createdByActorId: actor.actorId,
      })
      .returning();

    await audit.log("warehouse", warehouse.id, "warehouse_created", {
      code: body.code,
      name: body.name,
    });

    return NextResponse.json({ warehouseId: warehouse.id }, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/master/warehouses error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
