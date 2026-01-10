/**
 * /api/people/leave-requests/[id]
 *
 * Individual leave request operations - view, approve, reject, cancel
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  leaveRequests,
  leaveTypes,
  employees,
  people,
  users,
  aiTasks,
  employeeLeaveBalances,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

type LeaveRequestStatus = "pending" | "approved" | "rejected" | "cancelled" | "taken";

interface UpdateLeaveRequestRequest {
  status?: LeaveRequestStatus;
  rejectionReason?: string;
  notes?: string;
}

function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * GET /api/people/leave-requests/[id]
 * Get single leave request with details
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await params;

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });
    }

    const [request] = await db
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
        approvedByUserId: leaveRequests.approvedByUserId,
        approvedAt: leaveRequests.approvedAt,
        rejectionReason: leaveRequests.rejectionReason,
        affectsPayroll: leaveRequests.affectsPayroll,
        notes: leaveRequests.notes,
        createdAt: leaveRequests.createdAt,
        updatedAt: leaveRequests.updatedAt,
        // Joined fields
        leaveTypeName: leaveTypes.name,
        leaveTypeCode: leaveTypes.code,
        leaveTypeIsPaid: leaveTypes.isPaid,
        employeeName: people.fullName,
      })
      .from(leaveRequests)
      .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .innerJoin(employees, eq(leaveRequests.employeeId, employees.id))
      .innerJoin(people, eq(employees.personId, people.id))
      .where(and(eq(leaveRequests.tenantId, tenantId), eq(leaveRequests.id, id)));

    if (!request) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    // Get approver info if approved
    let approvedBy = null;
    if (request.approvedByUserId) {
      const [user] = await db
        .select({ fullName: users.fullName, email: users.email })
        .from(users)
        .where(eq(users.id, request.approvedByUserId));
      approvedBy = user;
    }

    return NextResponse.json({
      ...request,
      approvedBy,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/people/leave-requests/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/people/leave-requests/[id]
 * Update leave request - approve, reject, or cancel
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);
    const { id } = await params;

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });
    }

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    // Get existing request
    const [existing] = await db
      .select({
        id: leaveRequests.id,
        employeeId: leaveRequests.employeeId,
        leaveTypeId: leaveRequests.leaveTypeId,
        status: leaveRequests.status,
        daysRequested: leaveRequests.daysRequested,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
      })
      .from(leaveRequests)
      .where(and(eq(leaveRequests.tenantId, tenantId), eq(leaveRequests.id, id)));

    if (!existing) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    const body: UpdateLeaveRequestRequest = await req.json();
    const updateValues: Record<string, unknown> = { updatedAt: new Date() };

    if (body.notes !== undefined) {
      updateValues.notes = body.notes;
    }

    // Handle status transitions
    if (body.status && body.status !== existing.status) {
      const currentStatus = existing.status;
      const newStatus = body.status;

      // Validate status transitions
      const validTransitions: Record<string, string[]> = {
        pending: ["approved", "rejected", "cancelled"],
        approved: ["taken", "cancelled"],
        rejected: [], // Can't change from rejected
        cancelled: [], // Can't change from cancelled
        taken: [], // Can't change from taken
      };

      if (!validTransitions[currentStatus]?.includes(newStatus)) {
        return NextResponse.json(
          { error: `Cannot transition from '${currentStatus}' to '${newStatus}'` },
          { status: 400 }
        );
      }

      updateValues.status = newStatus;

      if (newStatus === "approved") {
        updateValues.approvedByUserId = userIdFromHeader;
        updateValues.approvedAt = new Date();
        updateValues.rejectionReason = null;

        // Update leave balance (deduct days)
        await updateLeaveBalance(
          tenantId,
          existing.employeeId,
          existing.leaveTypeId,
          existing.daysRequested,
          "deduct"
        );

        // Auto-resolve any pending AI tasks
        await db
          .update(aiTasks)
          .set({
            status: "approved",
            resolvedByActorId: actor.actorId,
            resolvedAt: new Date(),
            resolutionAction: "approved",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(aiTasks.tenantId, tenantId),
              eq(aiTasks.primaryEntityId, id),
              eq(aiTasks.taskType, "approve_leave_request"),
              eq(aiTasks.status, "pending")
            )
          );

        await audit.log("leave_request", id, "leave_request_approved", {
          daysRequested: existing.daysRequested,
          startDate: existing.startDate,
          endDate: existing.endDate,
        });
      } else if (newStatus === "rejected") {
        if (!body.rejectionReason) {
          return NextResponse.json(
            { error: "rejectionReason is required when rejecting a request" },
            { status: 400 }
          );
        }
        updateValues.rejectionReason = body.rejectionReason;
        updateValues.approvedByUserId = userIdFromHeader;
        updateValues.approvedAt = new Date();

        // Auto-resolve any pending AI tasks
        await db
          .update(aiTasks)
          .set({
            status: "rejected",
            resolvedByActorId: actor.actorId,
            resolvedAt: new Date(),
            resolutionAction: "rejected",
            resolutionNotes: body.rejectionReason,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(aiTasks.tenantId, tenantId),
              eq(aiTasks.primaryEntityId, id),
              eq(aiTasks.taskType, "approve_leave_request"),
              eq(aiTasks.status, "pending")
            )
          );

        await audit.log("leave_request", id, "leave_request_rejected", {
          rejectionReason: body.rejectionReason,
        });
      } else if (newStatus === "cancelled") {
        // If was approved, restore the balance
        if (currentStatus === "approved") {
          await updateLeaveBalance(
            tenantId,
            existing.employeeId,
            existing.leaveTypeId,
            existing.daysRequested,
            "add"
          );
        }

        // Auto-resolve any pending AI tasks
        await db
          .update(aiTasks)
          .set({
            status: "auto_resolved",
            resolvedAt: new Date(),
            resolutionNotes: "Request cancelled",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(aiTasks.tenantId, tenantId),
              eq(aiTasks.primaryEntityId, id),
              eq(aiTasks.taskType, "approve_leave_request"),
              eq(aiTasks.status, "pending")
            )
          );

        await audit.log("leave_request", id, "leave_request_cancelled", {});
      } else if (newStatus === "taken") {
        await audit.log("leave_request", id, "leave_request_created", {
          action: "marked_as_taken",
        });
      }
    }

    if (Object.keys(updateValues).length === 1) {
      // Only updatedAt
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const [updated] = await db
      .update(leaveRequests)
      .set(updateValues)
      .where(and(eq(leaveRequests.tenantId, tenantId), eq(leaveRequests.id, id)))
      .returning();

    return NextResponse.json({ leaveRequest: updated });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PATCH /api/people/leave-requests/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Update employee leave balance
 */
