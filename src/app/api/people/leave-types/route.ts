/**
 * /api/people/leave-types
 *
 * Manage leave types (vacation, sick, personal, etc.)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leaveTypes } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

type AccrualType = "manual" | "monthly" | "annual" | "per_period";

interface CreateLeaveTypeRequest {
  code: string;
  name: string;
  description?: string;
  accrualType?: AccrualType;
  defaultAnnualAllowance?: string;
  maxCarryoverDays?: string;
  requiresApproval?: boolean;
  isPaid?: boolean;
}

interface UpdateLeaveTypeRequest {
  name?: string;
  description?: string;
  accrualType?: AccrualType;
  defaultAnnualAllowance?: string | null;
  maxCarryoverDays?: string | null;
  requiresApproval?: boolean;
  isPaid?: boolean;
  isActive?: boolean;
}

/**
 * GET /api/people/leave-types
 * List leave types
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const url = new URL(req.url);

    const activeOnly = url.searchParams.get("activeOnly") !== "false";

    const conditions = [eq(leaveTypes.tenantId, tenantId)];
    if (activeOnly) {
      conditions.push(eq(leaveTypes.isActive, true));
    }

    const types = await db
      .select({
        id: leaveTypes.id,
        code: leaveTypes.code,
        name: leaveTypes.name,
        description: leaveTypes.description,
        accrualType: leaveTypes.accrualType,
        defaultAnnualAllowance: leaveTypes.defaultAnnualAllowance,
        maxCarryoverDays: leaveTypes.maxCarryoverDays,
        requiresApproval: leaveTypes.requiresApproval,
        isPaid: leaveTypes.isPaid,
        isActive: leaveTypes.isActive,
        createdAt: leaveTypes.createdAt,
      })
      .from(leaveTypes)
      .where(and(...conditions))
      .orderBy(leaveTypes.name);

    return NextResponse.json({ items: types });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/people/leave-types error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/people/leave-types
 * Create a new leave type
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: CreateLeaveTypeRequest = await req.json();

    // Validate required fields
    if (!body.code || !body.name) {
      return NextResponse.json(
        { error: "code and name are required" },
        { status: 400 }
      );
    }

    // Check for duplicate code
    const existing = await db
      .select({ id: leaveTypes.id })
      .from(leaveTypes)
      .where(and(eq(leaveTypes.tenantId, tenantId), eq(leaveTypes.code, body.code)))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: `Leave type with code '${body.code}' already exists` },
        { status: 409 }
      );
    }

    const [leaveType] = await db
      .insert(leaveTypes)
      .values({
        tenantId,
        code: body.code,
        name: body.name,
        description: body.description ?? null,
        accrualType: body.accrualType ?? "manual",
        defaultAnnualAllowance: body.defaultAnnualAllowance ?? null,
        maxCarryoverDays: body.maxCarryoverDays ?? null,
        requiresApproval: body.requiresApproval ?? true,
        isPaid: body.isPaid ?? true,
        isActive: true,
      })
      .returning();

    await audit.log("leave_type", leaveType.id, "leave_type_created", {
      code: body.code,
      name: body.name,
    });

    return NextResponse.json({ leaveTypeId: leaveType.id }, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/people/leave-types error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/people/leave-types
 * Update a leave type (pass id in body)
 */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: UpdateLeaveTypeRequest & { id: string } = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Verify exists
    const [existing] = await db
      .select({ id: leaveTypes.id })
      .from(leaveTypes)
      .where(and(eq(leaveTypes.tenantId, tenantId), eq(leaveTypes.id, body.id)));

    if (!existing) {
      return NextResponse.json({ error: "Leave type not found" }, { status: 404 });
    }

    const updateValues: Record<string, unknown> = { updatedAt: new Date() };

    if (body.name !== undefined) updateValues.name = body.name;
    if (body.description !== undefined) updateValues.description = body.description;
    if (body.accrualType !== undefined) updateValues.accrualType = body.accrualType;
    if (body.defaultAnnualAllowance !== undefined) updateValues.defaultAnnualAllowance = body.defaultAnnualAllowance;
    if (body.maxCarryoverDays !== undefined) updateValues.maxCarryoverDays = body.maxCarryoverDays;
    if (body.requiresApproval !== undefined) updateValues.requiresApproval = body.requiresApproval;
    if (body.isPaid !== undefined) updateValues.isPaid = body.isPaid;
    if (body.isActive !== undefined) updateValues.isActive = body.isActive;

    const [updated] = await db
      .update(leaveTypes)
      .set(updateValues)
      .where(and(eq(leaveTypes.tenantId, tenantId), eq(leaveTypes.id, body.id)))
      .returning();

    await audit.log("leave_type", body.id, "leave_type_updated", updateValues);

    return NextResponse.json({ leaveType: updated });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/people/leave-types error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
