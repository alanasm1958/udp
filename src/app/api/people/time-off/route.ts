/**
 * /api/people/time-off
 *
 * POST: Record time off for an employee
 */

import { NextRequest, NextResponse } from "next/server";
import {
  requireTenantIdFromHeaders,
  getActorIdFromHeaders,
  getUserIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext, logAuditEvent } from "@/lib/audit";

interface CreateTimeOffRequest {
  personId?: string;
  leaveType: "vacation" | "sick" | "personal" | "other";
  startDate: string;
  endDate: string;
  notes?: string;
}

/**
 * POST /api/people/time-off
 * Record time off for an employee
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const actorIdHeader = getActorIdFromHeaders(req);
    const userIdHeader = getUserIdFromHeaders(req);
    const { actorId } = await resolveActor(tenantId, actorIdHeader, userIdHeader);
    const ctx = createAuditContext(tenantId, actorId);

    const body: CreateTimeOffRequest = await req.json();
    const { personId, leaveType, startDate, endDate, notes } = body;

    // Validate required fields
    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Calculate duration
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (days < 1) {
      return NextResponse.json({ error: "End date must be on or after start date" }, { status: 400 });
    }

    // Log audit event
    await logAuditEvent({
      ...ctx,
      action: "time_off_recorded",
      entityType: "person",
      entityId: personId || actorId,
      metadata: {
        leaveType,
        startDate,
        endDate,
        days,
        notes,
      },
    });

    return NextResponse.json({
      success: true,
      timeOff: {
        personId,
        leaveType,
        startDate,
        endDate,
        days,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/people/time-off error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
