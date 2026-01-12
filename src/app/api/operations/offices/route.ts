import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { offices, users } from "@/db/schema";
import { eq, and, desc, ilike, or, count } from "drizzle-orm";
import { requireTenantIdFromHeaders, getActorIdFromHeaders, TenantError } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const whereConditions = [eq(offices.tenantId, tenantId)];

    if (status) {
      whereConditions.push(eq(offices.status, status as "active" | "inactive" | "closed"));
    }

    if (type) {
      whereConditions.push(eq(offices.type, type as "physical" | "virtual" | "hybrid"));
    }

    if (search) {
      whereConditions.push(
        or(
          ilike(offices.name, `%${search}%`),
          ilike(offices.code, `%${search}%`),
          ilike(offices.city, `%${search}%`)
        )!
      );
    }

    const [totalResult] = await db
      .select({ count: count() })
      .from(offices)
      .where(and(...whereConditions));

    const officeList = await db
      .select({
        id: offices.id,
        code: offices.code,
        name: offices.name,
        type: offices.type,
        status: offices.status,
        address: offices.address,
        city: offices.city,
        state: offices.state,
        postalCode: offices.postalCode,
        country: offices.country,
        capacity: offices.capacity,
        currentOccupancy: offices.currentOccupancy,
        managerId: offices.managerId,
        managerName: users.fullName,
        monthlyCost: offices.monthlyCost,
        currency: offices.currency,
        leaseStartDate: offices.leaseStartDate,
        leaseEndDate: offices.leaseEndDate,
        createdAt: offices.createdAt,
      })
      .from(offices)
      .leftJoin(users, eq(offices.managerId, users.id))
      .where(and(...whereConditions))
      .orderBy(desc(offices.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      offices: officeList,
      total: totalResult?.count || 0,
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error fetching offices:", error);
    return NextResponse.json({ error: "Failed to fetch offices" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const actorId = getActorIdFromHeaders(request);
    const body = await request.json();

    const {
      code,
      name,
      type = "physical",
      address,
      city,
      state,
      postalCode,
      country,
      capacity,
      managerId,
      monthlyCost,
      currency = "USD",
      leaseStartDate,
      leaseEndDate,
    } = body;

    if (!code || !name) {
      return NextResponse.json(
        { error: "Code and name are required" },
        { status: 400 }
      );
    }

    const [newOffice] = await db
      .insert(offices)
      .values({
        tenantId,
        code,
        name,
        type,
        status: "active",
        address,
        city,
        state,
        postalCode,
        country,
        capacity,
        currentOccupancy: 0,
        managerId,
        monthlyCost,
        currency,
        leaseStartDate,
        leaseEndDate,
        createdBy: actorId,
      })
      .returning();

    return NextResponse.json({ office: newOffice }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error creating office:", error);
    if (error instanceof Error && error.message.includes("unique")) {
      return NextResponse.json(
        { error: "Office code already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Failed to create office" }, { status: 500 });
  }
}