async function updateLeaveBalance(
  tenantId: string,
  employeeId: string,
  leaveTypeId: string,
  days: string,
  operation: "add" | "deduct"
): Promise<void> {
  // Get leave type code
  const [leaveType] = await db
    .select({ code: leaveTypes.code })
    .from(leaveTypes)
    .where(eq(leaveTypes.id, leaveTypeId));

  if (!leaveType) return;

  // Find existing balance
  const [balance] = await db
    .select()
    .from(employeeLeaveBalances)
    .where(
      and(
        eq(employeeLeaveBalances.tenantId, tenantId),
        eq(employeeLeaveBalances.employeeId, employeeId),
        eq(employeeLeaveBalances.leaveType, leaveType.code)
      )
    );

  const daysNum = parseFloat(days);
  const hoursChange = daysNum * 8; // Assuming 8-hour days

  if (balance) {
    const currentHours = parseFloat(balance.balanceHours || "0");
    const currentUsed = parseFloat(balance.usedYtd || "0");

    const newHours = operation === "deduct"
      ? currentHours - hoursChange
      : currentHours + hoursChange;

    const newUsed = operation === "deduct"
      ? currentUsed + hoursChange
      : Math.max(0, currentUsed - hoursChange);

    await db
      .update(employeeLeaveBalances)
      .set({
        balanceHours: newHours.toFixed(2),
        usedYtd: newUsed.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(employeeLeaveBalances.id, balance.id));
  }
  // If no balance exists, we don't create one - that should be done via HR setup
}

/**
 * DELETE /api/people/leave-requests/[id]
 * Delete a pending leave request
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);
    const { id } = await params;

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });
    }

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    // Only allow deleting pending requests
    const [existing] = await db
      .select({ id: leaveRequests.id, status: leaveRequests.status })
      .from(leaveRequests)
      .where(and(eq(leaveRequests.tenantId, tenantId), eq(leaveRequests.id, id)));

    if (!existing) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    if (existing.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending requests can be deleted" },
        { status: 400 }
      );
    }

    // Delete related AI tasks
    await db
      .delete(aiTasks)
      .where(
        and(
          eq(aiTasks.tenantId, tenantId),
          eq(aiTasks.primaryEntityId, id),
          eq(aiTasks.taskType, "approve_leave_request")
        )
      );

    // Delete the request
    await db
      .delete(leaveRequests)
      .where(and(eq(leaveRequests.tenantId, tenantId), eq(leaveRequests.id, id)));

    await audit.log("leave_request", id, "leave_request_cancelled", {
      action: "deleted",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("DELETE /api/people/leave-requests/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
