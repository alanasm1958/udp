/**
 * /api/people/leave-requests
 *
 * Submit and list leave requests
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leaveRequests, leaveTypes, employees, people, aiTasks } from "@/db/schema";
import { eq, and, desc, sql, gte, lte, or } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";
import crypto from "crypto";

type LeaveRequestStatus = "pending" | "approved" | "rejected" | "cancelled" | "taken";

interface CreateLeaveRequestRequest {
  employeeId: string;
  leaveTypeId: string;
  startDate: string; // ISO date
  endDate: string;   // ISO date
  daysRequested: string;
  halfDayStart?: boolean;
  halfDayEnd?: boolean;
  reason?: string;
  notes?: string;
}

function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * GET /api/people/leave-requests
 * List leave requests with filters
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const url = new URL(req.url);

    const employeeId = url.searchParams.get("employeeId");
    const status = url.searchParams.get("status");
    const startDateFrom = url.searchParams.get("startDateFrom");
    const startDateTo = url.searchParams.get("startDateTo");
    const pending = url.searchParams.get("pending");
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 200);

    const conditions = [eq(leaveRequests.tenantId, tenantId)];

    if (employeeId && isValidUuid(employeeId)) {
      conditions.push(eq(leaveRequests.employeeId, employeeId));
    }

    if (status) {
      conditions.push(eq(leaveRequests.status, status as LeaveRequestStatus));
    }

    if (pending === "true") {
      conditions.push(eq(leaveRequests.status, "pending"));
    }

    if (startDateFrom) {
      conditions.push(gte(leaveRequests.startDate, startDateFrom));
    }

    if (startDateTo) {
      conditions.push(lte(leaveRequests.startDate, startDateTo));
    }

    const requests = await db
      .select({
        id: leaveRequests.id,
        employeeId: leaveRequests.employeeId,
        leaveTypeId: leaveRequests.leaveTypeId,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        daysRequested: leaveRequests.daysRequested,
        halfDayStart: leaveRequests.halfDayStart,
        halfDayEnd: leaveRequests.halfDayEnd,
        reason: leaveRequests.reason,
        status: leaveRequests.status,
        approvedAt: leaveRequests.approvedAt,
        rejectionReason: leaveRequests.rejectionReason,
        affectsPayroll: leaveRequests.affectsPayroll,
        notes: leaveRequests.notes,
        createdAt: leaveRequests.createdAt,
        // Joined fields
        leaveTypeName: leaveTypes.name,
        leaveTypeCode: leaveTypes.code,
        employeeName: people.fullName,
      })
      .from(leaveRequests)
      .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .innerJoin(employees, eq(leaveRequests.employeeId, employees.id))
      .innerJoin(people, eq(employees.personId, people.id))
      .where(and(...conditions))
      .orderBy(desc(leaveRequests.createdAt))
      .limit(limit);

    return NextResponse.json({ items: requests });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/people/leave-requests error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/people/leave-requests
 * Submit a new leave request
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    const body: CreateLeaveRequestRequest = await req.json();

    // Validate required fields
    if (!body.employeeId || !body.leaveTypeId || !body.startDate || !body.endDate || !body.daysRequested) {
      return NextResponse.json(
        { error: "employeeId, leaveTypeId, startDate, endDate, and daysRequested are required" },
        { status: 400 }
      );
    }

    if (!isValidUuid(body.employeeId) || !isValidUuid(body.leaveTypeId)) {
      return NextResponse.json({ error: "Invalid UUID format" }, { status: 400 });
    }

    // Validate dates
    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }
    if (endDate < startDate) {
      return NextResponse.json({ error: "endDate cannot be before startDate" }, { status: 400 });
    }

    // Verify employee exists
    const [employee] = await db
      .select({
        id: employees.id,
        personId: employees.personId,
        managerEmployeeId: employees.managerEmployeeId,
      })
      .from(employees)
      .where(and(eq(employees.tenantId, tenantId), eq(employees.id, body.employeeId)));

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // Verify leave type exists
    const [leaveType] = await db
      .select({
        id: leaveTypes.id,
        name: leaveTypes.name,
        requiresApproval: leaveTypes.requiresApproval,
        isPaid: leaveTypes.isPaid,
      })
      .from(leaveTypes)
      .where(
        and(
          eq(leaveTypes.tenantId, tenantId),
          eq(leaveTypes.id, body.leaveTypeId),
          eq(leaveTypes.isActive, true)
        )
      );

    if (!leaveType) {
      return NextResponse.json({ error: "Leave type not found or inactive" }, { status: 404 });
    }

    // Check for overlapping requests
    const overlapping = await db
      .select({ id: leaveRequests.id })
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.tenantId, tenantId),
          eq(leaveRequests.employeeId, body.employeeId),
          or(
            eq(leaveRequests.status, "pending"),
            eq(leaveRequests.status, "approved")
          ),
          // Date overlap check
          sql`(${leaveRequests.startDate}, ${leaveRequests.endDate}) OVERLAPS (${body.startDate}::date, ${body.endDate}::date)`
        )
      )
      .limit(1);

    if (overlapping.length > 0) {
      return NextResponse.json(
        { error: "Leave request overlaps with an existing pending or approved request" },
        { status: 409 }
      );
    }

    // Get employee name for tasks
    const [person] = await db
      .select({ fullName: people.fullName })
      .from(people)
      .where(eq(people.id, employee.personId));

    // Create leave request
    const initialStatus = leaveType.requiresApproval ? "pending" : "approved";

    const [request] = await db
      .insert(leaveRequests)
      .values({
        tenantId,
        employeeId: body.employeeId,
        leaveTypeId: body.leaveTypeId,
        startDate: body.startDate,
        endDate: body.endDate,
        daysRequested: body.daysRequested,
        halfDayStart: body.halfDayStart ?? false,
        halfDayEnd: body.halfDayEnd ?? false,
        reason: body.reason ?? null,
        status: initialStatus,
        affectsPayroll: leaveType.isPaid,
        notes: body.notes ?? null,
        createdByActorId: actor.actorId,
        approvedAt: !leaveType.requiresApproval ? new Date() : null,
      })
      .returning();

    await audit.log("leave_request", request.id, "leave_request_created", {
      employeeId: body.employeeId,
      leaveType: leaveType.name,
      startDate: body.startDate,
      endDate: body.endDate,
      daysRequested: body.daysRequested,
      status: initialStatus,
    });

    // Create AI task for manager approval if required
    if (leaveType.requiresApproval && employee.managerEmployeeId) {
      const triggerHash = crypto
        .createHash("md5")
        .update(`leave_approval_${request.id}`)
        .digest("hex");

      await db.insert(aiTasks).values({
        tenantId,
        taskType: "approve_leave_request",
        status: "pending",
        title: `Approve leave request: ${person?.fullName || "Employee"}`,
        description: `${leaveType.name} request for ${body.daysRequested} days (${body.startDate} to ${body.endDate})`,
        reasoning: body.reason || "Leave request submitted",
        primaryEntityType: "leave_request",
        primaryEntityId: request.id,
        secondaryEntityType: "employee",
        secondaryEntityId: body.employeeId,
        suggestedAction: { action: "approve_leave", requestId: request.id },
        priority: "normal",
        triggerHash,
        createdByActorId: actor.actorId,
      });
    }

    return NextResponse.json(
      {
        leaveRequestId: request.id,
        status: initialStatus,
        requiresApproval: leaveType.requiresApproval,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/people/leave-requests error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
