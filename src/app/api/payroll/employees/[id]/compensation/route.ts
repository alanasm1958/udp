/**
 * /api/payroll/employees/[id]/compensation
 *
 * Manage employee compensation records.
 * Compensation changes are effective-dated for audit trail.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { employees, compensationRecords, people } from "@/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";
import { createAuditContext } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * GET /api/payroll/employees/[id]/compensation
 * Get compensation history for an employee
 */
export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id: employeeId } = await params;

    if (!isValidUuid(employeeId)) {
      return NextResponse.json({ error: "Invalid employee ID format" }, { status: 400 });
    }

    // Verify employee exists
    const [employee] = await db
      .select({ id: employees.id, employeeNumber: employees.employeeNumber })
      .from(employees)
      .where(and(eq(employees.tenantId, tenantId), eq(employees.id, employeeId)));

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // Get all compensation records
    const records = await db
      .select({
        id: compensationRecords.id,
        effectiveFrom: compensationRecords.effectiveFrom,
        effectiveTo: compensationRecords.effectiveTo,
        payType: compensationRecords.payType,
        payRate: compensationRecords.payRate,
        payFrequency: compensationRecords.payFrequency,
        commissionRate: compensationRecords.commissionRate,
        commissionBasis: compensationRecords.commissionBasis,
        standardHoursPerWeek: compensationRecords.standardHoursPerWeek,
        changeReason: compensationRecords.changeReason,
        changeNotes: compensationRecords.changeNotes,
        createdAt: compensationRecords.createdAt,
      })
      .from(compensationRecords)
      .where(
        and(
          eq(compensationRecords.tenantId, tenantId),
          eq(compensationRecords.employeeId, employeeId)
        )
      )
      .orderBy(desc(compensationRecords.effectiveFrom));

    // Identify current compensation (no effectiveTo)
    const current = records.find((r) => r.effectiveTo === null);

    return NextResponse.json({
      employeeId,
      employeeNumber: employee.employeeNumber,
      currentCompensation: current || null,
      history: records,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/payroll/employees/[id]/compensation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

interface CreateCompensationRequest {
  effectiveFrom: string;
  payType: "salary" | "hourly" | "commission";
  payRate: string;
  payFrequency: "weekly" | "biweekly" | "semimonthly" | "monthly";
  commissionRate?: string;
  commissionBasis?: string;
  standardHoursPerWeek?: string;
  changeReason: "hire" | "promotion" | "annual_review" | "adjustment" | "demotion" | "transfer";
  changeNotes?: string;
}

/**
 * POST /api/payroll/employees/[id]/compensation
 * Create a new compensation record (ends any current open record)
 */
export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);
    const { id: employeeId } = await params;

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);
    const audit = createAuditContext(tenantId, actor.actorId);

    if (!isValidUuid(employeeId)) {
      return NextResponse.json({ error: "Invalid employee ID format" }, { status: 400 });
    }

    // Verify employee exists and is active
    const [employee] = await db
      .select({
        id: employees.id,
        employeeNumber: employees.employeeNumber,
        employmentStatus: employees.employmentStatus,
        personId: employees.personId,
      })
      .from(employees)
      .where(and(eq(employees.tenantId, tenantId), eq(employees.id, employeeId)));

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    if (employee.employmentStatus === "terminated") {
      return NextResponse.json(
        { error: "Cannot add compensation for terminated employee" },
        { status: 400 }
      );
    }

    const body: CreateCompensationRequest = await req.json();

    // Validate required fields
    if (!body.effectiveFrom) {
      return NextResponse.json({ error: "effectiveFrom is required" }, { status: 400 });
    }
    if (!body.payType) {
      return NextResponse.json({ error: "payType is required" }, { status: 400 });
    }
    if (!body.payRate) {
      return NextResponse.json({ error: "payRate is required" }, { status: 400 });
    }
    if (!body.payFrequency) {
      return NextResponse.json({ error: "payFrequency is required" }, { status: 400 });
    }
    if (!body.changeReason) {
      return NextResponse.json({ error: "changeReason is required" }, { status: 400 });
    }

    // Validate pay rate is numeric
    const payRate = parseFloat(body.payRate);
    if (isNaN(payRate) || payRate < 0) {
      return NextResponse.json({ error: "payRate must be a positive number" }, { status: 400 });
    }

    // Commission rate validation for commission pay type
    if (body.payType === "commission") {
      if (!body.commissionRate) {
        return NextResponse.json(
          { error: "commissionRate is required for commission pay type" },
          { status: 400 }
        );
      }
    }

    // End any current open compensation record
    const effectiveFromDate = new Date(body.effectiveFrom);
    const dayBefore = new Date(effectiveFromDate);
    dayBefore.setDate(dayBefore.getDate() - 1);

    await db
      .update(compensationRecords)
      .set({
        effectiveTo: dayBefore.toISOString().split("T")[0],
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(compensationRecords.tenantId, tenantId),
          eq(compensationRecords.employeeId, employeeId),
          isNull(compensationRecords.effectiveTo)
        )
      );

    // Create new compensation record
    const [newRecord] = await db
      .insert(compensationRecords)
      .values({
        tenantId,
        employeeId,
        effectiveFrom: body.effectiveFrom,
        effectiveTo: null,
        payType: body.payType,
        payRate: body.payRate,
        payFrequency: body.payFrequency,
        commissionRate: body.commissionRate ?? null,
        commissionBasis: body.commissionBasis ?? null,
        standardHoursPerWeek: body.standardHoursPerWeek ?? "40.00",
        changeReason: body.changeReason,
        changeNotes: body.changeNotes ?? null,
        createdByActorId: actor.actorId,
      })
      .returning();

    // Get person name for audit
    const [person] = await db
      .select({ fullName: people.fullName })
      .from(people)
      .where(eq(people.id, employee.personId));

    await audit.log("employee", employeeId, "compensation_created", {
      compensationId: newRecord.id,
      employeeNumber: employee.employeeNumber,
      personName: person?.fullName,
      payType: body.payType,
      payRate: body.payRate,
      payFrequency: body.payFrequency,
      changeReason: body.changeReason,
      effectiveFrom: body.effectiveFrom,
    });

    return NextResponse.json(
      { compensationId: newRecord.id, effectiveFrom: body.effectiveFrom },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/payroll/employees/[id]/compensation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
