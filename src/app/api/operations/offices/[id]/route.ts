import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { offices, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const { id } = await params;

    const [office] = await db
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
        metadata: offices.metadata,
        createdAt: offices.createdAt,
        updatedAt: offices.updatedAt,
      })
      .from(offices)
      .leftJoin(users, eq(offices.managerId, users.id))
      .where(and(eq(offices.tenantId, tenantId), eq(offices.id, id)));

    if (!office) {
      return NextResponse.json({ error: "Office not found" }, { status: 404 });
    }

    return NextResponse.json({ office });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error fetching office:", error);
    return NextResponse.json({ error: "Failed to fetch office" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const { id } = await params;
    const body = await request.json();

    const {
      code,
      name,
      type,
      status,
      address,
      city,
      state,
      postalCode,
      country,
      capacity,
      currentOccupancy,
      managerId,
      monthlyCost,
      currency,
      leaseStartDate,
      leaseEndDate,
    } = body;

    const updateData: Record<string, unknown> = {};
    if (code !== undefined) updateData.code = code;
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (status !== undefined) updateData.status = status;
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (postalCode !== undefined) updateData.postalCode = postalCode;
    if (country !== undefined) updateData.country = country;
    if (capacity !== undefined) updateData.capacity = capacity;
    if (currentOccupancy !== undefined) updateData.currentOccupancy = currentOccupancy;
    if (managerId !== undefined) updateData.managerId = managerId;
    if (monthlyCost !== undefined) updateData.monthlyCost = monthlyCost;
    if (currency !== undefined) updateData.currency = currency;
    if (leaseStartDate !== undefined) updateData.leaseStartDate = leaseStartDate;
    if (leaseEndDate !== undefined) updateData.leaseEndDate = leaseEndDate;

    updateData.updatedAt = new Date();

    const [updatedOffice] = await db
      .update(offices)
      .set(updateData)
      .where(and(eq(offices.tenantId, tenantId), eq(offices.id, id)))
      .returning();

    if (!updatedOffice) {
      return NextResponse.json({ error: "Office not found" }, { status: 404 });
    }

    return NextResponse.json({ office: updatedOffice });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error updating office:", error);
    return NextResponse.json({ error: "Failed to update office" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const { id } = await params;

    // Soft delete by setting status to closed
    const [updatedOffice] = await db
      .update(offices)
      .set({ status: "closed", updatedAt: new Date() })
      .where(and(eq(offices.tenantId, tenantId), eq(offices.id, id)))
      .returning();

    if (!updatedOffice) {
      return NextResponse.json({ error: "Office not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, office: updatedOffice });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error deleting office:", error);
    return NextResponse.json({ error: "Failed to delete office" }, { status: 500 });
  }
}
